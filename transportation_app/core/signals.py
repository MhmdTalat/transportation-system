from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .cache import invalidate
from .models import (
    Booking,
    Driver,
    DriverDocument,
    Payment,
    Route,
    RouteStation,
    Station,
    Trip,
    User,
    Vehicle,
)


@receiver(post_save)
@receiver(post_delete)
def invalidate_app_cache(sender, **kwargs) -> None:
    if sender is User:
        invalidate('users')
        invalidate('analytics')
    elif sender in (Driver, DriverDocument):
        invalidate('drivers')
        invalidate('analytics')
        invalidate('trip-search')
    elif sender in (Vehicle,):
        invalidate('vehicles')
        invalidate('drivers')
        invalidate('trip-search')
        invalidate('analytics')
    elif sender in (Trip, Booking, Payment):
        invalidate('trip-search')
        invalidate('trips')
        invalidate('bookings')
        invalidate('analytics')
    elif sender in (Station, Route, RouteStation):
        invalidate('stations')
        invalidate('routes')
        invalidate('trip-search')
