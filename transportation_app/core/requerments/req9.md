# Master Prompt: Unify the Entire Wasalni Transportation App UI

Act as a senior UI/UX designer and React frontend architect. Your task is to redesign and standardize the entire existing transportation application under one consistent professional design system.

**Application name:** وصلني (Wasalni)

**Main objective:** Make every page, component, form, table, dashboard, modal, and navigation element look like part of the same professionally designed application.

## 1. Inspect the Entire Project First

Before changing code:
- Inspect the existing React project, routing configuration, page components, shared components, CSS, Tailwind configuration, icons, and API integration.
- Identify every page and layout, including authentication, passenger profiles, users, stations, trips, bookings, CRUD operations, and analytics.
- Identify duplicated components and inconsistent styles.
- Review the existing application screenshots or reference design if available.
- Create a checklist of all pages that must be updated.
- Preserve the current project architecture and reuse existing dependencies whenever possible.

Do not redesign only the dashboard. Apply the same design system to the entire application.

## 2. Establish One Global Design System

Create or improve a centralized design system with reusable design tokens.

### Brand identity
- Arabic brand name: وصلني
- English brand name: Wasalni
- Primary color: modern lime green.
- Base theme: premium dark interface with neutral charcoal backgrounds.
- Text: high-contrast white and gray.
- Status colors: consistent semantic colors for success, warning, error, and information.
- Use subtle borders, restrained shadows, and consistent corner radii.

### Typography
- Use a consistent font hierarchy across every page.
- Choose a suitable Arabic font, such as Cairo or IBM Plex Sans Arabic, if already available or installable within the project's dependency policy.
- Maintain consistent heading, body, label, caption, and button sizes.
- Ensure Arabic and English text render correctly.

### Layout and spacing
- Establish a consistent spacing scale.
- Standardize page padding, maximum content width, card spacing, section gaps, and alignment.
- Use the same responsive breakpoints throughout the application.
- Avoid arbitrary margins and one-off CSS values when shared tokens can be used.

Centralize colors, typography, spacing, shadows, radii, and other shared styles rather than duplicating them across individual pages.

## 3. Standardize the Application Shell

Every authenticated page must use the same shared application layout:

- One consistent sidebar with the Wasalni logo and navigation.
- One consistent top navigation bar with page title, breadcrumbs where appropriate, profile menu, and relevant actions.
- A consistent main content container.
- A consistent active-navigation state.
- Responsive sidebar behavior for smaller screens.
- Identical navigation spacing, icon sizes, and hover states.
- Consistent page transitions without excessive animations.

Use the same layout component across all applicable routes instead of implementing a different sidebar or header on every page.

Authentication pages may use a separate layout, but they must follow the same colors, typography, logo, and component styling.

## 4. Standardize Every Page Type

### Dashboards
- Use the same KPI card structure.
- Standardize chart containers, legends, tooltips, filters, and section headings.
- Use consistent data visualization colors.
- Display loading, empty, and error states uniformly.

### Lists and tables
- Standardize table headers, rows, borders, status badges, pagination, search fields, and filters.
- Use consistent action buttons for view, edit, and delete.
- Ensure horizontal overflow is handled properly on mobile.
- Provide readable empty states when no records exist.

### Create and edit forms
- Use the same field heights, labels, placeholders, spacing, validation messages, and focus states.
- Standardize dropdowns, date pickers, checkboxes, and text areas.
- Align form actions consistently.
- Show field-level validation errors clearly.
- Preserve all existing validation rules and API payloads.

### Details and profile pages
- Standardize information cards, page headings, metadata, badges, and relationship sections.
- Display user, passenger, driver, station, and trip details using a consistent information hierarchy where those entities exist.
- Make read-only information visually distinct from editable fields.

### Modals and confirmation dialogs
- Use consistent dimensions, padding, overlay, button placement, and close behavior.
- Require confirmation for destructive actions.
- Ensure keyboard accessibility and mobile usability.

### Authentication pages
- Apply consistent Wasalni branding to login, registration, password reset, and related screens.
- Keep the authentication experience visually aligned with the rest of the application.

### Notifications and feedback
- Standardize toast messages, alerts, success feedback, loading indicators, and API error messages.

