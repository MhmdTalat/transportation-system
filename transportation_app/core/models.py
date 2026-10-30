from decimal import Decimal
from uuid import uuid4

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone
from django.core.files.storage import FileSystemStorage


private_document_storage = FileSystemStorage(
    location=settings.PRIVATE_MEDIA_ROOT,
    base_url=None,
)


def driver_document_path(instance, filename):
    suffix = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'bin'
    return f'driver-documents/{instance.driver_id}/{uuid4().hex}.{suffix}'


class User(AbstractUser):
    ROLE_CHOICES = (
        ('passenger', 'Passenger'),
        ('driver', 'Driver'),
        ('admin', 'Admin'),
        ('authority', 'Authority'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='passenger')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    profile_photo_url = models.URLField(blank=True, null=True)
    email_verified = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_user'
        indexes = [
            models.Index(fields=('created_at',), name='user_created_at_idx'),
            models.Index(fields=('last_login',), name='user_last_login_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower('email'),
                condition=~Q(email=''),
                name='unique_user_email_ci',
            ),
        ]


class Station(models.Model):
    name = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    governorate = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'station'

    def __str__(self):
        return self.name


class Route(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    distance_km = models.FloatField(blank=True, null=True)
    duration_minutes = models.IntegerField(blank=True, null=True)
    status = models.CharField(max_length=100, default='active')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'route'

    def __str__(self):
        return self.name


class RouteStation(models.Model):
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='route_stations')
    station = models.ForeignKey(Station, on_delete=models.CASCADE, related_name='route_stations')
    sequence_order = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'route_station'
        ordering = ('sequence_order',)
        unique_together = ('route', 'station')
        constraints = [
            models.UniqueConstraint(
                fields=('route', 'sequence_order'),
                name='unique_route_station_sequence',
            ),
        ]

    def __str__(self):
        return f'{self.route.name} -> {self.station.name}'


class Vehicle(models.Model):
    registration_number = models.CharField(max_length=255, unique=True)
    capacity = models.PositiveIntegerField(default=30)
    seat_layout = models.JSONField(default=list, blank=True)
    disabled_seats = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=100, default='active')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'vehicle'
        constraints = [
            models.CheckConstraint(
                condition=Q(capacity__gte=1),
                name='vehicle_capacity_positive',
            ),
        ]

    def __str__(self):
        return self.registration_number


class Driver(models.Model):
    VERIFICATION_STATUSES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='driver_profile')
    vehicle = models.OneToOneField(Vehicle, on_delete=models.SET_NULL, blank=True, null=True, related_name='driver')
    status = models.CharField(max_length=100, default='active')
    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_STATUSES,
        default='pending',
    )
    verified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='verified_drivers',
    )
    verified_at = models.DateTimeField(blank=True, null=True)
    rejection_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'driver'

    def __str__(self):
        return self.user.get_full_name() or self.user.username


class EmailVerificationCode(models.Model):
    PURPOSE_CHOICES = (
        ('email_verification', 'Email verification'),
        ('password_reset', 'Password reset'),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='email_verification_codes',
    )
    purpose = models.CharField(
        max_length=32,
        choices=PURPOSE_CHOICES,
        default='email_verification',
    )
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'email_verification_code'
        indexes = [
            models.Index(fields=('user', '-created_at'), name='email_code_user_created_idx'),
        ]


class DriverDocument(models.Model):
    DOCUMENT_TYPES = (
        ('drivers_license', "Driver's license"),
        ('vehicle_registration', 'Vehicle registration'),
        ('identity', 'Identity document'),
    )
    REVIEW_STATUSES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )

    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPES)
    file = models.FileField(storage=private_document_storage, upload_to=driver_document_path)
    original_filename = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=REVIEW_STATUSES, default='pending')
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='reviewed_driver_documents',
    )
    reviewed_at = models.DateTimeField(blank=True, null=True)
    rejection_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'driver_document'
        ordering = ('-created_at',)


