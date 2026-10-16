# MASTER IMPLEMENTATION PROMPT — TRANSPORTATION MANAGEMENT SYSTEM UI REDESIGN

## 1. ROLE AND OBJECTIVE

Act as a Senior Frontend Engineer, UI/UX Designer, and Design Systems Architect.

Your task is to redesign and improve my existing transportation management application using the visual direction of this Dribbble reference:

https://dribbble.com/shots/27348841-A-Public-Transit-Operator-Mobile-App

The goal is to transform the existing application into a polished, modern, premium transportation platform with a consistent visual identity, excellent usability, responsive layouts, and maintainable frontend architecture.

This is an implementation task, not a design proposal.

You must inspect the existing project, understand how it works, identify the components and pages that need improvement, and implement the changes directly in the codebase.

Do not stop after creating a plan, writing recommendations, or generating a mockup.

### Primary priorities

1. Match the reference's visual language as closely as practical.
2. Preserve all existing business logic and working functionality.
3. Maintain compatibility with the existing Django backend and API contracts.
4. Improve the user experience across every existing page.
5. Build reusable components and a consistent design system.
6. Ensure the interface works on desktop, tablet, and mobile.
7. Test the implementation and fix problems introduced by your changes.

The existing codebase is the source of truth for functionality. The Dribbble reference is the source of visual inspiration.

---

# 2. MANDATORY PROJECT INSPECTION

Before changing any files, inspect the existing project thoroughly.

Determine the following:

- Frontend framework and version.
- Package manager and available scripts.
- Existing directory and component structure.
- Current routing configuration.
- Existing page components.
- Installed UI libraries.
- Styling approach, including CSS, Tailwind, CSS Modules, or other systems.
- Icon libraries.
- Existing form and validation libraries.
- API service modules and base URL configuration.
- Authentication and authorization mechanisms.
- Existing reusable components.
- Environment variables and configuration files.
- Available tests and linting tools.
- Current responsive behavior.

Inspect package.json, routing files, API services, layout components, and the pages most relevant to the redesign.

Identify the real entities and features supported by the backend. These may include passengers, users, drivers, vehicles, routes, trips, bookings, and administrative settings, but do not assume that all these modules exist.

Create an internal implementation checklist based on the actual project.

### Inspection constraints

- Do not replace the project with a new application.
- Do not change the frontend framework.
- Do not migrate the styling system without a strong technical reason.
- Do not install a new component library if existing dependencies can accomplish the task.
- Do not overwrite working components before understanding their responsibilities.
- Do not remove functionality merely because it complicates the redesign.

After inspection, proceed directly to implementation.

---

# 3. DESIGN REFERENCE ANALYSIS

Reference:

https://dribbble.com/shots/27348841-A-Public-Transit-Operator-Mobile-App

Study the available reference imagery and identify its key visual characteristics:

- Dark, high-contrast presentation.
- Minimalist transportation-oriented interface.
- Lime-green accents.
- Muted gray and blue-gray secondary colors.
- Strong typographic hierarchy.
- Rounded surfaces and carefully spaced content.
- Simple, purposeful visual elements.
- Clear status indicators and prominent primary actions.
- A restrained balance between visual character and functional information.

Translate these characteristics into a consistent desktop and mobile web interface.

Do not simply add a dark background to every existing page. Rework the composition, hierarchy, spacing, cards, tables, forms, navigation, and interaction states so that the result feels intentionally designed.

Do not claim pixel-perfect reproduction unless the reference provides sufficient detail to verify it. Use the actual reference assets and screenshots when accessible; do not invent details about unavailable screens.

---

# 4. GLOBAL DESIGN SYSTEM

Create a centralized design system using the project's existing styling approach.

Prefer CSS custom properties or the equivalent token mechanism already supported by the project.

## 4.1 Color palette

Use the following palette as the initial design direction:

| Token | Color | Purpose |
|---|---|---|
| Background | #020402 | Main application background |
| Surface | #101411 | Cards and content panels |
| Elevated surface | #181E19 | Inputs, dropdowns, elevated cards |
| Primary accent | #BBFC74 | Primary actions and active indicators |
| Secondary surface | #4C595A | Secondary controls and supporting surfaces |
| Muted blue-gray | #758CA0 | Supporting information and secondary elements |
| Secondary text | #AABDC7 | Metadata and muted text |
| Primary text | #F5F7F4 | Headings and important content |
| Border | #29312B | Subtle dividers and outlines |
| Success | #BBFC74 | Positive states, with readable text |
| Warning | #F2C879 | Warnings and pending states |
| Danger | #F07878 | Errors and destructive actions |
| Information | #8BBCE8 | Informational indicators |

These colors are proposed implementation tokens, not a claim that every value was sampled from the original design.

Validate contrast and adjust foreground colors where necessary.

### Color usage rules

- Use the primary accent selectively.
- Reserve bright lime for important actions, selected navigation, key metrics, and interactive states.
- Do not make every card or button green.
- Use muted text for metadata, timestamps, descriptions, and secondary labels.
- Use borders and tonal differences instead of excessive shadows.
- Keep destructive actions visually distinct from primary actions.
- Avoid large decorative gradients unless they are justified by the reference.

## 4.2 Typography

Use the existing typography system if one is already established.

Otherwise, choose a clean, readable sans-serif typeface suitable for a modern web application.

Establish consistent typography tokens for:

- Page titles.
- Section headings.
- Card headings.
- Table headings.
- Body text.
- Labels.
- Metadata.
- Buttons.
- Numeric statistics.

Use responsive typography and consistent font weights.

Numbers, IDs, dates, currency, and trip times must remain easy to scan.

Avoid excessively large headings that consume useful space in an administrative dashboard.

## 4.3 Spacing and layout

Define a consistent spacing scale.

Use a base spacing system such as 4, 8, 12, 16, 24, 32, and 40 pixels where appropriate.

Maintain consistent:

- Page padding.
- Card padding.
- Form field spacing.
- Table row heights.
- Section spacing.
- Header spacing.
- Grid gaps.
- Modal dimensions.

Use responsive container widths and avoid layouts that overflow on smaller screens.

## 4.4 Shape and depth

Use:

- Consistent rounded corners.
- Subtle borders.
- Restrained shadows.
- Clear separation between page background and card surfaces.
- Consistent input heights.
- Predictable button sizes.

Do not give every element a different radius or elevation.

## 4.5 Icons

Use the project's existing icon library.

If an icon library is already installed, reuse it rather than installing another.

Keep icon sizing, stroke weight, spacing, and alignment consistent.

Avoid mixing unrelated icon styles, emoji, and arbitrary Unicode symbols in the main interface.

---

# 5. APPLICATION SHELL

Create or improve a shared application layout used across the existing authenticated pages.

The layout should consist of:

1. Sidebar or primary navigation.
2. Top navigation bar.
3. Main content region.
4. Optional page-level action area.
5. Responsive mobile navigation.

Reuse the existing layout where possible.

## 5.1 Sidebar

Design a compact, modern sidebar inspired by the reference.

Include:

- Application logo or existing brand mark.
- Application name.
- Navigation links for actual supported features.
- Clear active-page indicators.
- Consistent icons.
- Optional section labels when useful.
- Account information near the bottom.
- Logout action if already supported.

Possible navigation entries include:

- Dashboard.
- Users or passengers.
- Drivers.
- Vehicles or buses.
- Routes.
- Trips.
- Bookings.
- Reports.
- Settings.

Only render modules that exist in the project or have been explicitly requested.

### Sidebar behavior

- Clearly highlight the active route.
- Support nested routes if the current application uses them.
- Keep navigation labels readable.
- Prevent long labels from breaking the layout.
- Add accessible hover and focus states.
- Preserve existing navigation and permission checks.
- Collapse or transform the sidebar appropriately on mobile.
- Use an accessible mobile menu button.

Do not introduce fake navigation links or routes that lead nowhere.

## 5.2 Topbar

Create a consistent topbar containing the elements relevant to the current application:

- Page title or breadcrumbs.
- Optional search.
- Notifications if supported.
- Current user avatar or initials.
- Account menu.
- Relevant page-level actions where appropriate.

Keep the topbar visually quiet.

Avoid adding search, notifications, or other controls that look functional but have no implementation.

