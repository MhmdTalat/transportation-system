# Task: Dynamic Vehicle Seat Selection & Booking (React + Volt, existing TMS)

You are a Senior React Engineer, Backend Engineer, and Transportation UX Designer.
Implement this feature INSIDE my existing project. Do not create a demo app, replace the architecture, or add libraries without justification.

## 0. Working Method (follow in order)
1. **Inspect** the frontend and backend: routing, state/API layer, Volt components, trip/vehicle/seat/booking models and endpoints, existing tests, i18n/RTL setup, currency formatting.
2. **Report findings briefly**: what exists, what is missing, and any conflicts with this spec.
3. **Plan**: list the files you will add or change and the backend changes needed. Then proceed without waiting unless a blocker requires my decision.
4. **Implement** backend first (if needed), then frontend.
5. **Test** and run the existing test suite.
6. **Report** using the format in Section 12.

Never invent API responses, hardcode bookings, or fake success states. Reuse existing models and endpoints. Do not duplicate types that already exist.

## 1. Reference Image
Use the attached reference image ONLY for the visual language of a long-bus layout (cabin at the front, four columns in two pairs, center aisle, sticky bottom bar). If no image is attached, say so and proceed from this spec.
The layout is rendered from backend data. It is never copied from the image.

## 2. Core Rule: Everything Is Data-Driven
- Never hardcode a seat count, vehicle type, seat list, or layout (no fixed 40/44-seat assumption anywhere).
- The assigned vehicle's configuration determines the seats, positions, aisles, and cabin shape.
- Seat IDs come from the backend. Display numbers are labels only and are never used as identifiers.
- If the trip has no vehicle or no valid layout, show a clear empty state. Do not invent a layout.

## 3. Data Contract
Adapt to existing models; extend only what is missing. Equivalent shape:

```ts
type SeatStatus = "available" | "booked" | "blocked" | "held"; // "held" only if the backend supports holds

interface VehicleSeat {
  id: string;            // authoritative, from backend
  label: string;         // display number, e.g. "12"
  row: number;
  column: number;
  status: SeatStatus;
  seatClass?: string;    // optional, only if pricing varies
}

interface VehicleSeatLayout {
  vehicleId: string;
  vehicleType: string;   // sedan | suv | van | microbus | minibus | bus | coach
  passengerCapacity: number;
  rows: number;
  columns: number;
  aisleColumns?: number[];       // gaps between columns
  gapRows?: number[];            // entrance/exit/space rows
  cabin?: { position: "front" | "rear"; side?: "left" | "right" };
  seats: VehicleSeat[];
}
```
Support irregular layouts through explicit seat coordinates, aisle gaps, and empty cells.
`passengerCapacity` must equal the number of bookable seats, excluding the driver and blocked seats. Confirm this rule against existing business logic.

## 4. Passenger Seat Selection Page ("Select Your Seats")
**Flow:** load trip → resolve vehicle → load layout → load live availability → render → select → confirm → refresh.

**Page content:** back navigation, trip summary (origin/destination, departure date/time, vehicle type, duration, price per seat from real trip data), legend, seat map, selected-seat summary, sticky confirmation bar.

**Layout renderer:** one reusable renderer for all vehicle types.
- Sedan → compact car cabin. SUV, van, microbus, bus, coach → shape and density based on vehicle type and seat coordinates.
- These are visual defaults only. Explicit backend coordinates always win.
- Support front/rear orientation, driver/cabin area, aisles, gaps, and blocked or missing seats.

**Seat visuals:** compact seat shape (rounded, subtle back/cushion detail), consistent size, centered readable number, smooth hover/selection transitions, visible focus ring.

| State | Visual | Non-color cue |
|---|---|---|
| Available | light gray, dark text | outlined |
| Selected (mine) | brand green/teal, white text | check icon |
| Booked | darker gray | diagonal hatch or lock icon, not clickable |
| Held (if supported) | amber | clock icon |
| Blocked | muted | strikethrough or X |

Legend above the map: Booked / Available / Your Seat (plus Held/Blocked only when present).

