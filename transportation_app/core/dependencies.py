from .repositories import TripRepository
from .services.trip_service import TripService


def get_trip_service() -> TripService:
    return TripService(repository=TripRepository())
