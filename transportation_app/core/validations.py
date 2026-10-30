from datetime import date, datetime, timedelta
from typing import Mapping

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    Booking,
    Driver,
    EmailVerificationCode,
    PrivateRide,
    RouteStation,
    Trip,
    User,
    Vehicle,
)
from .services.email_verification import check_verification_code


INVALID_PASSWORD_RESET = 'Your reset code is invalid or has expired. Please request a new one.'


class VerifiedEmailTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        identifier = attrs.get(self.username_field, '')
        if '@' in identifier:
            matching_usernames = list(
                User.objects.filter(email__iexact=identifier)
                .values_list('username', flat=True)[:2]
            )
            if len(matching_usernames) == 1:
                attrs[self.username_field] = matching_usernames[0]

        token_data = super().validate(attrs)
        if not self.user.email_verified:
            raise AuthenticationFailed(
                detail={
                    'detail': 'Verify your email address before signing in.',
                    'code': 'email_not_verified',
                },
            )
        return token_data


class VerifiedEmailTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = self.token_class(attrs['refresh'])
        user_id = refresh.payload.get(jwt_settings.USER_ID_CLAIM)
        user = User.objects.filter(
            **{jwt_settings.USER_ID_FIELD: user_id}
        ).only('email_verified').first()
        if user and not user.email_verified:
            raise AuthenticationFailed(
                {
                    'detail': 'Verify your email address before signing in.',
                    'code': 'email_not_verified',
                },
                code='email_not_verified',
            )
        return super().validate(attrs)


def validate_email_verification_result(failure: str | None) -> None:
    if failure:
        raise serializers.ValidationError({'detail': failure})


def validate_refresh_token(value: object) -> RefreshToken:
    if not isinstance(value, str) or not value:
        raise serializers.ValidationError({'refresh': 'A refresh token is required.'})
    try:
        return RefreshToken(value)
    except TokenError as error:
        raise serializers.ValidationError(
            {'refresh': 'The refresh token is invalid.'}
        ) from error


def validate_reset_code(
    user: User | None,
    reset_code: EmailVerificationCode | None,
    submitted_code: str,
    now,
) -> bool:
    if (
        not user
        or not reset_code
        or reset_code.expires_at <= now
        or reset_code.created_at + timedelta(minutes=5) <= now
        or reset_code.attempts >= 5
    ):
        return False
    if check_verification_code(user.pk, submitted_code, reset_code.code_hash):
        return True

    reset_code.attempts += 1
    if reset_code.attempts >= 5:
        reset_code.consumed_at = now
    reset_code.save(update_fields=('attempts', 'consumed_at'))
    return False


def validate_new_password(password: str, user: User) -> None:
    try:
        validate_password(password, user=user)
    except DjangoValidationError as error:
        raise serializers.ValidationError(
            {'new_password': error.messages}
        ) from error


def validate_user_status_target(user: User) -> None:
    if user.role not in ('passenger', 'driver'):
        raise serializers.ValidationError({
            'user': 'Only passenger and driver accounts can be deactivated or reactivated.'
        })


def validate_assignment_window(
    departure_value: str | None,
    arrival_value: str | None,
    exclude_trip: str | None,
) -> tuple[datetime | None, datetime | None, int | None]:
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
    try:
        trip_id = int(exclude_trip) if exclude_trip else None
    except ValueError as error:
        raise serializers.ValidationError({
            'trip_id': 'Trip ID must be a valid integer.'
        }) from error
    return departure, arrival, trip_id


def validate_vehicle_deletion(vehicle: Vehicle) -> None:
    if Trip.objects.filter(
        vehicle=vehicle,
        status__in=('scheduled', 'in_progress'),
    ).exists():
        raise serializers.ValidationError(
            'A vehicle assigned to a scheduled or active trip cannot be deleted.'
        )


def validate_driver_deletion(driver: Driver) -> None:
    if driver.trips.filter(status__in=('scheduled', 'in_progress')).exists():
        raise serializers.ValidationError(
            'A driver assigned to a scheduled or active trip cannot be deleted.'
        )


