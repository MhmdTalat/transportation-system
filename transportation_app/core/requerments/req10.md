# Wasalni — Complete UI/UX Redesign Master Prompt
## White & Yellow Premium Transportation Design System

Act as a senior UI/UX designer, product designer, and React frontend architect. Redesign my entire existing transportation application, **وصلني (Wasalni)**, into a premium, modern, consistent, and production-ready transportation platform.

**Design reference:** https://www.behance.net/gallery/198641487/Bus-Tracking-App-UIUX-Design-Case-Study

**Primary design direction:** A clean white interface with carefully selected yellow accents, inspired by modern transportation applications, mobility platforms, and professional SaaS products.

**Existing stack:** React frontend, Django backend, and the current application database.

**Main goal:** Every screen must feel like part of one product. Passengers, users, administrators, stations, trips, profiles, analytics, tables, forms, and dialogs must share the same design system without losing their individual purposes.

Do not build a disconnected demo. Inspect and improve the existing application.

# 1. Brand Identity

## Brand name
- Arabic: وصلني
- English: Wasalni
- Product category: Transportation, bus tracking, route discovery, and trip management.
- Brand personality: Reliable, approachable, efficient, modern, and easy to use.

## Color palette

Use white as the dominant background and yellow as the recognizable brand accent.

Define the following design tokens and adjust their exact values only when necessary for contrast and visual quality:

- Primary yellow: `#FFC928`
- Hover yellow: `#F2B91B`
- Pale yellow background: `#FFF8DB`
- Main background: `#FFFFFF`
- Secondary background: `#F8F9FB`
- Primary text: `#20242B`
- Secondary text: `#707783`
- Border: `#E8EBF0`
- Success: `#198754`
- Warning: `#D97706`
- Error: `#DC3545`
- Information: `#2878D0`

### Color usage rules
- Use white for the majority of page backgrounds.
- Use yellow for primary buttons, selected navigation elements, important highlights, route indicators, and selected controls.
- Use pale yellow for selected cards, informational callouts, and subtle background accents.
- Use dark text on yellow buttons for readability.
- Use dark neutral text for headings and body content.
- Use semantic colors for status indicators rather than using yellow for every status.
- Avoid large areas of saturated yellow that reduce readability.
- Do not introduce unrelated purple, neon green, or random gradients.
- Maintain consistent color usage across all pages.

# 2. Typography and Arabic Support

Choose a modern, highly readable font system.

Preferred typography:
- Arabic: Cairo or IBM Plex Sans Arabic.
- English: Inter or a comparable clean sans-serif font.

Define consistent styles for:
- Page titles.
- Section headings.
- Card headings.
- Body text.
- Form labels.
- Table content.
- Captions and helper text.
- Buttons and navigation labels.

Requirements:
- Use consistent font weights and line heights.
- Support Arabic RTL and English LTR.
- Ensure Arabic text does not appear clipped or incorrectly aligned.
- Use CSS logical properties instead of hardcoded left/right positioning.
- Keep numbers, dates, IDs, and technical values readable.
- Do not change existing content language unnecessarily.

# 3. Global Layout and Design System

Create a centralized, reusable design system.

## Spacing
Use a consistent spacing scale, preferably based on multiples of four pixels.

Suggested values:
- Compact spacing: 4–8px.
- Standard spacing: 12–16px.
- Section spacing: 20–24px.
- Major layout spacing: 32–40px.

## Components
Standardize:
- Border radii.
- Card padding.
- Input heights.
- Button heights.
- Icon sizes.
- Table row heights.
- Modal dimensions.
- Sidebar width.
- Content width.
- Shadows and border treatments.

Prefer subtle borders and restrained shadows over heavy visual effects.

Create reusable design tokens in the styling system already used by the project. Avoid duplicating colors and dimensions in individual components.

# 4. Shared Application Shell

Every authenticated page must use the same global layout.

