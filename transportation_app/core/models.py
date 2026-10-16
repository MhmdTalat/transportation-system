from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q


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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_user'
        indexes = [
            models.Index(fields=('created_at',), name='user_created_at_idx'),
            models.Index(fields=('last_login',), name='user_last_login_idx'),
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

    def __str__(self):
        return self.registration_number


class Driver(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='driver_profile')
    vehicle = models.OneToOneField(Vehicle, on_delete=models.SET_NULL, blank=True, null=True, related_name='driver')
    status = models.CharField(max_length=100, default='active')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'driver'

    def __str__(self):
        return self.user.get_full_name() or self.user.username


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
        if self.rule_type == 'distance':
            distance = route.distance_km or 0
            return self.base_amount + (self.per_km_rate * distance)
        if self.rule_type == 'station_count':
            route_stations = list(route.route_stations.all().order_by('sequence_order'))
            positions = {item.station_id: index for index, item in enumerate(route_stations)}
            start_pos = positions.get(start_station.id)
            destination_pos = positions.get(destination_station.id)
            if start_pos is None or destination_pos is None or start_pos >= destination_pos:
                return self.base_amount
            stations_traveled = destination_pos - start_pos
            return self.base_amount + (self.per_station_rate * stations_traveled)
        return self.amount


class Trip(models.Model):
    STATUS_CHOICES = (
        ('scheduled', 'Scheduled'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )

    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='trips')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, blank=True, null=True, related_name='trips')
    driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, blank=True, null=True, related_name='trips')
    start_station = models.ForeignKey(Station, on_delete=models.CASCADE, related_name='started_trips')
    destination_station = models.ForeignKey(Station, on_delete=models.CASCADE, related_name='arrived_trips')
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'booking'
        ordering = ('-created_at',)

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
    )

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='cash')
    status = models.CharField(max_length=20, default='paid')
    paid_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment'


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
