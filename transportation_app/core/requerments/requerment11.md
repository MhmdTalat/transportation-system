# Project Task: Implement Production-Quality Transportation Product Analytics & Data Visualization for Wasalni

## 1. Role

Act as a Senior Product Analyst, Data Analyst, Transportation Domain Expert, Django REST Framework Engineer, React Frontend Engineer, Database Architect, and Data Visualization Specialist.

Your goal is to analyze the existing **Wasalni (وصلني)** transportation platform and implement a professional, data-driven analytics module that complements the existing application and demonstrates strong product analytics, operational intelligence, and business intelligence capabilities.

Do not create a separate demo application. Work within the existing project.

## 2. Existing Product Context

Wasalni is a transportation platform designed to help citizens book transportation conveniently.

The platform supports:

- Booking an individual seat in a bus or minibus operating on a predefined route.
- Booking a private car based on a passenger's starting point and destination.
- Selecting valid pickup and destination stations or locations.
- Matching bookings with suitable trips, drivers, vehicles, and available capacity.
- Managing passengers, drivers, administrators, stations, routes, trips, vehicles, bookings, payments, and notifications, subject to the functionality already implemented.

The application has an existing Django REST Framework backend and React frontend.

The current application uses a white-and-yellow visual identity and should support Arabic RTL and English LTR where localization is already supported or can be extended without breaking existing functionality.

## 3. Mandatory First Step: Audit the Existing Project

Before implementing anything, inspect the complete existing project structure and understand its actual architecture.

Inspect:

- Django models and model relationships.
- Serializers and model validation.
- API views, ViewSets, URL configurations, permissions, authentication, and pagination.
- Existing database schema and migration history.
- Existing booking, route, trip, driver, vehicle, and payment logic.
- React routes, layouts, components, API clients, state management, charting libraries, and styling system.
- Existing admin dashboard and analytics, if present.
- Existing tests, seed data, and available real records.

Identify the authoritative data sources for every proposed metric.

Produce a short implementation plan containing:

1. Existing features that can be reused.
2. Missing data required for analytics.
3. Proposed analytics endpoints and frontend pages.
4. Required schema changes, if any, and their justification.
5. Business rules that must be preserved.

Do not blindly follow the proposed entity names below. Map the design to the actual existing models and fields.

Do not replace working functionality, rebuild authentication, duplicate models, or introduce incompatible API contracts.

## 4. Core Business Rule: Direction-Aware Trip and Booking Validation

This is one of the most important requirements.

A passenger must not be able to book a bus seat or a car trip that travels in a direction incompatible with the requested origin and destination.

### A. Bus and minibus bookings

For trips operating along an ordered route:

- Determine the boarding station's position in the actual route sequence.
- Determine the destination station's position in that same sequence.
- For a trip operating in the forward direction, the boarding position must be less than the destination position.
- Both stations must belong to the trip's actual route.
- The boarding and destination stations must be different.
- Reject requests that violate the direction or route constraints.
- Reject bookings when the trip is unavailable, the seat is already booked, or capacity has been exhausted.
- Enforce all critical rules on the backend, not only in React.

If reverse-direction services are supported, represent them as an explicitly valid reverse route or trip direction. Do not silently treat an outbound trip as a return trip.

### B. Private car bookings

A private car booking is based on the requested origin and destination.

- Match the passenger's request against a compatible driver journey, trip, or service capability using the data model already present.
- Never assign a driver to a trip that does not satisfy the existing route, direction, availability, and scheduling constraints.
- Do not assume that a car is compatible merely because it is geographically close.
- If the system supports flexible pickup and drop-off locations, use its actual matching rules and available location data.
- If no valid match exists, return a clear API response explaining that no compatible trip is available.
- If the current schema cannot establish route compatibility, identify the missing information instead of inventing a matching algorithm based on nonexistent fields.

### C. Analytics for direction violations