## 5.3 Main content region

Every page should follow a predictable structure:

1. Breadcrumbs where useful.
2. Page heading.
3. Short explanatory description if needed.
4. Primary action.
5. Filters or search when relevant.
6. Main content.
7. Pagination or supporting controls where applicable.

Use a consistent horizontal alignment and spacing system across the application.

---

# 6. DASHBOARD REDESIGN

Redesign the existing dashboard using actual data returned by the Django API.

## 6.1 Dashboard header

Include:

- A concise welcome or dashboard heading.
- A short contextual description.
- Relevant actions, if supported.
- Date or reporting-period selection only if meaningful and implemented.

Do not display unnecessary decorative welcome messages.

## 6.2 Statistics cards

Display relevant metrics supported by actual API responses.

Potential metrics include:

- Total passengers.
- Total drivers.
- Total vehicles.
- Active routes.
- Scheduled trips.
- Completed trips.
- Pending bookings.

Use only the metrics that are meaningful and available.

Each card should contain:

- A clear label.
- A prominent value.
- Optional comparison or trend only when supported by real historical data.
- A subtle icon or visual marker.
- An appropriate destination or interaction only when one exists.

Do not invent percentages, trends, counts, or historical comparisons.

## 6.3 Main dashboard content

Use a balanced grid for relevant operational information.

Possible sections include:

- Recent trips.
- Recently registered users.
- Vehicle availability.
- Upcoming departures.
- Booking activity.
- Route summaries.
- Recent administrative actions.

Choose the sections based on the actual backend capabilities.

Avoid placing every possible widget on the dashboard. Prioritize information that helps an administrator understand the system quickly.

## 6.4 Charts and maps

Only add charts when the underlying data supports meaningful analysis.

Only add an interactive map when suitable location data and an appropriate map integration are available.

Do not introduce a paid map dependency without approval.

If map data is unavailable, use a clean route summary or operational table rather than a decorative, nonfunctional map.

## 6.5 Dashboard states

Implement appropriate:

- Loading states.
- Empty states.
- Error states.
- Partial-data states.

One failed API request should not automatically hide all unrelated dashboard information if the existing architecture allows independent requests.

---

# 7. USER AND PASSENGER MANAGEMENT

Redesign all existing user-management screens.

## 7.1 User list page

Create a clean, readable user list with:

- Page title and description.
- Add-user action if supported.
- Search field.
- Relevant filters.
- Data table or responsive list.
- Pagination if supported.
- Loading, empty, and error states.

Display only fields actually returned by the API.

Possible columns include:

- ID.
- Username.
- Full name.
- Email.
- Role.
- Phone.
- Status.
- Creation date.
- Actions.

Do not assume that all fields exist for every user.

### Table behavior

- Keep headers visually distinct.
- Use consistent row heights.
- Support horizontal scrolling or an alternative mobile presentation when needed.
- Avoid excessively wide tables.
- Keep important identifiers and status information easy to locate.
- Add clear hover and focus states.
- Preserve the existing pagination and filtering logic.

### Row actions

Use only supported actions, such as:

- View details.
- Edit.
- Delete.
- Activate or deactivate.

Destructive actions must use confirmation dialogs.

Respect the existing permission model.

## 7.2 User profile and detail page

Create a polished detail page for the existing user record.

The page should include:

### Page header
- Back-to-users navigation.
- User identifier or username.
- Page title.
- Relevant actions.

### Profile overview
- Avatar or initials.
- Username.
- Full name when available.
- Role badge.
- Account status if available.
- Email and phone when available.

### Information sections
- Basic information.
- Contact details.
- Account metadata.
- Related records if supported by the API.

Organize information into readable cards with clear labels and values.

For example, display a field label above or beside its value rather than rendering raw JSON or an unstructured list of database fields.

Do not expose internal secrets, password hashes, tokens, or sensitive backend data.

Handle missing optional fields gracefully.

Do not display the literal strings "undefined", "null", or "[object Object]" to users.

## 7.3 Create and edit user forms

Preserve the existing validation rules and API contracts.

Implement:

- Clear field labels.
- Required-field indicators.
- Appropriate input types.
- Inline validation messages.
- Loading states during submission.
- Success and failure feedback.
- Disabled submit buttons during pending requests.
- Confirmation before abandoning unsaved changes when appropriate.

Do not silently discard data or replace existing form submission behavior.

---

# 8. DRIVERS, VEHICLES, ROUTES, TRIPS, AND BOOKINGS

Inspect the actual project before implementing this section.

For every existing module, apply the same visual design system without changing the underlying business logic.

## 8.1 Drivers

If a driver-management module exists, preserve its existing fields and operations.

Possible information includes:

- Driver identifier.
- Name.
- Contact information.
- License details if already supported.
- Account status.
- Assigned vehicle or trips if supported.

Use clear status badges and organized detail pages.

Do not introduce additional driver fields or assumptions about licensing rules.

## 8.2 Vehicles and buses

If vehicle management exists, present relevant information in a structured layout.

Potential fields include:

- Vehicle identifier.
- Registration number.
- Capacity.
- Vehicle type.
- Availability or maintenance status.
- Assigned driver.
- Related routes or trips.

Use existing field names and relationships.

Do not assume that the backend provides real-time GPS, fuel levels, maintenance records, or vehicle telemetry.

## 8.3 Routes

If route management exists, make route information easy to understand.

Display supported fields such as:

- Route identifier.
- Route name.
- Origin.
- Destination.
- Stops.
- Distance or estimated duration if available.
- Active status.

Use a clear visual representation of stops only when the API provides the required data.

Keep route creation and editing forms consistent with the rest of the application.

## 8.4 Trips

If trip management exists, prioritize operational clarity.

Display supported fields such as:

- Trip identifier.
- Route.
- Assigned driver.
- Assigned vehicle.
- Departure time.
- Arrival time.
- Trip status.

Use readable date and time formatting.

Distinguish scheduled, active, completed, and cancelled trips only when these statuses are defined by the backend.

## 8.5 Bookings and reservations

If the existing application supports bookings, preserve its actual reservation workflow.

Display relevant fields, statuses, and relationships.

Implement cancellation or status-changing actions only when the backend supports them.

Do not invent payment processing, seat allocation, or reservation policies.

---

# 9. SEARCH, FILTERING, AND PAGINATION

Audit existing search, filtering, and pagination functionality before changing it.

Maintain the current behavior and API parameters.

Where supported, provide:

- Search by relevant identifiers or names.
- Role or status filters.
- Route or trip filters.
- Date filters.
- Page size controls.
- Pagination.
- Clear filters action.

### Interaction requirements

- Debounce search requests when appropriate.
- Avoid unnecessary repeated API requests.
- Keep filter state synchronized with the displayed data.
- Provide clear feedback when no results match.
- Preserve current page and filter behavior when navigating where appropriate.
- Avoid implementing client-side filtering over incomplete data when the backend is responsible for filtering.

Do not create controls that suggest server-side filtering when the API does not support it.

---

# 10. FORMS, DIALOGS, AND FEEDBACK

Standardize interactive elements across all existing pages.

## Buttons

Create consistent visual variants:

- Primary.
- Secondary.
- Ghost.
- Destructive.
- Icon-only.

Ensure every button has a clear purpose.

## Form fields

Standardize:

- Labels.
- Input heights.
- Borders.
- Focus rings.
- Placeholder colors.
- Disabled states.
- Error messages.
- Required indicators.

Use suitable input types and preserve backend validation requirements.

## Dialogs

Use accessible dialogs for:

- Confirming deletion.
- Confirming destructive actions.
- Showing important confirmations.
- Editing records in dialogs when that matches the existing workflow.

Avoid using dialogs for complex forms that are better handled on a dedicated page.

## Feedback

Use a consistent mechanism for:

- Success messages.
- API failures.
- Validation errors.
- Permission errors.
- Loading indicators.

Do not display success notifications when the server operation fails.

---

# 11. LOADING, EMPTY, ERROR, AND EDGE STATES

Every API-driven page must account for more than the successful-data case.

## Loading state

Use restrained skeletons or progress indicators that fit the dark design system.

Avoid large spinners that obscure the entire interface unnecessarily.

## Empty state

