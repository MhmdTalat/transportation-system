# Core Transportation Business Logic & Booking System

The UI and frontend architecture must reflect a **real transportation booking platform**, not a generic CRUD application.

The system has three primary roles:

1. **Passenger**
2. **Driver**
3. **Administrator**

The frontend must clearly separate their experiences, permissions, and available actions.

---

# 1. Passenger Booking Flow

The passenger must be able to:

1. Browse available trips.
2. Select a trip.
3. View trip details.
4. View available seats.
5. Select one or more available seats.
6. See the selected seats visually.
7. See the total booking price.
8. Confirm the booking.
9. Receive booking confirmation.
10. Receive reminders before the trip.
11. View active/upcoming bookings.
12. Cancel the booking if cancellation is supported by the backend.
13. View booking history.

The booking experience must be simple and intuitive.

---

# 2. Seat Selection UI

Seat selection is a core feature and must receive special UX treatment.

Do NOT represent seats only as a dropdown.

Create a visual **bus/vehicle seat layout**.

Example:

```text
                 DRIVER
             ┌─────────────┐

             🚗

       ┌─────┐   ┌─────┐
       │ 01  │   │ 02  │
       └─────┘   └─────┘

       ┌─────┐   ┌─────┐
       │ 03  │   │ 04  │
       └─────┘   └─────┘

       ┌─────┐   ┌─────┐
       │ 05  │   │ 06  │
       └─────┘   └─────┘
```

The actual layout must be configurable based on the vehicle type and the data returned by the backend.

For example:

* 2+1 bus
* 2+2 bus
* Van
* Minibus
* Custom vehicle layout

Do NOT hardcode a single seat layout.

---

# 3. Seat States

Every seat must have a clearly distinguishable state.

### Available

Passenger can select it.

```text
[ 12 ]
```

### Selected

Passenger has selected it.

```text
[ ✓ 12 ]
```

### Booked

Seat is already reserved.

```text
[ 🔒 12 ]
```

Passenger cannot select it.

### Temporarily Reserved

If the backend supports temporary seat reservation:

```text
[ ⏳ 12 ]
```

Passenger cannot select it until the reservation expires.

### Disabled

Seat is unavailable because of vehicle configuration or operational restrictions.

```text
[ — 12 ]
```

Use both visual styling and text/tooltips where appropriate.

Do not rely on color alone.

---

# 4. Capacity Management

Seat availability must always be derived from the actual booking state.

Example:

Vehicle capacity:

```text
40 seats
```

Booked:

```text
17
```

Available:

```text
23
```

Display:

```text
17 / 40 seats booked

23 seats available
```

When a passenger successfully books a seat:

```text
Available capacity:
23 → 22
```

The UI must immediately reflect the updated capacity.

---

# 5. Critical Concurrency Rule

Do NOT assume that disabling a seat in the frontend is enough.

Two passengers could open the same trip simultaneously.

Example:

Passenger A sees:

```text
Seat 15 = Available
```

Passenger B also sees:

```text
Seat 15 = Available
```

Both attempt to book it.

The backend must be the final authority.

The frontend must correctly handle:

```text
Seat selected
      ↓
Booking request
      ↓
Backend validates availability
      ↓
Success
    OR
Seat no longer available
```

If the backend rejects the booking because another passenger booked the seat first:

Show:

> "Seat 15 is no longer available. Please select another seat."

Then refresh the seat availability.

Never silently create an inconsistent booking state.

---

# 6. Seat Selection Summary

While selecting seats, display a persistent summary.

Example:

```text
┌──────────────────────────────┐
│ Your Selection               │
│                              │
│ Seats                        │
│ 12, 13                       │
│                              │
│ 2 × 250 EGP                  │
│                              │
│ Total                        │
│ 500 EGP                      │
│                              │
│ [ Continue Booking ]         │
└──────────────────────────────┘
```

On desktop, keep the summary beside the seat layout.

On mobile, use a sticky bottom booking summary.

---

# 7. Booking Confirmation

Before final confirmation, show:

### Trip

Cairo → Alexandria

### Date

October 12, 2026

### Departure

08:30 AM

### Seats

12, 13

### Passenger

Passenger Name

### Total

500 EGP

Then:

**Confirm Booking**

The user should explicitly confirm before creating the booking.

---

# 8. Booking Status

Bookings should have clear lifecycle states.

Possible states:

```text
Pending
Confirmed
Cancelled
Completed
Expired
Failed
```

Only use statuses actually supported by the backend.

Display the status consistently throughout:

* Passenger dashboard
* Booking details
* Notifications
* Admin dashboard
* Trip details