Add meaningful operational indicators where the available data supports them:

- Rejected bookings due to invalid direction.
- Rejected bookings due to invalid route stations.
- Rejected bookings due to capacity or seat conflicts.
- Booking rejection rate by reason.
- Routes or stations with frequent validation failures.

Prefer structured validation error codes or existing error conventions so these events can be analyzed consistently.

Never count rejected attempts as successful bookings.

## 5. Analytics Architecture

Implement analytics using the existing backend and frontend architecture.

### Backend requirements

- Use Django ORM aggregation and database-level queries wherever appropriate.
- Avoid fetching every booking into Python to calculate simple counts and sums.
- Avoid N+1 query problems.
- Apply date filters, route filters, vehicle-type filters, and status filters consistently.
- Respect the application's authentication and role-based permissions.
- Restrict administrative analytics to authorized administrators.
- Prevent passengers and drivers from accessing administrative or other users' private data.
- Use database transactions and existing business rules for booking-related operations.
- Add indexes only when justified by actual query patterns and existing schema.
- Use timezone-aware date boundaries.
- Handle empty datasets and missing optional values safely.
- Add pagination to detailed result tables.
- Return consistent, documented API response structures.
- Add appropriate tests for aggregation correctness, permissions, filters, and edge cases.

Do not expose passenger personal information in aggregated analytics.

### Frontend requirements

- Reuse the existing React framework, routing, API client, authentication, components, and styling conventions.
- Reuse the installed charting library if one exists.
- If no chart library exists, select an appropriate maintained React-compatible charting library.
- Keep data-fetching logic separate from visualization components.
- Use reusable KPI cards, chart components, filter controls, and loading/error/empty states.
- Use real backend API responses as the source of truth.
- Do not hardcode analytics values or fabricate production records.
- If sample data is needed for development, isolate it from production mode and label it clearly as demo data.

## 6. Analytics Module A: Executive Overview

Implement an administrator-facing dashboard with a configurable date range.

### KPI cards

Display the following metrics where supported by the existing schema:

1. Total trips.
2. Completed trips.
3. Scheduled and in-progress trips.
4. Total bookings.
5. Confirmed bookings.
6. Cancelled bookings.
7. Booking completion rate.
8. Total passengers transported.
9. Total revenue from successfully paid transactions.
10. Average occupancy rate.
11. Available vehicles or available seats, where their definitions are reliable.
12. Booking rejection rate, if validation failures are recorded.

For each KPI:

- Display the value.
- Show a comparison against the previous equivalent period when sufficient data exists.
- Display the absolute and percentage change.
- Handle a previous-period value of zero without division errors.
- Include a tooltip or concise explanation defining the metric.

Do not present estimated or unsupported metrics as measured facts.

### Recommended visualizations

**A. Bookings and trips over time**
- Line chart.
- Daily, weekly, or monthly aggregation depending on the selected range.
- Compare booking volume and completed trips.

**B. Revenue over time**
- Line or area chart.
- Include only successfully paid transactions.
- Avoid double-counting payments, refunds, or payment retries.

**C. Booking status distribution**
- Donut or bar chart.
- Separate confirmed, completed, cancelled, pending, and other real statuses.

**D. Transportation mode distribution**
- Bar chart comparing bus/minibus and private car demand.

**E. Peak demand**
- Heatmap or matrix by weekday and hour, provided timestamps are available and timezone handling is correct.

**F. Previous-period comparison**
- Show trends for the selected period against the previous equivalent period.

## 7. Analytics Module B: Route Performance

Build a dedicated Routes & Demand page.

For each route, calculate relevant metrics such as:

- Route name and identifier.
- Number of scheduled trips.
- Number of completed trips.
- Total bookings.
- Unique passengers transported, where passenger identity and counting rules support it.
- Confirmed or completed seat reservations.
- Planned seat capacity.
- Occupied capacity.
- Occupancy rate.
- Cancellation rate.
- Revenue associated with the route, based on actual payment records.
- Average booking lead time, if booking and departure timestamps exist.