**Interaction:**
- Click an available seat to select it, and click again to deselect. Update state, count, and total immediately.
- Click a booked or blocked seat: do not select, and show a tooltip plus an accessible explanation.
- Enforce the existing backend per-booking seat limit and show a clear message when it is reached.
- The summary lists all selected seat labels, e.g. `Seats 12, 13 · 2 × 250 EGP · Total 500 EGP`.
- Totals use the real pricing rules (per-seat price, taxes/fees/discounts, seat class if applicable). Format with the app's existing currency utility.

**Sticky confirmation bar:** selected count, total, "Confirm Booking" button.
- Disabled with zero seats. Loading state while submitting. Block duplicate submissions.
- Clear success and error messages. Refresh availability after success.
- Keep the selection after an error if those seats are still available.
- Respect the mobile bottom safe area (`env(safe-area-inset-bottom)`). It must not cover seats or navigation, so add bottom padding to the content.

## 5. Booking Integrity (Backend)
The backend is the source of truth.
- Book by seat IDs inside a DB transaction with row locks or a unique constraint on (trip, seat). Return a proper conflict response (e.g. 409) listing the unavailable seat IDs.
- Support idempotent submissions (idempotency key or equivalent) to prevent duplicates from double-clicks or retries.
- If temporary holds already exist, use them. If not, do not build them unless required. Document the gap instead.
- Capacity = physical bookable seats − blocked − booked (− held). Never change capacity because of local selection.
- On a stale selection: reject, refresh the layout, tell the user which seats were taken, and let them re-select.
- Validate server-side: seat belongs to the trip's vehicle, status allows booking, the seat limit is respected, and the user is authorized.
- Update other affected views after a booking (trip lists, remaining capacity, my bookings).

## 6. Admin Vehicle Seat Configuration (authorized roles only)
Add to the vehicle create/edit flow:
- Vehicle type, passenger capacity, rows, seats per row, aisle and entrance gaps.
- Add/remove seat positions, edit labels, mark seats blocked, and a **live layout preview** that uses the same renderer as passengers.
- Validation: seat count matches the permitted capacity for the type and business rules, unique labels, no overlapping coordinates.
- Block any change that would invalidate existing future bookings (removing, relabeling, or repositioning booked seats). Return a clear conflict message. Do not silently migrate. Propose a migration path in the report instead.
- Existing bookings stay valid when the configuration changes. Prefer versioned or immutable layouts per trip if the data model allows.

## 7. Responsive Design
- **Mobile:** centered map, no horizontal page scroll, touch targets of at least 40px where the configuration allows, aisle clearly visible, readable numbers. Scale seat size to the column count so wide layouts fit.
- **Desktop:** centered map with the trip summary and booking summary beside it. Avoid oversized seats and wasted space.
- Support RTL and the existing locale/i18n setup. Do not hardcode user-facing strings.

## 8. Accessibility
- Semantic `<button>` per selectable seat, with `aria-pressed` and a label like "Seat 12, available" / "Seat 12, booked, unavailable".
- Keyboard navigation: arrow keys move through the grid (roving tabindex), Space/Enter toggles.
- Visible focus, `aria-live` announcements for selection changes and errors, WCAG AA contrast, and no meaning conveyed by color alone.

## 9. Suggested Structure (adapt to the repo)
```
components/booking/
  VehicleSeatMap.tsx            // data-driven renderer
  Seat.tsx
  SeatLegend.tsx
  SeatSelectionSummary.tsx
  BookingConfirmationBar.tsx
  TripSummary.tsx
hooks/useSeatSelection.ts       // selection, limits, totals
services/ (existing API layer)  // reuse
admin/vehicles/SeatLayoutEditor.tsx
```
Keep the map presentational (props in, events out). Keep data fetching in the existing API/state layer. Extract pure functions for layout normalization and price calculation so they can be unit-tested.

## 10. Testing
Automated tests for:
- Layout rendering from fixtures: 4-seat car, 7-seat SUV, 15-seat van, 18-seat microbus, 40-seat bus, 50+ coach, and an irregular layout with gaps and blocked seats.
- Single and multi-select, deselect, the max-seat limit, and booked/blocked clicks.
- Price calculation and seat-label correctness.
- Success, validation error, network error, stale-seat conflict (409), and duplicate-submit prevention.
- Keyboard navigation and ARIA labels.
- Backend: concurrent booking of the same seat (exactly one wins), a seat from another vehicle rejected, capacity math, admin edit blocked when it conflicts with existing bookings.
- Manual or visual checks at 360px, 768px, and desktop widths.

