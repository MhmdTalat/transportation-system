from collections.abc import Iterable, Mapping
from typing import Any, Protocol

from django.db.models import Prefetch, Q, QuerySet
from django.utils import timezone

from .models import FareRule, Route, RouteStation, Station, Trip


class TripRepositoryProtocol(Protocol):
    def get_station(self, station_id: int) -> Station | None: ...

    def find_routes(
        self,
        start_station: Station,
        destination_station: Station,
    ) -> Iterable[Route]: ...

    def first_active_fare_rule(self, route: Route) -> FareRule | None: ...

    def create_trip(self, validated_data: Mapping[str, Any]) -> Trip: ...


class TripRepository:
    def get_station(self, station_id: int) -> Station | None:
        return Station.objects.filter(id=station_id).first()

    def find_routes(
        self,
        start_station: Station,
        destination_station: Station,
    ) -> QuerySet[Route]:
        return (
            Route.objects.filter(route_stations__station=start_station)
            .filter(route_stations__station=destination_station)
            .distinct()
            .prefetch_related(
                Prefetch(
                    "route_stations",
                    queryset=RouteStation.objects.select_related("station").order_by(
                        "sequence_order"
                    ),
                ),
                Prefetch(
                    "fare_rules",
                    queryset=FareRule.objects.filter(is_active=True)
                    .filter(Q(valid_from__isnull=True) | Q(valid_from__lte=timezone.now()))
                    .filter(Q(valid_to__isnull=True) | Q(valid_to__gte=timezone.now()))
                    .order_by("pk"),
                    to_attr="_active_fare_rules",
                ),
            )
        )

    def first_active_fare_rule(self, route: Route) -> FareRule | None:
        active_fare_rules = route._active_fare_rules
        return active_fare_rules[0] if active_fare_rules else None

    def create_trip(self, validated_data: Mapping[str, Any]) -> Trip:
        return Trip.objects.create(**validated_data)
