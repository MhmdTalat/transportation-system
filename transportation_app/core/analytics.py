from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, F, Q
from django.db.models.functions import ExtractHour, ExtractWeekDay, TruncDate
from django.utils import timezone
from rest_framework import serializers

from .models import Booking, Station, Trip


class AnalyticsFilterSerializer(serializers.Serializer):
    period = serializers.ChoiceField(
        choices=('7d', '30d', '90d'),
        required=False,
        default='30d',
    )
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    status = serializers.ChoiceField(
        choices=Trip.STATUS_CHOICES,
        required=False,
        allow_blank=True,
    )
    role = serializers.ChoiceField(
        choices=get_user_model().ROLE_CHOICES,
        required=False,
        allow_blank=True,
    )
    station = serializers.IntegerField(required=False, min_value=1)

    def validate(self, attrs):
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        if (start_date is None) != (end_date is None):
            raise serializers.ValidationError(
                'Provide both start_date and end_date for a custom period.'
            )

        today = timezone.localdate()
        if start_date is None:
            days = int(attrs['period'][:-1])
            attrs['end_date'] = today
            attrs['start_date'] = today - timedelta(days=days - 1)
            end_date = today
            start_date = attrs['start_date']
        if start_date > end_date:
            raise serializers.ValidationError(
                {'end_date': 'End date must be on or after start date.'}
            )
        if end_date > today:
            raise serializers.ValidationError(
                {'end_date': 'End date cannot be in the future.'}
            )
        if (end_date - start_date).days >= 366:
            raise serializers.ValidationError(
                'Date range cannot exceed 366 days.'
            )

        station_id = attrs.get('station')
        if station_id is not None and not Station.objects.filter(pk=station_id).exists():
            raise serializers.ValidationError(
                {'station': 'Select an existing station.'}
            )
        attrs['period'] = (
            'custom' if 'start_date' in self.initial_data else attrs['period']
        )
        return attrs


def _date_bounds(start_date, end_date):
    current_timezone = timezone.get_current_timezone()
    start = timezone.make_aware(
        datetime.combine(start_date, time.min),
        current_timezone,
    )
    end = timezone.make_aware(
        datetime.combine(end_date + timedelta(days=1), time.min),
        current_timezone,
    )
    return start, end


def _trip_queryset(start, end, filters):
    queryset = Trip.objects.filter(created_at__gte=start, created_at__lt=end)
    if filters.get('status'):
        queryset = queryset.filter(status=filters['status'])
    if filters.get('station'):
        queryset = queryset.filter(
            Q(start_station_id=filters['station'])
            | Q(destination_station_id=filters['station'])
        )
    role = filters.get('role')
    if role == 'driver':
        queryset = queryset.filter(driver__user__role=role)
    elif role == 'passenger':
        queryset = queryset.filter(bookings__passenger__role=role)
    elif role:
        queryset = queryset.filter(created_by__role=role)
    return queryset.order_by()


def _booking_queryset(start, end, filters):
    queryset = Booking.objects.filter(created_at__gte=start, created_at__lt=end)
    if filters.get('status'):
        queryset = queryset.filter(trip__status=filters['status'])
    if filters.get('station'):
        queryset = queryset.filter(
            Q(trip__start_station_id=filters['station'])
            | Q(trip__destination_station_id=filters['station'])
        )
    role = filters.get('role')
    if role == 'passenger':
        queryset = queryset.filter(passenger__role=role)
    elif role == 'driver':
        queryset = queryset.filter(trip__driver__user__role=role)
    elif role:
        queryset = queryset.filter(trip__created_by__role=role)
    return queryset.order_by()


def _trip_counts(queryset):
    return queryset.aggregate(
        trips_created=Count('pk', distinct=True),
        completed_trips=Count(
            'pk',
            filter=Q(status='completed'),
            distinct=True,
        ),
        cancelled_trips=Count(
            'pk',
            filter=Q(status='cancelled'),
            distinct=True,
        ),
        scheduled_trips=Count(
            'pk',
            filter=Q(status='scheduled'),
            distinct=True,
        ),
        in_progress_trips=Count(
            'pk',
            filter=Q(status='in_progress'),
            distinct=True,
        ),
    )


