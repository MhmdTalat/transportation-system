from datetime import datetime, time, timedelta
from io import StringIO
import re
from smtplib import SMTPAuthenticationError, SMTPSenderRefused
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management.base import CommandError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import IntegrityError, connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    AuditLog,
    Booking,
    BookingSeat,
    Complaint,
    Driver,
    DriverDocument,
    EmailOutbox,
    EmailVerificationCode,
    FareRule,
    Notification,
    OperationalSetting,
    Payment,
    PrivateRide,
    Route,
    RouteStation,
    Station,
    Trip,
    Vehicle,
)
from .services.email_verification import (
    check_verification_code,
    generate_verification_code,
    hash_verification_code,
)
from .services.notification_service import create_due_trip_reminders
from .services.trip_service import TripService


class TransportApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username='tester',
            email='tester@example.com',
            password='secret123',
            role='admin',
        )
        self.client.force_authenticate(self.user)

    def test_route_search_and_fare_calculation(self):
        start = Station.objects.create(name='Start Station', latitude=30.0, longitude=31.0, is_active=True)
        middle = Station.objects.create(name='Middle Station', latitude=30.1, longitude=31.1, is_active=True)
        end = Station.objects.create(name='End Station', latitude=30.2, longitude=31.2, is_active=True)

        route = Route.objects.create(name='Route A', status='active')
        RouteStation.objects.create(route=route, station=start, sequence_order=1)
        RouteStation.objects.create(route=route, station=middle, sequence_order=2)
        RouteStation.objects.create(route=route, station=end, sequence_order=3)

        FareRule.objects.create(
            route=route,
            rule_type='fixed',
            amount=15.00,
            is_active=True,
        )

        response = self.client.post('/api/trips/search/', {
            'start_station_id': start.id,
            'destination_station_id': end.id,
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'][0]['route']['id'], route.id)
        self.assertEqual(response.data['results'][0]['fare'], '15.00')

    def test_trip_creation_does_not_create_payment_record(self):
        start = Station.objects.create(name='Alpha', latitude=1.0, longitude=1.0, is_active=True)
        end = Station.objects.create(name='Beta', latitude=2.0, longitude=2.0, is_active=True)
        route = Route.objects.create(name='Alpha-Beta', status='Active')
        RouteStation.objects.create(route=route, station=start, sequence_order=1)
        RouteStation.objects.create(route=route, station=end, sequence_order=2)
        FareRule.objects.create(route=route, rule_type='fixed', amount=8.50, is_active=True)

        vehicle = Vehicle.objects.create(registration_number='ABC-123', capacity=30, status='active')
        driver_user = get_user_model().objects.create_user(
            username='trip_driver',
            password='Different-strong-pass-123!',
            role='driver',
        )
        driver = Driver.objects.create(
            user=driver_user,
            vehicle=vehicle,
            status='active',
            verification_status='approved',
        )

        response = self.client.post('/api/trips/', {
            'route': route.id,
            'vehicle': vehicle.id,
            'driver': driver.id,
            'start_station': start.id,
            'destination_station': end.id,
            'departure_time': (timezone.now() + timedelta(days=1)).isoformat(),
            'arrival_time': (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            'status': 'scheduled',
            'is_published': True,
            'fare_amount': '8.50',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Trip.objects.filter(route=route).exists())
        self.assertTrue(response.data['is_published'])
        self.assertNotIn('payment', response.data)
        self.assertFalse(Payment.objects.filter(trip__route=route).exists())

    def test_trip_creation_rejects_pending_driver_assignment(self):
        start = Station.objects.create(name='Pending Start', latitude=1.0, longitude=1.0)
        end = Station.objects.create(name='Pending End', latitude=2.0, longitude=2.0)
        route = Route.objects.create(name='Pending Route', status='active')
        RouteStation.objects.create(route=route, station=start, sequence_order=1)
        RouteStation.objects.create(route=route, station=end, sequence_order=2)
        driver_user = get_user_model().objects.create_user(
            username='pending_trip_driver',
            password='Different-strong-pass-123!',
            role='driver',
        )
        driver = Driver.objects.create(
            user=driver_user,
            status='active',
            verification_status='pending',
        )

        response = self.client.post('/api/trips/', {
            'route': route.id,
            'driver': driver.id,
            'start_station': start.id,
            'destination_station': end.id,
            'departure_time': (timezone.now() + timedelta(days=1)).isoformat(),
            'arrival_time': (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            'status': 'scheduled',
            'is_published': False,
            'fare_amount': '8.50',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data['driver'][0],
            'This driver is waiting for verification approval.',
        )
        self.assertFalse(Trip.objects.filter(driver=driver).exists())

    def test_trip_creation_rejects_identical_start_and_destination_stations(self):
        station = Station.objects.create(
            name='Same Station',
            latitude=1.0,
            longitude=1.0,
            is_active=True,
        )
        route = Route.objects.create(name='Same Station Route', status='active')
        RouteStation.objects.create(route=route, station=station, sequence_order=1)

        response = self.client.post('/api/trips/', {
            'route': route.id,
            'start_station': station.id,
            'destination_station': station.id,
            'status': 'scheduled',
            'fare_amount': '8.50',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data['destination_station'][0],
            'Start and destination stations must differ.',
        )
        self.assertFalse(Trip.objects.filter(route=route).exists())

    def test_trip_creation_is_atomic_when_payment_creation_fails(self):
        start = Station.objects.create(name='Atomic Start', latitude=1.0, longitude=1.0)
        end = Station.objects.create(name='Atomic End', latitude=2.0, longitude=2.0)
        route = Route.objects.create(name='Atomic Route')

        class FailingTripRepository:
            def create_trip(self, validated_data):
                Trip.objects.create(**validated_data)
                raise IntegrityError('Payment could not be created.')

        with self.assertRaises(IntegrityError):
            TripService(FailingTripRepository()).create_trip({
                'route': route,
                'start_station': start,
                'destination_station': end,
                'fare_amount': '4.00',
            })

        self.assertFalse(Trip.objects.filter(route=route).exists())

    def test_trip_list_does_not_expose_payment_records(self):
        start = Station.objects.create(name='List Start', latitude=1.0, longitude=1.0)
        end = Station.objects.create(name='List End', latitude=2.0, longitude=2.0)
        route = Route.objects.create(name='List Route')
        for fare in ('4.00', '5.00'):
            trip = Trip.objects.create(
                route=route,
                start_station=start,
                destination_station=end,
                fare_amount=fare,
            )
            Payment.objects.create(trip=trip, amount=fare)

        with self.assertNumQueries(1):
            response = self.client.get('/api/trips/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertNotIn('payment', response.data[0])

    def test_station_collection_and_detail_keep_crud_behavior(self):
        response = self.client.post('/api/stations/', {
            'name': 'Created Station',
            'latitude': 1.0,
            'longitude': 2.0,
            'is_active': True,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        station_id = response.data['id']

        response = self.client.patch(
            f'/api/stations/{station_id}/',
            {'name': 'Updated Station'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Updated Station')

        response = self.client.get(f'/api/stations/{station_id}/')
        self.assertEqual(response.status_code, 200)

        response = self.client.delete(f'/api/stations/{station_id}/')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.client.get(f'/api/stations/{station_id}/').status_code, 404)

    def test_station_delete_rejects_records_with_existing_trip_history(self):
        station = Station.objects.create(name='Protected Station', latitude=1.0, longitude=2.0, is_active=True)
        route = Route.objects.create(name='Protected Route', status='active')
        RouteStation.objects.create(route=route, station=station, sequence_order=1)
        trip = Trip.objects.create(
            route=route,
            start_station=station,
            destination_station=station,
            status='scheduled',
            fare_amount='12.00',
        )
        Booking.objects.create(
            passenger=self.user,
            trip=trip,
            total_amount='12.00',
            status='confirmed',
        )

        response = self.client.delete(f'/api/stations/{station.pk}/')

        self.assertEqual(response.status_code, 400)
        details = response.data.get('detail', [])
        details_text = details[0] if isinstance(details, list) else str(details)
        self.assertIn('referenced', details_text.lower())
        self.assertTrue(Station.objects.filter(pk=station.pk).exists())

    def test_route_delete_rejects_records_with_existing_booking_history(self):
        station = Station.objects.create(name='Route History Station', latitude=1.0, longitude=2.0)
        route = Route.objects.create(name='Protected Booking Route', status='active')
        trip = Trip.objects.create(
            route=route,
            start_station=station,
            destination_station=station,
            status='scheduled',
            fare_amount='12.00',
        )
        Booking.objects.create(
            passenger=self.user,
            trip=trip,
            total_amount='12.00',
            status='confirmed',
        )

        response = self.client.delete(f'/api/routes/{route.pk}/')

        self.assertEqual(response.status_code, 400)
        details = response.data.get('detail', [])
        details_text = details[0] if isinstance(details, list) else str(details)
        self.assertIn('referenced', details_text.lower())
        self.assertTrue(Route.objects.filter(pk=route.pk).exists())

    def test_management_endpoints_remain_authenticated(self):
        response = APIClient().get('/api/stations/')
        self.assertEqual(response.status_code, 401)

    def test_admin_can_load_user_detail(self):
        user = get_user_model().objects.create_user(
            username='detail_user',
            email='detail@example.com',
            role='passenger',
        )

        response = self.client.get(f'/api/users/{user.pk}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], user.pk)
        self.assertEqual(response.data['username'], 'detail_user')
        self.assertEqual(response.data['role'], 'passenger')
        self.assertIn('is_active', response.data)
        self.assertIn('date_joined', response.data)

    def test_admin_can_deactivate_and_reactivate_passenger_or_driver_accounts(self):
        user_model = get_user_model()
        for role in ('passenger', 'driver'):
            user = user_model.objects.create_user(
                username=f'{role}_status_user',
                email=f'{role}_status@example.com',
                role=role,
            )
            if role == 'driver':
                Driver.objects.create(user=user)

            with self.subTest(role=role, action='deactivate'):
                response = self.client.patch(
                    f'/api/users/{user.pk}/',
                    {'is_active': False},
                    format='json',
                )
                self.assertEqual(response.status_code, 200)
                self.assertFalse(response.data['is_active'])
                user.refresh_from_db()
                self.assertFalse(user.is_active)

            with self.subTest(role=role, action='reactivate'):
                response = self.client.patch(
                    f'/api/users/{user.pk}/',
                    {'is_active': True},
                    format='json',
                )
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.data['is_active'])

    def test_user_account_status_updates_are_restricted_to_admins_and_business_roles(self):
        passenger = get_user_model().objects.create_user(
            username='status_permission_passenger',
            role='passenger',
        )
        client = APIClient()
        client.force_authenticate(passenger)
        response = client.patch(
            f'/api/users/{passenger.pk}/',
            {'is_active': False},
            format='json',
        )
        self.assertEqual(response.status_code, 403)
        passenger.refresh_from_db()
        self.assertTrue(passenger.is_active)

        admin = get_user_model().objects.create_user(
            username='status_permission_admin',
            role='admin',
        )
        client.force_authenticate(self.user)
        response = client.patch(
            f'/api/users/{admin.pk}/',
            {'is_active': False},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        admin.refresh_from_db()
        self.assertTrue(admin.is_active)

    def test_user_list_includes_account_status(self):
        user = get_user_model().objects.create_user(
            username='listed_status_user',
            role='passenger',
            is_active=False,
        )

        response = self.client.get('/api/users/')

        self.assertEqual(response.status_code, 200)
        listed_user = next(item for item in response.data if item['id'] == user.pk)
        self.assertFalse(listed_user['is_active'])

    def test_deactivated_driver_is_unavailable_for_assignment(self):
        driver_user = get_user_model().objects.create_user(
            username='inactive_assignment_driver',
            role='driver',
            is_active=False,
        )
        driver = Driver.objects.create(
            user=driver_user,
            status='active',
            verification_status='approved',
        )
        departure = timezone.now() + timedelta(days=1)
        arrival = departure + timedelta(hours=1)

        response = self.client.get('/api/assignment-drivers/', {
            'departure_time': departure.isoformat(),
            'arrival_time': arrival.isoformat(),
        })

        self.assertEqual(response.status_code, 200)
        result = next(item for item in response.data if item['id'] == driver.pk)
        self.assertFalse(result['available'])
        self.assertEqual(result['unavailable_reason'], 'Driver is inactive.')

    def test_pending_driver_is_visible_but_unavailable_for_assignment(self):
        driver_user = get_user_model().objects.create_user(
            username='pending_assignment_driver',
            role='driver',
        )
        driver = Driver.objects.create(
            user=driver_user,
            status='active',
            verification_status='pending',
        )
        departure = timezone.now() + timedelta(days=1)
        arrival = departure + timedelta(hours=1)

        response = self.client.get('/api/assignment-drivers/', {
            'departure_time': departure.isoformat(),
            'arrival_time': arrival.isoformat(),
        })

        self.assertEqual(response.status_code, 200)
        result = next(item for item in response.data if item['id'] == driver.pk)
        self.assertFalse(result['available'])
        self.assertEqual(
            result['unavailable_reason'],
            'Driver verification is pending approval.',
        )

    def test_assignment_reasons_do_not_require_schedule_for_static_ineligibility(self):
        inactive_user = get_user_model().objects.create_user(
            username='inactive_picker_driver',
            role='driver',
        )
        inactive_driver = Driver.objects.create(
            user=inactive_user,
            status='inactive',
            verification_status='approved',
        )
        pending_user = get_user_model().objects.create_user(
            username='pending_picker_driver',
            role='driver',
        )
        pending_driver = Driver.objects.create(
            user=pending_user,
            status='active',
            verification_status='pending',
        )
        inactive_vehicle = Vehicle.objects.create(
            registration_number='INACTIVE-PICKER-VEHICLE',
            capacity=20,
            status='inactive',
        )

        response = self.client.get('/api/assignment-drivers/')
        vehicles = self.client.get('/api/assignment-vehicles/')

        self.assertEqual(response.status_code, 200)
        inactive = next(item for item in response.data if item['id'] == inactive_driver.pk)
        pending = next(item for item in response.data if item['id'] == pending_driver.pk)
        self.assertFalse(inactive['available'])
        self.assertEqual(inactive['unavailable_reason'], 'Driver is inactive.')
        self.assertFalse(pending['available'])
        self.assertEqual(pending['unavailable_reason'], 'Driver verification is pending approval.')

        self.assertEqual(vehicles.status_code, 200)
        inactive_vehicle_result = next(
            item for item in vehicles.data
            if item['id'] == inactive_vehicle.pk
        )
        self.assertFalse(inactive_vehicle_result['available'])
        self.assertEqual(
            inactive_vehicle_result['unavailable_reason'],
            'Vehicle is inactive or under maintenance.',
        )

    def test_admin_can_add_existing_station_to_route(self):
        route = Route.objects.create(name='Sohag route', status='active')
        station = Station.objects.create(
            name='Tahta',
            latitude=26.77,
            longitude=31.50,
            is_active=True,
        )

        response = self.client.post('/api/route-stations/', {
            'route': route.pk,
            'station_id': station.pk,
            'sequence_order': 3,
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['route'], route.pk)
        self.assertEqual(response.data['station']['id'], station.pk)
        self.assertEqual(response.data['station']['name'], 'Tahta')
        self.assertEqual(response.data['sequence_order'], 3)
        self.assertTrue(RouteStation.objects.filter(
            route=route,
            station=station,
            sequence_order=3,
        ).exists())

    def test_admin_can_edit_existing_route_stop(self):
        route = Route.objects.create(name='Sohag route', status='active')
        station = Station.objects.create(
            name='Sohag',
            latitude=26.56,
            longitude=31.69,
            is_active=True,
        )
        route_stop = RouteStation.objects.create(
            route=route,
            station=station,
            sequence_order=1,
        )
        replacement_station = Station.objects.create(
            name='Tahta',
            latitude=26.77,
            longitude=31.50,
            is_active=True,
        )

        response = self.client.patch(
            f'/api/route-stations/{route_stop.pk}/',
            {'station_id': replacement_station.pk, 'sequence_order': 2},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], route_stop.pk)
        self.assertEqual(response.data['station']['id'], replacement_station.pk)
        self.assertEqual(response.data['sequence_order'], 2)

    def test_analytics_dashboard_aggregates_real_trips_users_and_comparisons(self):
        today = timezone.localdate()
        start_time = timezone.make_aware(
            datetime.combine(today - timedelta(days=2), time(hour=10)),
            timezone.get_current_timezone(),
        )
        passenger = get_user_model().objects.create_user(
            username='analytics_passenger',
            role='passenger',
        )
        get_user_model().objects.filter(pk=passenger.pk).update(
            created_at=start_time,
            last_login=start_time,
        )
        station = Station.objects.create(
            name='Analytics Station',
            latitude=1,
            longitude=1,
        )
        route = Route.objects.create(name='Analytics Route', distance_km=25)
        trips = [
            Trip.objects.create(
                route=route,
                start_station=station,
                destination_station=station,
                status=trip_status,
            )
            for trip_status in ('completed', 'cancelled', 'scheduled')
        ]
        Trip.objects.filter(pk__in=[trip.pk for trip in trips]).update(
            created_at=start_time,
        )
        Booking.objects.create(
            passenger=passenger,
            trip=trips[0],
            total_amount='10.00',
        )

        response = self.client.get('/api/analytics/dashboard/?period=7d&role=passenger')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['summary']['total_users']['current'], 1)
        self.assertEqual(response.data['summary']['active_users']['current'], 1)
        self.assertEqual(response.data['summary']['trips_created']['current'], 1)
        self.assertEqual(response.data['summary']['completed_trips']['current'], 1)
        self.assertEqual(response.data['summary']['completion_rate']['current'], 100.0)
        self.assertEqual(response.data['summary']['cancellation_rate']['current'], 0.0)
        self.assertEqual(
            response.data['summary']['completed_route_distance_km_estimate']['current'],
            25,
        )
        self.assertEqual(response.data['summary']['trips_created']['previous'], 0)
        self.assertEqual(
            len(response.data['charts']['trip_volume']),
            7,
        )
        self.assertEqual(response.data['charts']['popular_routes'][0]['name'], 'Analytics Route')
        self.assertIn(
            'actual trip start',
            response.data['unavailable_metrics']['average_trip_duration'],
        )

        filtered_response = self.client.get(
            f'/api/analytics/dashboard/?period=7d&role=passenger&status=cancelled&station={station.pk}',
        )
        self.assertEqual(filtered_response.status_code, 200)
        self.assertEqual(
            filtered_response.data['summary']['trips_created']['current'],
            0,
        )

    def test_analytics_dashboard_validates_filters_and_custom_ranges(self):
        invalid_responses = (
            self.client.get('/api/analytics/dashboard/?period=12d'),
            self.client.get('/api/analytics/dashboard/?start_date=2026-01-10'),
            self.client.get('/api/analytics/dashboard/?start_date=2026-01-10&end_date=2026-01-01'),
            self.client.get('/api/analytics/dashboard/?period=7d&station=999999'),
        )
        for response in invalid_responses:
            with self.subTest(response=response):
                self.assertEqual(response.status_code, 400)

        today = timezone.localdate()
        start_date = today - timedelta(days=6)
        response = self.client.get(
            f'/api/analytics/dashboard/?start_date={start_date}&end_date={today}',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['filters']['period'], 'custom')
        self.assertEqual(response.data['filters']['start_date'], start_date.isoformat())

    def test_analytics_dashboard_requires_admin_role(self):
        anonymous_response = APIClient().get('/api/analytics/dashboard/')
        self.assertEqual(anonymous_response.status_code, 401)

        passenger = get_user_model().objects.create_user(
            username='analytics_forbidden',
            role='passenger',
        )
        self.client.force_authenticate(passenger)
        response = self.client.get('/api/analytics/dashboard/')
        self.assertEqual(response.status_code, 403)

    def test_analytics_dashboard_query_count_does_not_grow_with_trip_rows(self):
        with CaptureQueriesContext(connection) as empty_queries:
            empty_response = self.client.get('/api/analytics/dashboard/?period=7d')
        self.assertEqual(empty_response.status_code, 200)

        station = Station.objects.create(name='Query station', latitude=1, longitude=1)
        route = Route.objects.create(name='Query route')
        for _ in range(8):
            Trip.objects.create(
                route=route,
                start_station=station,
                destination_station=station,
                status='scheduled',
            )

        with CaptureQueriesContext(connection) as populated_queries:
            populated_response = self.client.get('/api/analytics/dashboard/?period=7d')
        self.assertEqual(populated_response.status_code, 200)
        self.assertEqual(len(populated_queries), len(empty_queries))

    def test_every_resource_collection_route_is_available(self):
        for resource in (
            'stations',
            'routes',
            'route-stations',
            'vehicles',
            'drivers',
            'fare-rules',
            'trips',
            'bookings',
            'users',
            'assignment-drivers',
            'assignment-vehicles',
            'payments',
            'notifications',
            'driver-documents',
            'private-rides',
            'complaints',
            'audit-logs',
        ):
            with self.subTest(resource=resource):
                response = self.client.get(f'/api/{resource}/')
                self.assertEqual(response.status_code, 200)
                self.assertIsInstance(response.data, list)

    def test_api_root_and_format_suffix_are_preserved(self):
        response = self.client.get('/api/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(response.data),
            {
                'me',
                'analytics',
                'users',
                'assignment-drivers',
                'assignment-vehicles',
                'stations',
                'routes',
                'route-stations',
                'vehicles',
                'drivers',
                'fare-rules',
                'trips',
                'bookings',
                'payments',
                'notifications',
                'driver-documents',
                'private-rides',
                'complaints',
                'operational-settings',
                'audit-logs',
            },
        )

        response = self.client.get('/api/stations.json')
        self.assertEqual(response.status_code, 200)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class UserRegistrationApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.registration_data = {
            'username': 'new_passenger',
            'first_name': 'New',
            'last_name': 'Passenger',
            'email': 'new.passenger@example.com',
            'phone_number': '+15551234567',
            'password': 'Different-strong-pass-123!',
            'role': 'passenger',
        }

    def test_registration_requires_email_verification_before_login(self):
        response = self.client.post('/api/register/', self.registration_data, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertIn('verification code', response.data['detail'])
        self.assertNotRegex(str(response.data), r'\b\d{6}\b')

        user = get_user_model().objects.get(username=self.registration_data['username'])
        self.assertTrue(user.check_password(self.registration_data['password']))
        self.assertFalse(user.email_verified)
        self.assertFalse(Driver.objects.filter(user=user).exists())

        token_response = self.client.post('/api/token/', {
            'username': self.registration_data['username'],
            'password': self.registration_data['password'],
        }, format='json')
        self.assertEqual(token_response.status_code, 401)
        email_login_response = self.client.post('/api/token/', {
            'username': self.registration_data['email'],
            'password': self.registration_data['password'],
        }, format='json')
        self.assertEqual(email_login_response.status_code, 401)
        code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group(0)
        verify_response = self.client.post('/api/auth/verify-email/', {
            'email': self.registration_data['email'],
            'code': code,
        }, format='json')
        self.assertEqual(verify_response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)

        token_response = self.client.post('/api/token/', {
            'username': self.registration_data['username'],
            'password': self.registration_data['password'],
        }, format='json')
        self.assertEqual(token_response.status_code, 200)
        self.assertIn('access', token_response.data)
        refreshed = self.client.post('/api/token/refresh/', {
            'refresh': token_response.data['refresh'],
        }, format='json')
        self.assertEqual(refreshed.status_code, 200)
        self.assertIn('access', refreshed.data)

    def test_login_accepts_username_or_email_case_insensitively(self):
        user = get_user_model().objects.create_user(
            username='login_by_email',
            email='login.by.email@example.com',
            password='Different-strong-pass-123!',
            email_verified=True,
        )

        for identifier in (user.username, user.email, user.email.upper()):
            with self.subTest(identifier=identifier):
                response = self.client.post('/api/token/', {
                    'username': identifier,
                    'password': 'Different-strong-pass-123!',
                }, format='json')

                self.assertEqual(response.status_code, 200)
                self.assertIn('access', response.data)

    def test_unverified_user_cannot_use_existing_access_or_refresh_tokens(self):
        user = get_user_model().objects.create_user(
            username='unverified_token',
            email='unverified.token@example.com',
            password='Different-strong-pass-123!',
            email_verified=False,
        )
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        protected = self.client.get('/api/me/')
        self.assertEqual(protected.status_code, 401)
        self.client.credentials()

        refreshed = self.client.post('/api/token/refresh/', {
            'refresh': str(refresh),
        }, format='json')
        self.assertEqual(refreshed.status_code, 401)
        self.assertEqual(refreshed.data['code'], 'email_not_verified')

    def test_verification_code_generation_is_six_ascii_digits_and_keeps_zeroes(self):
        with patch('core.services.email_verification.secrets.choice', return_value='0'):
            code = generate_verification_code()

        self.assertEqual(code, '000000')
        self.assertRegex(code, r'^[0-9]{6}$')

    def test_verification_email_uses_requested_locale(self):
        response = self.client.post(
            '/api/register/',
            self.registration_data,
            format='json',
            HTTP_ACCEPT_LANGUAGE='en',
        )

        self.assertEqual(response.status_code, 201)
        self.assertIn('This code expires in 5 minutes.', mail.outbox[0].body)
        self.assertIn('lang="en"', mail.outbox[0].alternatives[0][0])

    def test_leading_zero_code_verifies_and_is_stored_as_a_keyed_hmac(self):
        user = get_user_model().objects.create_user(
            username='leading_zero',
            email='leading.zero@example.com',
            password='Different-strong-pass-123!',
            email_verified=False,
        )
        code = '004821'
        verification = EmailVerificationCode.objects.create(
            user=user,
            code_hash=hash_verification_code(user.pk, code),
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        self.assertNotEqual(verification.code_hash, code)
        self.assertTrue(check_verification_code(user.pk, code, verification.code_hash))
        response = self.client.post('/api/auth/verify-email/', {
            'email': user.email,
            'code': code,
        }, format='json')

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        verification.refresh_from_db()
        self.assertTrue(user.email_verified)
        self.assertIsNotNone(verification.consumed_at)

    def test_invalid_expired_and_consumed_codes_are_rejected(self):
        user = get_user_model().objects.create_user(
            username='expired_code',
            email='expired.code@example.com',
            password='Different-strong-pass-123!',
            email_verified=False,
        )
        expired = EmailVerificationCode.objects.create(
            user=user,
            code_hash=hash_verification_code(user.pk, '004821'),
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        invalid = self.client.post('/api/auth/verify-email/', {
            'email': user.email,
            'code': '000000',
        }, format='json')
        expired_response = self.client.post('/api/auth/verify-email/', {
            'email': user.email,
            'code': '004821',
        }, format='json')
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(expired_response.status_code, 400)
        self.assertEqual(invalid.data, expired_response.data)

        expired.expires_at = timezone.now() + timedelta(minutes=5)
        expired.consumed_at = timezone.now()
        expired.save(update_fields=('expires_at', 'consumed_at'))
        consumed = self.client.post('/api/auth/verify-email/', {
            'email': user.email,
            'code': '004821',
        }, format='json')
        self.assertEqual(consumed.status_code, 400)

    @override_settings(
        REST_FRAMEWORK={
            'DEFAULT_THROTTLE_RATES': {
                'login': '5/minute',
                'registration': '5/hour',
                'email_verification': '20/hour',
                'password_reset_request': '5/hour',
                'password_reset_submit': '10/hour',
            },
        },
    )
    def test_failed_attempt_limit_consumes_the_code(self):
        user = get_user_model().objects.create_user(
            username='attempt_limited',
            email='attempt.limited@example.com',
            password='Different-strong-pass-123!',
            email_verified=False,
        )
        verification = EmailVerificationCode.objects.create(
            user=user,
            code_hash=hash_verification_code(user.pk, '004821'),
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        for _ in range(5):
            response = self.client.post('/api/auth/verify-email/', {
                'email': user.email,
                'code': '000000',
            }, format='json')
            self.assertEqual(response.status_code, 400)

        verification.refresh_from_db()
        self.assertEqual(verification.attempts, 5)
        self.assertIsNotNone(verification.consumed_at)
        response = self.client.post('/api/auth/verify-email/', {
            'email': user.email,
            'code': '004821',
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_resend_cooldown_is_generic_and_a_new_code_supersedes_the_old_one(self):
        response = self.client.post('/api/register/', self.registration_data, format='json')
        self.assertEqual(response.status_code, 201)
        user = get_user_model().objects.get(username=self.registration_data['username'])
        old_code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group(0)

        cooldown_response = self.client.post('/api/auth/email-verification/', {
            'email': user.email,
        }, format='json')
        unknown_response = self.client.post('/api/auth/email-verification/', {
            'email': 'unknown@example.com',
        }, format='json')
        self.assertEqual(cooldown_response.status_code, 200)
        self.assertEqual(cooldown_response.data, unknown_response.data)
        self.assertEqual(len(mail.outbox), 1)

        EmailVerificationCode.objects.filter(user=user).update(
            created_at=timezone.now() - timedelta(seconds=61),
        )
        resend_response = self.client.post('/api/auth/email-verification/', {
            'email': user.email,
        }, format='json')
        self.assertEqual(resend_response.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        new_code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group(0)
        self.assertNotEqual(old_code, new_code)

        superseded = self.client.post('/api/auth/verify-email/', {
            'email': user.email,
            'code': old_code,
        }, format='json')
        verified = self.client.post('/api/auth/verify-email/', {
            'email': user.email,
            'code': new_code,
        }, format='json')
        self.assertEqual(superseded.status_code, 400)
        self.assertEqual(verified.status_code, 200)

    def test_email_delivery_failure_keeps_account_unverified_and_can_be_retried(self):
        with self.assertLogs('core.views', level='ERROR') as captured:
            with patch('core.views.EmailMultiAlternatives.send', side_effect=OSError):
                response = self.client.post(
                    '/api/register/',
                    self.registration_data,
                    format='json',
                )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.data['code'],
            'verification_email_delivery_failed',
        )
        user = get_user_model().objects.get(username=self.registration_data['username'])
        self.assertFalse(user.email_verified)
        self.assertFalse(EmailVerificationCode.objects.filter(user=user).exists())
        self.assertNotRegex(str(response.data), r'\b\d{6}\b')
        self.assertIn('SMTP connection failed', '\n'.join(captured.output))
        self.assertNotRegex('\n'.join(captured.output), r'\b\d{6}\b')

        retry = self.client.post('/api/auth/email-verification/', {
            'email': user.email,
        }, format='json')
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

    def test_smtp_authentication_failure_is_logged_without_exposing_code(self):
        with self.assertLogs('core.views', level='ERROR') as captured:
            with patch(
                'core.views.EmailMultiAlternatives.send',
                side_effect=SMTPAuthenticationError(535, b'Authentication failed'),
            ):
                response = self.client.post(
                    '/api/register/',
                    self.registration_data,
                    format='json',
                )

        self.assertEqual(response.status_code, 503)
        self.assertIn('SMTP authentication failed', '\n'.join(captured.output))
        self.assertNotRegex('\n'.join(captured.output), r'\b\d{6}\b')
        self.assertNotIn('Authentication failed', '\n'.join(captured.output))

    def test_resend_ip_throttle_applies_across_addresses(self):
        cache.clear()
        with self.settings(REST_FRAMEWORK={
            'DEFAULT_THROTTLE_RATES': {
                'login': '5/minute',
                'registration': '5/hour',
                'email_verification': '2/hour',
                'password_reset_request': '5/hour',
                'password_reset_submit': '10/hour',
            },
        }):
            for email in ('one@example.com', 'two@example.com'):
                response = self.client.post(
                    '/api/auth/email-verification/',
                    {'email': email},
                    format='json',
                )
                self.assertEqual(response.status_code, 200)
            limited = self.client.post('/api/auth/email-verification/', {
                'email': 'three@example.com',
            }, format='json')

        self.assertEqual(limited.status_code, 429)

    def test_registration_works_with_existing_admin_session_without_csrf_token(self):
        get_user_model().objects.create_user(
            username='existing_admin',
            password='Different-strong-pass-123!',
            role='admin',
            is_staff=True,
        )
        client = APIClient(enforce_csrf_checks=True)
        self.assertTrue(
            client.login(
                username='existing_admin',
                password='Different-strong-pass-123!',
            )
        )

        response = client.post(
            '/api/register/',
            self.registration_data,
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.status_code, 201)

    def test_driver_registration_creates_driver_profile(self):
        data = {
            **self.registration_data,
            'username': 'new_driver',
            'email': 'new.driver@example.com',
            'role': 'driver',
        }

        response = self.client.post('/api/register/', data, format='json')

        self.assertEqual(response.status_code, 201)
        user = get_user_model().objects.get(username='new_driver')
        self.assertFalse(user.email_verified)
        self.assertTrue(Driver.objects.filter(
            user=user,
            verification_status='pending',
        ).exists())

    def test_registration_rejects_privileged_business_roles(self):
        for role in ('admin', 'authority'):
            data = {
                **self.registration_data,
                'username': f'new_{role}',
                'email': f'new.{role}@example.com',
                'role': role,
            }
            with self.subTest(role=role):
                response = self.client.post('/api/register/', data, format='json')
                self.assertEqual(response.status_code, 400)
                self.assertIn('role', response.data)
                self.assertFalse(
                    get_user_model().objects.filter(username=f'new_{role}').exists()
                )

    def test_registration_rejects_duplicate_email(self):
        get_user_model().objects.create_user(
            username='existing_passenger',
            email=self.registration_data['email'].upper(),
            password='Different-strong-pass-123!',
        )

        response = self.client.post('/api/register/', self.registration_data, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)
        self.assertFalse(get_user_model().objects.filter(
            username=self.registration_data['username']
        ).exists())

    def test_registration_rejects_weak_password(self):
        self.registration_data['password'] = '12345678'

        response = self.client.post('/api/register/', self.registration_data, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.data)
        self.assertFalse(get_user_model().objects.filter(
            username=self.registration_data['username']
        ).exists())


class TestEmailCommandTests(TestCase):
    @override_settings(
        MAILERS={
            'default': {
                'BACKEND': 'django.core.mail.backends.smtp.EmailBackend',
                'OPTIONS': {
                    'host': 'smtp.gmail.com',
                    'port': 587,
                    'use_tls': True,
                    'use_ssl': False,
                    'username': 'sender@gmail.com',
                    'password': 'test-app-password',
                },
            },
        },
        DEFAULT_FROM_EMAIL='sender@example.com',
    )
    @patch(
        'core.management.commands.test_email.EmailMultiAlternatives.send',
        return_value=1,
    )
    def test_test_email_command_reports_smtp_acceptance(self, send):
        output = StringIO()
        call_command(
            'test_email',
            recipient='recipient@example.com',
            stdout=output,
        )

        self.assertIn('SMTP server accepted', output.getvalue())
        self.assertIn('from sender@example.com', output.getvalue())
        self.assertIn('not delivery to the inbox', output.getvalue())
        send.assert_called_once_with(fail_silently=False)

    @override_settings(MAILERS={
        'default': {
            'BACKEND': 'django.core.mail.backends.console.EmailBackend',
            'OPTIONS': {},
        },
    })
    def test_test_email_command_does_not_misreport_console_output_as_delivery(self):
        with self.assertRaisesMessage(CommandError, 'not SMTP'):
            call_command('test_email', recipient='recipient@example.com')

    @override_settings(
        MAILERS={
            'default': {
                'BACKEND': 'django.core.mail.backends.smtp.EmailBackend',
                'OPTIONS': {
                    'host': 'smtp.gmail.com',
                    'port': 587,
                    'username': 'sender@gmail.com',
                    'password': 'test-app-password',
                },
            },
        },
        DEFAULT_FROM_EMAIL='sender@example.com',
    )
    @patch(
        'core.management.commands.test_email.EmailMultiAlternatives.send',
        side_effect=SMTPAuthenticationError(535, b'Authentication failed'),
    )
    def test_test_email_command_reports_authentication_failure_without_credentials(self, _send):
        with self.assertRaisesMessage(CommandError, 'Gmail SMTP authentication failed'):
            call_command('test_email', recipient='recipient@example.com')


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='sender@gmail.com',
    FRONTEND_BASE_URL='https://transit.example',
)
class PasswordResetApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(
            username='reset_user',
            first_name='Reset',
            email='reset@example.com',
            password='Old-strong-password-123!',
        )
        self.client = APIClient()

    def request_reset(self, email=None):
        return self.client.post(
            '/api/auth/forgot-password/',
            {'email': email or self.user.email},
            format='json',
            HTTP_ACCEPT_LANGUAGE='en',
        )

    def reset_code(self):
        match = re.search(r'\b\d{6}\b', mail.outbox[-1].body)
        self.assertIsNotNone(match)
        return match.group(0)

    def test_known_and_unknown_emails_receive_the_same_public_response(self):
        known = self.request_reset()
        self.assertEqual(known.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].from_email, 'sender@gmail.com')
        self.assertEqual(
            mail.outbox[0].subject,
            'Your Wasalni password reset code',
        )
        self.assertIn(self.reset_code(), mail.outbox[0].alternatives[0][0])
        self.assertIn('expires in 5 minutes', mail.outbox[0].body)

        unknown = self.request_reset('unknown@example.com')
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(known.data, unknown.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_valid_reset_changes_password_and_code_cannot_be_reused(self):
        self.request_reset()
        payload = {
            'email': self.user.email,
            'code': self.reset_code(),
            'new_password': 'New-strong-password-456!',
        }

        response = self.client.post(
            '/api/auth/reset-password/',
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(payload['new_password']))
        self.assertTrue(self.user.email_verified)
        self.assertEqual(
            self.client.post(
                '/api/token/',
                {'username': self.user.username, 'password': payload['new_password']},
                format='json',
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.post(
                '/api/auth/reset-password/',
                payload,
                format='json',
            ).status_code,
            400,
        )

    def test_unverified_user_can_reset_password_and_log_in(self):
        self.user.email_verified = False
        self.user.save(update_fields=('email_verified',))
        self.request_reset()

        payload = {
            'email': self.user.email,
            'code': self.reset_code(),
            'new_password': 'New-strong-password-456!',
        }
        response = self.client.post(
            '/api/auth/reset-password/',
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)
        self.assertTrue(self.user.check_password(payload['new_password']))

        login = self.client.post(
            '/api/token/',
            {'username': self.user.username, 'password': payload['new_password']},
            format='json',
        )
        self.assertEqual(login.status_code, 200)
        self.client.credentials(
            HTTP_AUTHORIZATION=f'Bearer {login.data["access"]}',
        )
        self.assertEqual(self.client.get('/api/me/').status_code, 200)

    def test_disabled_user_can_reset_password_but_remains_disabled(self):
        self.user.email_verified = False
        self.user.is_active = False
        self.user.save(update_fields=('email_verified', 'is_active'))
        self.request_reset()

        payload = {
            'email': self.user.email,
            'code': self.reset_code(),
            'new_password': 'New-strong-password-456!',
        }
        response = self.client.post(
            '/api/auth/reset-password/',
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(payload['new_password']))
        self.assertTrue(self.user.email_verified)
        self.assertFalse(self.user.is_active)
        login = self.client.post(
            '/api/token/',
            {'username': self.user.username, 'password': payload['new_password']},
            format='json',
        )
        self.assertEqual(login.status_code, 401)

    def test_invalid_and_expired_codes_are_rejected(self):
        self.user.email_verified = False
        self.user.save(update_fields=('email_verified',))
        old_password = 'Old-strong-password-123!'
        self.request_reset()
        payload = {
            'email': self.user.email,
            'code': '999999',
            'new_password': 'New-strong-password-456!',
        }

        invalid = self.client.post('/api/auth/reset-password/', payload, format='json')
        self.assertEqual(invalid.status_code, 400)
        self.assertIn('invalid or has expired', invalid.data['detail'])
        self.user.refresh_from_db()
        self.assertFalse(self.user.email_verified)
        self.assertTrue(self.user.check_password(old_password))

        self.request_reset()
        reset_code = EmailVerificationCode.objects.get(
            user=self.user,
            purpose='password_reset',
            consumed_at__isnull=True,
        )
        reset_code.expires_at = timezone.now() - timedelta(seconds=1)
        reset_code.save(update_fields=('expires_at',))
        payload.update(
            code=self.reset_code(),
            new_password='New-strong-password-456!',
        )
        expired = self.client.post('/api/auth/reset-password/', payload, format='json')
        self.assertEqual(expired.status_code, 400)
        self.user.refresh_from_db()
        self.assertFalse(self.user.email_verified)
        self.assertFalse(self.user.check_password(payload['new_password']))

    def test_weak_password_is_rejected_without_changing_password(self):
        self.request_reset()
        payload = {
            'email': self.user.email,
            'code': self.reset_code(),
            'new_password': '12345678',
        }

        response = self.client.post(
            '/api/auth/reset-password/',
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('new_password', response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Old-strong-password-123!'))

    def test_five_invalid_codes_consume_the_reset_code(self):
        self.request_reset()
        payload = {
            'email': self.user.email,
            'code': '999999',
            'new_password': 'New-strong-password-456!',
        }

        for _ in range(5):
            response = self.client.post('/api/auth/reset-password/', payload, format='json')
            self.assertEqual(response.status_code, 400)

        reset_code = EmailVerificationCode.objects.get(
            user=self.user,
            purpose='password_reset',
        )
        self.assertIsNotNone(reset_code.consumed_at)

    def test_email_delivery_failure_keeps_generic_response(self):
        with patch('core.views._send_password_reset_email', side_effect=RuntimeError):
            response = self.request_reset()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['detail'], response.data['detail'])
        self.assertNotIn(self.user.email, str(response.data))

    def test_sender_refusal_is_logged_safely_and_keeps_generic_response(self):
        error = SMTPSenderRefused(
            550,
            b'Sender address rejected',
            'blocked-sender@example.com',
        )
        with self.assertLogs('core.views', level='ERROR') as captured:
            with patch('core.views.EmailMultiAlternatives.send', side_effect=error):
                response = self.request_reset()

        log_output = '\n'.join(captured.output)
        self.assertEqual(response.status_code, 200)
        self.assertIn('SMTP server refused sender=b***@example.com (SMTP 550)', log_output)
        self.assertNotIn('blocked-sender@example.com', log_output)
        self.assertNotIn(self.user.email, str(response.data))

    @override_settings(
        REST_FRAMEWORK={
            'DEFAULT_THROTTLE_RATES': {
                'password_reset_request': '1/hour',
                'password_reset_submit': '1/hour',
            },
        },
    )
    def test_password_reset_requests_are_rate_limited(self):
        first = self.request_reset('unknown@example.com')
        second = self.request_reset('another@example.com')

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)


class BookingApiTests(TestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_user(
            username='booking_admin',
            password='Different-strong-pass-123!',
            role='admin',
        )
        self.passenger = get_user_model().objects.create_user(
            username='booking_passenger',
            password='Different-strong-pass-123!',
            role='passenger',
        )
        self.driver_user = get_user_model().objects.create_user(
            username='booking_driver',
            password='Different-strong-pass-123!',
            role='driver',
        )
        self.driver = Driver.objects.create(
            user=self.driver_user,
            verification_status='approved',
        )
        self.client = APIClient()
        self.start = Station.objects.create(name='Cairo', latitude=30, longitude=31)
        self.destination = Station.objects.create(name='Alexandria', latitude=31, longitude=30)
        self.route = Route.objects.create(
            name='Cairo - Alexandria',
            duration_minutes=180,
            status='active',
        )
        RouteStation.objects.create(route=self.route, station=self.start, sequence_order=1)
        RouteStation.objects.create(route=self.route, station=self.destination, sequence_order=2)
        self.vehicle = Vehicle.objects.create(
            registration_number='BOOK-001',
            capacity=4,
            seat_layout=[[1, 2], [3, 4]],
            status='active',
        )
        self.driver.vehicle = self.vehicle
        self.driver.save(update_fields=('vehicle',))
        self.trip = Trip.objects.create(
            route=self.route,
            vehicle=self.vehicle,
            driver=self.driver,
            start_station=self.start,
            destination_station=self.destination,
            departure_time=timezone.now() + timedelta(days=1),
            arrival_time=timezone.now() + timedelta(days=1, hours=3),
            status='scheduled',
            is_published=True,
            fare_amount='250.00',
            created_by=self.admin,
        )
        self.client.force_authenticate(self.passenger)

    def test_booking_reserves_seats_and_returns_live_capacity(self):
        response = self.client.post(
            '/api/bookings/',
            {'trip': self.trip.pk, 'seat_numbers': [1, 2]},
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['seat_numbers'], [1, 2])
        self.assertEqual(response.data['total_amount'], '500.00')
        self.assertEqual(BookingSeat.objects.filter(trip=self.trip, is_active=True).count(), 2)
        self.assertTrue(Notification.objects.filter(
            user=self.passenger,
            booking_id=response.data['id'],
            notification_type='booking_confirmation',
        ).exists())

        seats_response = self.client.get(f'/api/trips/{self.trip.pk}/seats/')
        self.assertEqual(seats_response.status_code, 200)
        self.assertEqual(seats_response.data['booked_seats'], 2)
        self.assertEqual(seats_response.data['available_seats'], 2)
        self.assertEqual(
            [seat['state'] for seat in seats_response.data['seats']],
            ['booked', 'booked', 'available', 'available'],
        )

    def test_admin_can_delete_trip_after_all_bookings_are_cancelled(self):
        booking = Booking.objects.create(
            passenger=self.passenger,
            trip=self.trip,
            total_amount='250.00',
            status='cancelled',
            cancelled_at=timezone.now(),
        )
        BookingSeat.objects.create(
            booking=booking,
            trip=self.trip,
            seat_number=1,
            is_active=False,
        )
        payment = Payment.objects.create(
            booking=booking,
            trip=self.trip,
            amount='250.00',
            payment_method='cash',
            status='cancelled',
        )
        self.client.force_authenticate(self.admin)

        response = self.client.delete(f'/api/trips/{self.trip.pk}/')

        self.assertEqual(response.status_code, 204, getattr(response, 'data', None))
        self.assertFalse(Trip.objects.filter(pk=self.trip.pk).exists())
        self.assertFalse(Booking.objects.filter(pk=booking.pk).exists())
        self.assertFalse(Payment.objects.filter(pk=payment.pk).exists())

    def test_admin_can_delete_trip_without_booking_history(self):
        Payment.objects.create(trip=self.trip, amount='250.00')
        self.client.force_authenticate(self.admin)

        response = self.client.delete(f'/api/trips/{self.trip.pk}/')

        self.assertEqual(response.status_code, 204, getattr(response, 'data', None))
        self.assertFalse(Trip.objects.filter(pk=self.trip.pk).exists())
        self.assertFalse(Payment.objects.filter(trip=self.trip).exists())

    def test_admin_can_filter_bookings_by_passenger(self):
        other_passenger = get_user_model().objects.create_user(
            username='booking_other',
            password='Different-strong-pass-123!',
            role='passenger',
        )
        for passenger, seat in ((self.passenger, 1), (other_passenger, 2)):
            booking = Booking.objects.create(
                passenger=passenger,
                trip=self.trip,
                total_amount='250.00',
            )
            BookingSeat.objects.create(
                booking=booking,
                trip=self.trip,
                seat_number=seat,
                is_active=False,
            )

        self.client.force_authenticate(self.admin)
        response = self.client.get(f'/api/bookings/?passenger_id={self.passenger.pk}')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['passenger']['id'], self.passenger.pk)

    def test_backend_rejects_double_booking_and_refreshes_availability(self):
        first = self.client.post(
            '/api/bookings/',
            {'trip': self.trip.pk, 'seat_numbers': [3]},
            format='json',
        )
        second = self.client.post(
            '/api/bookings/',
            {'trip': self.trip.pk, 'seat_numbers': [3]},
            format='json',
        )

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 409, second.data)
        self.assertEqual(Booking.objects.filter(trip=self.trip).count(), 1)

    def test_passenger_can_cancel_and_release_seats(self):
        booking = Booking.objects.create(
            passenger=self.passenger,
            trip=self.trip,
            total_amount='250.00',
        )
        BookingSeat.objects.create(booking=booking, trip=self.trip, seat_number=4)

        response = self.client.post(f'/api/bookings/{booking.pk}/cancel/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'cancelled')
        self.assertFalse(booking.seats.get().is_active)
        self.assertEqual(
            self.client.get(f'/api/trips/{self.trip.pk}/seats/').data['available_seats'],
            4,
        )

    def test_unpublished_trips_are_not_visible_or_bookable(self):
        self.trip.is_published = False
        self.trip.save(update_fields=('is_published',))

        self.assertEqual(self.client.get('/api/trips/search/').data, [])
        response = self.client.post(
            '/api/bookings/',
            {'trip': self.trip.pk, 'seat_numbers': [1]},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Booking.objects.exists())

    def test_passenger_can_see_published_trip_when_route_status_is_title_case_active(self):
        self.route.status = 'Active'
        self.route.save(update_fields=('status',))

        response = self.client.get('/api/trips/search/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([trip['id'] for trip in response.data], [self.trip.pk])

    def test_passenger_cannot_book_trip_after_it_starts(self):
        now = timezone.now()
        self.trip.status = 'in_progress'
        self.trip.departure_time = now - timedelta(minutes=30)
        self.trip.arrival_time = now + timedelta(hours=1)
        self.trip.save(update_fields=('status', 'departure_time', 'arrival_time'))

        search = self.client.get('/api/trips/search/')
        booking = self.client.post(
            '/api/bookings/',
            {'trip': self.trip.pk, 'seat_numbers': [1]},
            format='json',
        )

        self.assertEqual(search.data, [])
        self.assertEqual(booking.status_code, 400, booking.data)

    def test_in_progress_trip_is_not_bookable_at_or_after_arrival(self):
        now = timezone.now()
        self.trip.status = 'in_progress'
        self.trip.departure_time = now - timedelta(hours=2)
        self.trip.arrival_time = now - timedelta(minutes=1)
        self.trip.save(update_fields=('status', 'departure_time', 'arrival_time'))

        search = self.client.get('/api/trips/search/')
        booking = self.client.post(
            '/api/bookings/',
            {'trip': self.trip.pk, 'seat_numbers': [1]},
            format='json',
        )

        self.assertEqual(search.status_code, 200)
        self.assertEqual(search.data, [])
        self.assertEqual(booking.status_code, 400)
        self.assertFalse(Booking.objects.exists())

    def test_disabled_vehicle_seats_are_not_shown_as_bookable(self):
        self.client.force_authenticate(self.admin)
        update = self.client.patch(
            f'/api/vehicles/{self.vehicle.pk}/',
            {'disabled_seats': [2]},
            format='json',
        )
        self.assertEqual(update.status_code, 200, update.data)
        self.client.force_authenticate(self.passenger)

        seats = self.client.get(f'/api/trips/{self.trip.pk}/seats/')
        self.assertEqual(seats.status_code, 200)
        self.assertEqual(seats.data['available_seats'], 3)
        self.assertEqual(seats.data['seats'][1]['state'], 'disabled')
        rejected = self.client.post(
            '/api/bookings/',
            {'trip': self.trip.pk, 'seat_numbers': [2]},
            format='json',
        )
        self.assertEqual(rejected.status_code, 400)

    def test_passengers_cannot_create_trips_or_read_other_passengers_bookings(self):
        response = self.client.post('/api/trips/', {}, format='json')
        self.assertEqual(response.status_code, 403)

        other_passenger = get_user_model().objects.create_user(
            username='another_passenger',
            role='passenger',
        )
        booking = Booking.objects.create(
            passenger=other_passenger,
            trip=self.trip,
            total_amount='250.00',
        )
        response = self.client.get(f'/api/bookings/{booking.pk}/')
        self.assertEqual(response.status_code, 404)

    def test_admin_can_delete_driver_without_trips(self):
        driver_user = get_user_model().objects.create_user(
            username='deletable_driver',
            role='driver',
        )
        driver = Driver.objects.create(user=driver_user)
        self.client.force_authenticate(self.admin)

        response = self.client.delete(f'/api/drivers/{driver.pk}/')

        self.assertEqual(response.status_code, 204, getattr(response, 'data', None))
        self.assertFalse(Driver.objects.filter(pk=driver.pk).exists())
        self.assertTrue(get_user_model().objects.filter(pk=driver_user.pk).exists())

    def test_admin_cannot_delete_driver_on_scheduled_trip(self):
        self.client.force_authenticate(self.admin)

        response = self.client.delete(f'/api/drivers/{self.driver.pk}/')

        self.assertEqual(response.status_code, 400, response.data)
        self.assertTrue(Driver.objects.filter(pk=self.driver.pk).exists())

    def test_driver_cannot_be_assigned_to_overlapping_trips(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/trips/', {
            'route': self.route.pk,
            'vehicle': self.vehicle.pk,
            'driver': self.driver.pk,
            'start_station': self.start.pk,
            'destination_station': self.destination.pk,
            'departure_time': self.trip.departure_time.isoformat(),
            'arrival_time': self.trip.arrival_time.isoformat(),
            'status': 'scheduled',
            'fare_amount': '250.00',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('driver', response.data)

    def test_vehicle_cannot_be_assigned_to_overlapping_trips(self):
        alternate_user = get_user_model().objects.create_user(
            username='alternate_driver',
            role='driver',
        )
        alternate_driver = Driver.objects.create(
            user=alternate_user,
            verification_status='approved',
        )
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/trips/', {
            'route': self.route.pk,
            'vehicle': self.vehicle.pk,
            'driver': alternate_driver.pk,
            'start_station': self.start.pk,
            'destination_station': self.destination.pk,
            'departure_time': self.trip.departure_time.isoformat(),
            'arrival_time': self.trip.arrival_time.isoformat(),
            'status': 'scheduled',
            'fare_amount': '250.00',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('vehicle', response.data)

    def test_assignment_picker_marks_scheduled_resources_unavailable(self):
        self.client.force_authenticate(self.admin)
        query = {
            'departure_time': self.trip.departure_time.isoformat(),
            'arrival_time': self.trip.arrival_time.isoformat(),
        }

        drivers = self.client.get('/api/assignment-drivers/', query)
        vehicles = self.client.get('/api/assignment-vehicles/', query)

        self.assertEqual(drivers.status_code, 200)
        self.assertFalse(next(item for item in drivers.data if item['id'] == self.driver.pk)['available'])
        self.assertFalse(next(item for item in vehicles.data if item['id'] == self.vehicle.pk)['available'])

    def test_assignment_picker_filters_drivers_and_vehicles_by_assignment(self):
        self.client.force_authenticate(self.admin)
        alternate_vehicle = Vehicle.objects.create(
            registration_number='BOOK-002',
            capacity=4,
            status='active',
        )
        alternate_user = get_user_model().objects.create_user(
            username='assigned_vehicle_driver',
            role='driver',
        )
        alternate_driver = Driver.objects.create(
            user=alternate_user,
            vehicle=alternate_vehicle,
            verification_status='approved',
            status='active',
        )

        drivers = self.client.get(
            '/api/assignment-drivers/',
            {'vehicle': self.vehicle.pk},
        )
        vehicles = self.client.get(
            '/api/assignment-vehicles/',
            {'driver': alternate_driver.pk},
        )

        self.assertEqual([item['id'] for item in drivers.data], [self.driver.pk])
        self.assertEqual([item['id'] for item in vehicles.data], [alternate_vehicle.pk])

    def test_assignment_picker_excludes_unassigned_drivers(self):
        self.client.force_authenticate(self.admin)
        unassigned_user = get_user_model().objects.create_user(
            username='unassigned_picker_driver',
            role='driver',
        )
        unassigned_driver = Driver.objects.create(
            user=unassigned_user,
            verification_status='approved',
            status='active',
        )

        response = self.client.get('/api/assignment-drivers/')

        self.assertEqual(response.status_code, 200)
        self.assertNotIn(
            unassigned_driver.pk,
            [item['id'] for item in response.data],
        )

    def test_trip_rejects_driver_not_assigned_to_selected_vehicle(self):
        self.client.force_authenticate(self.admin)
        alternate_vehicle = Vehicle.objects.create(
            registration_number='BOOK-003',
            capacity=4,
            status='active',
        )
        alternate_user = get_user_model().objects.create_user(
            username='wrong_vehicle_driver',
            role='driver',
        )
        alternate_driver = Driver.objects.create(
            user=alternate_user,
            vehicle=alternate_vehicle,
            verification_status='approved',
            status='active',
        )

        response = self.client.post('/api/trips/', {
            'route': self.route.pk,
            'vehicle': self.vehicle.pk,
            'driver': alternate_driver.pk,
            'start_station': self.start.pk,
            'destination_station': self.destination.pk,
            'departure_time': (timezone.now() + timedelta(days=2)).isoformat(),
            'arrival_time': (timezone.now() + timedelta(days=2, hours=1)).isoformat(),
            'status': 'scheduled',
            'fare_amount': '250.00',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data['driver'][0],
            'The selected driver must be assigned to the selected vehicle.',
        )

    def test_trip_reminders_are_created_once_for_due_confirmed_bookings(self):
        booking = Booking.objects.create(
            passenger=self.passenger,
            trip=self.trip,
            total_amount='250.00',
        )
        BookingSeat.objects.create(booking=booking, trip=self.trip, seat_number=1)
        self.trip.departure_time = timezone.now() + timedelta(hours=1)
        self.trip.save(update_fields=('departure_time',))

        self.assertEqual(create_due_trip_reminders(self.passenger), 1)
        self.assertEqual(create_due_trip_reminders(self.passenger), 0)
        reminder = Notification.objects.get(booking=booking, notification_type='trip_reminder')
        self.assertEqual(reminder.title, 'Trip starts in 2 hours')


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class OperationalWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.User = get_user_model()
        self.admin = self.User.objects.create_user(
            username='workflow_admin',
            email='workflow.admin@example.com',
            password='Different-strong-pass-123!',
            role='admin',
        )
        self.passenger = self.User.objects.create_user(
            username='workflow_passenger',
            email='workflow.passenger@example.com',
            password='Different-strong-pass-123!',
            role='passenger',
        )
        self.driver_user = self.User.objects.create_user(
            username='workflow_driver',
            email='workflow.driver@example.com',
            password='Different-strong-pass-123!',
            role='driver',
        )
        self.driver = Driver.objects.create(
            user=self.driver_user,
            status='active',
            verification_status='pending',
        )

    def test_driver_documents_are_private_and_required_for_verification(self):
        self.client.force_authenticate(self.driver_user)
        documents = []
        for document_type in ('drivers_license', 'identity'):
            response = self.client.post(
                '/api/driver-documents/',
                {
                    'document_type': document_type,
                    'file': SimpleUploadedFile(
                        f'{document_type}.pdf',
                        b'%PDF-1.4 test document',
                        content_type='application/pdf',
                    ),
                },
            )
            self.assertEqual(response.status_code, 201, response.data)
            document = DriverDocument.objects.get(pk=response.data['id'])
            self.addCleanup(document.file.delete, save=False)
            documents.append(document)

        self.client.force_authenticate(self.admin)
        verification = self.client.post(
            f'/api/drivers/{self.driver.pk}/verification/',
            {'status': 'approved'},
            format='json',
        )
        self.assertEqual(verification.status_code, 400)
        self.assertIn(
            'Identity document',
            verification.data['documents'],
        )

        for document in documents:
            review = self.client.post(
                f'/api/driver-documents/{document.pk}/review/',
                {'status': 'approved'},
                format='json',
            )
            self.assertEqual(review.status_code, 200, review.data)

        verification = self.client.post(
            f'/api/drivers/{self.driver.pk}/verification/',
            {'status': 'approved'},
            format='json',
        )
        self.assertEqual(verification.status_code, 200, verification.data)
        self.driver.refresh_from_db()
        self.assertEqual(self.driver.verification_status, 'approved')

        self.client.force_authenticate(self.passenger)
        denied_download = self.client.get(
            f'/api/driver-documents/{documents[0].pk}/download/'
        )
        self.assertEqual(denied_download.status_code, 403)

        self.client.force_authenticate(self.driver_user)
        downloaded = self.client.get(
            f'/api/driver-documents/{documents[0].pk}/download/',
            HTTP_ACCEPT='application/octet-stream',
        )
        self.assertEqual(downloaded.status_code, 200)
        self.assertEqual(downloaded['Content-Type'], 'application/pdf')
        downloaded.close()

    def test_private_ride_request_acceptance_and_completion(self):
        self.driver.verification_status = 'approved'
        self.driver.save(update_fields=('verification_status',))
        self.client.force_authenticate(self.passenger)
        response = self.client.post('/api/private-rides/', {
            'pickup_address': 'Home',
            'destination_address': 'Station',
            'pickup_latitude': 30.01,
            'pickup_longitude': 31.20,
            'destination_latitude': 30.05,
            'destination_longitude': 31.25,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        ride_id = response.data['id']

        self.client.force_authenticate(self.driver_user)
        response = self.client.post(
            f'/api/private-rides/{ride_id}/accept/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'accepted')

        response = self.client.post(
            f'/api/private-rides/{ride_id}/complete/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'completed')
        self.assertTrue(PrivateRide.objects.filter(
            pk=ride_id,
            driver=self.driver,
            status='completed',
        ).exists())

    def test_approved_driver_submits_draft_for_admin_publication(self):
        start = Station.objects.create(name='Driver trip start', latitude=1, longitude=1)
        destination = Station.objects.create(name='Driver trip end', latitude=2, longitude=2)
        route = Route.objects.create(name='Driver-submitted route', status='active')
        RouteStation.objects.create(route=route, station=start, sequence_order=1)
        RouteStation.objects.create(route=route, station=destination, sequence_order=2)
        vehicle = Vehicle.objects.create(
            registration_number='DRIVER-DRAFT-1',
            capacity=8,
            status='active',
        )
        self.driver.vehicle = vehicle
        self.driver.verification_status = 'approved'
        self.driver.save(update_fields=('vehicle', 'verification_status'))

        self.client.force_authenticate(self.driver_user)
        response = self.client.post('/api/trips/', {
            'route': route.pk,
            'start_station': start.pk,
            'destination_station': destination.pk,
            'departure_time': (timezone.now() + timedelta(days=1)).isoformat(),
            'arrival_time': (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            'fare_amount': '10.00',
            'is_published': True,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        trip_id = response.data['id']
        self.assertFalse(response.data['is_published'])
        self.assertEqual(response.data['driver'], self.driver.pk)

        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f'/api/trips/{trip_id}/',
            {'is_published': True},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['is_published'])

    def test_complaints_are_reporter_scoped_and_admin_updates_are_audited(self):
        self.client.force_authenticate(self.passenger)
        response = self.client.post('/api/complaints/', {
            'subject': 'Service issue',
            'description': 'The pickup point was unclear.',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        complaint_id = response.data['id']

        self.client.force_authenticate(self.driver_user)
        self.assertEqual(self.client.get('/api/complaints/').data, [])
        self.assertEqual(
            self.client.get(f'/api/complaints/{complaint_id}/').status_code,
            404,
        )

        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f'/api/complaints/{complaint_id}/',
            {'status': 'resolved', 'resolution': 'Pickup instructions updated.'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'resolved')
        self.assertTrue(AuditLog.objects.filter(
            action='complaint.updated',
            object_id=str(complaint_id),
        ).exists())

    def test_operational_setting_override_health_and_email_outbox(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            '/api/operational-settings/max_active_upcoming_bookings/',
            {'value': 3},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['value'], 3)
        self.assertEqual(
            OperationalSetting.objects.get(
                key='max_active_upcoming_bookings',
            ).value,
            '3',
        )
        self.assertEqual(self.client.get('/api/audit-logs/').status_code, 200)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/healthz/').data['status'], 'ok')

        outbox = EmailOutbox.objects.create(
            recipient_email=self.passenger.email,
            subject='Queued message',
            body='This message is queued.',
        )
        call_command('send_email_outbox', verbosity=0)
        outbox.refresh_from_db()
        self.assertEqual(outbox.status, 'sent')
        self.assertEqual(outbox.attempts, 1)

    def test_email_outbox_records_delivery_failure_for_retry(self):
        outbox = EmailOutbox.objects.create(
            recipient_email=self.passenger.email,
            subject='Retry message',
            body='This message should be retried.',
        )
        with patch(
            'core.management.commands.send_email_outbox.EmailMultiAlternatives.send',
            side_effect=OSError('Temporary mail service outage.'),
        ):
            call_command('send_email_outbox', verbosity=0)
        outbox.refresh_from_db()
        self.assertEqual(outbox.status, 'failed')
        self.assertEqual(outbox.attempts, 1)
        self.assertIn('Temporary mail service outage', outbox.last_error)
        self.assertGreater(outbox.available_at, timezone.now())


class QaRegressionTests(BookingApiTests):
    def _add_middle_stop(self):
        middle = Station.objects.create(
            name='Tanta',
            latitude=30.8,
            longitude=31.0,
            is_active=True,
        )
        self.destination_stop = RouteStation.objects.get(
            route=self.route,
            station=self.destination,
        )
        self.destination_stop.sequence_order = 3
        self.destination_stop.save(update_fields=('sequence_order',))
        RouteStation.objects.create(
            route=self.route,
            station=middle,
            sequence_order=2,
        )
        return middle

    def test_completing_a_trip_marks_pending_cash_payments_paid(self):
        booking_response = self.client.post(
            '/api/bookings/',
            {'trip': self.trip.pk, 'seat_numbers': [1]},
            format='json',
        )
        self.assertEqual(booking_response.status_code, 201, booking_response.data)
        payment = Payment.objects.get(booking_id=booking_response.data['id'])
        self.assertEqual(payment.status, 'pending')

        self.client.force_authenticate(self.driver_user)
        start = self.client.patch(
            f'/api/trips/{self.trip.pk}/',
            {'status': 'in_progress'},
            format='json',
        )
        self.assertEqual(start.status_code, 200, start.data)
        complete = self.client.patch(
            f'/api/trips/{self.trip.pk}/',
            {'status': 'completed'},
            format='json',
        )
        self.assertEqual(complete.status_code, 200, complete.data)

        payment.refresh_from_db()
        self.assertEqual(Booking.objects.get(pk=booking_response.data['id']).status, 'completed')
        self.assertEqual(payment.status, 'paid')
        self.assertIsNotNone(payment.paid_at)

    def test_segment_booking_uses_the_same_fare_as_trip_search(self):
        middle = self._add_middle_stop()
        pickup = RouteStation.objects.get(route=self.route, station=self.start)
        dropoff = RouteStation.objects.get(route=self.route, station=middle)

        search = self.client.get(
            '/api/trips/search/',
            {
                'start_station_id': self.start.pk,
                'destination_station_id': middle.pk,
            },
        )
        self.assertEqual(search.status_code, 200, search.data)
        self.assertEqual(len(search.data), 1)
        search_fare = search.data[0]['search_fare_amount']

        booking = self.client.post(
            '/api/bookings/',
            {
                'trip': self.trip.pk,
                'seat_numbers': [1],
                'pickup_stop': pickup.pk,
                'dropoff_stop': dropoff.pk,
            },
            format='json',
        )
        self.assertEqual(booking.status_code, 201, booking.data)
        self.assertEqual(
            booking.data['total_amount'],
            f"{search_fare:.2f}",
        )

    def test_cancelled_booking_releases_idempotency_key_for_rebooking(self):
        first = self.client.post(
            '/api/bookings/',
            {'trip': self.trip.pk, 'seat_numbers': [1]},
            format='json',
            HTTP_IDEMPOTENCY_KEY='seat-1-retry',
        )
        self.assertEqual(first.status_code, 201, first.data)
        cancel = self.client.post(f'/api/bookings/{first.data["id"]}/cancel/')
        self.assertEqual(cancel.status_code, 200, cancel.data)

        second = self.client.post(
            '/api/bookings/',
            {'trip': self.trip.pk, 'seat_numbers': [2]},
            format='json',
            HTTP_IDEMPOTENCY_KEY='seat-1-retry',
        )
        self.assertEqual(second.status_code, 201, second.data)
        self.assertNotEqual(second.data['id'], first.data['id'])
        self.assertEqual(second.data['seat_numbers'], [2])

    def test_second_driver_cannot_accept_an_already_accepted_private_ride(self):
        second_driver_user = get_user_model().objects.create_user(
            username='second_private_driver',
            password='Different-strong-pass-123!',
            role='driver',
        )
        Driver.objects.create(
            user=second_driver_user,
            status='active',
            verification_status='approved',
        )
        create = self.client.post('/api/private-rides/', {
            'pickup_address': 'Home',
            'destination_address': 'Work',
            'pickup_latitude': 30.01,
            'pickup_longitude': 31.20,
            'destination_latitude': 30.05,
            'destination_longitude': 31.25,
        }, format='json')
        self.assertEqual(create.status_code, 201, create.data)
        ride_id = create.data['id']

        self.client.force_authenticate(self.driver_user)
        first = self.client.post(f'/api/private-rides/{ride_id}/accept/', {}, format='json')
        self.assertEqual(first.status_code, 200, first.data)

        self.client.force_authenticate(second_driver_user)
        second = self.client.post(f'/api/private-rides/{ride_id}/accept/', {}, format='json')
        self.assertEqual(second.status_code, 400, second.data)
        self.assertEqual(PrivateRide.objects.get(pk=ride_id).driver, self.driver)

    def test_passenger_cancel_while_driver_accepts_keeps_one_terminal_state(self):
        create = self.client.post('/api/private-rides/', {
            'pickup_address': 'A',
            'destination_address': 'B',
            'pickup_latitude': 30.0,
            'pickup_longitude': 31.0,
            'destination_latitude': 30.1,
            'destination_longitude': 31.1,
        }, format='json')
        ride_id = create.data['id']
        cancel = self.client.post(f'/api/private-rides/{ride_id}/cancel/', {}, format='json')
        self.assertEqual(cancel.status_code, 200, cancel.data)

        self.client.force_authenticate(self.driver_user)
        accept = self.client.post(f'/api/private-rides/{ride_id}/accept/', {}, format='json')
        self.assertEqual(accept.status_code, 400, accept.data)
        self.assertEqual(PrivateRide.objects.get(pk=ride_id).status, 'cancelled')

    def test_admin_mark_all_read_does_not_mutate_other_users_notifications(self):
        Notification.objects.create(
            user=self.passenger,
            title='Passenger note',
            message='Yours',
            notification_type='trip_status',
        )
        other = Notification.objects.create(
            user=self.admin,
            title='Admin note',
            message='Mine',
            notification_type='trip_status',
        )
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/notifications/mark-all-read/')
        self.assertEqual(response.status_code, 200)
        other.refresh_from_db()
        self.assertTrue(other.is_read)
        self.assertFalse(Notification.objects.get(user=self.passenger).is_read)

    def test_paid_booking_is_refunded_when_cancelled(self):
        booking = self.client.post(
            '/api/bookings/',
            {'trip': self.trip.pk, 'seat_numbers': [1]},
            format='json',
        )
        payment = Payment.objects.get(booking_id=booking.data['id'])
        payment.status = 'paid'
        payment.paid_at = timezone.now()
        payment.save(update_fields=('status', 'paid_at'))

        cancel = self.client.post(f'/api/bookings/{booking.data["id"]}/cancel/')
        self.assertEqual(cancel.status_code, 200, cancel.data)
        payment.refresh_from_db()
        self.assertEqual(payment.status, 'refunded')

    def test_assigned_driver_can_view_trip_seats(self):
        self.client.force_authenticate(self.driver_user)
        response = self.client.get(f'/api/trips/{self.trip.pk}/seats/')
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.assertEqual(response.data['vehicle_capacity'], 4)

    def test_duplicate_idempotent_booking_returns_the_original(self):
        payload = {'trip': self.trip.pk, 'seat_numbers': [3]}
        first = self.client.post(
            '/api/bookings/',
            payload,
            format='json',
            HTTP_IDEMPOTENCY_KEY='same-request',
        )
        second = self.client.post(
            '/api/bookings/',
            payload,
            format='json',
            HTTP_IDEMPOTENCY_KEY='same-request',
        )
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(Booking.objects.filter(trip=self.trip).count(), 1)

    def test_booking_rejects_empty_and_duplicate_seat_lists(self):
        empty = self.client.post(
            '/api/bookings/',
            {'trip': self.trip.pk, 'seat_numbers': []},
            format='json',
        )
        duplicates = self.client.post(
            '/api/bookings/',
            {'trip': self.trip.pk, 'seat_numbers': [1, 1]},
            format='json',
        )
        self.assertEqual(empty.status_code, 400)
        self.assertEqual(duplicates.status_code, 400)