---

# 9. Passenger Dashboard

Create a passenger-oriented dashboard.

Prioritize:

### Upcoming Trip

```text
┌───────────────────────────────────────┐
│ UPCOMING TRIP                         │
│                                       │
│ Cairo             →       Alexandria  │
│                                       │
│ Oct 12, 2026       08:30 AM           │
│                                       │
│ Seats: 12, 13                         │
│ Status: ● Confirmed                   │
│                                       │
│        [ View Booking ]               │
└───────────────────────────────────────┘
```

Also display:

* Upcoming bookings
* Recent bookings
* Notifications
* Booking history

---

# 10. Active Trip Notifications

The system must provide active notifications related to passenger bookings.

Examples:

### Booking Confirmation

> Your booking for Cairo → Alexandria is confirmed.

### Trip Reminder

> Reminder: Your trip to Alexandria starts tomorrow at 08:30 AM.

### Same-Day Reminder

> Your trip starts in 2 hours. Please arrive at the pickup point on time.

### Trip Update

> Your trip departure time has been updated.

### Cancellation

> Your trip has been cancelled. Please review your booking for more information.

The frontend should support:

* Notification badge
* Notification dropdown
* Notification center
* Read/unread state
* Timestamp
* Relevant booking/trip reference
* Click-through to booking/trip

---

# 11. Notification Center

Create a professional notification center.

Example:

```text
Notifications

● Trip reminder
  Your Cairo → Alexandria trip starts tomorrow.
  10 min ago

● Booking confirmed
  Seat 12 has been successfully booked.
  2 hours ago

○ Trip update
  Departure time changed to 09:00 AM.
  Yesterday
```

Unread notifications should be visually distinguishable.

Provide:

* Mark as read
* Mark all as read
* Notification count
* Filtering if needed

---

# 12. Admin Role

Administrators have operational control.

Depending on backend permissions, administrators can manage:

### Trips

* Create trip
* Update trip
* Cancel trip
* View trip
* Assign driver
* Assign vehicle
* View passengers
* View seat availability

### Vehicles

* Create vehicle
* Update vehicle
* Configure capacity
* Configure seat layout
* Activate/deactivate vehicle
* View maintenance status

### Drivers

* Create driver
* Update driver
* Activate/deactivate driver
* View assignments
* View trip history

### Passengers

* View passengers
* Manage passenger accounts
* View bookings
* Cancel bookings where authorized

### Reports

* Trips
* Bookings
* Occupancy
* Revenue if supported
* Driver utilization
* Vehicle utilization

---

# 13. Driver Role

The Driver UI must be significantly different from the Admin UI.

A driver should NOT see administrative functionality.

Driver dashboard should prioritize:

### Current Trip

```text
CURRENT TRIP

Cairo → Alexandria

Departure:
08:30 AM

Passengers:
32 / 40

Vehicle:
VH-2048

Status:
● Assigned
```

Driver actions should be limited to operations allowed by the backend.

Possible actions:

* View assigned trip
* View route
* View passengers
* Start trip
* Update trip status
* Complete trip

Do not expose administrative CRUD functionality to drivers.

---

# 14. Critical Driver Assignment Rule

This is a mandatory business constraint:

## A driver cannot be assigned to multiple overlapping/active trips.

When an administrator attempts to assign a driver:

```text
Admin selects Driver
        ↓
System checks driver's assignments
        ↓
Does driver have conflicting active/scheduled trip?
        ↓
      YES
        ↓
Reject assignment
```

Show:

> Driver Ahmed Hassan cannot be assigned to this trip because he is already assigned to another trip during this period.

The UI must not allow the administrator to bypass this validation.

---

# 15. Driver Assignment UI

When assigning a driver, do not show every driver as selectable.

Display driver availability.

Example:

```text
Select Driver

┌────────────────────────────────────────────┐
│ Ahmed Hassan                               │
│ ● Available                                │
│ No conflicting trips                       │
│                                            │
│                              [ Select ]     │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ Mohamed Ali                                │
│ 🔴 Unavailable                             │
│ Assigned to TR-1024                        │
│ 08:00 AM → 12:00 PM                        │
│                                            │
│                              [ Disabled ]  │
└────────────────────────────────────────────┘
```

Unavailable drivers should either be disabled or clearly marked.

---

# 16. Driver Availability

Driver availability should consider:

* Existing assigned trips
* Trip start time
* Trip end time
* Current trip status
* Driver active/inactive status

Do not determine availability only from a simple boolean such as:

```text
is_available = true
```

