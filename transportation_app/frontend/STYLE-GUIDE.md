# وصلني (Wasalni) UI style guide

## Design tokens

Edit the shared values in [`src/index.css`](./src/index.css). Use them in component styles rather than adding one-off palette, type, radius, or elevation values.

| Purpose | Token |
| --- | --- |
| Page / card / elevated surfaces | `--color-background`, `--color-surface`, `--color-surface-elevated` |
| Brand and interaction states | `--color-accent`, `--color-accent-hover`, `--color-accent-pressed`, `--color-accent-tint` |
| Text and separators | `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-border`, `--color-divider` |
| Status colors | `--color-success`, `--color-warning`, `--color-danger`, `--color-information` and their `-tint` tokens |
| Spacing and type | `--space-*`, `--screen-padding`, `--font-size-*`, `--font-weight-*`, `--line-height-body` |
| Shapes and depth | `--radius-card`, `--radius-button`, `--radius-chip`, `--radius-input`, `--radius-bottom-sheet`, `--shadow-*` |
| Seat states | `--seat-available-*`, `--seat-booked-*`, `--seat-selected-*`, `--seat-blocked-*` |

## Component examples

- Use `.btn.btn-primary` for the main action and `.btn.btn-light` for secondary actions.
- Use `StatusBadge` for labeled, icon-supported status indicators.
- Use `.panel` for grouped content and `.passenger-trip-card` for journey results.
- Use `VehicleSeatMap` for passenger seat selection and the operator vehicle-layout preview.
- Use the mobile bottom navigation at compact breakpoints; keep the complete role-filtered navigation in the drawer.

## Intentional differences and limitations

- No reference screenshots were attached. The light palette and layouts follow the written req8 guidance and remain adjustable through the tokens; they are not claimed to be sampled or pixel-matched.
- Volt UI and an i18n package are not dependencies in this project. Existing Bootstrap components and Bootstrap Icons are reused; existing English strings have not been migrated to a new localization system.
- Seat count represents passenger count in the existing booking contract, so no separate passenger-count control was added. Vehicle type, boarding, full, on-time, and delay indicators are not fabricated when the corresponding API data is absent.
- An empty vehicle seat-layout field uses the backend default and cannot be previewed exactly in the form; a live preview is shown when valid layout JSON is supplied.
- The shared brand wordmark renders Arabic in an isolated right-to-left span with system Arabic font fallbacks. The rest of the interface remains English because this project does not yet include an Arabic translation/localization layer; existing styles include basic `dir="rtl"` mirroring hooks.
- The requested end-to-end state screenshots require authenticated API data for trips and seats. They were not generated from mock records.