## Sidebar
Create a clean navigation sidebar featuring:
- Wasalni logo and brand name.
- Navigation icons and readable labels.
- Clearly highlighted active route.
- Consistent hover states.
- Optional grouped navigation sections.
- Responsive collapse behavior.
- A mobile-friendly navigation drawer.

Use white or a very light neutral background. Highlight the active navigation item using pale yellow and a yellow indicator or icon.

Possible navigation items, depending on existing functionality:
- Dashboard.
- Trips.
- Bookings.
- Users.
- Passengers.
- Drivers.
- Stations.
- Routes.
- Analytics.
- Settings.

Do not add nonfunctional navigation links. Include only routes that exist or are implemented as part of this task.

## Top navigation bar
Use a consistent topbar containing:
- Current page title or breadcrumb.
- Page-specific primary action when appropriate.
- Search only where useful.
- Notifications if supported.
- User avatar and account menu.
- Language switcher if the application supports multiple languages.

Keep the topbar clean, compact, and consistent.

## Main content
- Use a consistent maximum content width and page padding.
- Align page headings, action buttons, cards, tables, and charts.
- Avoid inconsistent margins between pages.
- Use the same responsive rules everywhere.

# 5. Passenger Home and Trip Search

Make the passenger experience intuitive and visually attractive.

## Home page
Create a welcoming interface featuring:
- Wasalni branding.
- A clear headline describing the transportation service.
- A prominent trip-search panel.
- Start Station and Destination Station selectors.
- Travel date or schedule selection if supported.
- A strong yellow primary search button.
- Relevant upcoming trips or recent trips when available.
- Helpful empty states for users with no trips.

Avoid excessive promotional content or decorative elements that distract from the main trip-search action.

## Station selection
Use two visually consistent, clearly labeled fields:

**Start Station**
- Display the station name.
- Use real stations loaded from the Django API.
- Show loading and error states.
- Allow users to search station options if needed.

**Destination Station**
- Display the destination station name.
- Use the same data source and component style.
- Validate that the destination differs from the start station.
- Show the message “Start and destination stations must differ.” beside the relevant field when invalid.

When the start station changes:
- Preserve the destination only if it remains valid.
- Otherwise clear the invalid destination and prompt the user to select another station.

Submit the IDs and values expected by the existing backend. Do not change the API payload contract.

## Trip results
Present available trips as clean cards or structured rows.

Show only fields available from the real API, such as:
- Departure station.
- Destination station.
- Departure time.
- Estimated arrival.
- Duration.
- Fare.
- Trip status.
- Available seats, if supported.

Use yellow sparingly to highlight the most important action or selection.

# 6. Trip Details and Tracking

Create a clear trip-details experience.

## Trip details
Organize information into sections:
- Route overview.
- Departure and arrival information.
- Trip status.
- Booking information.
- Passenger or driver information where permitted.
- Available actions.

Use a simple route visualization with connected station markers if suitable.

## Live tracking
If the backend provides actual GPS coordinates and a map integration is configured:
- Display the map in a dedicated card.
- Use yellow route highlights and clear station markers.
- Display vehicle position using real location data.
- Show last update time and tracking status.
- Handle missing GPS data gracefully.

Do not invent live vehicle locations, ETAs, distances, or real-time tracking capabilities.

# 7. Trips and Bookings Management

Use the same design system for passenger trips and administrative trip management.

## Trips list
Include:
- Search.
- Date filters.
- Status filters.
- Pagination.
- Consistent table or card layout.
- Clearly visible trip status.
- View, edit, or cancel actions where supported.

## Status badges
Define consistent badges for existing statuses:
- Pending: pale yellow background.
- In progress: pale blue background.
- Completed: pale green background.
- Cancelled: pale red background.

Use readable text and avoid relying on color alone.

## Booking details
Display booking information in a structured layout with consistent cards, labels, and action placement.

Preserve existing booking validation, cancellation rules, and backend permissions.

# 8. User Profiles and Passenger Records

Redesign profile pages using a consistent information hierarchy.

## Profile overview
Include:
- Avatar or initial-based placeholder.
- Display name.
- Account role.
- Account status.
- Contact information when permitted.
- Account creation date if available.
- Edit action where supported.

