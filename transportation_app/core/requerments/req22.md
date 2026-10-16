# MASTER PROMPT — WASALNI INTERACTIVE MOBILITY EXPERIENCE

## ROLE

You are a Principal Product Designer, Senior Frontend/Mobile Engineer, and Motion Design Specialist with 10+ years of experience building world-class mobility products inspired by Uber, Bolt, Careem, Lyft, and Citymapper.

You think in complete product systems, not isolated screens. You understand UX psychology, interaction design, accessibility, responsive layouts, real-time transportation experiences, and high-performance animation.

Your mission is to transform **Wasalni (وصلني)** into a premium, highly interactive, modern transportation experience that feels alive, responsive, trustworthy, and delightful.

Do not create static mockups disguised as a functional application. Every interactive element must have a clear purpose and working behavior.

---

## 1. PROJECT CONTEXT

- **Product:** Wasalni (وصلني)
- **Product category:** Transportation, bus tracking, trip management, and passenger mobility.
- **Target users:** Daily commuters, passengers, transportation operators, and administrators, especially users in Cairo, Egypt.
- **Brand personality:** Friendly, fast, trustworthy, modern, accessible, and slightly playful.
- **Emotional goal:** Users should feel safe, informed, in control, and confident about every transportation decision.
- **Languages:** Arabic and English, with complete RTL and LTR support.
- **Visual identity:** Premium white-and-yellow design system.
- **Primary brand color:** `#FFC928`
- **Background:** White and soft off-white.
- **Text:** Charcoal and neutral gray.
- **Design direction:** Clean, spacious, map-oriented, card-based, interactive, and mobile-first.

### First: Inspect the Existing Project

Before writing code:

1. Inspect the existing repository, frontend framework, routing, API services, authentication, components, and folder structure.
2. Identify the actual available backend endpoints, entities, permissions, and supported workflows.
3. Reuse existing functionality instead of rebuilding it unnecessarily.
4. Identify missing, inconsistent, or nonfunctional UI interactions.
5. Create an implementation plan based on the real project structure.

**Critical constraints:**

- Preserve all existing API contracts, endpoints, HTTP methods, authentication, CRUD operations, validation rules, and business logic.
- Do not invent backend capabilities, live GPS tracking, payment processing, driver matching, or real-time events that are not implemented.
- Never display fabricated live locations, prices, ratings, trip statuses, or passenger statistics as real data.
- If an integration is unavailable, provide an honest demo state or a clearly labeled disabled feature.
- Keep the existing stack unless a change is necessary and explicitly justified.
- Implement one screen at a time. Complete and verify the Home screen before moving to another screen.

---

## 2. INTERACTION-FIRST DESIGN PHILOSOPHY

Every screen must feel responsive to the user.

### Core interaction rules

- Every button must perform its advertised action.
- Every navigation item must navigate to the correct destination.
- Every form must validate input and display useful errors.
- Every search field must support real searching or clearly indicate that search is unavailable.
- Every filter and sorting control must change the displayed results.
- Every modal and bottom sheet must open, close, and handle dismissal correctly.
- Every clickable card must have a meaningful action.
- Every asynchronous operation must expose loading, success, and failure feedback.
- Every destructive action must request confirmation.
- Every empty state must explain what happened and offer a useful next action when possible.
- Every user action must have visible feedback within approximately 100–200 ms when technically feasible.

Never add decorative controls that look functional but do nothing.

### Interaction states

For every interactive component, define:

1. Default
2. Hover — for supported desktop interfaces
3. Focus — keyboard accessibility
4. Pressed
5. Selected
6. Disabled
7. Loading
8. Success
9. Error

Only implement states that make sense for the particular component.

### Micro-interactions

Add polished interactions such as:

- Buttons compress slightly when pressed.
- Cards elevate subtly on hover and respond to selection.
- Inputs display animated focus rings.
- Search suggestions appear with smooth transitions.
- Dropdowns animate naturally.
- Tabs use a moving selection indicator.
- Counters animate when actual values change.
- Toast notifications communicate success or failure.
- Skeleton loaders appear during real loading operations.
- Form errors appear near the relevant field.
- Empty states include subtle illustrations and actionable recovery buttons.
- Sidebar navigation highlights the active route.
- Selected map markers visually distinguish pickup, destination, bus, and current location where supported.

Interactions must enhance clarity, not distract from transportation tasks.