class FareRule(models.Model):
    RULE_TYPES = (
        ('fixed', 'Fixed'),
        ('distance', 'Distance-based'),
        ('station_count', 'Station-count-based'),
    )

    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='fare_rules')
    rule_type = models.CharField(max_length=20, choices=RULE_TYPES, default='fixed')
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    base_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    per_km_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    per_station_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    valid_from = models.DateTimeField(blank=True, null=True)
    valid_to = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'fare_rule'

    def calculate_amount(self, route, start_station, destination_station):
        route_stations = list(route.route_stations.all().order_by('sequence_order'))
        positions = {
            item.station_id: index
            for index, item in enumerate(route_stations)
        }
        start_pos = positions.get(start_station.id)
        destination_pos = positions.get(destination_station.id)
        segment_ratio = (
            Decimal(destination_pos - start_pos) / Decimal(len(route_stations) - 1)
            if (
                start_pos is not None
                and destination_pos is not None
                and start_pos < destination_pos
                and len(route_stations) > 1
            )
            else Decimal('1')
        )
        if self.rule_type == 'distance':
            distance = Decimal(str(route.distance_km or 0)) * segment_ratio
            return self.base_amount + (self.per_km_rate * distance)
        if self.rule_type == 'station_count':
            if start_pos is None or destination_pos is None or start_pos >= destination_pos:
                return self.base_amount
            stations_traveled = destination_pos - start_pos
            return self.base_amount + (self.per_station_rate * stations_traveled)
        return self.amount * segment_ratio


class Trip(models.Model):
    STATUS_CHOICES = (
        ('scheduled', 'Scheduled'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )

    route = models.ForeignKey(Route, on_delete=models.PROTECT, related_name='trips')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, blank=True, null=True, related_name='trips')
    driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, blank=True, null=True, related_name='trips')
    start_station = models.ForeignKey(Station, on_delete=models.PROTECT, related_name='started_trips')
    destination_station = models.ForeignKey(Station, on_delete=models.PROTECT, related_name='arrived_trips')
    departure_time = models.DateTimeField(blank=True, null=True)
    arrival_time = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    is_published = models.BooleanField(default=False)
    fare_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True, related_name='created_trips')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'trip'
        indexes = [
            models.Index(fields=('created_at',), name='trip_created_at_idx'),
            models.Index(fields=('status', 'is_published', 'departure_time'), name='trip_public_departure_idx'),
            models.Index(fields=('driver', 'status', 'departure_time'), name='trip_driver_status_idx'),
            models.Index(fields=('vehicle', 'status', 'departure_time'), name='trip_vehicle_status_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(arrival_time__isnull=True) | Q(departure_time__isnull=True) | Q(arrival_time__gt=models.F('departure_time')),
                name='trip_arrival_after_departure',
            ),
            models.CheckConstraint(condition=Q(fare_amount__gte=0), name='trip_fare_nonnegative'),
        ]

    def __str__(self):
        return f'{self.route.name} ({self.status})'


class Booking(models.Model):
    STATUS_CHOICES = (
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    )

    passenger = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='bookings',
    )
    trip = models.ForeignKey(Trip, on_delete=models.PROTECT, related_name='bookings')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='confirmed')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    idempotency_key = models.CharField(max_length=128, blank=True, null=True)
    pickup_stop = models.ForeignKey(
        RouteStation,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name='pickup_bookings',
    )
    dropoff_stop = models.ForeignKey(
        RouteStation,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name='dropoff_bookings',
    )
    cancelled_at = models.DateTimeField(blank=True, null=True)
    cancelled_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='cancelled_bookings',
    )
    cancellation_reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'booking'
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('passenger', 'status', '-created_at'), name='booking_passenger_status_idx'),
            models.Index(fields=('trip', 'status'), name='booking_trip_status_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=('passenger', 'idempotency_key'),
                condition=Q(idempotency_key__isnull=False),
                name='unique_booking_idempotency',
            ),
            models.CheckConstraint(condition=Q(total_amount__gte=0), name='booking_total_nonnegative'),
        ]

    def __str__(self):
        return f'Booking {self.pk} for {self.trip}'