def validate_driver_approval(driver: Driver, verification_status: str) -> None:
    if verification_status != 'approved':
        return
    required_types = {'drivers_license', 'identity'}
    if driver.vehicle_id:
        required_types.add('vehicle_registration')
    latest_documents = {}
    for document in driver.documents.order_by('-created_at'):
        latest_documents.setdefault(document.document_type, document.status)
    missing = sorted(
        document_type
        for document_type in required_types
        if latest_documents.get(document_type) != 'approved'
    )
    if missing:
        document_names = {
            'drivers_license': "Driver's license",
            'identity': 'Identity document',
            'vehicle_registration': 'Vehicle registration',
        }
        raise serializers.ValidationError({
            'documents': (
                'The latest required documents must all be approved: '
                + ', '.join(document_names[document_type] for document_type in missing)
            )
        })


def validate_operational_setting_value(key: str, value: int) -> None:
    if key == 'max_active_upcoming_bookings' and value < 1:
        raise serializers.ValidationError({
            'value': 'At least one upcoming booking must be allowed.'
        })


def validate_driver_trip_vehicle(driver: Driver) -> None:
    if not driver.vehicle_id or driver.vehicle.status != 'active':
        raise serializers.ValidationError(
            'An approved driver must have an active assigned vehicle to submit a trip.'
        )


def validate_trip_status_transition(requested_status: str, current_status: str) -> None:
    if current_status in ('completed', 'cancelled'):
        raise serializers.ValidationError({
            'status': f'The trip is already {current_status} and its status cannot be changed.'
        })
    if (
        requested_status == 'in_progress' and current_status != 'scheduled'
    ) or (
        requested_status == 'completed' and current_status != 'in_progress'
    ):
        raise serializers.ValidationError({
            'status': 'Trips must be started before they can be completed.'
        })


def validate_trip_deletion(trip: Trip) -> None:
    protected_bookings = trip.bookings.exclude(status='cancelled')
    if protected_bookings.exists():
        booking_count = protected_bookings.count()
        raise serializers.ValidationError(
            f'This trip has {booking_count} booking record(s) and cannot be deleted. '
            'Cancel the trip instead.'
        )


def validate_search_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise serializers.ValidationError({
            'date': 'Enter a valid ISO date (YYYY-MM-DD).'
        }) from error


def validate_passenger_filter(value: str):
    return serializers.IntegerField().run_validation(value)


def validate_idempotency_key(value: str) -> None:
    if len(value) > 128:
        raise serializers.ValidationError({
            'Idempotency-Key': 'The key must be 128 characters or fewer.'
        })


def validate_bookable_trip(is_bookable: bool) -> None:
    if not is_bookable:
        raise serializers.ValidationError({
            'trip': 'This trip is no longer available for booking.'
        })


def validate_booking_stops(
    trip: Trip,
    pickup_stop: RouteStation | None,
    dropoff_stop: RouteStation | None,
) -> None:
    if not pickup_stop or not dropoff_stop:
        return
    route_stops = RouteStation.objects.filter(
        route_id=trip.route_id,
        sequence_order__gte=pickup_stop.sequence_order,
        sequence_order__lte=dropoff_stop.sequence_order,
    )
    if (
        pickup_stop.route_id != trip.route_id
        or dropoff_stop.route_id != trip.route_id
        or not route_stops.filter(pk=pickup_stop.pk).exists()
        or not route_stops.filter(pk=dropoff_stop.pk).exists()
    ):
        raise serializers.ValidationError({
            'pickup_stop': 'Pickup and drop-off must be on this trip route.'
        })
    trip_start_order = RouteStation.objects.get(
        route_id=trip.route_id,
        station_id=trip.start_station_id,
    ).sequence_order
    trip_end_order = RouteStation.objects.get(
        route_id=trip.route_id,
        station_id=trip.destination_station_id,
    ).sequence_order
    if (
        pickup_stop.sequence_order < trip_start_order
        or dropoff_stop.sequence_order > trip_end_order
    ):
        raise serializers.ValidationError({
            'pickup_stop': 'The selected segment must be within the trip stops.'
        })