---

## 3. DESIGN SYSTEM

Build a centralized, reusable design system before implementing individual screens.

### 3.1 Color tokens

Use the following initial palette and validate text contrast before finalizing it.

| Token | Value | Usage |
|---|---|---|
| Primary | `#FFC928` | Brand, primary actions, active indicators |
| Primary Hover | `#E8B51F` | Hover and emphasized states |
| Primary Soft | `#FFF4CC` | Selected cards and subtle highlights |
| Background | `#FFFFFF` | Main application surface |
| Background Soft | `#F8F9FB` | Page backgrounds and secondary sections |
| Surface | `#FFFFFF` | Cards, dialogs, and sheets |
| Text Primary | `#202124` | Main headings and important content |
| Text Secondary | `#68707D` | Supporting information |
| Border | `#E5E7EB` | Inputs, dividers, and card outlines |
| Success | `#218653` | Successful operations |
| Warning | `#A86600` | Warnings and attention states |
| Error | `#C93636` | Validation errors and failed operations |
| Info | `#2767C7` | Informational feedback |

Do not assume that yellow is suitable for small text or icon foregrounds. Use dark text on yellow when necessary to meet WCAG AA.

Provide contrast ratios for important foreground/background combinations and target at least 4.5:1 for normal text and 3:1 for large text and applicable UI graphics.

### 3.2 Dark mode

Implement a complete dark theme using semantic tokens.

- Backgrounds must become comfortable dark neutrals.
- Cards must remain distinguishable from their surroundings.
- Text must remain readable.
- Yellow should remain the recognizable brand accent.
- Inputs, dialogs, menus, maps, and notifications must all follow the selected theme.

Theme switching must update the entire application, not just one component.

### 3.3 Typography

Use:

- **English:** Inter
- **Arabic:** Cairo

Typography scale:

- Display: 32 px
- Page title: 24 px
- Section heading: 20 px
- Body: 16 px
- Supporting text: 14 px
- Caption: 13 px

Define font weights, line heights, and responsive scaling. Use tabular numerals for prices, IDs, trip durations, and ETAs where supported.

### 3.4 Spacing and shape

Use a consistent 4/8 px spacing system:

`4, 8, 12, 16, 24, 32, 48, 64`

- Inputs: 12 px radius
- Cards: 20 px radius
- Bottom sheets: 28 px radius
- Buttons and chips: pill-shaped where appropriate
- Shadows: subtle, layered, and consistent

No arbitrary spacing values or scattered hardcoded colors.

### 3.5 Iconography

Use a consistent rounded icon library and a 24 px icon grid.

- Use icons that communicate familiar actions.
- Include accessible labels for icon-only buttons.
- Avoid mixing unrelated icon styles.
- Pair unfamiliar icons with text labels.
- Do not use emoji as replacements for core navigation icons.

### 3.6 Reusable components

Create and document reusable components for:

- Primary, secondary, and ghost buttons
- Icon buttons
- Search fields
- Text fields and validation messages
- Selects and dropdowns
- Filter and sorting controls
- Passenger and bus cards
- Trip and route cards
- Status badges
- Statistics cards
- Data tables
- Pagination
- Tabs
- Navigation sidebar and topbar
- Bottom navigation for mobile
- Dialogs and confirmation modals
- Bottom sheets
- Toast notifications
- Tooltips
- Rating controls where applicable
- Skeleton loaders
- Empty states
- Error states
- Map pins
- Offline banners
- Loading indicators

Each component must support consistent interaction states, responsive behavior, accessibility, and theme tokens.

---

## 4. APP-WIDE CONSISTENCY

All screens must feel like parts of the same product.

Implement a shared application shell with:

- Consistent branding and logo placement
- Shared navigation
- Reusable page headers
- Standardized spacing
- Unified card and form styles
- Consistent button hierarchy
- Shared feedback and loading behavior
- Theme support
- Language switching
- RTL/LTR layout handling
- Responsive breakpoints

Use the correct navigation pattern for each platform.

### Desktop

- Sidebar or appropriate primary navigation
- Topbar with relevant account and language controls
- Clear page titles and content hierarchy
- Efficient use of available space

### Tablet

- Collapsible navigation
- Responsive grid layouts
- Touch-friendly controls

### Mobile

