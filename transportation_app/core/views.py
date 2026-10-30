import logging
from datetime import datetime, time, timedelta
from decimal import Decimal
import json
import mimetypes
from smtplib import (
    SMTPAuthenticationError,
    SMTPConnectError,
    SMTPException,
    SMTPRecipientsRefused,
    SMTPSenderRefused,
    SMTPServerDisconnected,
)
from urllib.parse import urlsplit

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import EmailMultiAlternatives
from django.core.mail.exceptions import InvalidMailer
from django.core.serializers.json import DjangoJSONEncoder
from django.db import DatabaseError, IntegrityError, connection, transaction
from django.db.models import (
    Count,
    F,
    Func,
    IntegerField,
    OuterRef,
    Prefetch,
    ProtectedError,
    Q,
    QuerySet,
    Subquery,
    Value,
)
from django.db.models.functions import Coalesce
from django.http import FileResponse
from pathlib import Path
from django.template.loader import render_to_string
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils import translation
from .cache import get_or_set
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes, throttle_scope
from rest_framework.exceptions import APIException, NotFound, PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.renderers import BaseRenderer
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.settings import api_settings
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .dependencies import get_trip_service
from .analytics import build_analytics_dashboard
from .models import (
    AuditLog,
    Booking,
    BookingSeat,
    Complaint,
    Driver,
    DriverDocument,
    EmailOutbox,
    FareRule,
    EmailVerificationCode,
    Notification,
    OperationalSetting,
    Payment,
    PrivateRide,
    Route,
    RouteStation,
    Station,
    Trip,
    User,
    Vehicle,
)
from .validations import (
    VerifiedEmailTokenRefreshSerializer,
    VerifiedEmailTokenSerializer,
    raise_protected_deletion_error,
    validate_active_booking_limit,
    validate_assignment_window,
    validate_bookable_trip,
    validate_booking_cancellation,
    validate_booking_capacity,
    validate_booking_seats,
    validate_booking_stops,
    validate_complaint_booking_trip,
    validate_driver_approval,
    validate_driver_deletion,
    validate_driver_trip_vehicle,
    validate_email_verification_result,
    validate_idempotency_key,
    validate_new_password,
    validate_notification_update,
    validate_operational_setting_value,
    validate_passenger_filter,
    validate_private_ride_accept,
    validate_private_ride_cancellation,
    validate_private_ride_rejection,
    validate_refresh_token,
    validate_reset_code,
    validate_reset_result,
    validate_search_date,
    validate_trip_deletion,
    validate_trip_status_transition,
    validate_user_status_target,
    validate_vehicle_deletion,
)


class OptionalPageNumberPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        if 'page' not in request.query_params and 'page_size' not in request.query_params:
            return None
        return super().paginate_queryset(queryset, request, view)


def _list_response(
    request: Request,
    queryset: QuerySet,
    serializer_class: type[serializers.BaseSerializer],
) -> Response:
    paginator = OptionalPageNumberPagination()
    page = paginator.paginate_queryset(queryset, request)
    if page is None:
        return Response(serializer_class(queryset, many=True, context={'request': request}).data)
    return paginator.get_paginated_response(
        serializer_class(page, many=True, context={'request': request}).data
    )


def _list_response_for_items(
    request: Request,
    items: list,
    serializer_class: type[serializers.BaseSerializer],
) -> Response:
    paginator = OptionalPageNumberPagination()
    page = paginator.paginate_queryset(items, request)
    if page is None:
        return Response(serializer_class(items, many=True, context={'request': request}).data)
    return paginator.get_paginated_response(
        serializer_class(page, many=True, context={'request': request}).data
    )
from .serializers import (
    AuditLogSerializer,
    BookingCreateSerializer,
    BookingSerializer,
    DriverSerializer,
    DriverDocumentSerializer,
    DriverDocumentReviewSerializer,
    DriverVerificationSerializer,
    EmailVerificationSerializer,
    ComplaintSerializer,
    ComplaintUpdateSerializer,
    FareRuleSerializer,
    ForgotPasswordSerializer,
    NotificationSerializer,
    OperationalSettingSerializer,
    PaymentSerializer,
    PrivateRideSerializer,
    RouteSerializer,
    RouteStationSerializer,
    ResetPasswordSerializer,
    StationSerializer,
    TripSearchSerializer,
    TripSerializer,
    UserAccountStatusSerializer,
    UserDetailSerializer,
    UserRegistrationSerializer,
    UserSerializer,
    VehicleSerializer,
)


logger = logging.getLogger(__name__)
PASSWORD_RESET_GENERIC_RESPONSE = (
    'If an account exists and email delivery succeeds, a reset code will be sent. '
    'If you do not receive it, check your spam folder or try again later.'
)


class PasswordResetRequestThrottle(ScopedRateThrottle):
    scope = 'password_reset_request'

    def get_rate(self):
        try:
            return api_settings.DEFAULT_THROTTLE_RATES[self.scope]
        except KeyError as error:
            raise ImproperlyConfigured(
                f'No default throttle rate set for {self.scope!r}.'
            ) from error


class PasswordResetSubmitThrottle(ScopedRateThrottle):
    scope = 'password_reset_submit'

    def get_rate(self):
        try:
            return api_settings.DEFAULT_THROTTLE_RATES[self.scope]
        except KeyError as error:
            raise ImproperlyConfigured(
                f'No default throttle rate set for {self.scope!r}.'
            ) from error


class LoginThrottle(ScopedRateThrottle):
    scope = 'login'

    def get_rate(self):
        return api_settings.DEFAULT_THROTTLE_RATES[self.scope]


class RegistrationThrottle(ScopedRateThrottle):
    scope = 'registration'

    def get_rate(self):
        return api_settings.DEFAULT_THROTTLE_RATES[self.scope]


class EmailVerificationThrottle(ScopedRateThrottle):
    scope = 'email_verification'

    def get_rate(self):
        return api_settings.DEFAULT_THROTTLE_RATES[self.scope]


class EmailVerificationDeliveryError(Exception):
    pass


class LoginTokenObtainPairView(TokenObtainPairView):
    serializer_class = VerifiedEmailTokenSerializer
    throttle_classes = (LoginThrottle,)
    throttle_scope = 'login'