def validate_active_booking_limit(active_count: int, limit: int) -> None:
    if active_count >= limit:
        raise serializers.ValidationError({
            'code': 'booking_limit_reached',
            'detail': f'You may have at most {limit} active upcoming bookings.',
        })


def validate_booking_seats(
    seat_numbers: list[int],
    vehicle: Vehicle,
    layout: list[list[int | None]],
) -> None:
    configured_seats = {seat for row in layout for seat in row if seat is not None}
    disabled_seats = set(vehicle.disabled_seats)
    disabled_requested = set(seat_numbers) & disabled_seats
    if disabled_requested:
        seat = min(disabled_requested)
        raise serializers.ValidationError({
            'seat_numbers': f'Seat {seat} is disabled and cannot be booked.'
        })
    invalid_seats = sorted(set(seat_numbers) - configured_seats)
    if invalid_seats:
        raise serializers.ValidationError({
            'seat_numbers': f'Seats are not configured for this vehicle: {invalid_seats}.'
        })


def validate_booking_capacity(
    seat_numbers: list[int],
    vehicle: Vehicle,
    occupied_count: int,
) -> None:
    disabled_seats = set(vehicle.disabled_seats)
    if occupied_count + len(seat_numbers) + len(disabled_seats) > vehicle.capacity:
        raise serializers.ValidationError({
            'seat_numbers': 'The requested seats exceed the remaining vehicle capacity.'
        })


def validate_booking_cancellation(
    booking: Booking,
    trip: Trip,
    cutoff_hours: int,
    now: datetime,
) -> None:
    if booking.status != 'confirmed':
        raise serializers.ValidationError('Only confirmed bookings can be cancelled.')
    if (
        trip.status != 'scheduled'
        or not trip.departure_time
        or trip.departure_time <= now
    ):
        raise serializers.ValidationError(
            'A booking cannot be cancelled after its trip has started.'
        )
    if trip.departure_time <= now + timedelta(hours=cutoff_hours):
        raise serializers.ValidationError({
            'code': 'cancellation_window_closed',
            'detail': (
                f'Bookings can only be cancelled at least {cutoff_hours} hours '
                'before departure.'
            ),
        })


def validate_private_ride_accept(ride: PrivateRide, driver: Driver) -> None:
    if ride.status != 'requested' or ride.driver_id is not None:
        raise serializers.ValidationError('This private ride is no longer available.')
    if PrivateRide.objects.filter(driver=driver, status='accepted').exists():
        raise serializers.ValidationError(
            'Complete or cancel your active private ride before accepting another.'
        )


def validate_private_ride_cancellation(ride: PrivateRide) -> None:
    if ride.status not in {'requested', 'accepted'}:
        raise serializers.ValidationError('This private ride cannot be cancelled.')


def validate_private_ride_rejection(ride: PrivateRide) -> None:
    if ride.status != 'requested' or ride.driver_id is not None:
        raise serializers.ValidationError('Only open private rides can be rejected.')


def validate_complaint_booking_trip(booking: Booking | None, trip: Trip | None) -> None:
    if booking and trip and booking.trip_id != trip.pk:
        raise serializers.ValidationError({
            'trip': 'The trip must match the referenced booking.'
        })


def validate_notification_update(data: Mapping[str, object]) -> None:
    if set(data) != {'is_read'} or not isinstance(data['is_read'], bool):
        raise serializers.ValidationError({
            'is_read': 'Only the read/unread state can be updated.'
        })


def validate_reset_result() -> None:
    raise serializers.ValidationError({'detail': INVALID_PASSWORD_RESET})


def raise_protected_deletion_error(error: ProtectedError) -> None:
    raise serializers.ValidationError({
        'detail': 'This record is still referenced by existing related data and cannot be deleted.'
    }) from error