- Compact navigation or bottom navigation where appropriate
- Full-width forms and cards
- Touch targets of at least 44 × 44 px
- No horizontal overflow
- Safe handling of the on-screen keyboard
- Bottom sheets and dialogs sized for small screens

Do not force a mobile ride-hailing layout onto administrative pages where a dashboard or data table is more appropriate.

---

## 5. SCREEN INVENTORY AND FUNCTIONAL SPECIFICATION

First map the existing product capabilities to the following screens. Implement only those relevant to the actual application and backend.

### Screen 1 — Splash

- Display the Wasalni identity.
- Use a short logo reveal.
- Avoid unnecessary delays.
- Navigate based on the actual authentication state.
- Respect reduced-motion preferences.

### Screen 2 — Onboarding

- Up to three concise introduction slides.
- Explain real product benefits.
- Include Skip, Next, and Get Started actions.
- Show progress indicators.
- Persist completion only if appropriate for the existing application.

### Screen 3 — Permissions

- Explain why location or notification access is useful.
- Request permissions only when needed.
- Handle granted, denied, and unavailable states.
- Never imply that permissions have been granted when they have not.

### Screen 4 — Home

Create an engaging transportation home screen with:

- A prominent destination or route search field
- Map or route overview when supported
- Relevant saved locations if implemented
- Recent trips or routes if available
- Relevant nearby buses or stations only when backed by real data
- A clear primary action
- Contextual status and useful next steps

The Home screen must quickly answer:

- Where am I in the current workflow?
- What can I do next?
- What information is current?
- What happens when I tap each major control?

### Screen 5 — Destination or Route Search

- Search with debounce where appropriate.
- Display loading, suggestions, recent searches, and empty results.
- Support keyboard navigation where applicable.
- Allow users to clear the search.
- Handle network failures gracefully.
- Use real API results where available.

### Screen 6 — Route or Trip Selection

Show supported routes or trips using clear cards containing applicable fields such as:

- Route or trip name
- Origin and destination
- Departure time
- Duration
- Available seats
- Price, only when supplied by the system
- Current status

Make selection visually obvious. Provide a useful next action and preserve existing business rules.

Do not show Economy, Comfort, Premium, or Bike options unless the actual product supports these service categories.

### Screen 7 — Searching or Loading

When a real search or request is running:

- Show meaningful progress.
- Use a subtle animation.
- Allow cancellation only if the operation supports it.
- Display a timeout or retry action where appropriate.

Never display a fake driver-matching animation if the backend has no driver-matching capability.

### Screen 8 — Details or Confirmation

Display the selected route, trip, passenger, or record details.

- Clearly distinguish editable and read-only fields.
- Show relevant statuses.
- Provide Edit, Confirm, Cancel, or Back actions only when supported.
- Confirm destructive or irreversible operations.
- Prevent duplicate submissions.

### Screen 9 — Tracking

When real tracking data exists:

- Display the current vehicle location.
- Show route progress and relevant arrival information.
- Refresh according to the actual data source.
- Smooth marker movement between valid location updates.
- Indicate when the location was last updated.
- Clearly distinguish live information from cached data.

When live tracking is unavailable, provide a useful static route or trip-status view instead.

### Screen 10 — Trip or Operation Completed

- Confirm completion only after backend success.
- Display a concise summary.
- Show applicable payment, status, or receipt information.
- Offer relevant follow-up actions.
- Use a subtle success animation.

### Screen 11 — History and Details

- Search, filter, and sort available records.
- Show pagination or incremental loading when appropriate.
- Provide a clear details view.
- Include retry and empty-result states.
- Preserve filters when returning from a details page where practical.

### Screen 12 — Profile and Settings

- Display real account data.
- Support existing profile editing capabilities.
- Provide language and theme settings.
- Make sign-out behavior explicit.
- Handle validation and saving states.
- Never expose private fields unnecessarily.

### Screen 13 — Help and Error Recovery

- Provide relevant help content.
- Display clear errors without technical jargon.
- Include Retry, Back, or Contact Support when appropriate.
- Do not expose stack traces, access tokens, or internal server details.

### Additional existing application screens

Also redesign every existing screen, including passenger profiles, users, stations, trips, authentication, and administration pages when present.

Do not ignore screens simply because they are not included in this inventory.

---

## 6. COMPLETE STATE DESIGN

For each screen, define the states that apply:

- Default
- Initial loading
- Background refresh
- Empty
- No search results
- Validation error
- API error
- Unauthorized
- Offline
- Stale cached data
- Success
- Disabled or unavailable functionality

### State behavior

**Loading:** Use skeletons matching the actual layout. Avoid replacing an entire screen with a spinner when existing content can remain visible.

**Empty:** Explain why content is absent and offer a relevant action.

**Error:** Explain the problem in plain language and offer recovery.

**Offline:** Indicate connectivity limitations. Keep cached information available only when safely and correctly supported.

**Success:** Confirm the operation and reflect the actual updated data.

**Unauthorized:** Follow the existing authentication flow and do not leak protected information.

Do not add meaningless states to static pages. Implement state coverage based on each screen's actual behavior.

---

## 7. MOTION DESIGN SYSTEM

Animations must communicate state, relationships, and feedback. They must never delay important actions.

### Global timing

| Interaction | Duration |
|---|---:|
| Press feedback | 100–150 ms |
| Focus and hover | 100–200 ms |
| Small component transition | 150–250 ms |
| Card or panel transition | 250–350 ms |
| Screen transition | 300–450 ms |
| Theme transition | 250–350 ms |
| Route drawing | Up to 800 ms |
| Skeleton shimmer | 1.4 s loop |
| Radar animation | 2 s loop, only for genuine searching states |

### Easing

- Entering elements: ease-out
- Exiting elements: ease-in
- Sheets and interactive panels: spring-based motion
- Continuous motion: smooth and restrained
- Data changes: brief transitions that do not interfere with reading

For spring-capable animation libraries, begin with stiffness 300 and damping 25, then tune based on the component and platform.

### Required interactions

Implement applicable animations for:

1. Splash logo reveal.
2. Onboarding slide transitions and progress indicators.
3. Search field focus and suggestion appearance.
4. Route selection and card selection.
5. Bottom-sheet opening, dismissal, and supported snap points.
6. Number changes for actual prices and ETAs.
7. Loading and skeleton states.
8. Success and error feedback.
9. Rating interactions if ratings exist.
10. Navigation transitions.
11. Pull-to-refresh when supported.
12. Theme switching.
13. Empty-state illustrations.
14. Real vehicle-marker updates where live tracking exists.

For every implemented animation, document:

- Purpose
- Trigger
- Duration
- Easing
- Reduced-motion alternative
- Performance considerations

Use shared-element transitions only where the underlying framework supports them reliably.

### Important implementation rules

- Prefer transform and opacity animations.
- Avoid layout-thrashing animation patterns.
- Do not run continuous animations unnecessarily.
- Stop animations when their components are no longer visible.
- Avoid decorative movement on every element.
- Do not animate fabricated data.
- Respect the operating system's Reduce Motion preference.

Provide actual implementation code appropriate to the existing framework, not pseudocode presented as completed functionality.

---

## 8. DELIGHT AND PERSONALIZATION

Add small details that make the product feel polished:

- Context-aware greetings when reliable user and time data are available.
- Helpful, concise microcopy.
- Clear progress indicators.
- Subtle transitions between related screens.
- Friendly but professional empty states.
- Remembered theme and language preferences when supported.
- Smooth interaction feedback.
- Meaningful celebrations after real milestones, if the product tracks them.

Optional sound effects must be off by default and must not interfere with accessibility.

Do not add weather-based map styling, trip milestones, promotional features, or personalization that requires data or integrations the application does not have.

---

## 9. ACCESSIBILITY AND PERFORMANCE

- Follow WCAG AA contrast requirements.
- Use minimum 44 × 44 px touch targets.
- Provide keyboard navigation for web interfaces.
- Add accessible names to icon-only controls.
- Preserve logical focus order.
- Support screen readers and semantic headings.
- Ensure Arabic RTL layout works correctly across forms, icons, tables, and navigation.
- Avoid mirroring icons whose meaning should remain unchanged.
- Respect reduced-motion settings.
- Lazy-load heavy resources when appropriate.
- Optimize images and map assets.
- Avoid unnecessary component re-renders.
- Test responsiveness at small and large screen sizes.
- Target smooth 60 FPS animation where hardware permits.
- Test on low-end Android devices and constrained network conditions.

Do not sacrifice functionality or accessibility for visual effects.

---

## 10. ENGINEERING ARCHITECTURE

Adapt all implementation choices to the existing technology stack.

### Shared architecture

Create or reuse:

- Centralized design tokens
- Theme provider
- Language and direction provider
- Reusable UI components
- API service layer
- Shared loading, error, and empty-state components
- Centralized animation constants
- Consistent form validation
- Route and navigation conventions

### State management

- Keep state local when it belongs to one component.
- Use shared state only when multiple components genuinely need it.
- Distinguish server state from UI state.
- Avoid duplicating API data in unnecessary stores.
- Handle request cancellation and race conditions where relevant.
- Prevent duplicate form submissions.
- Keep loading, error, and success states consistent.

### API integration

- Reuse existing API clients and authentication.
- Handle HTTP errors appropriately.
- Validate server responses before assuming success.
- Preserve existing endpoint contracts.
- Avoid hardcoded production data.
- Never place credentials or secrets in frontend code.
- Use mock data only in clearly isolated demo or test scenarios.

### Code quality

- Follow the conventions of the existing repository.
- Keep components small and maintainable.
- Avoid giant page components.
- Avoid unnecessary dependencies.
- Centralize tokens and animation settings.
- Add comments explaining non-obvious animation behavior.
- Remove obsolete code only after verifying it is unused.
- Do not rewrite the entire application unnecessarily.

---

## 11. REQUIRED OUTPUT AND IMPLEMENTATION WORKFLOW

Follow this exact sequence.

### Step 1 — Repository assessment

Inspect the project and report:

- Existing stack
- Current screen inventory
- Current routes and API integrations
- Existing reusable components
- Missing or broken interactions
- Technical limitations
- Proposed implementation plan

Do not begin a large rewrite before completing this assessment.

### Step 2 — Design system

Provide:

- Color tokens and contrast checks
- Typography tokens
- Spacing and radius scales
- Light and dark themes
- RTL/LTR conventions
- Component inventory
- Interaction-state conventions

Then implement the reusable foundation in the project.

### Step 3 — Motion system

Provide:

- Timing table
- Easing conventions
- Centralized animation constants
- Reduced-motion behavior
- Component-specific motion rules

Implement only animations that are appropriate to the current stack.

### Step 4 — User flows and screen inventory

Document:

- Main user journeys
- Navigation relationships
- Screen responsibilities
- Supported actions
- API dependencies
- Error and recovery paths

Clearly distinguish existing functionality from proposed enhancements.

### Step 5 — Home screen implementation

Build the Home screen first.

Requirements:

- Match the Wasalni white-and-yellow identity.
- Use existing data and API integrations.
- Implement all visible controls.
- Include responsive desktop, tablet, and mobile layouts.
- Support Arabic RTL and English LTR.
- Implement appropriate loading, empty, error, offline, and success states.
- Add purposeful micro-interactions.
- Avoid fabricated live transportation information.
- Reuse shared design-system components.

### Step 6 — Verification

After implementing the Home screen:

- Run the existing build and tests where available.
- Fix compilation errors.
- Check browser console and network errors.
- Verify each visible control.
- Verify navigation and API integration.
- Test RTL and LTR.
- Test mobile responsiveness.
- Check keyboard navigation and reduced motion.
- Confirm that existing functionality has not regressed.

Report actual test results. Never claim that tests passed unless they were executed successfully.

### Step 7 — Stop and request approval

After the Home screen is implemented and verified, stop.

Provide:

- Files created or modified
- Functionality implemented
- Animations added
- Tests executed and their results
- Known limitations
- Screenshots if browser tooling is available

Then ask for my approval before proceeding to the next screen.

Repeat this workflow for each subsequent screen.

---

## 12. ACCEPTANCE CRITERIA

The implementation is not complete unless:

- The visual identity is consistent across the application.
- Every visible interactive control works or is explicitly disabled with an explanation.
- All existing API contracts remain intact.
- Real backend data is distinguished from mock data.
- Loading, empty, error, and success states behave correctly.
- Arabic and English layouts work correctly.
- Responsive layouts do not overflow.
- Animations are purposeful and respect reduced-motion preferences.
- Forms provide meaningful validation.
- No secrets or sensitive information are exposed.
- Build and test results are reported honestly.
- The Home screen is complete before implementation of the next screen begins.

**Start by inspecting the existing repository. If an essential decision cannot be determined from the codebase, ask up to three concise clarifying questions. Otherwise, use sensible defaults, state your assumptions, and begin Step 1. Do not ask questions whose answers are already available in the project.**