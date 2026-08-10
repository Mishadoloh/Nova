# NOVA style architecture

The application keeps two tiny public entry points:

- `../globals.css` loads visual styles in cascade order.
- `../animations.css` loads the motion system after visual styles.

## Visual cascade

1. `01-foundation.css` — tokens, reset, shell and core dashboard primitives.
2. `02-product-tools.css` — shared product controls and utilities.
3. `03-workspace-pages.css` — shared inner-page layouts.
4. `04-home-dashboard.css` — home-specific dashboard composition.
5. `05-premium-foundation.css` — elevated surfaces and visual foundation.
6. `06-premium-components.css` — reusable premium components.
7. `07-premium-dashboard.css` — dashboard data presentation.
8. `08-page-polish.css` — page-specific visual details.
9. `09-responsive.css` — layout breakpoints.
10. `10-quality-pass.css` — accessibility, interaction consistency and final safeguards.
11. `11-product-functionality.css` — functional controls for tasks, goals and session history.

## Motion cascade

The `motion/` directory follows the same approach: shared keyframes first, then
navigation, cards, data, page-specific motion, controls, responsive behavior and
accessibility overrides.

## Conventions

- Keep design tokens in `01-foundation.css`.
- Put a reusable component in `06-premium-components.css`; page-only rules stay in
  their page layer.
- Keep breakpoints centralized unless a component needs a tightly coupled fallback.
- New animations must include a `prefers-reduced-motion` fallback.
- Avoid `!important`; rely on the documented cascade order and low-specificity
  selectors such as `:where()`.