## User details
Group related fields into clean information cards rather than displaying raw API output or unformatted JSON.

Use readable labels, appropriate capitalization, and consistent value alignment.

## Edit profile forms
Standardize:
- Field labels.
- Input heights.
- Required-field indicators.
- Validation messages.
- Save and cancel buttons.
- Disabled and loading states.

Never expose passwords, authentication tokens, or other sensitive values.

# 9. Professional Admin Dashboard

Build a polished administrative dashboard using the same white-and-yellow design system.

The dashboard must prioritize actionable insights rather than decorative charts.

## KPI cards
Display actual metrics supported by the application, such as:
- Total users.
- Active users during the selected period.
- Total trips.
- Completed trips.
- Cancelled trips.
- Pending trips.
- Completion rate.
- Cancellation rate.

Each card should include:
- Clear label.
- Large readable value.
- Optional comparison with the previous equivalent period.
- Small contextual icon.
- Consistent spacing and alignment.

Do not display invented growth percentages.

## Charts
Where the required data exists, include:
- Trip volume over time.
- Trip distribution by status.
- User registrations over time.
- Most popular origin stations.
- Most popular destination stations.
- Peak demand hours.

Use consistent chart containers, readable axes, subtle gridlines, accessible tooltips, and a restrained yellow primary series.

Use other colors only when they represent distinct data categories and remain readable.

## Filters
Provide consistent filters for:
- Last 7 days.
- Last 30 days.
- Last 90 days.
- Custom date range.
- Trip status.
- Station.

Apply filters consistently to all related KPIs and charts. Clearly distinguish unavailable metrics from genuine zero values.

## Dashboard responsiveness
- Use a balanced grid on desktop.
- Stack KPI cards and charts on smaller screens.
- Keep filters usable on mobile.
- Prevent chart labels and tables from overflowing.

# 10. Standardized Tables

Every table in the application must use the same component and visual conventions.

Requirements:
- Consistent header typography.
- White or subtle neutral row backgrounds.
- Fine borders and separators.
- Consistent row padding.
- Predictable column alignment.
- Standard status badges.
- Consistent action menus.
- Search and filter placement.
- Pagination controls.
- Loading skeletons.
- Empty and error states.

Use pale yellow or a subtle yellow indicator for selected rows when appropriate.

Do not make every row yellow.

On mobile, use responsive table layouts, horizontal scrolling where appropriate, or a suitable card-based presentation.

# 11. Standardized Forms and Validation

All create and edit forms must use the same components.

Standardize:
- Text inputs.
- Dropdowns.
- Searchable station selectors.
- Date pickers.
- Checkboxes.
- Radio buttons.
- Text areas.
- Validation messages.
- Primary and secondary actions.

## Visual states
- Default: white background and neutral border.
- Focused: clearly visible yellow border or focus ring.
- Valid: subtle success indication when appropriate.
- Invalid: red border and readable error message.
- Disabled: neutral background and clear disabled appearance.
- Loading: visible progress feedback.

Use labels above fields, consistent field spacing, and accessible validation feedback.

Preserve all existing validation rules and API field names.

# 12. Modal Dialogs and Notifications

Standardize all dialogs, alerts, and toast messages.

## Dialogs
- White background.
- Clear title and concise description.
- Consistent padding and border radius.
- Clear primary and secondary actions.
- Appropriate mobile dimensions.
- Accessible keyboard and close behavior.

## Notifications
- Success: green semantic indicator.
- Warning: amber semantic indicator.
- Error: red semantic indicator.
- Information: blue semantic indicator.

Use yellow for the Wasalni brand, not as a replacement for every semantic status color.

Require confirmation for destructive actions where appropriate.

# 13. Authentication Pages

Redesign login, registration, and password-reset pages with the same branding.

Use:
- White backgrounds.
- Yellow brand accents.
- Clear Wasalni logo.
- Consistent typography.
- Accessible form fields.
- Clear error messages.
- Appropriate loading states.
- Responsive layouts.