## 11. Acceptance Criteria
- One seat-selection component works for cars, vans, microbuses, and buses.
- Seat count, labels, and positions come entirely from backend data, with no fixed 40/44-seat assumption left in the code (search and confirm).
- Booked and blocked seats cannot be selected. Double booking is impossible.
- Local selection never changes capacity. Totals match backend pricing.
- Existing bookings remain valid after configuration changes.
- Works on mobile and desktop, passes accessibility checks, and existing tests still pass.

## 12. Final Report Format
1. Summary of what was implemented.
2. Files added/changed (grouped frontend / backend / tests).
3. Backend changes and migrations.
4. Tests run and results.
5. Missing functionality, assumptions, and known limitations (e.g. holds, layout versioning, data migration).
6. Anything that needs my decision.
7. ## 4A. GUI & Visual Design System (Professional Transportation-App Style)

Act as the GUI designer for this project. The result must look like a polished, trustworthy booking product, not an admin demo. Extend Volt UI (its components, spacing, and grid). Do not introduce a second design system. Define the tokens below once as CSS variables or SCSS variables mapped onto Volt's theme, and never hardcode colors in components.

### Design principles
1. **One primary action per screen.** On seat selection it is "Confirm Booking".
2. **Seats are the hero.** The map gets the most space and contrast. Chrome stays quiet.
3. **Status at a glance.** A passenger should understand availability in under 2 seconds.
4. **Calm and trustworthy.** Flat surfaces, soft shadows, generous whitespace, no gradients or decoration that carry no meaning.
5. **Mobile first.** Design at 360px, then scale up.

### Design tokens
| Token | Value (adjust to the existing Volt brand) |
|---|---|
| Brand primary | Teal/green `#0E9F6E` (hover `#0B8A5E`, pressed `#087553`) |
| Brand tint (selected backgrounds) | `#E6F6EF` |
| Neutral text | `#111827` (primary), `#4B5563` (secondary), `#6B7280` (muted) |
| Surface / page background | `#FFFFFF` / `#F5F7FA` |
| Border | `#E5E7EB` |
| Seat available | fill `#EEF0F3`, border `#D5D9E0`, text `#1F2937` |
| Seat booked | fill `#9CA3AF`, text `#FFFFFF`, hatch pattern |
| Seat selected | fill brand primary, text `#FFFFFF`, check badge |
| Seat held | fill `#FBBF24`, text `#1F2937`, clock icon |
| Seat blocked | fill `#F3F4F6`, text `#9CA3AF`, X mark |
| Danger / success / warning | `#DC2626` / `#16A34A` / `#D97706` |
| Radius | seat 10px (rounded top, flatter bottom), cards 14px, buttons 12px, bar 20px top corners on mobile |
| Spacing scale | 4 / 8 / 12 / 16 / 24 / 32 |
| Elevation | cards `0 1px 3px rgba(0,0,0,.08)`, sticky bar `0 -4px 16px rgba(0,0,0,.10)` |
| Motion | 150ms ease-out for hover, press, and selection. Selection uses a subtle scale (1 → 1.06 → 1) and a check fade-in. Respect `prefers-reduced-motion`. |

All text and meaningful UI must meet WCAG AA contrast. Verify white text on the booked and selected fills. Darken them if they fail.

### Typography
Use the app's existing font (Volt default) with this scale.
- Page title 22/28 semibold (mobile) and 28/36 (desktop).
- Section label 14/20 semibold.
- Body 14/20 regular.
- Seat number 13/16 semibold with tabular numerals, so labels like 10 and 11 stay aligned.
- Price total 20/28 bold.
- Caption 12/16 muted.

### Screen composition
**Mobile (360–480px)**
1. Compact header: back button, title "Select Your Seats", trip route as a subtitle.
2. Trip summary card: origin → destination with a timeline dot/line, departure time, duration chip, vehicle type chip, price per seat.
3. Legend row: Booked / Available / Your Seat as small chips with icons.
4. Seat map card: the vehicle outline (rounded body, cabin/driver area with a steering-wheel icon, FRONT/REAR labels, entrance marker), centered, with no horizontal page scroll.
5. Sticky bottom bar: left side shows seat count and selected labels (truncate with "+N"), right side shows the total, and the full-width primary button sits below or beside them depending on space.