def _booking_counts(queryset):
    return queryset.aggregate(
        bookings_created=Count('pk', distinct=True),
        confirmed_bookings=Count(
            'pk',
            filter=Q(status='confirmed'),
            distinct=True,
        ),
        cancelled_bookings=Count(
            'pk',
            filter=Q(status='cancelled'),
            distinct=True,
        ),
        completed_bookings=Count(
            'pk',
            filter=Q(status='completed'),
            distinct=True,
        ),
    )


def _seat_occupancy(queryset):
    trips = queryset.filter(
        status__in=('scheduled', 'in_progress'),
        vehicle__isnull=False,
    ).values(
        'pk',
        'vehicle__capacity',
        'vehicle__disabled_seats',
    ).annotate(
        reserved=Count(
            'booked_seats',
            distinct=True,
            filter=Q(booked_seats__is_active=True),
        ),
    )
    reserved_seats = 0
    available_capacity = 0
    for trip in trips:
        capacity = trip['vehicle__capacity']
        disabled_seats = {
            seat for seat in (trip['vehicle__disabled_seats'] or [])
            if isinstance(seat, int) and 1 <= seat <= capacity
        }
        reserved_seats += trip['reserved']
        available_capacity += capacity - len(disabled_seats)
    return _rate(reserved_seats, available_capacity)


def _user_counts(start, end, role):
    User = get_user_model()
    queryset = User.objects.filter(created_at__lt=end)
    if role:
        queryset = queryset.filter(role=role)
    total = queryset.count()
    active_queryset = queryset.filter(
        is_active=True,
        last_login__gte=start,
        last_login__lt=end,
    )
    return {
        'total_users': total,
        'active_users': active_queryset.count(),
    }


def _comparison(current, previous):
    return {
        'current': current,
        'previous': previous,
    }


def _rate(numerator, denominator):
    return round(numerator / denominator * 100, 1) if denominator else None


def _completed_route_distance(queryset):
    groups = queryset.filter(
        route__distance_km__isnull=False,
    ).values('route_id', distance=F('route__distance_km')).annotate(
        trip_count=Count('pk', distinct=True),
    )
    distances = [
        row['distance'] * row['trip_count']
        for row in groups
    ]
    return round(sum(distances), 2) if distances else None


def _top_stations(queryset, field):
    station_relation = f'{field}_station'
    rows = queryset.values(
        'start_station_id' if field == 'start' else 'destination_station_id',
        f'{station_relation}__name',
    ).annotate(trips=Count('pk', distinct=True)).order_by('-trips', f'{station_relation}__name')[:5]
    id_field = 'start_station_id' if field == 'start' else 'destination_station_id'
    return [
        {
            'id': row[id_field],
            'name': row[f'{station_relation}__name'],
            'trips': row['trips'],
        }
        for row in rows
    ]


def _timeseries(queryset, start_date, end_date, expression):
    counts = {
        item['bucket'].isoformat(): item['count']
        for item in queryset.annotate(
            bucket=TruncDate(expression, tzinfo=timezone.get_current_timezone()),
        ).values('bucket').annotate(count=Count('pk', distinct=True))
    }
    result = []
    day = start_date
    while day <= end_date:
        result.append({'date': day.isoformat(), 'count': counts.get(day.isoformat(), 0)})
        day += timedelta(days=1)
    return result


