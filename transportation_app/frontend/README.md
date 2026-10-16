# وصلني (Wasalni) frontend

React and TypeScript application for the transportation API in the parent Django project.

## Run locally

Apply database migrations, then start Django from the project root:

```powershell
python manage.py migrate
python manage.py runserver 8000
```

In another terminal:

```powershell
Set-Location frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api`, `/swagger`, and `/redoc` to Django at `http://127.0.0.1:8000`; change the target in `vite.config.ts` if Django uses another address.

## Build

```powershell
npm run build
```

The production bundle is written to `dist/`. Hosting/deploying that bundle is separate from the Django development server.

## API coverage

The workspace is role-aware: administrators plan and publish trips, review bookings and users, and manage fleet resources; drivers see only their assigned trips and can start or complete them; passengers search bookable trips, select seats, cancel eligible bookings, and view their notifications and history.

### Booking workflow

1. Create a scheduled trip with an active driver, active vehicle, departure/arrival times, and fare.
2. Configure the vehicle layout as JSON rows in the vehicle editor. Use `null` for aisle spaces, for example `[[1,2,null,3,4],[5,6,null,7,8]]`. The default layout is generated from capacity when no custom layout is saved.
3. Publish the trip using **Publish for passenger booking**. A trip is listed to passengers only while it is published, scheduled for the future, assigned to active operations, and has remaining seats.
4. Passengers search trips, select one or more seats from the vehicle layout, review the total, and explicitly confirm. The API locks the trip during allocation and the database enforces one active reservation per trip/seat.

Key authenticated endpoints include `GET /api/me/`, `GET /api/trips/search/`, `GET /api/trips/<id>/seats/`, `GET|POST /api/bookings/`, `GET /api/bookings/<id>/`, `POST /api/bookings/<id>/cancel/`, `GET /api/trips/<id>/passengers/`, and the notification collection/read endpoints. Administrators can check scheduled driver and vehicle availability at `/api/assignment-drivers/` and `/api/assignment-vehicles/`; assignment conflicts are also rejected by the trip API.

Trip reminder notifications are created idempotently when notifications are checked and by the `python manage.py send_trip_reminders` management command. Schedule that command to run periodically in the deployment environment for reminders even when a passenger is not using the app. The UI refreshes notification counts and notifications while open; push notifications are not configured.

The tracking command center plots configured station coordinates and planned routes from existing records. It continues to report that live GPS locations and ETAs are unavailable because the API has no telemetry feed. Revenue reporting and payment processing are not implied by booking confirmation.
