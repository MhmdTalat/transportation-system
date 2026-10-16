from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.db import transaction

from ..models import Route, Station, Trip
from ..repositories import TripRepositoryProtocol


class StationsNotFoundError(Exception):
    pass


@dataclass(frozen=True)
class TripSearchResult:
    route: Route
    fare: Decimal
    estimated_travel_time: int


class TripService:
    def __init__(self, repository: TripRepositoryProtocol) -> None:
        self._repository = repository

    def search_routes(
        self,
        start_station_id: int,
        destination_station_id: int,
    ) -> list[TripSearchResult]:
        start_station = self._repository.get_station(start_station_id)
        destination_station = self._repository.get_station(destination_station_id)
        if start_station is None or destination_station is None:
            raise StationsNotFoundError("Stations not found")

        results = []
        for route in self._repository.find_routes(start_station, destination_station):
            route_stations = list(route.route_stations.all())
            positions = {
                route_station.station_id: index
                for index, route_station in enumerate(route_stations)
            }
            start_position = positions.get(start_station.id)
            destination_position = positions.get(destination_station.id)
            if (
                start_position is None
                or destination_position is None
                or start_position >= destination_position
            ):
                continue

            fare_rule = self._repository.first_active_fare_rule(route)
            fare = (
                fare_rule.calculate_amount(route, start_station, destination_station)
                if fare_rule
                else Decimal("0")
            )
            results.append(
                TripSearchResult(
                    route=route,
                    fare=fare,
                    estimated_travel_time=route.duration_minutes or 0,
                )
            )
        return results

    @transaction.atomic
    def create_trip(self, validated_data: Mapping[str, Any]) -> Trip:
        return self._repository.create_trip_with_payment(validated_data)