Explain that no records are currently available and provide an action when appropriate.

Distinguish between:

- No records exist.
- No search results match.
- Filters exclude all results.

## Error state

Provide useful feedback without exposing stack traces, database errors, secrets, or raw internal exception details.

Where appropriate, offer a retry action.

## Edge cases

Handle:

- Missing optional fields.
- Empty strings.
- Null relationships.
- Long names and email addresses.
- Large tables.
- Invalid dates.
- Failed image requests.
- Unauthorized requests.
- Expired authentication.
- Network failures.
- Partial API responses.

Ensure these states remain visually consistent with the reference.

---

# 12. RESPONSIVE DESIGN

Implement responsive behavior across the entire application.

## Desktop

- Use the sidebar and full application layout.
- Display dashboard cards in balanced grids.
- Preserve comfortable reading widths.
- Avoid excessively wide content areas.

## Tablet

- Reduce grid columns.
- Adjust sidebar width or collapse it when appropriate.
- Ensure tables and forms remain usable.
- Preserve the hierarchy of important actions.

## Mobile

- Replace or collapse the sidebar into accessible mobile navigation.
- Stack dashboard cards.
- Adapt tables into scrollable tables or mobile-friendly record layouts.
- Make forms fit the available width.
- Prevent dialogs from extending beyond the viewport.
- Ensure buttons have comfortable touch targets.
- Avoid horizontal overflow.
- Keep important actions visible and accessible.

Test at representative viewport widths such as:

- 375 px.
- 390 px.
- 768 px.
- 1024 px.
- 1440 px.

Do not treat responsive design as simply shrinking the desktop interface.

---

# 13. ACCESSIBILITY

Follow practical WCAG accessibility principles.

Implement:

- Semantic HTML.
- Correct heading hierarchy.
- Accessible form labels.
- Keyboard navigation.
- Visible keyboard focus.
- Appropriate button names.
- Accessible dialog behavior.
- Sufficient text contrast.
- Non-color indicators for status.
- Reduced-motion support.
- Appropriate alternative text for meaningful images.

Do not rely on color alone to communicate errors, status, or selection.

Ensure muted text remains readable against the dark surfaces.

---

# 14. FRONTEND ARCHITECTURE AND CODE QUALITY

Maintain the existing project architecture wherever possible.

## Reusable components

Create or refactor shared components only when useful.

Potential components include:

- ApplicationLayout.
- Sidebar.
- MobileNavigation.
- Topbar.
- Breadcrumbs.
- PageHeader.
- StatCard.
- DataTable.
- StatusBadge.
- SearchField.
- FilterBar.
- FormField.
- ConfirmDialog.
- EmptyState.
- ErrorState.
- LoadingSkeleton.
- ProfileCard.

Adapt the names and responsibilities to the existing codebase.

## Design tokens

Centralize:

- Colors.
- Typography.
- Spacing.
- Border radii.
- Borders.
- Shadows.
- Transitions.
- Responsive breakpoints.

Avoid duplicating color definitions and layout values across many files.

## Maintainability

- Keep components focused on clear responsibilities.
- Avoid giant page components.
- Reuse existing hooks and API services.
- Preserve type definitions when using TypeScript.
- Remove dead code only when safe.
- Avoid duplicated API calls.
- Avoid unnecessary global state.
- Avoid introducing dependencies without justification.
- Follow the project's existing linting and formatting conventions.

Do not refactor unrelated backend or business logic as part of this visual task.

---

# 15. API AND BACKEND PROTECTION

The existing Django backend is authoritative.

Before modifying API-related frontend code, inspect the existing implementation.

Preserve:

- API base URL configuration.
- Existing endpoint paths.
- HTTP methods.
- Request payload shapes.
- Response handling.
- Authentication headers.
- Token refresh or session handling.
- Pagination conventions.
- Filtering parameters.
- Error-handling conventions.
- Relationship identifiers.
- CRUD behavior.

Do not:

- Replace real API data with hardcoded arrays.
- Invent endpoints.
- Rename backend fields without an explicit mapping requirement.
- Modify Django models or database schemas for cosmetic reasons.
- Remove authentication checks.
- Bypass authorization.
- expose credentials in frontend code.
- Claim that an API integration works without testing it.