def build_analytics_dashboard(query_params):
    filters_serializer = AnalyticsFilterSerializer(data=query_params)
    filters_serializer.is_valid(raise_exception=True)
    filters = filters_serializer.validated_data
    start_date = filters['start_date']
    end_date = filters['end_date']
    start, end = _date_bounds(start_date, end_date)
    day_count = (end_date - start_date).days + 1
    previous_start_date = start_date - timedelta(days=day_count)
    previous_end_date = start_date - timedelta(days=1)
    previous_start, previous_end = _date_bounds(
        previous_start_date,
        previous_end_date,
    )

    current_trips = _trip_queryset(start, end, filters)
    previous_trips = _trip_queryset(previous_start, previous_end, filters)
    current_bookings = _booking_queryset(start, end, filters)
    previous_bookings = _booking_queryset(previous_start, previous_end, filters)
    current_trip_counts = _trip_counts(current_trips)
    previous_trip_counts = _trip_counts(previous_trips)
    current_booking_counts = _booking_counts(current_bookings)
    previous_booking_counts = _booking_counts(previous_bookings)
    role = filters.get('role')
    current_users = _user_counts(start, end, role)
    previous_users = _user_counts(previous_start, start, role)

    current_eligible = (
        current_trip_counts['completed_trips']
        + current_trip_counts['cancelled_trips']
    )
    previous_eligible = (
        previous_trip_counts['completed_trips']
        + previous_trip_counts['cancelled_trips']
    )
    summary = {
        key: _comparison(current_users[key], previous_users[key])
        for key in current_users
    }
    for key in current_trip_counts:
        summary[key] = _comparison(
            current_trip_counts[key],
            previous_trip_counts[key],
        )
    for key in current_booking_counts:
        summary[key] = _comparison(
            current_booking_counts[key],
            previous_booking_counts[key],
        )
    current_booking_outcomes = (
        current_booking_counts['confirmed_bookings']
        + current_booking_counts['cancelled_bookings']
        + current_booking_counts['completed_bookings']
    )
    previous_booking_outcomes = (
        previous_booking_counts['confirmed_bookings']
        + previous_booking_counts['cancelled_bookings']
        + previous_booking_counts['completed_bookings']
    )
    summary['booking_cancellation_rate'] = _comparison(
        _rate(current_booking_counts['cancelled_bookings'], current_booking_outcomes),
        _rate(previous_booking_counts['cancelled_bookings'], previous_booking_outcomes),
    )
    summary['seat_occupancy_rate'] = _comparison(
        _seat_occupancy(current_trips),
        _seat_occupancy(previous_trips),
    )
    summary['completion_rate'] = _comparison(
        _rate(current_trip_counts['completed_trips'], current_eligible),
        _rate(previous_trip_counts['completed_trips'], previous_eligible),
    )
    summary['cancellation_rate'] = _comparison(
        _rate(current_trip_counts['cancelled_trips'], current_eligible),
        _rate(previous_trip_counts['cancelled_trips'], previous_eligible),
    )

    current_distance_estimate = _completed_route_distance(
        current_trips.filter(status='completed'),
    )
    previous_distance_estimate = _completed_route_distance(
        previous_trips.filter(status='completed'),
    )
    summary['completed_route_distance_km_estimate'] = {
        'current': current_distance_estimate,
        'previous': previous_distance_estimate,
    }

    trip_series = _timeseries(current_trips, start_date, end_date, 'created_at')
    booking_series = _timeseries(
        current_bookings,
        start_date,
        end_date,
        'created_at',
    )
    user_queryset = get_user_model().objects.filter(
        created_at__gte=start,
        created_at__lt=end,
    )
    if role:
        user_queryset = user_queryset.filter(role=role)
    registrations_series = _timeseries(
        user_queryset,
        start_date,
        end_date,
        'created_at',
    )
    registrations_by_role = {
        row['role']: row['count']
        for row in user_queryset.values('role').annotate(
            count=Count('pk'),
        )
    }

    status_rows = current_trips.values('status').annotate(
        count=Count('pk', distinct=True),
    )
    status_counts = {row['status']: row['count'] for row in status_rows}
    status_breakdown = [
        {'status': status, 'count': status_counts.get(status, 0)}
        for status, _label in Trip.STATUS_CHOICES
    ]
    creation_hours = current_trips.annotate(
        hour=ExtractHour('created_at', tzinfo=timezone.get_current_timezone()),
    ).values('hour').annotate(count=Count('pk', distinct=True))
    hours = {row['hour']: row['count'] for row in creation_hours}
    creation_weekdays = current_trips.annotate(
        weekday=ExtractWeekDay('created_at', tzinfo=timezone.get_current_timezone()),
    ).values('weekday').annotate(count=Count('pk', distinct=True))
    weekdays = {row['weekday']: row['count'] for row in creation_weekdays}
    weekday_labels = ('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')

    route_rows = current_trips.values('route_id', 'route__name').annotate(
        trips=Count('pk', distinct=True),
    ).order_by('-trips', 'route__name')[:5]
    return {
        'filters': {
            'period': filters['period'],
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'status': filters.get('status', ''),
            'role': role or '',
            'station': filters.get('station'),
        },
        'updated_at': timezone.now().isoformat(),
        'summary': summary,
        'charts': {
            'trip_volume': trip_series,
            'booking_volume': booking_series,
            'user_registrations': registrations_series,
            'user_registrations_by_role': [
                {'role': role, 'count': registrations_by_role.get(role, 0)}
                for role, _label in get_user_model().ROLE_CHOICES
                if not filters.get('role') or role == filters['role']
            ],
            'trip_status': status_breakdown,
            'popular_start_stations': _top_stations(current_trips, 'start'),
            'popular_destination_stations': _top_stations(current_trips, 'destination'),
            'popular_routes': [
                {'id': row['route_id'], 'name': row['route__name'], 'trips': row['trips']}
                for row in route_rows
            ],
            'trip_creation_hours': [
                {'hour': hour, 'count': hours.get(hour, 0)}
                for hour in range(24)
            ],
            'trip_creation_weekdays': [
                {'day': label, 'count': weekdays.get(index + 1, 0)}
                for index, label in enumerate(weekday_labels)
            ],
        },
        'definitions': {
            'active_users': 'Active accounts whose last_login falls within the selected date range.',
            'trips_created': 'Trips created within the selected date range; status reflects the current stored status.',
            'completion_rate': 'Completed trips divided by completed plus cancelled trips created in the selected date range.',
            'cancellation_rate': 'Cancelled trips divided by completed plus cancelled trips created in the selected date range.',
            'trip_volume': 'Trip creation date, not scheduled departure date.',
            'booking_volume': 'Booking creation date, filtered by the selected trip, station, and role criteria.',
            'bookings_created': 'Bookings created within the selected date range.',
            'booking_cancellation_rate': 'Cancelled bookings divided by bookings with a confirmed, cancelled, or completed status.',
            'seat_occupancy_rate': 'Active seats reserved on scheduled or in-progress trips divided by their usable configured vehicle capacity.',
            'confirmed_bookings': 'Bookings currently confirmed among bookings created within the selected date range.',
            'cancelled_bookings': 'Bookings currently cancelled among bookings created within the selected date range.',
            'completed_bookings': 'Bookings currently completed among bookings created within the selected date range.',
            'completed_route_distance_km_estimate': 'Sum of configured route distances for completed trips; this is planned route distance, not GPS-measured distance.',
            'user_role_filter': 'Filters user KPIs by role and trip records to trips associated with that driver/passenger or created by that role.',
            'station_filter': 'Includes trips whose selected origin or destination matches the station.',
        },
        'unavailable_metrics': {
            'average_trip_duration': 'Only scheduled departure and arrival times are stored; actual trip start and completion timestamps are not collected.',
            'total_distance_traveled': 'GPS traces or actual traveled-distance records are not collected.',
            'api_latency_and_error_rates': 'Request telemetry is not currently collected.',
            'database_query_performance': 'Database query telemetry is not currently collected.',
            'background_task_failures': 'There is no persistent background-task monitoring data source.',
        },
    }