**Desktop (≥ 992px)**
Two-column layout in the Volt grid.
- Left (7/12): seat map card, centered, with the legend above it.
- Right (5/12, sticky): trip summary, selected-seat summary (labels, per-seat price, fees, total), and the Confirm Booking button.
- The bottom bar is replaced by this sticky side panel on desktop, or kept as a slim bar if the product prefers consistency.

### Vehicle shell (the "interior" graphic)
- Draw the vehicle body as an outline container: soft border, light fill, rounded corners that follow the vehicle type (sedan: compact rounded rectangle; van/microbus: squarer body; bus/coach: long body with a rounded front).
- The cabin area shows a steering-wheel icon on the driver's side and a "Front" label.
- Show aisles as empty space (not drawn lines), plus an entrance/door marker and a "Rear" label.
- The shell scales with the seat grid. Never use a fixed-height image.
- Row labels or row separators are optional and very subtle.

### Seat component
- Shape: rounded rectangle with a subtle seat-back band (a darker 4–6px strip on the back edge) and cushion highlight. Pure CSS or inline SVG, no raster images.
- Size: 44px default, 40px minimum on dense layouts, and larger (up to 52px) for sedans and SUVs where there are few seats. Compute size from the column count and the container width.
- Gap: 8px between seats in a pair, 24–32px for aisles (configurable from layout data).
- States follow the token table. Each state has a non-color cue (check, hatch, clock, X).
- Hover (desktop): lift 1px, border darkens. Focus: 3px brand-tinted ring with a 2px offset. Pressed: scale 0.97.
- Tooltip on booked or blocked seats: "Seat 12 is already booked". It also appears on keyboard focus, not only on hover.

### Components to style
- **Trip summary card:** route timeline, time and duration, vehicle chip with an icon per type (car, van, bus), price per seat badge.
- **Legend chips:** the same mini seat icon as the map, so the meaning matches exactly.
- **Selected-seat chips:** one removable chip per seat (e.g. `12 ✕`), so passengers can deselect from the summary.
- **Primary button:** brand green, 48px high, full width on mobile, with a spinner and a "Confirming…" label while loading. Disabled state is muted with the label "Select a seat".
- **Toasts / alerts:** success (green check, "Booking confirmed"), error (red, with a retry action), conflict (amber, "Seat 12 was just taken. Please choose another").
- **Modal for confirmation (optional):** shows the final summary (trip, seats, total) before submit, if the existing flow uses one.

### States the UI must design
- **Loading:** skeleton card for the summary, plus a skeleton seat grid. No bare spinners on blank pages.
- **Empty / invalid:** a centered illustration or icon, "Seat layout isn't available for this trip", and a Back button.
- **Fully booked:** a banner "This trip is sold out" with a link to alternative trips if the app supports it.
- **Error:** a retry card with a plain-language message, never a raw API error.
- **Refreshing after conflict:** a brief highlight (amber pulse) on seats that changed.

### Iconography and microcopy
- One icon family only (use what Volt already ships, e.g. Font Awesome or Heroicons). 16–20px, consistent stroke.
- Short, human labels: "Select Your Seats", "Your Seat", "Booked", "Available", "Confirm Booking".
- All strings go through the i18n layer. Arabic/RTL is supported: mirror layout, flip the vehicle orientation only if the product decides to, and keep seat numbers in Latin or Arabic-Indic digits consistently with the app setting.
- Currency uses the app's existing formatter (e.g. `250 EGP`).

### Dark mode (only if Volt's dark theme is already enabled)
Use the dark equivalents of every token. Keep seat states distinguishable without color through icons and patterns, and re-check contrast.

### Design QA checklist
- Pixel check at 360, 390, 768, 1024, and 1440px, with no overflow and no clipped seat numbers.
- All five seat states are distinguishable in grayscale.
- Contrast passes AA for every state pair.
- Sticky bar never hides the last seat row (content has bottom padding equal to the bar height plus the safe area).
- Touch targets are at least 40px.
- Focus is visible on every interactive element.
- The same renderer and styles are used in the admin layout preview and the passenger page.
- Screenshots are attached for: sedan, 15-seat van, 40-seat bus, loading, error, and conflict states.