## 5. Build Reusable UI Components

Create shared components where appropriate, such as:

- `AppLayout`
- `Sidebar`
- `Topbar`
- `PageHeader`
- `Breadcrumbs`
- `Button`
- `Input`
- `Select`
- `FormField`
- `DataTable`
- `StatusBadge`
- `StatCard`
- `ChartCard`
- `SearchFilterBar`
- `Pagination`
- `EmptyState`
- `LoadingSkeleton`
- `ErrorState`
- `ConfirmDialog`

Adapt these names to the existing project conventions. Do not create duplicate components if equivalent reusable components already exist.

All pages should consume the same shared components and design tokens so a future global style update can be applied consistently.

## 6. Arabic, English, RTL, and LTR

- Support Arabic right-to-left layouts wherever Arabic is used.
- Support English left-to-right layouts without breaking alignment.
- Prefer logical CSS properties such as `margin-inline-start`, `padding-inline-end`, and `text-align: start`.
- Ensure icons, forms, tables, dropdowns, and navigation work in both directions.
- Avoid manually reversing individual elements when direction-aware styling can solve the problem globally.
- Do not translate existing application content unless needed or explicitly requested.

## 7. Preserve Existing Functionality

This is a UI standardization task, not a backend rewrite.

Strict requirements:
- Keep the Django backend and its API contracts unchanged.
- Preserve all routes, CRUD operations, authentication, permissions, and business rules.
- Keep existing API request and response structures.
- Preserve form field names, identifiers, and submitted values.
- Maintain existing search, sorting, pagination, filters, and validation behavior.
- Do not replace real API data with hardcoded demo data.
- Do not remove existing pages or features.
- Avoid unnecessary dependency installations.
- Do not rewrite working business logic merely to simplify the UI.

If a component must be refactored, preserve its existing behavior and verify its API integration afterward.

## 8. Responsive Design

Verify the complete application at these viewport widths:
- Mobile: 375px and 430px.
- Tablet: 768px.
- Desktop: 1366px and 1920px.

Requirements:
- No unintended horizontal page overflow.
- Tables remain usable on small screens.
- Forms fit the available width.
- Navigation remains accessible.
- Cards and charts resize appropriately.
- Buttons have usable touch targets.
- Modals fit within small screens.

## 9. Accessibility and UX Quality

- Use semantic HTML elements.
- Maintain sufficient text/background contrast.
- Provide visible keyboard focus states.
- Associate labels with form controls.
- Add accessible names to icon-only buttons.
- Ensure interactive elements are keyboard accessible.
- Avoid excessive animation and respect reduced-motion preferences.
- Make validation, loading, and error feedback easy to understand.

## 10. Implementation and Verification Workflow

Work incrementally:

1. Audit the current application and list all routes and page components.
2. Define the global design tokens and component conventions.
3. Implement the shared application layout.
4. Standardize shared form, table, card, and feedback components.
5. Update every existing page to use the shared system.
6. Remove obsolete styles and resolve conflicting CSS.
7. Verify responsive layouts and Arabic/English direction.
8. Run the available frontend build, lint checks, and tests.
9. Test critical CRUD flows and confirm API integrations still work.
10. Fix visual and functional regressions.

Do not stop after redesigning the first page. Continue until every existing route has been reviewed and updated.

## 11. Final Acceptance Criteria

The task is complete only when:

- Every page follows the same Wasalni design system.
- Headers, sidebars, buttons, forms, tables, cards, badges, and dialogs are consistent.
- Shared components are genuinely reused rather than merely styled similarly.
- Responsive behavior works across all major screen sizes.
- Arabic and English layouts work correctly.
- Existing API integrations and business functionality remain intact.
- No major page is left with the old inconsistent design.
- The application builds successfully, or any pre-existing build failures are clearly reported.

At completion, provide:
1. The list of all reviewed and updated pages.
2. The shared components and design tokens created or improved.
3. The files changed.
4. Build and test results.
5. Any remaining inconsistencies or limitations.

**Priority:** consistency across the entire application, maintainability, accessibility, and preservation of existing functionality. Do not focus on making one page beautiful while leaving the other pages inconsistent.