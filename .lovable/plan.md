# Fix the mobile experience

## Scope
- Audit the shared header, navigation, project cards, discovery, project details, backing dialog, dashboard, and project creation flow at phone widths.
- Remove horizontal overflow, prevent clipped text and controls, and improve mobile spacing and touch targets.
- Keep the desktop layout and existing visual identity unchanged.

## Implementation
- Make the mobile header use stable grid sizing and ensure the logo, account/sign-in controls, and menu fit narrow screens.
- Make project grids, funding details, tab rows, dialogs, dashboard rows, and creation controls adapt cleanly to small widths.
- Add safe-area spacing for fixed bottom actions and avoid content being hidden behind them.
- Validate key screens at a 390px phone viewport, including opening the menu and backing dialog.

## Technical details
- Use existing design tokens and Button components.
- Apply responsive Tailwind utilities in the existing components only; no business logic or data changes.