If a required feature is unsupported by the backend, do not fake the functionality. Document the limitation and propose the smallest necessary change separately.

---

# 16. IMPLEMENTATION PHASES

Complete the work in the following sequence.

## Phase 1 — Audit

- Inspect the frontend structure.
- Identify all existing routes and pages.
- Map pages to their API services.
- Identify reusable components.
- Identify existing design inconsistencies.
- Determine available testing and build commands.

## Phase 2 — Design foundation

- Establish the color and typography tokens.
- Standardize spacing, borders, and radii.
- Update global styles.
- Standardize buttons, fields, badges, and cards.

## Phase 3 — Application layout

- Implement the sidebar.
- Implement the topbar.
- Establish responsive navigation.
- Standardize the main content container.
- Verify navigation and existing route behavior.

## Phase 4 — Dashboard

- Redesign the dashboard.
- Connect metrics to real data.
- Improve information hierarchy.
- Add appropriate loading, empty, and error states.

## Phase 5 — Management pages

Redesign the existing user, passenger, driver, vehicle, route, trip, booking, and settings pages as applicable.

Preserve CRUD functionality and existing permissions.

## Phase 6 — Interaction refinement

- Standardize dialogs.
- Improve forms.
- Improve search and filters.
- Improve pagination.
- Add consistent feedback and error states.

## Phase 7 — Responsive and accessibility review

- Test representative viewport sizes.
- Check overflow.
- Verify keyboard navigation.
- Check contrast.
- Verify focus states.
- Fix layout and usability issues.

## Phase 8 — Verification

- Run the existing build command.
- Run linting and type checks if available.
- Run relevant frontend tests.
- Fix errors introduced by the implementation.
- Verify navigation.
- Verify create, read, update, and delete flows where testable.
- Verify API request and response compatibility.
- Review browser console errors where browser testing is available.

Do not report a check as passed unless it was actually performed.

---

# 17. VISUAL QUALITY ACCEPTANCE CRITERIA

The implementation is complete only when the following requirements are satisfied.

### Design consistency
- All existing pages use the same design tokens.
- The lime accent is used consistently.
- Card, button, field, and badge styles are standardized.
- The interface looks intentionally designed rather than assembled from unrelated templates.

### Functionality
- Existing routes remain functional.
- Existing API integrations remain intact.
- Forms preserve their request payloads and validation.
- CRUD actions continue to work where supported.
- Authentication and authorization behavior are preserved.
- No fake functionality is introduced.

### Responsiveness
- No unintended horizontal overflow.
- Navigation remains usable at mobile widths.
- Tables and forms remain readable.
- Dialogs fit within the viewport.
- Primary actions remain accessible.

### Reliability
- Loading, empty, and error states are handled.
- Missing data does not break the interface.
- Build and type checks pass where available.
- No new console errors remain unaddressed.
- No broken imports or unused dependencies are introduced unnecessarily.

### Maintainability
- Shared components are reused appropriately.
- Design tokens are centralized.
- API logic is not unnecessarily duplicated.
- Existing project conventions are respected.

---

# 18. FINAL EXECUTION INSTRUCTIONS

Start by inspecting the actual repository.

Then implement the redesign directly in the existing files, following the phases above.

Do not ask me to manually create components that you can implement yourself.

Do not stop after analyzing the codebase.

Do not generate a separate static demo instead of updating the application.

Do not replace existing API-driven behavior with mock data.

Do not make unrelated changes to the backend.

If you encounter a blocker, investigate it and choose the smallest safe solution. Ask for clarification only when an unresolved decision genuinely prevents correct implementation.

When the work is complete, provide a concise implementation report containing:

1. Summary of the redesigned interface.
2. Pages and components changed.
3. Files created, modified, or removed.
4. Existing functionality preserved.
5. Commands and tests actually executed.
6. Build, lint, or test results.
7. Any unresolved problems or backend limitations.
8. Any additional dependencies installed and why.

**Definition of done:** My existing transportation application should have a cohesive, polished interface inspired by the Dribbble reference while continuing to function correctly with its existing Django API, data models, authentication, and business rules.