### Route occupancy calculation

Use a clearly defined formula:

Occupancy Rate = Occupied Seats / Available Capacity × 100

However, define the numerator and denominator precisely.

- Count seats according to the application's booking and trip model.
- Exclude cancelled reservations from occupied seats when the business rules release those seats.
- Do not count the same seat twice.
- Do not add capacity from unrelated or overlapping trips.
- Distinguish planned capacity from remaining capacity.
- Do not exceed 100% unless the underlying data is inconsistent; surface data-quality problems rather than hiding them.

For flexible private car services, do not apply bus-seat occupancy calculations unless the actual service and data model support a meaningful equivalent.

### Visualizations

- Top routes by booking volume.
- Routes with the highest occupancy.
- Routes with low occupancy.
- Route-level booking and revenue trends.
- Origin-destination demand matrix.
- A route sequence view showing ordered stations, if the route data supports it.

For every chart, show useful labels, units, tooltips, and empty states.

Do not claim a route is underperforming based on a small sample without showing its trip count or observation period.

## 8. Analytics Module C: Origin-Destination Demand

Analyze which journeys citizens request most frequently.

Where the data model supports it, aggregate demand by:

- Origin station or location.
- Destination station or location.
- Origin-destination pair.
- Direction of travel.
- Transportation mode.
- Day of week.
- Hour of day.
- Booking outcome.

Implement an origin-destination matrix or heatmap showing the most frequently requested journeys.

Use the actual origin and destination attached to the booking or search event, according to the existing schema.

Do not infer travel direction from station names or alphabetical sorting.

If the platform stores only completed bookings and does not store search attempts, clearly label the analysis as booking demand rather than total citizen demand.

Do not create a live geographic map unless reliable coordinates or a suitable mapping source are available.

## 9. Analytics Module D: Citizen Booking Funnel

Measure the citizen's journey through the application.

Recommended funnel:

1. Search or journey request initiated.
2. Compatible trips displayed.
3. Trip selected.
4. Booking initiated.
5. Booking successfully confirmed.
6. Payment completed, where payment is required.

For each stage, show:

- Number of users or events, according to the defined counting method.
- Conversion rate from the previous stage.
- Overall conversion rate.
- Drop-off count and percentage.

Important:

- First inspect whether search events, trip views, and booking attempts are already recorded.
- Do not pretend that these stages can be measured from completed booking records alone.
- If event tracking is missing, propose and implement a minimal privacy-conscious event model or event-tracking mechanism that fits the current architecture.
- Define event names, timestamps, identifiers, retention considerations, and deduplication rules.
- Avoid storing unnecessary personal information.
- Do not send sensitive passenger data to third-party analytics services.
- Distinguish actual observed events from historical estimates.

If a complete funnel cannot be calculated from existing data, implement the stages that are supported and document the missing instrumentation.

## 10. Analytics Module E: Fleet and Operational Efficiency

Analyze vehicle and driver utilization.

Metrics may include:

- Total active vehicles.
- Vehicles available for service.
- Trips per vehicle.
- Completed trips per driver.
- Scheduled versus completed trips.
- Driver assignment conflicts.
- Vehicle scheduling conflicts.
- Cancelled trips.
- Delayed trips, if scheduled and actual timestamps are stored.
- Average trip duration, when actual timestamps are available.
- Seat availability by upcoming trip.

Do not assume that a driver is available merely because no current booking is visible. Respect existing assignments, trip schedules, working constraints, and backend availability rules.

Create tables for upcoming trips and operational exceptions, including appropriate filters and pagination.

Use clear severity indicators for conflicts and unavailable capacity.

Do not introduce fabricated GPS tracking or fake real-time vehicle locations.

## 11. Analytics Module F: Booking, Cancellation, and Payment Analysis

