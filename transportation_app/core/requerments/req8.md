## 4B. UI Reference: "A Public Transit Operator Mobile App" (Dribbble)

**Source of truth:** the attached screenshots of the Dribbble shot "A Public Transit Operator Mobile App" (by wincasoft). If screenshots are not attached, say so, build from the guidance below, and keep every value in theme tokens so it can be adjusted later.

Match the reference's look and feel: layout, spacing, card style, color mood, iconography, and typography. Do not copy its brand assets, logos, or illustrations. Build everything with Volt UI components and theme tokens. Never hardcode colors, radii, or font sizes in components.

### 1. Extract design tokens first
Before coding, inspect the reference and write down these tokens in one theme file (CSS/SCSS variables mapped onto Volt):
- Primary, secondary, and accent colors, plus hover and pressed states.
- Page background, card surface, border, and divider colors.
- Text colors (primary, secondary, muted, on-primary).
- Status colors: on time, delayed, cancelled, full, boarding, success, warning, danger.
- Border radii (card, button, chip, input, bottom sheet).
- Shadows and elevation levels.
- Font family, size scale, weights, and line heights.
- Spacing scale and screen side padding.
- Icon family, size, and stroke weight.
Any color I did not specify must be sampled from the reference. Verify WCAG AA contrast and adjust only if it fails.

### 2. Visual language (apply across the app)
- Clean, light, card-based UI. White cards on a soft neutral background.
- Large rounded corners (cards 16–20px, buttons 12–16px, chips fully rounded).
- Soft, low-contrast shadows. No heavy borders, gradients, or decoration without meaning.
- One strong brand color for primary actions and selected states, used sparingly.
- Generous whitespace, 16–20px screen padding, clear vertical rhythm.
- Bold numerals for times, prices, and counts. Muted small text for labels.
- A consistent line-icon set at 20–24px. Use the set Volt already ships.
- Mobile first at 360–430px. The same components scale up to tablet and desktop.

### 3. Core components to build or restyle
- **App bar:** back button, centered title, optional action icon. Collapses on scroll.
- **Route/trip card:** origin → destination with a timeline (dot, line, dot), departure and arrival times in bold, duration chip, vehicle type chip with icon, price, and a status badge (On time / Delayed / Boarding / Full).
- **Status badges and chips:** pill-shaped, tinted background with dark text of the same hue, plus an icon so color is never the only signal.
- **Filter / segmented tabs:** pill tabs for Today / Tomorrow / Date, vehicle type, and sort. Active tab is filled with the brand color.
- **Search / route selector:** stacked From / To fields with a swap button, date and passenger pickers as tappable rows.
- **Bottom sheet:** used for filters, trip details, and booking confirmation, with a drag handle and rounded top corners.
- **Bottom navigation:** 4–5 items with icons and labels, active item in the brand color with a tinted indicator. Respect the safe area.
- **Primary button:** full width, 48–52px high, brand color, with loading and disabled states. Secondary is outline or tinted.
- **Lists:** trips, bookings, and stops use the same card pattern with consistent padding and dividers.
- **Empty, loading, and error states:** skeleton cards for loading, a simple icon with a short message and a clear action for empty and error states.
- **Toasts and alerts:** top or bottom, with icon, message, and optional action.

### 4. Apply the style to the seat-selection page
- Page structure: app bar → trip summary card → legend → vehicle seat map card → sticky bottom bar (a bottom sheet style on mobile).
- The seat map sits in a white rounded card on the neutral background. The vehicle shell uses a soft outline with a steering-wheel marker and Front/Rear labels.
- Seats use the same radii, brand colors, and status colors defined in the token file. Selected seat = brand color with a check. Booked = muted gray with a pattern. Available = light neutral.
- The sticky bar uses the same card style: seat count and labels on the left, total in bold on the right, and a full-width primary button.
- Selected seats appear as removable chips in the summary.

### 5. Operator-facing screens (if the app has operator or admin roles)
Use the same system for these, with denser layouts where needed.
- Trip list with status badges and occupancy (e.g. "32 / 40 seats") shown as a thin progress bar.
- Vehicle and seat-layout editor with live preview, using the passenger seat map renderer.
- Passenger manifest per trip with seat labels, search, and status filters.
- Dashboard cards for today's trips, occupancy, and revenue, using big numerals and small trend chips.

### 6. Motion and feedback
- 150–250ms ease-out transitions for press, selection, tab changes, and bottom-sheet open/close.
- Subtle scale and check animation on seat selection, skeleton shimmer for loading.
- Respect `prefers-reduced-motion`.

### 7. Localization, RTL, and accessibility
- All strings go through the existing i18n layer. Arabic RTL must mirror layouts, timelines, and icons that imply direction.
- WCAG AA contrast, 44px minimum touch targets on mobile (40px minimum for dense seat grids), visible focus states, and semantic labels on all controls.
- Format dates, times, numbers, and currency with the app's existing utilities (e.g. EGP).

### 8. Deliverables for this section
- One theme/tokens file and a short style guide page listing tokens and component examples.
- Screenshots at 360px, 768px, and desktop for: search, trip list, trip details, seat selection (sedan, 15-seat van, 40-seat bus), booking confirmation, loading, empty, and error states.
- A short note listing any place where the implementation intentionally differs from the reference, and why.