from .services.trip_service import StationsNotFoundError
from .services.email_verification import (
    check_verification_code,
    generate_verification_code,
    hash_verification_code,
)
def _collection_api(
    request: Request,
    queryset: QuerySet,
    serializer_class: type[serializers.BaseSerializer],
) -> Response:
    if request.method == "GET":
        return _list_response(request, queryset, serializer_class)

    serializer = serializer_class(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        instance = serializer.save()
        if _is_admin(request.user):
            _write_audit(
                request,
                f'{instance._meta.label_lower}.created',
                instance,
                {'after': _audit_snapshot(instance)},
            )
    return Response(serializer.data, status=status.HTTP_201_CREATED)


def _is_admin(user) -> bool:
    return user.role in ('admin', 'authority')


def _operational_int(key: str, fallback: int) -> int:
    value = OperationalSetting.objects.filter(key=key).values_list('value', flat=True).first()
    if value is None:
        return fallback
    try:
        return int(value)
    except ValueError as error:
        raise ImproperlyConfigured(
            f'Operational setting {key!r} must contain an integer.'
        ) from error


def _write_audit(
    request: Request,
    action: str,
    instance,
    details: dict | None = None,
    object_id: int | str | None = None,
) -> None:
    AuditLog.objects.create(
        actor=request.user if request.user.is_authenticated else None,
        action=action,
        object_type=instance.__class__.__name__,
        object_id=str(instance.pk if object_id is None else object_id),
        ip_address=request.META.get('REMOTE_ADDR'),
        details=json.loads(json.dumps(details or {}, cls=DjangoJSONEncoder)),
    )


def _audit_snapshot(instance) -> dict:
    excluded_fields = {'password', 'provider_payload', 'file'}
    return {
        field.name: getattr(instance, field.attname)
        for field in instance._meta.concrete_fields
        if field.name not in excluded_fields
    }


def _require_admin(user) -> None:
    if not _is_admin(user):
        raise PermissionDenied('Administrator access is required.')


def _require_role(user, *roles: str) -> None:
    if _is_admin(user):
        return
    if user.role not in roles:
        raise PermissionDenied('You do not have permission to perform this action.')


def _lock_assignment_resources(driver_ids, vehicle_ids) -> None:
    try:
        normalized_driver_ids = {int(value) for value in driver_ids if value not in (None, '')}
        normalized_vehicle_ids = {int(value) for value in vehicle_ids if value not in (None, '')}
    except (TypeError, ValueError):
        return
    list(
        Driver.objects.select_for_update()
        .filter(pk__in=normalized_driver_ids)
        .order_by('pk')
    )
    list(
        Vehicle.objects.select_for_update()
        .filter(pk__in=normalized_vehicle_ids)
        .order_by('pk')
    )


def _lock_trip_assets(trip: Trip) -> None:
    if trip.driver_id:
        trip.driver = get_object_or_404(
            Driver.objects.select_for_update(),
            pk=trip.driver_id,
        )
    if trip.vehicle_id:
        trip.vehicle = get_object_or_404(
            Vehicle.objects.select_for_update(),
            pk=trip.vehicle_id,
        )


def _bookable_trips() -> QuerySet:
    disabled_seat_count_function = (
        'jsonb_array_length' if connection.vendor == 'postgresql' else 'json_array_length'
    )
    queryset = _trip_queryset().filter(
        is_published=True,
        route__status__iexact='active',
        start_station__is_active=True,
        destination_station__is_active=True,
        driver__status='active',
        driver__verification_status='approved',
        driver__user__is_active=True,
        vehicle__status='active',
        status='scheduled',
        departure_time__gt=timezone.now(),
    ).annotate(
        disabled_seat_count=Coalesce(
            Func(
                F('vehicle__disabled_seats'),
                function=disabled_seat_count_function,
                output_field=IntegerField(),
            ),
            Value(0),
        ),
    ).filter(
        active_seat_count__lt=F('vehicle__capacity') - F('disabled_seat_count'),
    )
    return queryset


def _detail_api(
    request: Request,
    queryset: QuerySet,
    serializer_class: type[serializers.BaseSerializer],
    resource_id: int,
) -> Response:
    instance = get_object_or_404(queryset, pk=resource_id)

    if request.method == "GET":
        return Response(serializer_class(instance).data)
    if request.method == "DELETE":
        before = _audit_snapshot(instance)
        try:
            with transaction.atomic():
                instance.delete()
                if _is_admin(request.user):
                    _write_audit(
                        request,
                        f'{instance._meta.label_lower}.deleted',
                        instance,
                        {'before': before},
                        object_id=before['id'],
                    )
        except ProtectedError as exc:
            raise_protected_deletion_error(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)

    before = _audit_snapshot(instance)
    serializer = serializer_class(
        instance,
        data=request.data,
        partial=request.method == "PATCH",
    )
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        instance = serializer.save()
        if _is_admin(request.user):
            _write_audit(
                request,
                f'{instance._meta.label_lower}.updated',
                instance,
                {
                    'before': before,
                    'after': _audit_snapshot(instance),
                },
            )
    return Response(serializer.data)


def _trip_queryset() -> QuerySet:
    return Trip.objects.select_related(
        "route",
        "vehicle",
        "driver__user",
        "start_station",
        "destination_station",
        "created_by",
    ).annotate(
        active_seat_count=Count(
            'booked_seats',
            filter=Q(booked_seats__is_active=True),
        )
    )


def _booking_queryset() -> QuerySet:
    return Booking.objects.select_related('passenger').prefetch_related(
        Prefetch('trip', queryset=_trip_queryset()),
        'seats',
        Prefetch('payments', queryset=Payment.objects.order_by('pk'), to_attr='api_payments'),
    )


def _default_seat_layout(vehicle: Vehicle) -> list[list[int | None]]:
    capacity = max(vehicle.capacity, 1)
    if capacity <= 4:
        return [list(range(1, capacity + 1))]

    if capacity <= 8:
        seats_per_row = 2
    elif capacity <= 16:
        seats_per_row = 4
    elif capacity <= 28:
        seats_per_row = 5
    else:
        seats_per_row = 6

    rows: list[list[int | None]] = []
    seat_number = 1
    while seat_number <= capacity:
        row = list(range(seat_number, min(seat_number + seats_per_row, capacity + 1)))
        if len(row) == 1 and rows:
            rows[-1].append(row[0])
        else:
            rows.append(row)
        seat_number += len(row)
    return rows


def _available_seat_layout(vehicle: Vehicle) -> list[list[int | None]]:
    if vehicle.seat_layout:
        return vehicle.seat_layout
    return _default_seat_layout(vehicle)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def api_root(request: Request, format: str | None = None) -> Response:
    resources = (
        ("me", "current-user"),
        ("analytics", "analytics-dashboard"),
        ("users", "user-list"),
        ("assignment-drivers", "assignment-drivers"),
        ("assignment-vehicles", "assignment-vehicles"),
        ("stations", "station-list"),
        ("routes", "route-list"),
        ("route-stations", "routestation-list"),
        ("vehicles", "vehicle-list"),
        ("drivers", "driver-list"),
        ("fare-rules", "farerule-list"),
        ("trips", "trip-list"),
        ("bookings", "booking-list"),
        ("payments", "payment-list"),
        ("notifications", "notification-list"),
        ("driver-documents", "driver-document-list"),
        ("private-rides", "private-ride-list"),
        ("complaints", "complaint-list"),
        ("operational-settings", "operational-settings"),
        ("audit-logs", "audit-log-list"),
    )
    return Response({
        resource: reverse(view_name, request=request, format=format)
        for resource, view_name in resources
    })


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([RegistrationThrottle])
@throttle_scope('registration')
def register(request: Request, format: str | None = None) -> Response:
    serializer = UserRegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    try:
        _send_email_verification(user, request.LANGUAGE_CODE)
    except EmailVerificationDeliveryError:
        logger.warning(
            'Email verification delivery failed for user_id=%s.',
            user.pk,
        )
        return Response(
            {
                'detail': (
                    'Your account was created, but the verification email could not be sent. '
                    'Request a new code to try again.'
                ),
                'code': 'verification_email_delivery_failed',
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response(
        {
            'detail': 'Account created. Check your email for the verification code.',
            'email': user.email,
        },
        status=status.HTTP_201_CREATED,
    )


def _send_email_verification(
    user: User,
    language_code: str,
    *,
    enforce_cooldown: bool = False,
) -> bool:
    code = generate_verification_code()
    with transaction.atomic():
        locked_user = User.objects.select_for_update().get(pk=user.pk)
        if locked_user.email_verified:
            return False

        now = timezone.now()
        if enforce_cooldown and EmailVerificationCode.objects.filter(
            user=locked_user,
            purpose='email_verification',
            created_at__gt=now - timedelta(seconds=60),
        ).exists():
            return False

        EmailVerificationCode.objects.filter(
            user=locked_user,
            purpose='email_verification',
            consumed_at__isnull=True,
        ).update(consumed_at=now)
        verification = EmailVerificationCode.objects.create(
            user=locked_user,
            purpose='email_verification',
            code_hash=hash_verification_code(locked_user.pk, code),
            expires_at=now + timedelta(minutes=5),
        )
        context = {
            'LANGUAGE_CODE': language_code,
            'code': code,
            'name': locked_user.first_name or locked_user.username,
        }
        with translation.override(language_code):
            subject = translation.gettext('Verify your Wasalni account')
            body = render_to_string(
                'core/email_verification.txt',
                context,
            ).strip()
            html_body = render_to_string(
                'core/email_verification.html',
                context,
            )
        message = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[locked_user.email],
        )
        message.attach_alternative(html_body, 'text/html')
        try:
            sent = message.send(fail_silently=False)
        except SMTPAuthenticationError as error:
            logger.error(
                'Verification email SMTP authentication failed for user_id=%s (SMTP %s).',
                locked_user.pk,
                error.smtp_code,
            )
            raise EmailVerificationDeliveryError from error
        except SMTPRecipientsRefused as error:
            address = locked_user.email
            local_part, separator, domain = address.partition('@')
            masked_address = (
                f'{local_part[:1]}***@{domain}' if separator else '[invalid address]'
            )
            logger.error(
                'Verification email recipient was rejected for user_id=%s recipient=%s.',
                locked_user.pk,
                masked_address,
            )
            raise EmailVerificationDeliveryError from error
        except (SMTPConnectError, SMTPServerDisconnected, OSError) as error:
            logger.error(
                'Verification email SMTP connection failed for user_id=%s (%s).',
                locked_user.pk,
                type(error).__name__,
            )
            raise EmailVerificationDeliveryError from error
        except (SMTPException, InvalidMailer) as error:
            logger.error(
                'Verification email delivery failed for user_id=%s (%s).',
                locked_user.pk,
                type(error).__name__,
            )
            raise EmailVerificationDeliveryError from error
        if sent != 1:
            logger.error(
                'Verification email backend accepted no messages for user_id=%s.',
                locked_user.pk,
            )
            raise EmailVerificationDeliveryError
        return True


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([EmailVerificationThrottle])
@throttle_scope('email_verification')
def request_email_verification(request: Request) -> Response:
    serializer = serializers.EmailField()
    email = serializer.run_validation(request.data.get('email'))
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user and not user.email_verified:
        try:
            _send_email_verification(
                user,
                request.LANGUAGE_CODE,
                enforce_cooldown=True,
            )
        except EmailVerificationDeliveryError:
            pass
    return Response({
        'detail': 'If the account needs verification, a code will be sent.'
    })


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([EmailVerificationThrottle])
@throttle_scope('email_verification')
def verify_email(request: Request) -> Response:
    serializer = EmailVerificationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    failure = None
    with transaction.atomic():
        user = User.objects.select_for_update().filter(
            email__iexact=serializer.validated_data['email'],
            is_active=True,
        ).first()
        verification = None
        if user and not user.email_verified:
            verification = EmailVerificationCode.objects.select_for_update().filter(
                user=user,
                purpose='email_verification',
                consumed_at__isnull=True,
            ).order_by('-created_at').first()
        if not verification or not user:
            failure = 'The verification code is invalid or has expired.'
        elif (
            verification.expires_at <= timezone.now()
            or verification.created_at + timedelta(minutes=5) <= timezone.now()
        ):
            failure = 'The verification code is invalid or has expired.'
        elif verification.attempts >= 5:
            failure = 'The verification code is invalid or has expired.'
        elif not check_verification_code(
            user.pk,
            serializer.validated_data['code'],
            verification.code_hash,
        ):
            verification.attempts += 1
            if verification.attempts >= 5:
                verification.consumed_at = timezone.now()
            verification.save(update_fields=('attempts', 'consumed_at'))
            failure = 'The verification code is invalid or has expired.'
        else:
            verification.consumed_at = timezone.now()
            verification.save(update_fields=('consumed_at',))
            user.email_verified = True
            user.save(update_fields=('email_verified',))
    validate_email_verification_result(failure)
    return Response({'detail': 'Email verified. You can now sign in.'})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
@throttle_scope('login')
def refresh_token(request: Request) -> Response:
    serializer = VerifiedEmailTokenRefreshSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(serializer.validated_data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request: Request) -> Response:
    refresh_token_value = request.data.get('refresh')
    validate_refresh_token(refresh_token_value).blacklist()
    return Response(status=status.HTTP_205_RESET_CONTENT)


def _send_password_reset_email(user: User, language_code: str) -> None:
    code = generate_verification_code()
    with transaction.atomic():
        locked_user = User.objects.select_for_update().get(pk=user.pk)
        now = timezone.now()
        EmailVerificationCode.objects.filter(
            user=locked_user,
            purpose='password_reset',
            consumed_at__isnull=True,
        ).update(consumed_at=now)
        EmailVerificationCode.objects.create(
            user=locked_user,
            purpose='password_reset',
            code_hash=hash_verification_code(locked_user.pk, code),
            expires_at=now + timedelta(minutes=5),
        )
        context = {
            'LANGUAGE_CODE': language_code,
            'code': code,
            'name': locked_user.first_name or locked_user.username,
        }
        with translation.override(language_code):
            subject = translation.gettext('Your Wasalni password reset code')
            body = render_to_string(
                'core/emails/password_reset.txt',
                context,
            ).strip()
            html_body = render_to_string(
                'core/emails/password_reset.html',
                context,
            )
        message = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[locked_user.email],
        )
        message.attach_alternative(html_body, 'text/html')
    try:
        sent = message.send(fail_silently=False)
    except SMTPSenderRefused as error:
        sender = error.sender
        local_part, separator, domain = sender.partition('@')
        masked_sender = (
            f'{local_part[:1]}***@{domain}' if separator else '[invalid address]'
        )
        logger.error(
            'Password reset OTP SMTP server refused sender=%s (SMTP %s). '
            'Use the authenticated Gmail address or an authorized alias.',
            masked_sender,
            error.smtp_code,
        )
        raise
    if sent != 1:
        raise RuntimeError('Password reset OTP email delivery did not complete.')


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetRequestThrottle])
@throttle_scope('password_reset_request')
def forgot_password(request: Request) -> Response:
    serializer = ForgotPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = User.objects.filter(
        email__iexact=serializer.validated_data['email'],
    ).exclude(password='').order_by('pk').first()

    if user and user.has_usable_password():
        try:
            _send_password_reset_email(user, request.LANGUAGE_CODE)
            logger.info('Password reset OTP email accepted by the configured mail server.')
        except (OSError, SMTPException, InvalidMailer, RuntimeError) as error:
            logger.error(
                'Password reset email delivery failed (%s).',
                type(error).__name__,
            )

    return Response({'detail': PASSWORD_RESET_GENERIC_RESPONSE})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetSubmitThrottle])