Implement charts and tables for:

- Booking status distribution.
- Cancellation trends.
- Cancellation rate by route and transportation mode.
- Cancellation timing relative to departure.
- Payment status distribution.
- Successfully collected revenue.
- Refunds, if represented in the payment model.
- Failed payment attempts, if recorded.
- Average fare or transaction value, where meaningful.

Define all financial calculations using the existing payment model and business rules.

For example:

Net Collected Revenue = Successful Captured Payments − Completed Refunds

Use this definition only if the payment data supports it and the application's financial rules agree. Otherwise, define the correct measure based on the actual payment lifecycle.

Do not calculate revenue from booking prices alone if payment completion is required.

## 12. Analytics Module G: Data Quality and Business Rule Monitoring

Add a compact operational data-quality section.

Where the database supports the necessary checks, identify:

- Routes with duplicate or invalid station ordering.
- Trips whose route references are inconsistent.
- Bookings with origin and destination equal.
- Bookings whose stations do not belong to the relevant route.
- Seats booked more than once.
- Occupancy exceeding valid capacity.
- Trips with conflicting driver or vehicle assignments.
- Payment records inconsistent with booking status.
- Missing timestamps or other required relationships.

Distinguish actual data-integrity violations from legitimate rejected requests.

Prefer enforcing integrity in the backend and database wherever possible. Analytics should detect problems, not replace validation.

Avoid exposing sensitive personal data in these reports.

## 13. Filters and Interaction Design

Provide reusable filters across analytics pages where applicable:

- Date range.
- Transportation mode.
- Route.
- Origin station.
- Destination station.
- Trip status.
- Booking status.
- Payment status.

Requirements:

- All charts and tables must respond to the applicable filters.
- Clearly show active filters.
- Include a reset-filters action.
- Preserve selected filters during relevant navigation if consistent with the existing application.
- Provide a clear empty state when no matching records exist.
- Display the selected date range and timezone.
- Use consistent definitions across all widgets.

Do not add filters that have no corresponding backend support.

## 14. UI/UX Requirements

Build a professional transportation analytics interface consistent with Wasalni's existing product identity.

### Design

- White background with yellow as the primary brand accent.
- Dark neutral text with accessible contrast.
- Restrained use of green, amber, and red for meaningful operational states.
- Clean typography and consistent spacing.
- Responsive layout for desktop, tablet, and mobile.
- Arabic RTL and English LTR support consistent with the existing localization architecture.
- Accessible chart legends, tooltips, keyboard interaction where supported, and clear text labels.
- Reusable KPI cards and chart containers.
- Avoid excessive gradients, unnecessary animations, decorative gauges, and chart clutter.

### Interaction

- Clicking a chart segment or bar should apply a relevant filter or navigate to a meaningful detailed view when appropriate.
- Provide accessible tooltips with the exact values and units.
- Use consistent date and currency formatting.
- Display loading skeletons or equivalent indicators.
- Display meaningful API errors with a retry option.
- Avoid rendering misleading zero values when data is still loading or failed to load.

Analytics must feel like a native extension of the existing Wasalni administration dashboard.

## 15. Suggested Navigation

Integrate into the existing navigation rather than creating a competing application.

Suggested administrator sections:

- Overview.
- Route Performance.
- Origin-Destination Demand.
- Bookings & Payments.
- Fleet & Operations.
- Data Quality.

Only expose sections supported by the implementation and existing permission system.

Passenger and driver interfaces should remain focused on their own permitted workflows.

## 16. API Design

Inspect the current URL and API conventions before choosing endpoint names.

Add a dedicated analytics API namespace only if that fits the existing architecture.

Potential endpoint responsibilities include:

- Summary KPIs.
- Time-series trends.
- Route performance.
- Origin-destination demand.
- Booking funnel.
- Fleet utilization.
- Booking and payment analysis.
- Data-quality reports.

