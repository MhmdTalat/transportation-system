import logging
from urllib.parse import urlencode, urlsplit

from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError, transaction
from django.db.models import Count, F, Prefetch, ProtectedError, Q, QuerySet
from django.template.loader import render_to_string
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import APIException, NotFound, PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.throttling import ScopedRateThrottle

from .dependencies import get_trip_service
from .analytics import build_analytics_dashboard
from .models import (
    Booking,
    BookingSeat,
    Driver,
    FareRule,
    Notification,
    Payment,
    Route,
    RouteStation,
    Station,
    Trip,
    User,
    Vehicle,
)
from .serializers import (
    BookingCreateSerializer,
    BookingSerializer,
    DriverSerializer,
    FareRuleSerializer,
    ForgotPasswordSerializer,
    NotificationSerializer,
    PaymentSerializer,
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
INVALID_PASSWORD_RESET = 'Your reset link is invalid or has expired. Please request a new one.'
PASSWORD_RESET_GENERIC_RESPONSE = (
    'If an account with that email exists, password reset instructions will be sent.'
)


class PasswordResetRequestThrottle(ScopedRateThrottle):
    scope = 'password_reset_request'


class PasswordResetSubmitThrottle(ScopedRateThrottle):
    scope = 'password_reset_submit'
from .services.trip_service import StationsNotFoundError
from .services.notification_service import create_due_trip_reminders


def _collection_api(
    request: Request,
    queryset: QuerySet,
    serializer_class: type[serializers.BaseSerializer],
) -> Response:
    if request.method == "GET":
        return Response(serializer_class(queryset, many=True).data)

    serializer = serializer_class(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


def _is_admin(user) -> bool:
    return user.role in ('admin', 'authority')


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
    queryset = _trip_queryset().filter(
        is_published=True,
        route__status__iexact='active',
        start_station__is_active=True,
        destination_station__is_active=True,
        driver__status='active',
        driver__user__is_active=True,
        vehicle__status='active',
    ).filter(
        Q(status='scheduled', departure_time__gt=timezone.now())
        | Q(status='in_progress', arrival_time__gt=timezone.now()),
        active_seat_count__lt=F('vehicle__capacity'),
    )
    available_ids = [
        trip_id
        for trip_id, booked, capacity, disabled in queryset.values_list(
            'pk',
            'active_seat_count',
            'vehicle__capacity',
            'vehicle__disabled_seats',
        )
        if booked + len(disabled or []) < capacity
    ]
    return queryset.filter(pk__in=available_ids)


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
        try:
            instance.delete()
        except ProtectedError as exc:
            raise serializers.ValidationError({
                'detail': 'This record is still referenced by existing related data and cannot be deleted.'
            }) from exc
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = serializer_class(
        instance,
        data=request.data,
        partial=request.method == "PATCH",
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


def _trip_queryset() -> QuerySet:
    return Trip.objects.select_related(
        "route",
        "vehicle",
        "driver__user",
        "start_station",
        "destination_station",
        "created_by",
    ).prefetch_related(
        Prefetch(
            "payments",
            queryset=Payment.objects.order_by("pk")[:1],
            to_attr="api_first_payment",
        )
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
    )
    return Response({
        resource: reverse(view_name, request=request, format=format)
        for resource, view_name in resources
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request: Request, format: str | None = None) -> Response:
    serializer = UserRegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


def _password_reset_url(uid: str, token: str) -> str:
    frontend = urlsplit(settings.FRONTEND_BASE_URL)
    if (
        frontend.scheme not in {'http', 'https'}
        or not frontend.netloc
        or frontend.username
        or frontend.password
        or frontend.query
        or frontend.fragment
    ):
        raise ValueError('FRONTEND_BASE_URL must be a valid HTTP(S) origin and path.')
    return (
        f'{settings.FRONTEND_BASE_URL.rstrip("/")}/reset-password?'
        f'{urlencode({"uid": uid, "token": token})}'
    )


def _send_password_reset_email(user: User, uid: str, token: str) -> None:
    reset_url = _password_reset_url(uid, token)
    context = {
        'first_name': user.first_name or user.username,
        'reset_url': reset_url,
        'expiration_minutes': max(1, settings.PASSWORD_RESET_TIMEOUT // 60),
    }
    message = EmailMultiAlternatives(
        subject='Reset Your Transportation Platform Password',
        body=(
            f'Hello {context["first_name"]},\n\n'
            'We received a request to reset your Transportation Platform password. '
            f'Use this link within {context["expiration_minutes"]} minutes:\n'
            f'{reset_url}\n\n'
            'If you did not request this, you can ignore this email.'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    message.attach_alternative(
        render_to_string('core/emails/password_reset.html', context),
        'text/html',
    )
    if message.send(fail_silently=False) != 1:
        raise RuntimeError('Password reset email delivery did not complete.')


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetRequestThrottle])
def forgot_password(request: Request) -> Response:
    serializer = ForgotPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = User.objects.filter(
        email__iexact=serializer.validated_data['email'],
        is_active=True,
    ).exclude(password='').order_by('pk').first()

    if user and user.has_usable_password():
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        try:
            _send_password_reset_email(user, uid, token)
        except Exception:
            logger.error('Password reset email delivery failed.')

    return Response({'detail': PASSWORD_RESET_GENERIC_RESPONSE})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetSubmitThrottle])
def reset_password(request: Request) -> Response:
    serializer = ResetPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        user_id = force_str(urlsafe_base64_decode(serializer.validated_data['uid']))
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=user_id)
            if (
                not user.is_active
                or not user.has_usable_password()
                or not default_token_generator.check_token(
                    user,
                    serializer.validated_data['token'],
                )
            ):
                return Response(
                    {'detail': INVALID_PASSWORD_RESET},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                from django.contrib.auth.password_validation import validate_password

                validate_password(serializer.validated_data['new_password'], user=user)
            except DjangoValidationError as error:
                raise serializers.ValidationError(
                    {'new_password': error.messages}
                ) from error

            user.set_password(serializer.validated_data['new_password'])
            user.save(update_fields=['password'])
    except (User.DoesNotExist, ValueError, TypeError, OverflowError, UnicodeDecodeError):
        return Response(
            {'detail': INVALID_PASSWORD_RESET},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({'detail': 'Your password has been updated.'})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request: Request) -> Response:
    return Response(UserSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_dashboard(request: Request) -> Response:
    _require_admin(request.user)
    return Response(build_analytics_dashboard(request.query_params))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def users(request: Request) -> Response:
    _require_admin(request.user)
    return Response(UserDetailSerializer(
        User.objects.all().order_by('role', 'username'),
        many=True,
    ).data)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def user_detail(request: Request, pk: int) -> Response:
    _require_admin(request.user)
    user = get_object_or_404(User, pk=pk)
    if request.method == 'PATCH':
        if user.role not in ('passenger', 'driver'):
            raise serializers.ValidationError({
                'user': 'Only passenger and driver accounts can be deactivated or reactivated.'
            })
        serializer = UserAccountStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.update(user, serializer.validated_data)
    return Response(UserDetailSerializer(user).data)


def _assignment_window(request: Request):
    departure_value = request.query_params.get('departure_time')
    arrival_value = request.query_params.get('arrival_time')
    if not departure_value or not arrival_value:
        return None, None, None
    departure = parse_datetime(departure_value)
    arrival = parse_datetime(arrival_value)
    if departure is None or arrival is None or arrival <= departure:
        raise serializers.ValidationError({
            'arrival_time': 'Provide a valid arrival after the departure time.'
        })
    if timezone.is_naive(departure):
        departure = timezone.make_aware(departure)
    if timezone.is_naive(arrival):
        arrival = timezone.make_aware(arrival)
    exclude_trip = request.query_params.get('trip_id')
    try:
        trip_id = int(exclude_trip) if exclude_trip else None
    except ValueError as error:
        raise serializers.ValidationError({
            'trip_id': 'Trip ID must be a valid integer.'
        }) from error
    return departure, arrival, trip_id


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
    drivers = Driver.objects.select_related('user', 'vehicle').order_by('user__username')
    driver_conflicts = {}
    if departure and arrival:
        driver_conflicts, _ = _assignment_conflicts(departure, arrival, exclude_trip)
    results = []
    for driver in drivers:
        conflict = driver_conflicts.get(driver.pk)
        available = bool(
            departure
            and arrival
            and driver.status == 'active'
            and driver.user.is_active
            and not conflict
        )
        item = DriverSerializer(driver).data
        item['available'] = available
        item['unavailable_reason'] = (
            f'Assigned to {_conflict_schedule(conflict)}.'
            if conflict else 'Set a valid trip schedule to check availability.'
            if not departure or not arrival else
            'Driver is inactive.'
            if driver.status != 'active' or not driver.user.is_active else None
        )
        results.append(item)
    return Response(results)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def assignment_vehicles(request: Request) -> Response:
    _require_admin(request.user)
    departure, arrival, exclude_trip = _assignment_window(request)
    vehicles = Vehicle.objects.all().order_by('registration_number')
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
        item['unavailable_reason'] = (
            f'Assigned to {_conflict_schedule(conflict)}.'
            if conflict else 'Set a valid trip schedule to check availability.'
            if not departure or not arrival else
            'Vehicle is inactive or under maintenance.'
            if vehicle.status != 'active' else None
        )
        results.append(item)
    return Response(results)


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


@api_view(["GET", "PUT", "PATCH", "DELETE"])
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


@api_view(["GET", "PUT", "PATCH", "DELETE"])
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


@api_view(["GET", "PUT", "PATCH", "DELETE"])
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


@api_view(["GET", "PUT", "PATCH", "DELETE"])
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
            if Trip.objects.filter(
                vehicle=instance,
                status__in=('scheduled', 'in_progress'),
            ).exists():
                raise serializers.ValidationError(
                    'A vehicle assigned to a scheduled or active trip cannot be deleted.'
                )
            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = VehicleSerializer(
            instance,
            data=request.data,
            partial=request.method == 'PATCH',
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def drivers(request: Request, format: str | None = None) -> Response:
    _require_admin(request.user)
    queryset = Driver.objects.select_related("user", "vehicle")
    return _collection_api(request, queryset, DriverSerializer)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
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
            if instance.trips.filter(status__in=('scheduled', 'in_progress')).exists():
                raise serializers.ValidationError(
                    'A driver assigned to a scheduled or active trip cannot be deleted.'
                )
            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = DriverSerializer(
            instance,
            data=request.data,
            partial=request.method == 'PATCH',
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def fare_rules(request: Request, format: str | None = None) -> Response:
    _require_admin(request.user)
    queryset = FareRule.objects.select_related("route")
    return _collection_api(request, queryset, FareRuleSerializer)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
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
        return Response(TripSerializer(queryset, many=True).data)

    _require_admin(request.user)
    with transaction.atomic():
        _lock_assignment_resources(
            (request.data.get('driver'),),
            (request.data.get('vehicle'),),
        )
        serializer = TripSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.validated_data['created_by'] = request.user
        trip = get_trip_service().create_trip(serializer.validated_data)
    return Response(TripSerializer(_trip_queryset().get(pk=trip.pk)).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
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
        return Response(TripSerializer(trip).data)
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
            if (
                request.data['status'] == 'in_progress'
                and trip.status != 'scheduled'
            ) or (
                request.data['status'] == 'completed'
                and trip.status != 'in_progress'
            ):
                raise serializers.ValidationError({
                    'status': 'Trips must be started before they can be completed.'
                })
        if request.method == 'DELETE':
            if trip.bookings.exists():
                raise serializers.ValidationError('Trips with booking history cannot be deleted.')
            trip.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        old_departure = trip.departure_time
        old_status = trip.status
        if _is_admin(request.user):
            _lock_assignment_resources(
                (trip.driver_id, request.data.get('driver')),
                (trip.vehicle_id, request.data.get('vehicle')),
            )
        serializer = TripSerializer(trip, data=request.data, partial=request.method == 'PATCH')
        serializer.is_valid(raise_exception=True)
        updated_trip = serializer.save()
        _notify_trip_changes(updated_trip, old_departure, old_status)
        if updated_trip.status == 'completed':
            _complete_trip_bookings(updated_trip)
        elif updated_trip.status == 'cancelled':
            _cancel_trip_bookings(updated_trip)
    return Response(TripSerializer(updated_trip).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def trip_search(request: Request, format: str | None = None) -> Response:
    if request.method == 'GET':
        _require_role(request.user, 'passenger')
        queryset = _bookable_trips()
        start_station_id = request.query_params.get('start_station_id')
        destination_station_id = request.query_params.get('destination_station_id')
        travel_date = request.query_params.get('date')
        if start_station_id:
            queryset = queryset.filter(start_station_id=start_station_id)
        if destination_station_id:
            queryset = queryset.filter(destination_station_id=destination_station_id)
        if travel_date:
            try:
                date.fromisoformat(travel_date)
            except ValueError as error:
                raise serializers.ValidationError({
                    'date': 'Enter a valid ISO date (YYYY-MM-DD).'
                }) from error
            queryset = queryset.filter(departure_time__date=travel_date)
        return Response(TripSerializer(queryset.order_by('departure_time'), many=True).data)

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


def _create_trip_notification(booking: Booking, title: str, message: str, kind: str) -> None:
    Notification.objects.create(
        user=booking.passenger,
        booking=booking,
        title=title,
        message=message,
        notification_type=kind,
    )


def _notify_trip_changes(trip: Trip, old_departure, old_status: str) -> None:
    if trip.status == 'cancelled':
        return
    bookings = trip.bookings.filter(status='confirmed').select_related('passenger')
    for booking in bookings:
        if trip.departure_time != old_departure:
            _create_trip_notification(
                booking,
                'Trip departure updated',
                f'The departure time for {trip.start_station.name} to '
                f'{trip.destination_station.name} has changed.',
                'trip_status',
            )
        elif trip.status != old_status:
            _create_trip_notification(
                booking,
                'Trip status updated',
                f'Your trip from {trip.start_station.name} to '
                f'{trip.destination_station.name} is now {trip.get_status_display().lower()}.',
                'trip_status',
            )


def _cancel_trip_bookings(trip: Trip) -> None:
    with transaction.atomic():
        bookings = list(
            Booking.objects.select_for_update()
            .filter(trip=trip, status='confirmed')
            .select_related('passenger')
        )
        for booking in bookings:
            booking.status = 'cancelled'
            booking.save(update_fields=('status', 'updated_at'))
            booking.seats.filter(is_active=True).update(is_active=False)
            _create_trip_notification(
                booking,
                'Trip cancelled',
                f'Your trip from {trip.start_station.name} to '
                f'{trip.destination_station.name} has been cancelled.',
                'trip_status',
            )


def _complete_trip_bookings(trip: Trip) -> None:
    Booking.objects.filter(trip=trip, status='confirmed').update(
        status='completed',
        updated_at=timezone.now(),
    )


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
    else:
        raise PermissionDenied('Only passengers and administrators can view seat availability.')

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
                validated_passenger_id = serializers.IntegerField().run_validation(passenger_id)
                queryset = queryset.filter(passenger_id=validated_passenger_id)
        elif request.user.role == 'passenger':
            create_due_trip_reminders(request.user)
            queryset = Booking.objects.filter(passenger=request.user)
        else:
            raise PermissionDenied('Drivers cannot view passenger booking records.')
        queryset = queryset.prefetch_related(
            Prefetch('trip', queryset=_trip_queryset()),
            'seats',
        ).select_related('passenger')
        return Response(BookingSerializer(queryset, many=True).data)

    _require_role(request.user, 'passenger')
    serializer = BookingCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    trip_id = serializer.validated_data['trip']
    seat_numbers = sorted(serializer.validated_data['seat_numbers'])
    try:
        with transaction.atomic():
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
            if not _bookable_trips().filter(pk=trip.pk).exists():
                raise serializers.ValidationError({
                    'trip': 'This trip is no longer available for booking.'
                })
            layout = _available_seat_layout(trip.vehicle)
            configured_seats = {
                seat for row in layout for seat in row if seat is not None
            }
            disabled_seats = set(trip.vehicle.disabled_seats)
            if set(seat_numbers) & disabled_seats:
                seat = min(set(seat_numbers) & disabled_seats)
                raise serializers.ValidationError({
                    'seat_numbers': f'Seat {seat} is disabled and cannot be booked.'
                })
            invalid_seats = sorted(set(seat_numbers) - configured_seats)
            if invalid_seats:
                raise serializers.ValidationError({
                    'seat_numbers': f'Seats are not configured for this vehicle: {invalid_seats}.'
                })
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
            if occupied_count + len(seat_numbers) + len(disabled_seats) > trip.vehicle.capacity:
                raise serializers.ValidationError({
                    'seat_numbers': 'The requested seats exceed the remaining vehicle capacity.'
                })

            booking = Booking.objects.create(
                passenger=request.user,
                trip=trip,
                total_amount=trip.fare_amount * Decimal(len(seat_numbers)),
            )
            BookingSeat.objects.bulk_create([
                BookingSeat(
                    booking=booking,
                    trip=trip,
                    seat_number=seat_number,
                )
                for seat_number in seat_numbers
            ])
            _create_trip_notification(
                booking,
                'Booking confirmed',
                f'Your booking for {trip.start_station.name} to '
                f'{trip.destination_station.name} is confirmed. '
                f'Seats: {", ".join(map(str, seat_numbers))}.',
                'booking_confirmation',
            )
    except IntegrityError as error:
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
        if booking.status != 'confirmed':
            raise serializers.ValidationError('Only confirmed bookings can be cancelled.')
        if (
            trip.status != 'scheduled'
            or not trip.departure_time
            or trip.departure_time <= timezone.now()
        ):
            raise serializers.ValidationError(
                'A booking cannot be cancelled after its trip has started.'
            )
        booking.status = 'cancelled'
        booking.save(update_fields=('status', 'updated_at'))
        booking.seats.filter(is_active=True).update(is_active=False)
        _create_trip_notification(
            booking,
            'Booking cancelled',
            f'Your booking for trip {booking.trip_id} has been cancelled.',
            'trip_status',
        )
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
        result.append({
            'booking_id': booking.pk,
            'passenger_name': booking.passenger.get_full_name() or booking.passenger.username,
            'phone_number': booking.passenger.phone_number,
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
    queryset = Payment.objects.select_related("trip")
    return _collection_api(request, queryset, PaymentSerializer)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def payment_detail(
    request: Request,
    pk: int,
    format: str | None = None,
) -> Response:
    _require_admin(request.user)
    queryset = Payment.objects.select_related("trip")
    return _detail_api(request, queryset, PaymentSerializer, pk)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notifications(request: Request, format: str | None = None) -> Response:
    create_due_trip_reminders(request.user)
    queryset = Notification.objects.select_related("user", 'booking')
    if not _is_admin(request.user):
        queryset = queryset.filter(user=request.user)
    return Response(NotificationSerializer(queryset, many=True).data)


@api_view(["GET", "PATCH"])
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
        if set(request.data) != {'is_read'} or not isinstance(request.data['is_read'], bool):
            raise serializers.ValidationError({
                'is_read': 'Only the read/unread state can be updated.'
            })
        notification.is_read = request.data['is_read']
        notification.save(update_fields=('is_read',))
    return Response(NotificationSerializer(notification).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request: Request) -> Response:
    queryset = Notification.objects.all()
    if not _is_admin(request.user):
        queryset = queryset.filter(user=request.user)
    updated = queryset.filter(is_read=False).update(is_read=True)
    return Response({'updated': updated})
