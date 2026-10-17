from django.urls import path
from rest_framework.urlpatterns import format_suffix_patterns
from . import views


urlpatterns = [
    path("register/", views.register, name="user-register"),
    path("auth/verify-email/", views.verify_email, name="verify-email"),
    path("auth/resend-verification/", views.resend_email_verification, name="resend-email-verification"),
    path("token/", views.RateLimitedTokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("token/refresh/", views.TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/forgot-password/", views.forgot_password, name="forgot-password"),
    path("auth/reset-password/", views.reset_password, name="reset-password"),
    path("me/", views.current_user, name="current-user"),
    path("analytics/dashboard/", views.analytics_dashboard, name="analytics-dashboard"),
    path("users/", views.users, name="user-list"),
    path("users/<int:pk>/", views.user_detail, name="user-detail"),
    path("assignment-drivers/", views.assignment_drivers, name="assignment-drivers"),
    path("assignment-vehicles/", views.assignment_vehicles, name="assignment-vehicles"),
]

resource_urlpatterns = [
    path("", views.api_root, name="api-root"),
    path("stations/", views.stations, name="station-list"),
    path("stations/<int:pk>/", views.station_detail, name="station-detail"),
    path("routes/", views.routes, name="route-list"),
    path("routes/<int:pk>/", views.route_detail, name="route-detail"),
    path("route-stations/", views.route_stations, name="routestation-list"),
    path(
        "route-stations/<int:pk>/",
        views.route_station_detail,
        name="routestation-detail",
    ),
    path("vehicles/", views.vehicles, name="vehicle-list"),
    path("vehicles/<int:pk>/", views.vehicle_detail, name="vehicle-detail"),
    path("drivers/", views.drivers, name="driver-list"),
    path("drivers/<int:pk>/", views.driver_detail, name="driver-detail"),
    path("fare-rules/", views.fare_rules, name="farerule-list"),
    path("fare-rules/<int:pk>/", views.fare_rule_detail, name="farerule-detail"),
    path("trips/search/", views.trip_search, name="trip-search"),
    path("trips/", views.trips, name="trip-list"),
    path("trips/<int:pk>/", views.trip_detail, name="trip-detail"),
    path("trips/<int:pk>/seats/", views.trip_seats, name="trip-seats"),
    path("trips/<int:pk>/passengers/", views.trip_passengers, name="trip-passengers"),
    path("bookings/", views.bookings, name="booking-list"),
    path("bookings/<int:pk>/", views.booking_detail, name="booking-detail"),
    path("bookings/<int:pk>/cancel/", views.cancel_booking, name="booking-cancel"),
    path("payments/", views.payments, name="payment-list"),
    path("payments/<int:pk>/", views.payment_detail, name="payment-detail"),
    path("notifications/", views.notifications, name="notification-list"),
    path(
        "notifications/mark-all-read/",
        views.mark_all_notifications_read,
        name="notifications-mark-all-read",
    ),
    path(
        "notifications/<int:pk>/",
        views.notification_detail,
        name="notification-detail",
    ),
]

urlpatterns += format_suffix_patterns(resource_urlpatterns)