These are logical responsibilities, not mandatory literal URLs. Reuse existing endpoints when appropriate and avoid duplicating existing functionality.

For each endpoint:

- Document query parameters.
- Validate date ranges and filters.
- Enforce authorization.
- Return aggregated results efficiently.
- Include consistent date formats and metric definitions.
- Handle invalid parameters clearly.
- Add API schema documentation using the existing documentation approach.

## 17. Performance and Scalability

- Use database aggregations for counts, sums, averages, and grouped time series.
- Avoid repeated identical requests from multiple dashboard widgets.
- Use appropriate caching only when justified and ensure data freshness is clear.
- Apply sensible limits to date ranges and detailed results.
- Avoid unbounded queries.
- Add database indexes based on actual query patterns and the database engine.
- Use efficient joins and query optimization.
- Verify that analytics endpoints remain responsive with realistic record volumes.

Do not introduce a separate data warehouse, streaming platform, or complex analytics infrastructure unless the existing project genuinely requires it.

## 18. Testing and Acceptance Criteria

Implement tests that verify:

### Business logic
- Same origin and destination is rejected.
- A destination preceding the origin in a forward-only route is rejected.
- A valid forward-direction booking is accepted.
- A valid explicitly supported reverse-direction trip is handled correctly.
- Stations outside the route are rejected.
- A full trip cannot accept another seat reservation.
- Duplicate seat bookings are prevented.
- Driver and vehicle conflicts are prevented.
- Unauthorized users cannot access administrator analytics.

### Analytics correctness
- Counts match the underlying filtered records.
- Cancelled bookings are treated consistently.
- Occupancy calculations use the correct capacity and reservation statuses.
- Revenue excludes unpaid transactions and handles refunds correctly.
- Date boundaries and timezones are handled correctly.
- Filters return consistent results across charts and KPI cards.
- Empty datasets return valid, clearly represented responses.
- Missing tracking events are not fabricated.
- Invalid query parameters return clear errors.

### Frontend behavior
- All visualizations render from real API data.
- Filters update relevant widgets.
- Loading, error, and empty states work.
- Responsive layouts remain usable.
- Arabic RTL and English LTR layouts remain consistent.
- Existing booking and administration features continue working.

Run the relevant tests and fix regressions before declaring completion.

## 19. Implementation Workflow

Work in the following order:

1. Audit the existing repository.
2. Map the existing domain model and booking lifecycle.
3. Document metric definitions and data availability.
4. Identify the smallest necessary backend and schema changes.
5. Implement and test backend aggregation endpoints.
6. Implement missing event instrumentation only where needed for the booking funnel.
7. Build reusable React analytics components.
8. Integrate the dashboard into the existing admin navigation.
9. Add filters, responsive behavior, localization, and authorization.
10. Run backend and frontend tests.
11. Verify calculations against actual database records.
12. Document setup, API endpoints, metric definitions, and known limitations.

Do not stop after generating a mockup or a list of recommendations. Implement the working features within the available project.

If an essential requirement cannot be implemented because the repository lacks the necessary data or functionality, explain the exact limitation, implement the supported parts, and identify the smallest required change.

## 20. Final Deliverables

At completion, provide:

1. A summary of the existing architecture discovered.
2. A list of implemented analytics pages and charts.
3. A list of API endpoints added or reused.
4. A list of schema changes and migrations, if any.
5. The definitions and formulas of every KPI.
6. A list of missing data and limitations.
7. Test results and any unresolved issues.
8. Instructions to run the Django backend and React frontend.
9. Screenshots or a visual preview of the completed dashboard, if supported by the development environment.

### Final Principle

Build a real, maintainable product analytics system for Wasalni—not a static dashboard filled with imaginary numbers.

Preserve existing functionality, treat Django and the actual database as the source of truth, enforce route-direction and booking rules on the backend, and ensure that every displayed metric has a precise definition and a traceable data source.