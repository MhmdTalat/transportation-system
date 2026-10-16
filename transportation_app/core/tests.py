from datetime import datetime, time, timedelta
from urllib.parse import parse_qs, urlsplit
import re
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.db import IntegrityError, connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from django.core.cache import cache
from rest_framework.test import APIClient

from .models import (
    Booking,
    BookingSeat,
    Driver,
    FareRule,
    Notification,
    Payment,
    Route,
    RouteStation,
    Station,
    Trip,
    Vehicle,
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

    def test_trip_creation_creates_payment_record(self):
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
        driver = Driver.objects.create(user=driver_user, vehicle=vehicle, status='active')

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
        self.assertEqual(response.data['payment']['amount'], '8.50')

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
            def create_trip_with_payment(self, validated_data):
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

    def test_trip_list_prefetches_the_first_payment_for_all_trips(self):
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

        with self.assertNumQueries(2):
            response = self.client.get('/api/trips/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(
            {item['payment']['amount'] for item in response.data},
            {'4.00', '5.00'},
        )

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
        driver = Driver.objects.create(user=driver_user, status='active')
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
            },
        )

        response = self.client.get('/api/stations.json')
        self.assertEqual(response.status_code, 200)


class UserRegistrationApiTests(TestCase):
    def setUp(self):
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

    def test_registration_creates_passenger_and_allows_login(self):
        response = self.client.post('/api/register/', self.registration_data, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['username'], self.registration_data['username'])
        self.assertEqual(response.data['role'], 'passenger')
        self.assertNotIn('password', response.data)

        user = get_user_model().objects.get(username=self.registration_data['username'])
        self.assertTrue(user.check_password(self.registration_data['password']))
        self.assertFalse(Driver.objects.filter(user=user).exists())

        token_response = self.client.post('/api/token/', {
            'username': self.registration_data['username'],
            'password': self.registration_data['password'],
        }, format='json')
        self.assertEqual(token_response.status_code, 200)
        self.assertIn('access', token_response.data)

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
        self.assertEqual(response.data['role'], 'driver')
        user = get_user_model().objects.get(username='new_driver')
        self.assertTrue(Driver.objects.filter(user=user).exists())

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


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
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
        )

    def reset_link_payload(self):
        email = mail.outbox[-1]
        reset_url = re.search(r'href="([^"]+)"', email.alternatives[0][0]).group(1)
        query = parse_qs(urlsplit(reset_url).query)
        return {'uid': query['uid'][0], 'token': query['token'][0]}

    def test_known_and_unknown_emails_receive_the_same_public_response(self):
        known = self.request_reset()
        self.assertEqual(known.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(
            mail.outbox[0].subject,
            'Reset Your Transportation Platform Password',
        )
        self.assertIn('Reset Password', mail.outbox[0].alternatives[0][0])
        self.assertIn('https://transit.example/reset-password?', mail.outbox[0].alternatives[0][0])

        unknown = self.request_reset('unknown@example.com')
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(known.data, unknown.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_valid_reset_changes_password_and_token_cannot_be_reused(self):
        self.request_reset()
        payload = self.reset_link_payload()
        payload['new_password'] = 'New-strong-password-456!'

        response = self.client.post(
            '/api/auth/reset-password/',
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(payload['new_password']))
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

    def test_invalid_and_expired_tokens_are_rejected(self):
        self.request_reset()
        payload = self.reset_link_payload()
        payload.update(token='invalid-token', new_password='New-strong-password-456!')

        invalid = self.client.post('/api/auth/reset-password/', payload, format='json')
        self.assertEqual(invalid.status_code, 400)
        self.assertIn('invalid or has expired', invalid.data['detail'])

        self.request_reset()
        payload = self.reset_link_payload()
        payload['new_password'] = 'New-strong-password-456!'
        with override_settings(PASSWORD_RESET_TIMEOUT=-1):
            expired = self.client.post('/api/auth/reset-password/', payload, format='json')
        self.assertEqual(expired.status_code, 400)
        self.assertFalse(self.user.check_password(payload['new_password']))

    def test_weak_password_is_rejected_without_changing_password(self):
        self.request_reset()
        payload = self.reset_link_payload()
        payload['new_password'] = '12345678'

        response = self.client.post(
            '/api/auth/reset-password/',
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('new_password', response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Old-strong-password-123!'))

    def test_email_delivery_failure_keeps_generic_response(self):
        with patch('core.views._send_password_reset_email', side_effect=RuntimeError):
            response = self.request_reset()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['detail'], response.data['detail'])
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
        self.driver = Driver.objects.create(user=self.driver_user)
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

    def test_passenger_can_see_and_book_in_progress_trip_before_arrival(self):
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

        self.assertEqual([trip['id'] for trip in search.data], [self.trip.pk])
        self.assertEqual(booking.status_code, 201, booking.data)

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
        alternate_driver = Driver.objects.create(user=alternate_user)
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