Keep authentication flows, backend endpoints, and security behavior unchanged.

# 14. Arabic RTL and English LTR

Support both Arabic and English layouts correctly.

Requirements:
- Use appropriate direction settings.
- Mirror directional layouts where necessary.
- Keep icons aligned correctly.
- Ensure tables and form labels work in both directions.
- Use CSS logical properties.
- Test Arabic station names and mixed Arabic/English values.
- Ensure the logo and brand name remain legible.

Do not force RTL onto English-only screens or LTR onto Arabic screens.

# 15. Responsive Design

Test all major page types at:
- 375px mobile.
- 430px mobile.
- 768px tablet.
- 1024px small desktop.
- 1366px desktop.
- 1920px large desktop.

Ensure:
- No accidental page-level horizontal overflow.
- Cards resize and stack correctly.
- Sidebar navigation remains accessible.
- Tables remain usable.
- Modals fit the viewport.
- Forms do not exceed the available width.
- Charts resize without losing readability.
- Touch targets remain comfortable.

# 16. Reusable Component Architecture

Inspect the existing project before creating new components.

Reuse or create shared components such as:
- `AppLayout`
- `Sidebar`
- `Topbar`
- `PageHeader`
- `Button`
- `Input`
- `Select`
- `FormField`
- `StationSelector`
- `TripCard`
- `StatCard`
- `ChartCard`
- `DataTable`
- `StatusBadge`
- `Pagination`
- `EmptyState`
- `LoadingSkeleton`
- `ErrorState`
- `ConfirmDialog`

Centralize design tokens and avoid duplicated styling logic.

Do not create multiple visually different versions of the same button, input, table, or card without a clear functional reason.

# 17. Technical and Backend Constraints

My backend uses Django and the existing database.

Strict rules:
- Preserve existing API contracts.
- Preserve authentication and authorization.
- Preserve routes, CRUD functionality, and business logic.
- Use real API data.
- Do not replace working pages with static mockups.
- Do not invent missing backend capabilities.
- Avoid unnecessary packages and infrastructure.
- Keep API integration separate from presentational components where appropriate.
- Handle loading, empty, validation, and network-error states consistently.
- Do not expose secrets or sensitive personal data.

If a requested visual feature needs backend support that does not exist, document the gap rather than simulating functionality.

# 18. Implementation Workflow

Complete the redesign systematically:

1. Inspect the reference and existing application.
2. Inventory all current routes and pages.
3. Establish the white-and-yellow design tokens.
4. Implement the shared layout.
5. Standardize buttons, forms, tables, cards, and status badges.
6. Redesign passenger-facing pages.
7. Redesign user profiles and trip-management pages.
8. Redesign the analytics dashboard.
9. Standardize modals, alerts, loading states, and empty states.
10. Verify RTL and LTR behavior.
11. Test responsive layouts.
12. Run the frontend build, lint checks, and available tests.
13. Verify authentication and critical CRUD workflows.
14. Fix inconsistencies and functional regressions.

Do not stop after completing the dashboard or homepage. Review every existing route.

# 19. Final Acceptance Criteria

The task is complete only when:
- The entire application follows the same white-and-yellow visual identity.
- The design is professional, readable, and consistent.
- Every existing page uses the shared design system.
- Navigation, forms, tables, buttons, cards, dialogs, and notifications are standardized.
- Arabic and English layouts work correctly.
- Responsive behavior has been verified.
- Real API integrations and existing business functionality remain intact.
- No major page is left with the old inconsistent styling.
- The project builds successfully, or remaining failures are explicitly documented.

At completion, report:
1. All pages reviewed and updated.
2. Shared components and design tokens created or reused.
3. Files changed.
4. Build and test results.
5. Any missing backend capabilities.
6. Remaining inconsistencies, if any.

**Final design principle:** White should provide clarity, yellow should establish the Wasalni identity, and dark neutral text should maintain readability. Use one coherent design system across the entire application, not a different visual style for each page.