class BookingSeat(models.Model):
    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='seats',
    )
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='booked_seats')
    seat_number = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'booking_seat'
        ordering = ('seat_number',)
        constraints = [
            models.UniqueConstraint(
                fields=('trip', 'seat_number'),
                condition=Q(is_active=True),
                name='unique_active_trip_seat',
            ),
            models.UniqueConstraint(
                fields=('booking', 'seat_number'),
                name='unique_booking_seat',
            ),
        ]

    def __str__(self):
        return f'{self.trip_id}:{self.seat_number}'


class Payment(models.Model):
    PAYMENT_METHODS = (
        ('cash', 'Cash'),
        ('wallet', 'Wallet'),
        ('paymob', 'Paymob'),
        ('fawry', 'Fawry'),
        ('stripe', 'Stripe'),
    )
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
        ('refunded', 'Refunded'),
        ('legacy', 'Legacy'),
    )

    booking = models.ForeignKey(
        Booking,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name='payments',
    )
    trip = models.ForeignKey(
        Trip,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='payments',
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='cash')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    provider_reference = models.CharField(max_length=255, blank=True)
    provider_payload = models.JSONField(default=dict, blank=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment'
        constraints = [
            models.CheckConstraint(condition=Q(amount__gte=0), name='payment_amount_nonnegative'),
        ]
        indexes = [
            models.Index(fields=('status', 'created_at'), name='payment_status_created_idx'),
        ]


class PrivateRide(models.Model):
    STATUS_CHOICES = (
        ('requested', 'Requested'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    )

    passenger = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='private_rides',
    )
    driver = models.ForeignKey(
        Driver,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name='private_rides',
    )
    pickup_address = models.CharField(max_length=500)
    destination_address = models.CharField(max_length=500)
    pickup_latitude = models.FloatField()
    pickup_longitude = models.FloatField()
    destination_latitude = models.FloatField()
    destination_longitude = models.FloatField()
    fare_amount = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    accepted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'private_ride'
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('status', 'created_at'), name='private_ride_status_idx'),
            models.Index(fields=('passenger', 'status'), name='private_ride_passenger_idx'),
            models.Index(fields=('driver', 'status'), name='private_ride_driver_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(fare_amount__isnull=True) | Q(fare_amount__gte=0),
                name='private_ride_fare_nonnegative',
            ),
        ]


class Complaint(models.Model):
    STATUS_CHOICES = (
        ('open', 'Open'),
        ('under_review', 'Under review'),
        ('resolved', 'Resolved'),
        ('rejected', 'Rejected'),
    )

    reporter = models.ForeignKey(User, on_delete=models.PROTECT, related_name='complaints')
    booking = models.ForeignKey(
        Booking,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='complaints',
    )
    trip = models.ForeignKey(
        Trip,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='complaints',
    )
    subject = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    resolution = models.TextField(blank=True)
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='assigned_complaints',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'complaint'
        ordering = ('-created_at',)


class AuditLog(models.Model):
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='audit_events',
    )
    action = models.CharField(max_length=100)
    object_type = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_log'
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('actor', '-created_at'), name='audit_actor_created_idx'),
            models.Index(fields=('object_type', 'object_id'), name='audit_object_idx'),
        ]


class EmailOutbox(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('failed', 'Failed'),
        ('sent', 'Sent'),
    )

    recipient_email = models.EmailField()
    subject = models.CharField(max_length=255)
    body = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    attempts = models.PositiveSmallIntegerField(default=0)
    available_at = models.DateTimeField(default=timezone.now)
    last_error = models.TextField(blank=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'email_outbox'
        indexes = [
            models.Index(fields=('status', 'available_at'), name='outbox_status_available_idx'),
        ]


class OperationalSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.CharField(max_length=255)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='updated_operational_settings',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'operational_setting'


class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('booking_confirmation', 'Booking Confirmation'),
        ('trip_reminder', 'Trip Reminder'),
        ('trip_status', 'Trip Status'),
        ('vehicle_proximity', 'Vehicle Proximity'),
        ('fare_change', 'Fare Change'),
        ('admin_broadcast', 'Admin Broadcast'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    booking = models.ForeignKey(
        Booking,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='notifications',
    )
    dedupe_key = models.CharField(max_length=120, blank=True, null=True, unique=True)
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES, default='trip_status')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notification'
        ordering = ('-created_at',)
