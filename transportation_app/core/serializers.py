from datetime import timedelta

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

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


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'first_name',
            'last_name',
            'email',
            'role',
            'phone_number',
            'profile_photo_url',
        )


class UserDetailSerializer(UserSerializer):
    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ('is_active', 'date_joined')


class UserAccountStatusSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()

    def update(self, instance, validated_data):
        instance.is_active = validated_data['is_active']
        instance.save(update_fields=['is_active'])
        return instance


class UserRegistrationSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(
        choices=(('passenger', 'Passenger'), ('driver', 'Driver')),
        required=False,
        default='passenger',
    )
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone_number = serializers.CharField(
        max_length=20, required=False, allow_blank=True, allow_null=True
    )
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = (
            'username',
            'first_name',
            'last_name',
            'email',
            'phone_number',
            'password',
            'role',
        )

    def validate_email(self, value):
        email = value.strip()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('A user with this email address already exists.')
        return email

    def validate(self, attrs):
        prospective_user = User(
            username=attrs.get('username'),
            first_name=attrs.get('first_name'),
            last_name=attrs.get('last_name'),
            email=attrs.get('email'),
        )
        try:
            validate_password(attrs['password'], user=prospective_user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({'password': error.messages}) from error
        return attrs

    def create(self, validated_data):
        role = validated_data.pop('role')
        with transaction.atomic():
            user = User.objects.create_user(
                **validated_data,
                role=role,
                email_verified=False,
            )
            if role == 'driver':
                Driver.objects.create(user=user)
        return user


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class EmailVerificationRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class EmailVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(regex=r'^\d{6}$')


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        min_length=1,
    )


class StationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Station
        fields = '__all__'


class RouteStationSerializer(serializers.ModelSerializer):
    station = StationSerializer(read_only=True)
    station_id = serializers.PrimaryKeyRelatedField(
        source='station',
        queryset=Station.objects.all(),
        write_only=True,
    )

    class Meta:
        model = RouteStation
        fields = '__all__'


class RouteSerializer(serializers.ModelSerializer):
    route_stations = RouteStationSerializer(many=True, read_only=True)

    class Meta:
        model = Route
        fields = '__all__'


class VehicleSerializer(serializers.ModelSerializer):
    disabled_seats = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
    )
    seat_layout = serializers.ListField(
        child=serializers.ListField(
            child=serializers.IntegerField(min_value=1, allow_null=True),
        ),
        required=False,
    )

    class Meta:
        model = Vehicle
        fields = '__all__'

    def validate(self, attrs):
        capacity = attrs.get('capacity', getattr(self.instance, 'capacity', 30))
        layout = attrs.get('seat_layout', getattr(self.instance, 'seat_layout', []))
        disabled_seats = attrs.get(
            'disabled_seats',
            getattr(self.instance, 'disabled_seats', []),
        )
        status_value = attrs.get('status', getattr(self.instance, 'status', 'active'))
        if capacity < 1:
            raise serializers.ValidationError({'capacity': 'A vehicle must have at least one seat.'})
        if (
            len(disabled_seats) != len(set(disabled_seats))
            or any(seat > capacity for seat in disabled_seats)
        ):
            raise serializers.ValidationError({
                'disabled_seats': 'Disabled seats must be unique numbers within the vehicle capacity.'
            })
        if layout:
            seat_numbers = [seat for row in layout for seat in row if seat is not None]
            if len(seat_numbers) != len(set(seat_numbers)):
                raise serializers.ValidationError({
                    'seat_layout': 'Each seat number must appear only once.'
                })
            if set(seat_numbers) != set(range(1, capacity + 1)):
                raise serializers.ValidationError({
                    'seat_layout': 'The layout must contain each seat from 1 to capacity exactly once.'
                })
        if self.instance:
            active_seats = BookingSeat.objects.filter(
                trip__vehicle=self.instance,
                is_active=True,
            )
            if active_seats.filter(seat_number__gt=capacity).exists():
                raise serializers.ValidationError({
                    'capacity': 'Capacity cannot be reduced below currently reserved seats.'
                })
            if active_seats.filter(seat_number__in=disabled_seats).exists():
                raise serializers.ValidationError({
                    'disabled_seats': 'A reserved seat cannot be marked as disabled.'
                })
            if layout:
                configured_seats = {seat for row in layout for seat in row if seat is not None}
                if active_seats.exclude(seat_number__in=configured_seats).exists():
                    raise serializers.ValidationError({
                        'seat_layout': 'The new layout must keep every currently reserved seat.'
                    })
            if status_value != 'active' and Trip.objects.filter(
                vehicle=self.instance,
                status__in=('scheduled', 'in_progress'),
                bookings__status='confirmed',
            ).exists():
                raise serializers.ValidationError({
                    'status': 'A vehicle with confirmed upcoming passengers cannot be taken out of service.'
                })
        return attrs


class DriverSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Driver
        fields = '__all__'

    def validate(self, attrs):
        status_value = attrs.get('status', getattr(self.instance, 'status', 'active'))
        vehicle = attrs.get('vehicle', getattr(self.instance, 'vehicle', None))
        if self.instance and vehicle:
            if vehicle.status != 'active':
                raise serializers.ValidationError({
                    'vehicle': 'Only active vehicles can be assigned to a driver.'
                })
            other_assignment = Driver.objects.filter(vehicle=vehicle).exclude(
                pk=self.instance.pk
            )
            if other_assignment.exists():
                raise serializers.ValidationError({
                    'vehicle': 'This vehicle is already assigned to another driver.'
                })
        if self.instance and status_value != 'active' and Trip.objects.filter(
            driver=self.instance,
            status__in=('scheduled', 'in_progress'),
            bookings__status='confirmed',
        ).exists():
            raise serializers.ValidationError({
                'status': 'A driver with confirmed upcoming passengers cannot be deactivated.'
            })
        return attrs


class FareRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = FareRule
        fields = '__all__'


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'


class NotificationSerializer(serializers.ModelSerializer):
    user = serializers.IntegerField(source='user_id', read_only=True)

    class Meta:
        model = Notification
        fields = ('id', 'user', 'booking', 'title', 'message', 'notification_type', 'is_read', 'created_at')
        read_only_fields = fields