@throttle_scope('password_reset_submit')
def reset_password(request: Request) -> Response:
    serializer = ResetPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    reset_failed = False
    with transaction.atomic():
        user = User.objects.select_for_update().filter(
            email__iexact=serializer.validated_data['email'],
        ).first()
        reset_code = None
        if user and user.has_usable_password():
            reset_code = EmailVerificationCode.objects.select_for_update().filter(
                user=user,
                purpose='password_reset',
                consumed_at__isnull=True,
            ).order_by('-created_at').first()
        now = timezone.now()
        code_is_valid = validate_reset_code(
            user,
            reset_code,
            serializer.validated_data['code'],
            now,
        )
        if not code_is_valid:
            reset_failed = True
        else:
            validate_new_password(serializer.validated_data['new_password'], user)
            reset_code.consumed_at = now
            reset_code.save(update_fields=('consumed_at',))
            user.set_password(serializer.validated_data['new_password'])
            user.email_verified = True
            user.save(update_fields=['password', 'email_verified'])
    if reset_failed:
        validate_reset_result()

    return Response({'detail': 'Your password has been updated.'})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request: Request) -> Response:
    return Response(UserSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_dashboard(request: Request) -> Response:
    _require_admin(request.user)
    params = sorted(request.query_params.items())
    data = get_or_set(
        'analytics',
        params,
        60,
        lambda: build_analytics_dashboard(request.query_params),
    )
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def users(request: Request) -> Response:
    _require_admin(request.user)
    return _list_response(
        request,
        User.objects.all().order_by('role', 'username'),
        UserDetailSerializer,
    )


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def user_detail(request: Request, pk: int) -> Response:
    _require_admin(request.user)
    user = get_object_or_404(User, pk=pk)
    if request.method in ('PUT'):
        validate_user_status_target(user)
        serializer = UserAccountStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        previous_status = user.is_active
        user = serializer.update(user, serializer.validated_data)
        _write_audit(request, 'core.user.status_changed', user, {
            'before': {'is_active': previous_status},
            'after': {'is_active': user.is_active},
        })
    return Response(UserDetailSerializer(user).data)


def _assignment_window(request: Request):
    return validate_assignment_window(
        request.query_params.get('departure_time'),
        request.query_params.get('arrival_time'),
        request.query_params.get('trip_id'),
    )


def _assignment_conflicts(departure, arrival, exclude_trip):
    driver_conflicts: dict[int, Trip] = {}
    vehicle_conflicts: dict[int, Trip] = {}
    trips = Trip.objects.filter(status__in=('scheduled', 'in_progress')).select_related('route')
    if exclude_trip:
        trips = trips.exclude(pk=exclude_trip)
    for trip in trips:
        overlaps = trip.status == 'in_progress' or trip.departure_time is None
        if trip.departure_time:
            trip_end = trip.arrival_time or (
                trip.departure_time + timedelta(minutes=trip.route.duration_minutes or 60)
            )
            overlaps = overlaps or (
                departure < trip_end and arrival > trip.departure_time
            )
        if overlaps:
            if trip.driver_id:
                driver_conflicts[trip.driver_id] = trip
            if trip.vehicle_id:
                vehicle_conflicts[trip.vehicle_id] = trip
    return driver_conflicts, vehicle_conflicts


def _conflict_schedule(trip: Trip) -> str:
    if not trip.departure_time:
        return 'an active trip with no scheduled time'
    start = timezone.localtime(trip.departure_time).strftime('%b %d, %I:%M %p')
    end_time = trip.arrival_time or (
        trip.departure_time + timedelta(minutes=trip.route.duration_minutes or 60)
    )
    end = timezone.localtime(end_time).strftime('%I:%M %p')
    return f'TR-{trip.pk:04d} from {start} to {end}'


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def assignment_drivers(request: Request) -> Response:
    _require_admin(request.user)
    departure, arrival, exclude_trip = _assignment_window(request)
    drivers = (
        Driver.objects.select_related('user', 'vehicle')
        .order_by('user__username')
    )
    vehicle_id = request.query_params.get('vehicle')
    if vehicle_id:
        try:
            drivers = drivers.filter(vehicle_id=int(vehicle_id))
        except (TypeError, ValueError):
            drivers = drivers.none()
    driver_conflicts = {}
    if departure and arrival:
        driver_conflicts, _ = _assignment_conflicts(departure, arrival, exclude_trip)
    results = []
    for driver in drivers:
        if (
            driver.status == 'active'
            and driver.user.is_active
            and driver.verification_status == 'approved'
            and not driver.vehicle_id
        ):
            continue
        conflict = driver_conflicts.get(driver.pk)
        available = bool(
            departure
            and arrival
            and driver.status == 'active'
            and driver.user.is_active
            and driver.verification_status == 'approved'
            and driver.vehicle_id
            and not conflict
        )
        item = DriverSerializer(driver).data
        item['available'] = available
        if driver.status != 'active' or not driver.user.is_active:
            item['unavailable_reason'] = 'Driver is inactive.'
        elif driver.verification_status == 'pending':
            item['unavailable_reason'] = 'Driver verification is pending approval.'
        elif driver.verification_status == 'rejected':
            item['unavailable_reason'] = 'Driver verification was rejected.'
        elif not driver.vehicle_id:
            item['unavailable_reason'] = 'Driver is not assigned to a vehicle.'
        elif not departure or not arrival:
            item['unavailable_reason'] = 'Set a valid trip schedule to check availability.'
        elif conflict:
            item['unavailable_reason'] = f'Assigned to {_conflict_schedule(conflict)}.'
        else:
            item['unavailable_reason'] = None
        results.append(item)
    paginator = OptionalPageNumberPagination()
    page = paginator.paginate_queryset(results, request)
    if page is None:
        return Response(results)
    return paginator.get_paginated_response(page)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def assignment_vehicles(request: Request) -> Response:
    _require_admin(request.user)
    departure, arrival, exclude_trip = _assignment_window(request)
    vehicles = Vehicle.objects.all().order_by('registration_number')
    driver_id = request.query_params.get('driver')
    if driver_id:
        try:
            driver = Driver.objects.select_related('vehicle').filter(pk=int(driver_id)).first()
            vehicles = vehicles.filter(pk=driver.vehicle_id) if driver and driver.vehicle_id else vehicles.none()
        except (TypeError, ValueError):
            vehicles = vehicles.none()
    vehicle_conflicts = {}
    if departure and arrival:
        _, vehicle_conflicts = _assignment_conflicts(departure, arrival, exclude_trip)
    results = []
    for vehicle in vehicles:
        conflict = vehicle_conflicts.get(vehicle.pk)
        available = bool(
            departure
            and arrival
            and vehicle.status == 'active'
            and not conflict
        )
        item = VehicleSerializer(vehicle).data
        item['available'] = available
        if vehicle.status != 'active':
            item['unavailable_reason'] = 'Vehicle is inactive or under maintenance.'
        elif conflict:
            item['unavailable_reason'] = f'Assigned to {_conflict_schedule(conflict)}.'
        elif not departure or not arrival:
            item['unavailable_reason'] = 'Set a valid trip schedule to check availability.'
        else:
            item['unavailable_reason'] = None
        results.append(item)
    paginator = OptionalPageNumberPagination()
    page = paginator.paginate_queryset(results, request)
    if page is None:
        return Response(results)
    return paginator.get_paginated_response(page)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def stations(request: Request, format: str | None = None) -> Response:
    if request.method != 'GET':
        _require_admin(request.user)
    return _collection_api(
        request,
        Station.objects.filter(is_active=True),
        StationSerializer,
    )


@api_view(["GET", "PUT" , "DELETE"])
@permission_classes([IsAuthenticated])
def station_detail(
    request: Request,
    pk: int,
    format: str | None = None,
) -> Response:
    if request.method != 'GET':
        _require_admin(request.user)
    return _detail_api(
        request,
        Station.objects.filter(is_active=True),
        StationSerializer,
        pk,
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def routes(request: Request, format: str | None = None) -> Response:
    if request.method != 'GET':
        _require_admin(request.user)
    queryset = Route.objects.prefetch_related(
        "route_stations__station",
    )
    return _collection_api(request, queryset, RouteSerializer)


@api_view(["GET", "PUT" , "DELETE"])
@permission_classes([IsAuthenticated])
def route_detail(
    request: Request,
    pk: int,
    format: str | None = None,
) -> Response:
    if request.method != 'GET':
        _require_admin(request.user)
    queryset = Route.objects.prefetch_related("route_stations__station")
    return _detail_api(request, queryset, RouteSerializer, pk)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def route_stations(request: Request, format: str | None = None) -> Response:
    if request.method != 'GET':
        _require_admin(request.user)
    queryset = RouteStation.objects.select_related("station")
    return _collection_api(request, queryset, RouteStationSerializer)


@api_view(["GET", "PUT" , "DELETE"])
@permission_classes([IsAuthenticated])
def route_station_detail(
    request: Request,
    pk: int,
    format: str | None = None,
) -> Response:
    if request.method != 'GET':
        _require_admin(request.user)
    queryset = RouteStation.objects.select_related("station")
    return _detail_api(
        request,
        queryset,
        RouteStationSerializer,
        pk,
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def vehicles(request: Request, format: str | None = None) -> Response:
    _require_admin(request.user)
    return _collection_api(request, Vehicle.objects.all(), VehicleSerializer)


@api_view(["GET", "PUT" , "DELETE"])
@permission_classes([IsAuthenticated])
def vehicle_detail(
    request: Request,
    pk: int,
    format: str | None = None,
) -> Response:
    _require_admin(request.user)
    if request.method == 'GET':
        return _detail_api(request, Vehicle.objects.all(), VehicleSerializer, pk)
    with transaction.atomic():
        instance = get_object_or_404(Vehicle.objects.select_for_update(), pk=pk)
        if request.method == 'DELETE':
            validate_vehicle_deletion(instance)
            before = _audit_snapshot(instance)
            instance.delete()
            _write_audit(
                request,
                'core.vehicle.deleted',
                instance,
                {'before': before},
                object_id=before['id'],
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        before = _audit_snapshot(instance)
        serializer = VehicleSerializer(
            instance,
            data=request.data,
            partial=request.method == 'PATCH',
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        _write_audit(request, 'core.vehicle.updated', instance, {
            'before': before,
            'after': _audit_snapshot(instance),
        })
        return Response(serializer.data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def drivers(request: Request, format: str | None = None) -> Response:
    _require_admin(request.user)
    queryset = Driver.objects.select_related("user", "vehicle")
    return _collection_api(request, queryset, DriverSerializer)


@api_view(["GET", "PUT" , "DELETE"])
@permission_classes([IsAuthenticated])
def driver_detail(
    request: Request,
    pk: int,
    format: str | None = None,
) -> Response:
    _require_admin(request.user)
    if request.method == 'GET':
        queryset = Driver.objects.select_related("user", "vehicle")
        return _detail_api(request, queryset, DriverSerializer, pk)
    with transaction.atomic():
        instance = get_object_or_404(
            Driver.objects.select_for_update(),
            pk=pk,
        )
        if request.method == 'DELETE':
            validate_driver_deletion(instance)
            before = _audit_snapshot(instance)
            instance.delete()
            _write_audit(
                request,
                'core.driver.deleted',
                instance,
                {'before': before},
                object_id=before['id'],
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        before = _audit_snapshot(instance)
        serializer = DriverSerializer(
            instance,
            data=request.data,
            partial=request.method == 'PATCH',
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        _write_audit(request, 'core.driver.updated', instance, {
            'before': before,
            'after': _audit_snapshot(instance),
        })
        return Response(serializer.data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def driver_documents(request: Request) -> Response:
    if request.method == 'GET':
        queryset = DriverDocument.objects.select_related('driver__user', 'reviewed_by')
        if not _is_admin(request.user):
            _require_role(request.user, 'driver')
            queryset = queryset.filter(driver__user=request.user)
        return _list_response(request, queryset, DriverDocumentSerializer)

    _require_role(request.user, 'driver')
    driver = Driver.objects.filter(user=request.user).first()
    if not driver:
        raise PermissionDenied('A driver profile is required to upload documents.')
    serializer = DriverDocumentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    uploaded_file = serializer.validated_data['file']
    document = serializer.save(
        driver=driver,
        original_filename=Path(uploaded_file.name).name[:255],
    )
    _write_audit(request, 'driver_document.uploaded', document, {
        'document_type': document.document_type,
    })
    return Response(
        DriverDocumentSerializer(document).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def driver_document_detail(request: Request, pk: int) -> Response:
    queryset = DriverDocument.objects.select_related('driver__user', 'reviewed_by')
    if not _is_admin(request.user):
        _require_role(request.user, 'driver')
        queryset = queryset.filter(driver__user=request.user)
    document = get_object_or_404(queryset, pk=pk)
    return Response(DriverDocumentSerializer(document).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def review_driver_document(request: Request, pk: int) -> Response:
    _require_admin(request.user)
    with transaction.atomic():
        document = get_object_or_404(
            DriverDocument.objects.select_for_update().select_related('driver__user'),
            pk=pk,
        )
        serializer = DriverDocumentReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document.status = serializer.validated_data['status']
        document.rejection_note = (
            serializer.validated_data.get('rejection_note', '').strip()
            if document.status == 'rejected'
            else ''
        )
        document.reviewed_by = request.user
        document.reviewed_at = timezone.now()
        document.save(update_fields=(
            'status',
            'rejection_note',
            'reviewed_by',
            'reviewed_at',
        ))
        _write_audit(request, 'driver_document.reviewed', document, {
            'status': document.status,
        })
    return Response(DriverDocumentSerializer(document).data)


class BinaryFileRenderer(BaseRenderer):
    media_type = 'application/octet-stream'
    format = 'binary'
    charset = None

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class DownloadDriverDocumentView(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [BinaryFileRenderer]

    def get(self, request: Request, pk: int) -> FileResponse:
        queryset = DriverDocument.objects.select_related('driver__user')
        if not _is_admin(request.user):
            _require_role(request.user, 'driver')
            queryset = queryset.filter(driver__user=request.user)
        document = get_object_or_404(queryset, pk=pk)
        filename = Path(document.original_filename).name
        return FileResponse(
            document.file.open('rb'),
            as_attachment=True,
            filename=filename,
            content_type=mimetypes.guess_type(filename)[0] or 'application/octet-stream',
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_driver(request: Request, pk: int) -> Response:
    _require_admin(request.user)
    with transaction.atomic():
        driver = get_object_or_404(
            Driver.objects.select_for_update().select_related('user'),
            pk=pk,
        )
        serializer = DriverVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verification_status = serializer.validated_data['status']
        note = serializer.validated_data.get('note', '').strip()
        validate_driver_approval(driver, verification_status)
        driver.verification_status = verification_status
        driver.verified_by = request.user
        driver.verified_at = timezone.now()
        driver.rejection_note = note if verification_status == 'rejected' else ''
        driver.save(update_fields=(
            'verification_status',
            'verified_by',
            'verified_at',
            'rejection_note',
        ))
        _write_audit(request, 'driver.verification_changed', driver, {
            'status': verification_status,
            'note': note,
        })
        _queue_email(
            driver.user,
            'Wasalni driver verification update',
            (
                'Your driver account is approved.'
                if verification_status == 'approved'
                else f'Your driver account was not approved. {note}'
            ),
        )
    return Response(DriverSerializer(driver).data)


OPERATIONAL_SETTING_DEFAULTS = {
    'booking_cancellation_cutoff_hours': settings.BOOKING_CANCELLATION_CUTOFF_HOURS,
    'driver_passenger_phone_window_hours': settings.DRIVER_PASSENGER_PHONE_WINDOW_HOURS,
    'max_active_upcoming_bookings': settings.MAX_ACTIVE_UPCOMING_BOOKINGS,
}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def operational_settings(request: Request) -> Response:
    _require_admin(request.user)
    return Response({
        key: _operational_int(key, default)
        for key, default in OPERATIONAL_SETTING_DEFAULTS.items()
    })


@api_view(["PUT" ])
@permission_classes([IsAuthenticated])
def operational_setting_detail(request: Request, key: str) -> Response:
    _require_admin(request.user)
    if key not in OPERATIONAL_SETTING_DEFAULTS:
        raise NotFound('This operational setting is not configurable.')
    serializer = OperationalSettingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    value = serializer.validated_data['value']
    validate_operational_setting_value(key, value)
    with transaction.atomic():
        setting, _ = OperationalSetting.objects.update_or_create(
            key=key,
            defaults={
                'value': str(value),
                'updated_by': request.user,
            },
        )
        _write_audit(request, 'operational_setting.updated', setting, {
            'value': value,
        })
    return Response({
        'key': setting.key,
        'value': int(setting.value),
    })


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def fare_rules(request: Request, format: str | None = None) -> Response:
    _require_admin(request.user)
    queryset = FareRule.objects.select_related("route")
    return _collection_api(request, queryset, FareRuleSerializer)


@api_view(["GET", "PUT" , "DELETE"])
@permission_classes([IsAuthenticated])
def fare_rule_detail(
    request: Request,
    pk: int,
    format: str | None = None,
) -> Response:
    _require_admin(request.user)
    queryset = FareRule.objects.select_related("route")
    return _detail_api(
        request,
        queryset,
        FareRuleSerializer,
        pk,
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def trips(request: Request, format: str | None = None) -> Response:
    if request.method == "GET":
        if _is_admin(request.user):
            queryset = _trip_queryset()
        elif request.user.role == 'driver':
            queryset = _trip_queryset().filter(driver__user=request.user)
        else:
            _require_role(request.user, 'passenger')
            queryset = _bookable_trips()
        return _list_response(request, queryset, TripSerializer)

    payload = request.data
    admin_request = _is_admin(request.user)
    if not admin_request:
        _require_role(request.user, 'driver')
        payload = request.data.copy()
    with transaction.atomic():
        if admin_request:
            _lock_assignment_resources(
                (request.data.get('driver'),),
                (request.data.get('vehicle'),),
            )
        else:
            driver = get_object_or_404(
                Driver.objects.select_for_update().select_related('user'),
                user=request.user,
                status='active',
                verification_status='approved',
            )
            validate_driver_trip_vehicle(driver)
            requested_driver = payload.get('driver')
            requested_vehicle = payload.get('vehicle')
            if requested_driver not in (None, '') and str(requested_driver) != str(driver.pk):
                raise PermissionDenied('Drivers can submit trips only for their own account.')
            if requested_vehicle not in (None, '') and str(requested_vehicle) != str(driver.vehicle_id):
                raise PermissionDenied('Drivers can submit trips only with their assigned vehicle.')
            payload['driver'] = driver.pk
            payload['vehicle'] = driver.vehicle_id
            payload['is_published'] = False
            payload['status'] = 'scheduled'
        serializer = TripSerializer(data=payload, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.validated_data['created_by'] = request.user
        trip = get_trip_service().create_trip(serializer.validated_data)
        _write_audit(
            request,
            'trip.created',
            trip,
            {'is_published': trip.is_published},
        )
        _notify_driver_assignment(trip, None)
    return Response(
        TripSerializer(_trip_queryset().get(pk=trip.pk), context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "PUT" , "DELETE"])
@permission_classes([IsAuthenticated])
def trip_detail(
    request: Request,
    pk: int,
    format: str | None = None,
) -> Response:
    if request.method == 'GET':
        trip = get_object_or_404(_trip_queryset(), pk=pk)
        if _is_admin(request.user):
            pass
        elif request.user.role == 'driver' and trip.driver_id == getattr(
            getattr(request.user, 'driver_profile', None), 'pk', None
        ):
            pass
        elif request.user.role == 'passenger':
            if not _bookable_trips().filter(pk=trip.pk).exists():
                raise NotFound('This trip is not available for booking.')
        else:
            raise PermissionDenied('You cannot access this trip.')
        return Response(TripSerializer(trip, context={'request': request}).data)
    with transaction.atomic():
        trip = get_object_or_404(
                Trip.objects.select_for_update(of=('self',)).select_related(
                    'route',
                    'vehicle',
                    'driver',
                    'start_station',
                    'destination_station',
                    'created_by',
                ),
                pk=pk,
            )
        if not _is_admin(request.user):
            if request.user.role != 'driver' or trip.driver_id != getattr(
                getattr(request.user, 'driver_profile', None), 'pk', None
            ):
                raise PermissionDenied('You cannot modify this trip.')
            if request.method != 'PATCH':
                raise PermissionDenied('Drivers cannot delete or replace trips.')
            if set(request.data) != {'status'} or request.data['status'] not in (
                'in_progress',
                'completed',
            ):
                raise PermissionDenied('Drivers may only start or complete their assigned trip.')
            validate_trip_status_transition(request.data['status'], trip.status)
        if request.method == 'DELETE':
            validate_trip_deletion(trip)
            before = _audit_snapshot(trip)
            cancelled_bookings = trip.bookings.filter(status='cancelled')
            Payment.objects.filter(booking__in=cancelled_bookings).delete()
            cancelled_bookings.delete()
            trip.delete()
            _write_audit(
                request,
                'core.trip.deleted',
                trip,
                {'before': before},
                object_id=before['id'],
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        old_departure = trip.departure_time
        old_status = trip.status
        old_driver = trip.driver
        if _is_admin(request.user):
            _lock_assignment_resources(
                (trip.driver_id, request.data.get('driver')),
                (trip.vehicle_id, request.data.get('vehicle')),
            )
        serializer = TripSerializer(
            trip,
            data=request.data,
            partial=request.method == 'PATCH',
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        updated_trip = serializer.save()
        _write_audit(request, 'trip.updated', updated_trip, {
            'previous_status': old_status,
            'status': updated_trip.status,
            'is_published': updated_trip.is_published,
        })
        _notify_driver_assignment(updated_trip, old_driver)
        _notify_trip_changes(updated_trip, old_departure, old_status)
        if updated_trip.status == 'completed':
            _complete_trip_bookings(updated_trip)
        elif updated_trip.status == 'cancelled':
            _cancel_trip_bookings(updated_trip)
    return Response(TripSerializer(updated_trip, context={'request': request}).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def trip_search(request: Request, format: str | None = None) -> Response:
    if request.method == 'GET':
        _require_role(request.user, 'passenger')
        params = {
            'start_station_id': request.query_params.get('start_station_id'),
            'destination_station_id': request.query_params.get('destination_station_id'),
            'date': request.query_params.get('date'),
        }
        queryset = _bookable_trips()
        start_station_id = request.query_params.get('start_station_id')
        destination_station_id = request.query_params.get('destination_station_id')
        travel_date = request.query_params.get('date')
        start_station = None
        destination_station = None
        if start_station_id:
            start_station = get_object_or_404(Station, pk=start_station_id, is_active=True)
        if destination_station_id:
            destination_station = get_object_or_404(
                Station,
                pk=destination_station_id,
                is_active=True,
            )
        if start_station and destination_station:
            trip_start_order = RouteStation.objects.filter(
                route_id=OuterRef('route_id'),
                station_id=OuterRef('start_station_id'),
            ).values('sequence_order')[:1]
            trip_end_order = RouteStation.objects.filter(
                route_id=OuterRef('route_id'),
                station_id=OuterRef('destination_station_id'),
            ).values('sequence_order')[:1]
            search_start_order = RouteStation.objects.filter(
                route_id=OuterRef('route_id'),
                station_id=start_station.pk,
            ).values('sequence_order')[:1]
            search_end_order = RouteStation.objects.filter(
                route_id=OuterRef('route_id'),
                station_id=destination_station.pk,
            ).values('sequence_order')[:1]
            queryset = queryset.annotate(
                _trip_start_order=Subquery(trip_start_order),
                _trip_end_order=Subquery(trip_end_order),
                _search_start_order=Subquery(search_start_order),
                _search_end_order=Subquery(search_end_order),
            ).filter(
                _trip_start_order__lte=F('_search_start_order'),
                _search_start_order__lt=F('_search_end_order'),
                _search_end_order__lte=F('_trip_end_order'),
            )
        elif start_station:
            queryset = queryset.filter(start_station_id=start_station.pk)
        elif destination_station:
            queryset = queryset.filter(destination_station_id=destination_station.pk)
        if travel_date:
            parsed_date = validate_search_date(travel_date)
            local_timezone = timezone.get_current_timezone()
            start_of_day = timezone.make_aware(
                datetime.combine(parsed_date, time.min),
                local_timezone,
            )
            start_of_next_day = timezone.make_aware(
                datetime.combine(parsed_date + timedelta(days=1), time.min),
                local_timezone,
            )
            queryset = queryset.filter(
                departure_time__gte=start_of_day,
                departure_time__lt=start_of_next_day,
            )
        trips_for_search = list(queryset.order_by('departure_time'))
        if start_station and destination_station:
            for trip in trips_for_search:
                trip_legs = trip._trip_end_order - trip._trip_start_order
                segment_legs = trip._search_end_order - trip._search_start_order
                trip._search_start_station = start_station
                trip._search_destination_station = destination_station
                trip._search_fare_amount = (
                    trip.fare_amount * Decimal(segment_legs) / Decimal(trip_legs)
                    if trip_legs > 0 else trip.fare_amount
                )
        data = get_or_set(
            'trip-search',
            params,
            15,
            lambda: TripSerializer(
                trips_for_search,
                many=True,
                context={'request': request},
            ).data,
        )
        return Response(data)

    _require_role(request.user, 'passenger')
    serializer = TripSearchSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        results = get_trip_service().search_routes(
            serializer.validated_data["start_station_id"],
            serializer.validated_data["destination_station_id"],
        )
    except StationsNotFoundError as error:
        raise NotFound(str(error)) from error

    return Response({
        "results": [
            {
                "route": RouteSerializer(result.route).data,
                "fare": f"{result.fare:.2f}",
                "estimated_travel_time": result.estimated_travel_time,
            }
            for result in results
        ]
    })


class SeatConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = 'seat_unavailable'


class IdempotencyMismatch(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = 'idempotency_mismatch'
    default_detail = 'This Idempotency-Key was already used with a different booking request.'


def _create_trip_notification(booking: Booking, title: str, message: str, kind: str) -> None:
    Notification.objects.create(
        user=booking.passenger,
        booking=booking,
        title=title,
        message=message,
        notification_type=kind,
    )


def _queue_email(user: User, subject: str, body: str) -> None:
    if user.email:
        EmailOutbox.objects.create(
            recipient_email=user.email,
            subject=subject,
            body=body,
        )


def _notify_driver_assignment(trip: Trip, previous_driver) -> None:
    if previous_driver and trip.driver_id == previous_driver.pk:
        return

    route = trip.route
    origin = trip.start_station.name
    destination = trip.destination_station.name
    departure = timezone.localtime(trip.departure_time).strftime('%b %d at %I:%M %p') if trip.departure_time else 'time to be confirmed'

    if trip.driver_id and trip.driver:
        Notification.objects.get_or_create(
            dedupe_key=f'trip-assignment:{trip.pk}:{trip.driver_id}',
            defaults={
                'user': trip.driver.user,
                'notification_type': 'trip_status',
                'title': 'New trip assigned',
                'message': (
                    f'Trip TR-{trip.pk:04d} from {origin} to {destination} '
                    f'is assigned to you for {departure}.'
                ),
            },
        )

    if previous_driver:
        Notification.objects.get_or_create(
            dedupe_key=f'trip-reassignment:{trip.pk}:{previous_driver.pk}',
            defaults={
                'user': previous_driver.user,
                'notification_type': 'trip_status',
                'title': 'Trip reassigned',
                'message': (
                    f'Trip TR-{trip.pk:04d} from {origin} to {destination} '
                    'has been reassigned to another driver.'
                ),
            },
        )


def _notify_trip_changes(trip: Trip, old_departure, old_status: str) -> None:
    if trip.status == 'cancelled':
        return
    bookings = trip.bookings.filter(status='confirmed').select_related('passenger')
    for booking in bookings:
        if trip.departure_time != old_departure:
            message = (
                f'The departure time for {trip.start_station.name} to '
                f'{trip.destination_station.name} has changed.'
            )
            _create_trip_notification(
                booking,
                'Trip departure updated',
                message,
                'trip_status',
            )
            _queue_email(booking.passenger, 'Wasalni trip departure updated', message)
        elif trip.status != old_status:
            message = (
                f'Your trip from {trip.start_station.name} to '
                f'{trip.destination_station.name} is now '
                f'{trip.get_status_display().lower()}.'
            )
            _create_trip_notification(
                booking,
                'Trip status updated',
                message,
                'trip_status',
            )
            _queue_email(booking.passenger, 'Wasalni trip status updated', message)


def _cancel_trip_bookings(trip: Trip) -> None:
    with transaction.atomic():
        bookings = list(
            Booking.objects.select_for_update()
            .filter(trip=trip, status='confirmed')
            .select_related('passenger')
        )
        for booking in bookings:
            booking.status = 'cancelled'
            booking.cancelled_at = timezone.now()
            booking.cancellation_reason = 'Trip cancelled by operator.'
            booking.save(update_fields=(
                'status',
                'cancelled_at',
                'cancellation_reason',
                'updated_at',
            ))
            booking.seats.filter(is_active=True).update(is_active=False)
            booking.payments.filter(status='pending').update(status='cancelled')
            booking.payments.filter(status='paid').update(status='refunded', paid_at=None)
            booking.idempotency_key = None
            booking.save(update_fields=('idempotency_key',))
            _create_trip_notification(
                booking,
                'Trip cancelled',
                f'Your trip from {trip.start_station.name} to '
                f'{trip.destination_station.name} has been cancelled.',
                'trip_status',
            )
            _queue_email(
                booking.passenger,
                'Your Wasalni trip was cancelled',
                f'Your trip from {trip.start_station.name} to '
                f'{trip.destination_station.name} has been cancelled.',
            )


def _complete_trip_bookings(trip: Trip) -> None:
    completed_booking_ids = list(
        Booking.objects.filter(trip=trip, status='confirmed')
        .values_list('pk', flat=True)
    )
    Booking.objects.filter(pk__in=completed_booking_ids).update(
        status='completed',
        updated_at=timezone.now(),
    )
    Payment.objects.filter(
        booking_id__in=completed_booking_ids,
        payment_method='cash',
        status='pending',
    ).update(status='paid', paid_at=timezone.now())


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def trip_seats(request: Request, pk: int) -> Response:
    trip = get_object_or_404(
        _trip_queryset().select_related('vehicle'),
        pk=pk,
    )
    if _is_admin(request.user):
        pass
    elif request.user.role == 'passenger':
        if not _bookable_trips().filter(pk=trip.pk).exists():
            raise NotFound('This trip is not available for booking.')
    elif request.user.role == 'driver':
        if trip.driver_id != getattr(
            getattr(request.user, 'driver_profile', None),
            'pk',
            None,
        ):
            raise PermissionDenied('You can only view seats for your assigned trips.')
    else:
        raise PermissionDenied('You cannot view seat availability.')

    if not trip.vehicle_id:
        return Response({
            'trip': trip.pk,
            'vehicle_capacity': 0,
            'booked_seats': 0,
            'available_seats': 0,
            'layout': [],
            'seats': [],
        })
    layout = _available_seat_layout(trip.vehicle)
    active_seats = set(
        BookingSeat.objects.filter(trip=trip, is_active=True)
        .values_list('seat_number', flat=True)
    )
    disabled_seats = set(trip.vehicle.disabled_seats)
    seat_numbers = [seat for row in layout for seat in row if seat is not None]
    seats = [
        {
            'number': number,
            'state': (
                'booked' if number in active_seats
                else 'disabled' if number in disabled_seats
                else 'available'
            ),
        }
        for number in seat_numbers
    ]
    return Response({
        'trip': trip.pk,
        'vehicle_capacity': trip.vehicle.capacity,
        'booked_seats': len(active_seats),
        'available_seats': max(
            trip.vehicle.capacity - len(active_seats) - len(disabled_seats),
            0,
        ),
        'layout': layout,
        'seats': seats,
    })


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def bookings(request: Request) -> Response:
    if request.method == 'GET':
        if _is_admin(request.user):
            queryset = Booking.objects.all()
            passenger_id = request.query_params.get('passenger_id')
            if passenger_id is not None:
                validated_passenger_id = validate_passenger_filter(passenger_id)
                queryset = queryset.filter(passenger_id=validated_passenger_id)
        elif request.user.role == 'passenger':
            queryset = Booking.objects.filter(passenger=request.user)
        else:
            raise PermissionDenied('Drivers cannot view passenger booking records.')
        queryset = queryset.prefetch_related(
            Prefetch('trip', queryset=_trip_queryset()),
            'seats',
        ).select_related('passenger')
        return _list_response(request, queryset, BookingSerializer)

    _require_role(request.user, 'passenger')
    serializer = BookingCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    trip_id = serializer.validated_data['trip']
    seat_numbers = sorted(serializer.validated_data['seat_numbers'])
    idempotency_key = request.headers.get('Idempotency-Key', '').strip()
    validate_idempotency_key(idempotency_key)

    pickup_stop = serializer.validated_data.get('pickup_stop')
    dropoff_stop = serializer.validated_data.get('dropoff_stop')

    def matches_request(existing: Booking) -> bool:
        return (
            existing.trip_id == trip_id
            and list(existing.seats.order_by('seat_number').values_list('seat_number', flat=True)) == seat_numbers
            and existing.pickup_stop_id == getattr(pickup_stop, 'pk', None)
            and existing.dropoff_stop_id == getattr(dropoff_stop, 'pk', None)
        )

    if idempotency_key:
        existing_booking = _booking_queryset().filter(
            passenger=request.user,
            idempotency_key=idempotency_key,
        ).first()
        if existing_booking:
            if not matches_request(existing_booking):
                raise IdempotencyMismatch()
            return Response(BookingSerializer(existing_booking).data)

    try:
        with transaction.atomic():
            User.objects.select_for_update().get(pk=request.user.pk)
            if idempotency_key:
                existing_booking = _booking_queryset().filter(
                    passenger=request.user,
                    idempotency_key=idempotency_key,
                ).first()
                if existing_booking:
                    if not matches_request(existing_booking):
                        raise IdempotencyMismatch()
                    return Response(BookingSerializer(existing_booking).data)
            trip = get_object_or_404(
                Trip.objects.select_for_update(of=('self',)).select_related(
                    'vehicle',
                    'route',
                    'start_station',
                    'destination_station',
                ),
                pk=trip_id,
            )
            _lock_trip_assets(trip)
            validate_bookable_trip(_bookable_trips().filter(pk=trip.pk).exists())
            validate_booking_stops(trip, pickup_stop, dropoff_stop)
            booking_limit = _operational_int(
                'max_active_upcoming_bookings',
                settings.MAX_ACTIVE_UPCOMING_BOOKINGS,
            )
            active_booking_count = Booking.objects.filter(
                passenger=request.user,
                status='confirmed',
                trip__status='scheduled',
                trip__departure_time__gt=timezone.now(),
            ).count()
            validate_active_booking_limit(active_booking_count, booking_limit)
            layout = _available_seat_layout(trip.vehicle)
            validate_booking_seats(seat_numbers, trip.vehicle, layout)
            active_seats = set(
                BookingSeat.objects.filter(
                    trip=trip,
                    is_active=True,
                    seat_number__in=seat_numbers,
                ).values_list('seat_number', flat=True)
            )
            if active_seats:
                raise SeatConflict(
                    f"Seat {min(active_seats)} is no longer available. Please select another seat."
                )
            occupied_count = BookingSeat.objects.filter(
                trip=trip,
                is_active=True,
            ).count()
            validate_booking_capacity(seat_numbers, trip.vehicle, occupied_count)

            booking_total = trip.fare_amount * Decimal(len(seat_numbers))
            if pickup_stop and dropoff_stop:
                trip_start = RouteStation.objects.get(
                    route=trip.route,
                    station=trip.start_station,
                )
                trip_destination = RouteStation.objects.get(
                    route=trip.route,
                    station=trip.destination_station,
                )
                trip_legs = trip_destination.sequence_order - trip_start.sequence_order
                segment_legs = (
                    dropoff_stop.sequence_order - pickup_stop.sequence_order
                )
                segment_fare = (
                    trip.fare_amount * Decimal(segment_legs) / Decimal(trip_legs)
                    if trip_legs > 0
                    else trip.fare_amount
                )
                booking_total = segment_fare * Decimal(len(seat_numbers))

            booking = Booking.objects.create(
                passenger=request.user,
                trip=trip,
                total_amount=booking_total,
                idempotency_key=idempotency_key or None,
                pickup_stop=pickup_stop,
                dropoff_stop=dropoff_stop,
            )
            BookingSeat.objects.bulk_create([
                BookingSeat(
                    booking=booking,
                    trip=trip,
                    seat_number=seat_number,
                )
                for seat_number in seat_numbers
            ])
            Payment.objects.create(
                booking=booking,
                trip=trip,
                amount=booking.total_amount,
                payment_method='cash',
                status='pending',
            )
            _create_trip_notification(
                booking,
                'Booking confirmed',
                f'Your booking for {trip.start_station.name} to '
                f'{trip.destination_station.name} is confirmed. '
                f'Seats: {", ".join(map(str, seat_numbers))}.',
                'booking_confirmation',
            )
            _queue_email(
                request.user,
                'Wasalni booking confirmed',
                f'Your booking from {trip.start_station.name} to '
                f'{trip.destination_station.name} is confirmed. '
                f'Seats: {", ".join(map(str, seat_numbers))}.',
            )
    except IntegrityError as error:
        if idempotency_key:
            existing_booking = _booking_queryset().filter(
                passenger=request.user,
                idempotency_key=idempotency_key,
            ).first()
            if existing_booking:
                if not matches_request(existing_booking):
                    raise IdempotencyMismatch() from error
                return Response(BookingSerializer(existing_booking).data)
        raise SeatConflict(
            'A selected seat is no longer available. Please refresh and choose another seat.'
        ) from error

    booking = _booking_queryset().get(pk=booking.pk)
    return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def booking_detail(request: Request, pk: int) -> Response:
    queryset = _booking_queryset()
    if not _is_admin(request.user):
        queryset = queryset.filter(passenger=request.user)
    booking = get_object_or_404(queryset, pk=pk)
    return Response(BookingSerializer(booking).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_booking(request: Request, pk: int) -> Response:
    with transaction.atomic():
        queryset = Booking.objects.all()
        if not _is_admin(request.user):
            _require_role(request.user, 'passenger')
            queryset = queryset.filter(passenger=request.user)
        initial_booking = get_object_or_404(queryset, pk=pk)
        trip = get_object_or_404(
            Trip.objects.select_for_update(of=('self',)),
            pk=initial_booking.trip_id,
        )
        queryset = queryset.select_for_update().select_related('trip')
        booking = get_object_or_404(queryset, pk=pk)
        cutoff_hours = _operational_int(
            'booking_cancellation_cutoff_hours',
            settings.BOOKING_CANCELLATION_CUTOFF_HOURS,
        )
        validate_booking_cancellation(
            booking,
            trip,
            cutoff_hours,
            timezone.now(),
        )
        before = _audit_snapshot(booking)
        booking.status = 'cancelled'
        booking.cancelled_at = timezone.now()
        booking.cancelled_by = request.user
        booking.cancellation_reason = 'Passenger or administrator cancelled.'
        booking.save(update_fields=(
            'status',
            'cancelled_at',
            'cancelled_by',
            'cancellation_reason',
            'updated_at',
        ))
        booking.seats.filter(is_active=True).update(is_active=False)
        booking.payments.filter(status='pending').update(status='cancelled')
        booking.payments.filter(status='paid').update(status='refunded')
        booking.idempotency_key = None
        booking.save(update_fields=('idempotency_key',))
        _create_trip_notification(
            booking,
            'Booking cancelled',
            f'Your booking for trip {booking.trip_id} has been cancelled.',
            'trip_status',
        )
        _queue_email(
            booking.passenger,
            'Wasalni booking cancelled',
            f'Your booking for trip {booking.trip_id} has been cancelled.',
        )
        _write_audit(request, 'core.booking.cancelled', booking, {
            'before': before,
            'after': _audit_snapshot(booking),
        })
    return Response(BookingSerializer(booking).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def trip_passengers(request: Request, pk: int) -> Response:
    trip = get_object_or_404(Trip.objects.select_related('driver__user'), pk=pk)
    if not _is_admin(request.user) and (
        request.user.role != 'driver'
        or trip.driver_id != getattr(
            getattr(request.user, 'driver_profile', None),
            'id',
            None,
        )
    ):
        raise PermissionDenied('Only the assigned driver or an administrator can view passengers.')
    result = []
    for booking in trip.bookings.filter(status='confirmed').select_related('passenger').prefetch_related('seats'):
        departure = trip.departure_time
        phone_available = (
            _is_admin(request.user)
            or (
                departure is not None
                and timezone.now()
                >= departure - timedelta(hours=_operational_int(
                    'driver_passenger_phone_window_hours',
                    settings.DRIVER_PASSENGER_PHONE_WINDOW_HOURS,
                ))
            )
        )
        result.append({
            'booking_id': booking.pk,
            'passenger_name': booking.passenger.get_full_name() or booking.passenger.username,
            'phone_number': booking.passenger.phone_number if phone_available else None,
            'seat_numbers': [
                seat.seat_number
                for seat in booking.seats.all()
                if seat.is_active
            ],
        })
    return Response(result)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def payments(request: Request, format: str | None = None) -> Response:
    _require_admin(request.user)
    queryset = Payment.objects.select_related("trip", "booking")
    return _collection_api(request, queryset, PaymentSerializer)


@api_view(["GET", "PUT" , "DELETE"])
@permission_classes([IsAuthenticated])
def payment_detail(
    request: Request,
    pk: int,
    format: str | None = None,
) -> Response:
    _require_admin(request.user)
    queryset = Payment.objects.select_related("trip", "booking")
    return _detail_api(request, queryset, PaymentSerializer, pk)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def private_rides(request: Request) -> Response:
    if request.method == 'GET':
        queryset = PrivateRide.objects.select_related('passenger', 'driver__user')
        if _is_admin(request.user):
            pass
        elif request.user.role == 'driver':
            queryset = queryset.filter(
                Q(status='requested', driver__isnull=True)
                | Q(driver__user=request.user)
            )
        elif request.user.role == 'passenger':
            queryset = queryset.filter(passenger=request.user)
        else:
            raise PermissionDenied('You cannot access private rides.')
        return _list_response(request, queryset, PrivateRideSerializer)

    _require_role(request.user, 'passenger')
    serializer = PrivateRideSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    ride = serializer.save(passenger=request.user)
    _write_audit(request, 'private_ride.requested', ride)
    return Response(
        PrivateRideSerializer(ride).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def private_ride_detail(request: Request, pk: int) -> Response:
    queryset = PrivateRide.objects.select_related('passenger', 'driver__user')
    if not _is_admin(request.user):
        if request.user.role == 'passenger':
            queryset = queryset.filter(passenger=request.user)
        elif request.user.role == 'driver':
            queryset = queryset.filter(
                Q(status='requested', driver__isnull=True)
                | Q(driver__user=request.user)
            )
        else:
            raise PermissionDenied('You cannot access this private ride.')
    ride = get_object_or_404(queryset, pk=pk)
    return Response(PrivateRideSerializer(ride).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def private_ride_action(request: Request, pk: int, action: str) -> Response:
    if action not in {'accept', 'cancel', 'complete', 'reject'}:
        raise NotFound('Unknown private-ride action.')
    with transaction.atomic():
        ride = get_object_or_404(
            PrivateRide.objects.select_for_update().select_related('passenger'),
            pk=pk,
        )
        if action == 'accept':
            _require_role(request.user, 'driver')
            driver = get_object_or_404(
                Driver.objects.select_for_update().select_related('user'),
                user=request.user,
                status='active',
                verification_status='approved',
            )
            validate_private_ride_accept(ride, driver)
            ride.driver = driver
            ride.status = 'accepted'
            ride.accepted_at = timezone.now()
            ride.save(update_fields=('driver', 'status', 'accepted_at', 'updated_at'))
            _queue_email(
                ride.passenger,
                'Wasalni private ride accepted',
                'A driver has accepted your private ride request.',
            )
        elif action == 'cancel':
            if not _is_admin(request.user):
                _require_role(request.user, 'passenger')
                if ride.passenger_id != request.user.pk:
                    raise PermissionDenied('You can cancel only your own private rides.')
            validate_private_ride_cancellation(ride)
            ride.status = 'cancelled'
            ride.save(update_fields=('status', 'updated_at'))
            if ride.driver_id:
                _queue_email(
                    ride.driver.user,
                    'Wasalni private ride cancelled',
                    'A private ride assigned to you has been cancelled.',
                )
        elif action == 'complete':
            _require_role(request.user, 'driver')
            if (
                ride.status != 'accepted'
                or not ride.driver_id
                or (
                    not _is_admin(request.user)
                    and ride.driver.user_id != request.user.pk
                )
            ):
                raise PermissionDenied(
                    'Only the assigned driver or an administrator can complete this ride.'
                )
            ride.status = 'completed'
            ride.save(update_fields=('status', 'updated_at'))
            _queue_email(
                ride.passenger,
                'Wasalni private ride completed',
                'Your private ride has been marked as completed.',
            )
        else:
            _require_admin(request.user)
            validate_private_ride_rejection(ride)
            ride.status = 'rejected'
            ride.save(update_fields=('status', 'updated_at'))
            _queue_email(
                ride.passenger,
                'Wasalni private ride update',
                'Your private ride request was not accepted.',
            )
        _write_audit(request, f'private_ride.{action}ed', ride)
    return Response(PrivateRideSerializer(ride).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def complaints(request: Request) -> Response:
    if request.method == 'GET':
        queryset = Complaint.objects.select_related(
            'reporter',
            'booking',
            'trip',
            'assigned_to',
        )
        if not _is_admin(request.user):
            queryset = queryset.filter(reporter=request.user)
        return _list_response(request, queryset, ComplaintSerializer)

    serializer = ComplaintSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    booking = serializer.validated_data.get('booking')
    trip = serializer.validated_data.get('trip')
    if booking and booking.passenger_id != request.user.pk:
        raise PermissionDenied('A complaint may reference only your own booking.')
    validate_complaint_booking_trip(booking, trip)
    if trip and not booking and not _is_admin(request.user):
        is_trip_participant = (
            Booking.objects.filter(passenger=request.user, trip=trip).exists()
            or trip.driver and trip.driver.user_id == request.user.pk
        )
        if not is_trip_participant:
            raise PermissionDenied('A complaint may reference only a trip you participated in.')
    complaint = serializer.save(reporter=request.user)
    _write_audit(request, 'complaint.created', complaint)
    return Response(
        ComplaintSerializer(complaint).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET" ])
@permission_classes([IsAuthenticated])
def complaint_detail(request: Request, pk: int) -> Response:
    queryset = Complaint.objects.select_related(
        'reporter',
        'booking',
        'trip',
        'assigned_to',
    )
    if not _is_admin(request.user):
        queryset = queryset.filter(reporter=request.user)
    complaint = get_object_or_404(queryset, pk=pk)
    if request.method == 'PATCH':
        _require_admin(request.user)
        before = {
            'status': complaint.status,
            'resolution': complaint.resolution,
            'assigned_to_id': complaint.assigned_to_id,
        }
        serializer = ComplaintUpdateSerializer(
            complaint,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        complaint = serializer.save()
        _write_audit(request, 'complaint.updated', complaint, {
            'before': before,
            'after': {
                'status': complaint.status,
                'resolution': complaint.resolution,
                'assigned_to_id': complaint.assigned_to_id,
            },
            'status': complaint.status,
        })
    return Response(ComplaintSerializer(complaint).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def audit_logs(request: Request) -> Response:
    _require_admin(request.user)
    queryset = AuditLog.objects.select_related('actor')
    return _list_response(request, queryset, AuditLogSerializer)


@api_view(["GET"])
@permission_classes([AllowAny])
def healthz(request: Request) -> Response:
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except DatabaseError:
        logger.exception('Health check database query failed.')
        return Response(
            {'status': 'unavailable', 'database': 'unavailable'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response({'status': 'ok', 'database': 'ok'})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notifications(request: Request, format: str | None = None) -> Response:
    queryset = Notification.objects.select_related("user", 'booking')
    if not _is_admin(request.user):
        queryset = queryset.filter(user=request.user)
    return _list_response(request, queryset, NotificationSerializer)


@api_view(["GET" ])
@permission_classes([IsAuthenticated])
def notification_detail(
    request: Request,
    pk: int,
    format: str | None = None,
) -> Response:
    queryset = Notification.objects.select_related("user", 'booking')
    if not _is_admin(request.user):
        queryset = queryset.filter(user=request.user)
    notification = get_object_or_404(queryset, pk=pk)
    if request.method == 'PATCH':
        validate_notification_update(request.data)
        notification.is_read = request.data['is_read']
        notification.save(update_fields=('is_read',))
    return Response(NotificationSerializer(notification).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request: Request) -> Response:
    queryset = Notification.objects.filter(user=request.user)
    updated = queryset.filter(is_read=False).update(is_read=True)
    return Response({'updated': updated})
