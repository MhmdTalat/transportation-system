from datetime import timedelta

from django.utils import timezone

from ..models import Booking, Notification, User


def create_due_trip_reminders(user: User | None = None) -> int:
    now = timezone.now()
    bookings = Booking.objects.filter(
        status='confirmed',
        trip__status='scheduled',
        trip__departure_time__gt=now,
        trip__is_published=True,
    ).select_related('trip__destination_station', 'passenger')
    if user is not None:
        bookings = bookings.filter(passenger=user)

    created_count = 0
    for booking in bookings:
        departure = booking.trip.departure_time
        remaining = departure - now
        if remaining <= timedelta(hours=2):
            title = 'Trip starts in 2 hours'
            message = (
                f'Your trip to {booking.trip.destination_station.name} starts in 2 hours. '
                'Please arrive at the pickup point on time.'
            )
        elif remaining <= timedelta(hours=24):
            title = 'Trip reminder'
            message = (
                f'Reminder: your trip to {booking.trip.destination_station.name} starts '
                f'on {timezone.localtime(departure).strftime("%b %d at %I:%M %p")}.'
            )
        else:
            continue
        _, created = Notification.objects.get_or_create(
            dedupe_key=f'trip-reminder:{booking.pk}:{2 if remaining <= timedelta(hours=2) else 24}h',
            defaults={
                'user': booking.passenger,
                'booking': booking,
                'notification_type': 'trip_reminder',
                'title': title,
                'message': message,
            },
        )
        created_count += int(created)
    return created_count