class TripSerializer(serializers.ModelSerializer):
    payment = serializers.SerializerMethodField()
    booked_seats = serializers.SerializerMethodField()
    available_seats = serializers.SerializerMethodField()
    vehicle_capacity = serializers.SerializerMethodField()
    start_station_name = serializers.CharField(source='start_station.name', read_only=True)
    destination_station_name = serializers.CharField(source='destination_station.name', read_only=True)
    vehicle_registration = serializers.CharField(source='vehicle.registration_number', read_only=True, allow_null=True)

    class Meta:
        model = Trip
        fields = '__all__'
        read_only_fields = ('created_by',)

    def validate(self, attrs):
        data = {
            field: attrs.get(field, getattr(self.instance, field, None))
            for field in (
                'route',
                'vehicle',
                'driver',
                'start_station',
                'destination_station',
                'departure_time',
                'arrival_time',
                'status',
                'is_published',
            )
        }
        vehicle = data['vehicle']
        driver = data['driver']

        if vehicle and vehicle.status != 'active':
            raise serializers.ValidationError({'vehicle': 'Only active vehicles can be assigned.'})
        if driver and (driver.status != 'active' or not driver.user.is_active):
            raise serializers.ValidationError({'driver': 'Only active drivers can be assigned.'})
        if driver and driver.user.role != 'driver':
            raise serializers.ValidationError({'driver': 'Only registered driver accounts can be assigned.'})

        start_station = data['start_station']
        destination_station = data['destination_station']
        if start_station and destination_station:
            if start_station.pk == destination_station.pk:
                raise serializers.ValidationError({
                    'destination_station': 'Start and destination stations must differ.'
                })
            if data['route']:
                positions = {
                    item.station_id: item.sequence_order
                    for item in data['route'].route_stations.filter(
                        station_id__in=(start_station.pk, destination_station.pk)
                    )
                }
                start_order = positions.get(start_station.pk)
                destination_order = positions.get(destination_station.pk)
                if (
                    start_order is None
                    or destination_order is None
                    or start_order >= destination_order
                ):
                    raise serializers.ValidationError({
                        'route': 'The route must include the selected stations in travel order.'
                    })

        if data['is_published']:
            required = (
                'route',
                'vehicle',
                'driver',
                'start_station',
                'destination_station',
                'departure_time',
                'arrival_time',
            )
            missing = [field for field in required if data[field] is None]
            if missing:
                raise serializers.ValidationError({
                    'is_published': f'Assign a route, active vehicle and driver, departure, and arrival before publishing. Missing: {", ".join(missing)}.'
                })
            if data['arrival_time'] <= data['departure_time']:
                raise serializers.ValidationError({
                    'arrival_time': 'Arrival must be after departure.'
                })
            if data['route'].status.strip().casefold() != 'active':
                raise serializers.ValidationError({'route': 'Only active routes can be published.'})
            if not start_station.is_active or not destination_station.is_active:
                raise serializers.ValidationError({
                    'start_station': 'Published trips require active stations.'
                })
            if data['status'] == 'scheduled' and data['departure_time'] <= timezone.now():
                raise serializers.ValidationError({
                    'departure_time': 'A trip must depart in the future to be published.'
                })

        if self.instance and self.instance.bookings.filter(status='confirmed').exists():
            active_seats = BookingSeat.objects.filter(
                trip=self.instance,
                is_active=True,
            )
            if not vehicle or active_seats.filter(seat_number__gt=vehicle.capacity).exists():
                raise serializers.ValidationError({
                    'vehicle': 'The assigned vehicle must accommodate all confirmed passenger seats.'
                })
            if active_seats.filter(seat_number__in=vehicle.disabled_seats).exists():
                raise serializers.ValidationError({
                    'vehicle': 'The vehicle cannot disable a seat that is already booked.'
                })
            configured_seats = {
                seat
                for row in (vehicle.seat_layout or [])
                for seat in row
                if seat is not None
            }
            if configured_seats and active_seats.exclude(
                seat_number__in=configured_seats
            ).exists():
                raise serializers.ValidationError({
                    'vehicle': 'The vehicle seat layout must preserve all currently booked seats.'
                })

        if data['status'] not in ('cancelled', 'completed'):
            self._validate_assignment_conflicts(data, vehicle, driver)
        return attrs

    def _validate_assignment_conflicts(self, data, vehicle, driver):
        from django.db.models import Q

        if not vehicle and not driver:
            return
        departure = data['departure_time']
        arrival = data['arrival_time']
        if not departure:
            return
        if not arrival:
            duration = data['route'].duration_minutes if data['route'] else None
            arrival = departure + timedelta(minutes=duration or 60)
        candidates = Trip.objects.filter(
            status__in=('scheduled', 'in_progress'),
        ).filter(
            Q(vehicle=vehicle) if vehicle else Q(driver=driver)
        )
        if vehicle and driver:
            candidates = Trip.objects.filter(
                status__in=('scheduled', 'in_progress'),
            ).filter(Q(vehicle=vehicle) | Q(driver=driver))
        if self.instance:
            candidates = candidates.exclude(pk=self.instance.pk)
        for existing in candidates.select_related('route'):
            if existing.status == 'in_progress':
                conflicting_field = (
                    'driver' if driver and existing.driver_id == driver.pk else 'vehicle'
                )
                assigned_resource = (
                    driver.user.get_full_name() or driver.user.username
                    if conflicting_field == 'driver' and driver
                    else vehicle.registration_number
                )
                raise serializers.ValidationError({
                    conflicting_field: (
                        f'{conflicting_field.capitalize()} {assigned_resource} is already on '
                        f'an active trip (trip {existing.pk}).'
                    )
                })
            if not existing.departure_time:
                raise serializers.ValidationError({
                    'driver' if driver and existing.driver_id == driver.pk else 'vehicle':
                    'The selected driver or vehicle already has an active assignment without a scheduled time.'
                })
            existing_end = existing.arrival_time
            if not existing_end:
                duration = existing.route.duration_minutes or 60
                existing_end = existing.departure_time + timedelta(minutes=duration)
            if departure < existing_end and arrival > existing.departure_time:
                conflicting_field = (
                    'driver' if driver and existing.driver_id == driver.pk else 'vehicle'
                )
                assigned_resource = (
                    driver.user.get_full_name() or driver.user.username
                    if conflicting_field == 'driver' and driver
                    else vehicle.registration_number
                )
                raise serializers.ValidationError({
                    conflicting_field: (
                        f'{conflicting_field.capitalize()} {assigned_resource} is already '
                        f'assigned to trip {existing.pk} during this period.'
                    )
                })

    def get_booked_seats(self, obj):
        count = getattr(obj, 'active_seat_count', None)
        return count if count is not None else obj.booked_seats.filter(is_active=True).count()

    def get_available_seats(self, obj):
        capacity = self.get_vehicle_capacity(obj)
        disabled = len(obj.vehicle.disabled_seats) if obj.vehicle else 0
        return max(capacity - self.get_booked_seats(obj) - disabled, 0)

    def get_vehicle_capacity(self, obj):
        return obj.vehicle.capacity if obj.vehicle else 0

    def get_payment(self, obj):
        if hasattr(obj, 'api_first_payment'):
            payments = obj.api_first_payment
            payment = payments[0] if payments else None
        else:
            payment = obj.payments.first()
        if payment is None:
            return None
        return PaymentSerializer(payment).data


class BookingSerializer(serializers.ModelSerializer):
    passenger = UserSerializer(read_only=True)
    trip = TripSerializer(read_only=True)
    seat_numbers = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            'id',
            'passenger',
            'trip',
            'seat_numbers',
            'status',
            'total_amount',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields

    def get_seat_numbers(self, obj):
        return [seat.seat_number for seat in obj.seats.all()]


class BookingCreateSerializer(serializers.Serializer):
    trip = serializers.IntegerField()
    seat_numbers = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=1,
        max_length=10,
    )

    def validate_seat_numbers(self, values):
        if len(values) != len(set(values)):
            raise serializers.ValidationError('Select each seat only once.')
        return values

class TripSearchSerializer(serializers.Serializer):
    start_station_id = serializers.IntegerField()
    destination_station_id = serializers.IntegerField()

    def validate(self, attrs):
        start_station_id = attrs.get('start_station_id')
        destination_station_id = attrs.get('destination_station_id')
        if start_station_id == destination_station_id:
            raise serializers.ValidationError('Start and destination stations must be different.')
        return attrs
