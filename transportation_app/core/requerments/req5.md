# Feature: Interactive Bus Interior & Seat Booking UI

Act as a Senior React Frontend Engineer and Transportation UX/UI Designer.

Implement a professional, interactive **Bus Seat Selection page** in my existing Transportation Management System using React and the existing Volt UI design system.

Use the attached reference image as the primary layout reference. Reproduce its practical bus-seat arrangement while improving the visual quality, responsiveness, accessibility, and booking experience.

**Important:** Implement this feature in my existing project. Do not create a separate demo application or replace the existing architecture.

## 1. Seat Selection Page

Create a page titled **Select Your Seats** or **Trip Details**.

The page must include:

- Back navigation.
- Trip summary.
- Bus seat layout viewed from above.
- Seat availability legend.
- Interactive seat selection.
- Selected-seat count.
- Total booking price.
- Sticky confirmation bar.
- Responsive mobile and desktop layouts.

Display trip information when available:

- Origin and destination.
- Departure date and time.
- Bus type.
- Trip duration.
- Price per seat.

Use the actual trip data from the existing backend.

## 2. Bus Interior Layout

Reproduce the general layout in the reference image:

- A vertical bus interior.
- A driver/cabin area at the front.
- Four seat columns arranged in two pairs.
- A central aisle separating the left and right seat pairs.
- Clearly separated seat rows.
- Configurable gaps between rows.
- Additional aisle or entrance space where appropriate.
- Sequential seat numbers matching the actual vehicle configuration.

Example layout:

```text
              FRONT
        ┌─────────────────┐
        │ Driver / Cabin  │
        │                 │
        │  [04] [03] [02] [01]
        │                 │
        │  [08] [07] [06] [05]
        │                 │
        │  [12] [11] [10] [09]
        │                 │
        │  [16] [15] [14] [13]
        │                 │
        │  [20] [19] [18] [17]
        │                 │
        │      Aisle      │
        │                 │
        │  [28] [27] [26] [25]
        │  [32] [31] [30] [29]
        │  [36] [35] [34] [33]
        │  [40] [39] [38] [37]
        └─────────────────┘
               REAR
```

This is an illustrative layout, not a fixed seat configuration. Match the attached image's actual arrangement and generate the layout from the selected vehicle's seat configuration.

Do not hardcode a 44-seat bus or assume every vehicle uses the same layout.

## 3. Seat Visual Design

Design seats as compact, recognizable bus-seat shapes rather than plain square buttons.

Each seat should have:

- Rounded corners.
- A subtle seat-back or cushion detail.
- A centered, readable seat number.
- Consistent dimensions.
- Clear spacing.
- Smooth hover and selection transitions.
- A visible keyboard focus state.

Use the following visual states:

**Available:** Light neutral gray with dark text.

**Selected by current passenger:** Strong brand green or teal with white text and a check indicator.

**Booked by another passenger:** Darker neutral gray, visibly unavailable, and not clickable.

**Temporarily reserved:** Amber or another distinct status, only if temporary reservations exist in the backend.

**Disabled:** Muted styling for seats that cannot be booked.

Provide a legend above the seat layout:

- Booked
- Available
- Your Seat

Do not rely on color alone to communicate seat status.

## 4. Seat Interaction

Every seat must be interactive.

When a passenger clicks an available seat:

1. Select the seat.
2. Update its visual state immediately.
3. Add it to the selected-seat summary.
4. Recalculate the selected-seat count.
5. Recalculate the total price.
6. Allow the passenger to deselect it by clicking again.

When the passenger clicks a booked seat:

- Do not select it.
- Show an unavailable tooltip or accessible explanation.

When a passenger selects multiple seats, display all selected seat numbers.

Example:

```text
Selected Seats
12, 13

2 seats × 250 EGP

Total: 500 EGP
```

Enforce any existing booking limits from the backend.

## 5. Booking Confirmation Bar

Create a sticky bottom confirmation bar similar to the reference image, with improved contrast and readability.

Display:

- Selected-seat count.
- Total price.
- Confirm Booking button.

Example:

```text
┌──────────────────────────────────────────┐
│ 2 seats              Total: 500 EGP      │
│                    [ Confirm Booking ]   │
└──────────────────────────────────────────┘
```

Behavior:

- Disable confirmation when no seats are selected.
- Show a loading state during submission.
- Prevent duplicate submissions.
- Display a clear success or error message.
- Refresh seat availability after a successful booking.
- Preserve the passenger's selection if an error occurs and those seats remain available.

On mobile, account for the device's bottom safe area and ensure the bar does not cover seats or navigation.

## 6. Seat Availability and Capacity

The backend is the authoritative source of seat availability.

When a passenger successfully books a seat:

- Update the booked-seat state.
- Refresh the remaining capacity.
- Prevent the same seat from being booked twice.
- Update other affected views where applicable.

Calculate remaining capacity from the authoritative vehicle and booking data.

Never decrement capacity merely because a passenger selected a seat locally. A selection is not a completed booking.

If another passenger books a selected seat before confirmation:

- Reject the stale selection.
- Refresh the layout.
- Explain which seat is unavailable.
- Allow the passenger to select another seat.

Use backend transactions and appropriate concurrency protection to prevent double booking.

## 7. Seat Layout Architecture

Build reusable components, such as:

```text
components/
  booking/
    BusSeatMap.tsx
    BusSeat.tsx
    SeatLegend.tsx
    SeatSelectionSummary.tsx
    BookingConfirmationBar.tsx
    TripSummary.tsx
```

Adapt filenames and folder structure to the existing project.

The seat map should receive its data through props or the established state/API architecture.

Represent the layout using configuration data rather than manually writing individual seat buttons.

Support:

- Different vehicle capacities.
- Different seat arrangements.
- Aisles and gaps.
- Missing or blocked seats.
- Different vehicle types where supported.

Seat identifiers must come from the backend, not be generated solely from their display numbers.

## 8. API Integration

Inspect existing API endpoints before implementing new ones.

Reuse the existing trip, vehicle, seat, and booking APIs.

The frontend must:

- Load the selected trip.
- Load its seat layout.
- Load current seat availability.
- Submit the selected seat identifiers.
- Display the booking result.
- Handle validation errors.
- Refresh data after booking.

If the backend does not support seat layouts or safe seat booking, document the missing functionality and implement the required backend changes using the existing framework.

Do not invent successful API responses or hardcode production bookings.

## 9. Responsive Design

On mobile:

- Keep the seat map centered.
- Preserve the two-pair layout where the vehicle configuration supports it.
- Use compact but touch-friendly seats.
- Keep the center aisle clearly visible.
- Avoid horizontal page scrolling.
- Make the confirmation bar sticky.
- Ensure the seat numbers remain readable.

On desktop:

- Center the seat map in a clean booking layout.
- Place the trip summary and booking summary beside it when space allows.
- Avoid excessively large seats or wasted space.

## 10. Accessibility

Implement:

- Semantic buttons for selectable seats.
- Accessible seat labels, such as "Seat 12, available".
- Keyboard navigation.
- Visible focus indicators.
- Appropriate disabled states.
- Screen-reader announcements for selection changes.
- Sufficient contrast.

## 11. Quality Assurance

Test:

- Selecting one seat.
- Selecting multiple seats.
- Deselecting seats.
- Clicking booked seats.
- Selecting the maximum allowed number of seats.
- Booking when availability changes.
- Booking failures and network errors.
- Duplicate submission prevention.
- Correct price calculations.
- Correct seat numbering.
- Different vehicle configurations.
- Mobile responsiveness.

## Final Requirement

The final result should closely follow the reference image's seat arrangement while looking like a polished international transportation-booking application.

Prioritize **accurate seat positioning, intuitive selection, clear availability, correct booking calculations, and reliable backend integration** over unnecessary decoration.

Inspect the existing project first, implement the feature directly, run the relevant tests, and report the files changed and any backend functionality still missing.
## Dynamic Vehicle Seat Layout — Based on Vehicle Type and Capacity

Implement a fully dynamic seat-selection system in my existing React + Volt transportation application.

**Critical requirement:** The seat layout must automatically adapt to the actual vehicle assigned to the selected trip and the number of seats configured for that vehicle.

Never hardcode a fixed number of seats or assume that every vehicle is a bus.

### 1. Support Different Vehicle Types

Support vehicle types based on the existing project data, such as:

- Sedan / private car
- SUV
- Van
- Microbus
- Minibus
- Bus
- Coach bus

Each vehicle may have a different capacity and seating arrangement.

Examples:

| Vehicle | Example capacity | Possible layout |
|---|---:|---|
| Sedan | 4 passenger seats | 1+1 or actual configured layout |
| SUV | 5–7 passenger seats | Vehicle-specific rows |
| Van | 8–15 passenger seats | Configurable rows |
| Microbus | 14–18 passenger seats | Configurable aisle and rows |
| Bus | 24–50+ passenger seats | Configurable multi-row layout |

These are examples only. Always use the actual vehicle configuration from the backend.

### 2. Dynamic Seat Layout

Build the seat map from vehicle configuration data rather than hardcoded JSX.

The layout must support:

- Variable seat count.
- Variable number of rows.
- Variable seats per row.
- One or more aisles where appropriate.
- Front and rear orientation.
- Driver and cabin position.
- Empty spaces and blocked seats.
- Different vehicle layouts.

For example, a 4-seat car should display a compact car layout, while a 40-seat bus should display a long bus layout similar to the supplied reference image.

Do not display a bus-shaped layout for every vehicle.

### 3. Vehicle Configuration

Each vehicle should have configuration information equivalent to:

```typescript
interface VehicleSeat {
  id: string;
  seatNumber: string;
  row: number;
  column: number;
  status: "available" | "booked" | "blocked";
}

interface VehicleSeatLayout {
  vehicleId: string;
  vehicleType: string;
  passengerCapacity: number;
  rows: number;
  columns: number;
  seats: VehicleSeat[];
}
```

Adapt these types to the actual backend models and API response. Do not create duplicate models if equivalent ones already exist.

For irregular layouts, support explicit seat positions and aisle gaps instead of relying only on row and column counts.

### 4. Passenger Booking

When a passenger opens a trip:

1. Retrieve the trip details.
2. Identify the vehicle assigned to the trip.
3. Retrieve that vehicle's seating configuration.
4. Retrieve current seat availability.
5. Render the correct vehicle layout.
6. Allow selection only of available seats.
7. Calculate the total price using the actual trip pricing rules.
8. Submit the selected seat IDs to the backend.
9. Refresh availability after the booking succeeds.

If the trip has no assigned vehicle or valid seat configuration, display a clear message rather than inventing a layout.

### 5. Admin Vehicle Management

Allow authorized administrators to configure a vehicle's seating layout when creating or editing the vehicle.

Provide options to:

- Select vehicle type.
- Set passenger capacity.
- Configure the number of rows.
- Configure the seating arrangement.
- Add or remove seat positions.
- Define aisles and entrance spaces.
- Mark seats as unavailable where supported.
- Preview the layout before saving.

Validate that the configured passenger-seat count matches the permitted vehicle capacity and applicable business rules.

Do not allow an administrator to change a vehicle's seat configuration in a way that invalidates existing bookings without an explicit migration or conflict-resolution process.

### 6. Automatic Layout Selection

Create a reusable layout renderer that uses the configured vehicle type and seat positions.

Example behavior:

- Four-seat car → compact car seating layout.
- Seven-seat SUV → configured SUV seating layout.
- Fifteen-seat van → multi-row van layout.
- Forty-seat bus → full bus layout with a center aisle.

These examples illustrate the behavior, not hardcoded mappings that override real vehicle configuration.

If a vehicle has an unusual layout, render the explicit seat positions supplied by the backend.

### 7. Capacity and Booking Integrity

Distinguish between:

- Physical passenger-seat capacity.
- Seats blocked or unavailable.
- Seats currently booked.
- Seats available for booking.
- Seats temporarily reserved, if supported.

The backend must enforce seat uniqueness and capacity constraints transactionally. Selecting a seat in React must not reduce confirmed capacity.

Use the backend's seat identifiers for all booking operations.

### 8. Acceptance Criteria

The implementation is complete only when:

- The same seat-selection component works for cars, vans, microbuses, and buses.
- Seat count is derived from the actual vehicle configuration.
- The layout adjusts to the number and positions of seats.
- Booked and blocked seats cannot be selected.
- Seat numbering matches backend data.
- Capacity and pricing remain correct.
- Existing bookings remain valid when vehicle configuration changes.
- The layout works on mobile and desktop.
- No fixed 40-seat or 44-seat assumption remains in the implementation.

Inspect the existing frontend and backend first, implement the feature within the existing architecture, and test multiple vehicle configurations.