The actual schedule must be considered.

---

# 17. Vehicle Assignment

Apply similar logic to vehicles.

A vehicle should not be assigned to conflicting trips.

Before assigning a vehicle:

```text
Check:
    Vehicle active?
    Vehicle available?
    Existing conflicting trip?
    Maintenance status?
    Capacity sufficient?
```

If any critical condition fails, prevent the assignment.

Example:

> Vehicle VH-2048 cannot be assigned because it is already scheduled for TR-1024 from 08:00–12:00.

---

# 18. Trip Assignment Workflow

The complete admin workflow should be:

```text
Create Trip
     ↓
Select Route
     ↓
Select Date & Time
     ↓
Select Vehicle
     ↓
Validate Vehicle Availability
     ↓
Select Driver
     ↓
Validate Driver Availability
     ↓
Configure Capacity / Seats
     ↓
Publish Trip
     ↓
Trip becomes available for Passenger Booking
```

Do not make a trip bookable until its required operational information is valid.

---

# 19. Trip Availability

Passengers should only see trips that are actually bookable.

A trip should not appear as normally bookable if:

* Trip is cancelled
* Trip has already departed
* Trip is completed
* Trip is not published
* No seats are available
* Vehicle is unavailable
* Required driver assignment is missing
* Backend marks the trip as unavailable

The backend remains the source of truth.

---

# 20. Capacity Rules

The UI must distinguish between:

### Vehicle Capacity

The physical maximum capacity.

Example:

```text
40 seats
```

### Booked Seats

Seats already reserved.

```text
32 seats
```

### Available Seats

```text
8 seats
```

### Occupancy

```text
80%
```

Display this visually:

```text
Occupancy

████████████████░░░░

32 / 40

80%
```

---

# 21. Passenger Booking Concurrency

The UI should support real-time or near-real-time seat updates if the backend provides such capability.

If another passenger books a seat while the current passenger is viewing the page:

```text
Seat 15
Available → Booked
```

The UI should update accordingly.

If real-time updates are not currently available, implement a safe refresh/revalidation strategy before final booking.

Do NOT pretend that frontend state alone guarantees seat availability.

---

# 22. Role-Based Navigation

Navigation must dynamically reflect the current role.

### Admin

```text
Dashboard
Trips
Fleet
Drivers
Passengers
Bookings
Tracking
Reports
Users
Settings
```

### Driver

```text
Dashboard
My Trips
Current Trip
Passengers
Notifications
Profile
```

### Passenger

```text
Home
Search Trips
My Bookings
Upcoming Trips
Notifications
Profile
```

Do not show irrelevant navigation items.

---

# 23. Permission Architecture

Implement frontend permission checks where appropriate.

Examples:

```text
trip.create
trip.update
trip.cancel
trip.assign_driver
trip.assign_vehicle

booking.create
booking.cancel
booking.view

vehicle.create
vehicle.update

driver.create
driver.update
```

However:

**Frontend permissions are for UX only.**

Never treat frontend authorization as security.

The backend must independently validate:

* Authentication
* Role
* Permission
* Ownership
* Booking availability
* Driver availability
* Vehicle availability
* Seat availability

---

# 24. Booking Lifecycle

Design the UI around the complete lifecycle:

```text
Trip Created
      ↓
Driver Assigned
      ↓
Vehicle Assigned
      ↓
Trip Published
      ↓
Passenger Selects Seats
      ↓
Booking Created
      ↓
Booking Confirmed
      ↓
Reminder Notification
      ↓
Trip Starts
      ↓
Passenger Travels
      ↓
Trip Completed
      ↓
Booking Completed
```

Each stage should have appropriate UI states.

---

# 25. Important Backend Principle

Do NOT implement these rules only in React.

The following must be enforced server-side:

* Seat cannot be double-booked
* Capacity cannot be exceeded
* Driver cannot have conflicting trips
* Vehicle cannot have conflicting trips
* Cancelled trips cannot receive bookings
* Completed trips cannot receive bookings
* Unauthorized users cannot perform restricted operations

React should provide immediate UX validation, but the backend must enforce the actual business rules.

---

# 26. Final Product Experience

The three users should feel like they are using three different products built on the same transportation platform.

### Passenger

**"Find → Select Seat → Book → Get Reminder → Travel"**

### Driver

**"See Assignment → Operate Trip → Update Status"**

### Admin

**"Plan → Assign → Monitor → Manage → Report"**

Design the UI around these workflows rather than around database tables.

The final product should feel like a complete professional **Transportation Booking + Fleet Management + Trip Operations Platform**.
