# Client Accessibility Baseline (`bd-94r`)

Last updated: 2026-02-14

## Scope

Accessibility baseline for the overlay UI now covers keyboard access, visible focus treatment, reduced-motion support, and a repeatable contrast checklist.

Files:
- `apps/client-web/src/overlay/OverlayRoot.tsx`
- `apps/client-web/src/state/uiStore.ts`
- `apps/client-web/src/styles.css`

## Keyboard and Focus Behavior

Implemented:
- global panel shortcuts (`Alt+1..7`) to open core panels
- focus clear shortcuts (`Alt+0`, `Esc`) for scene focus reset
- shortcut handling is suppressed while keyboard focus is in editable controls (`input`, `textarea`, `select`, contenteditable)
- first-run guided onboarding focus trap while modal guidance is active
- first-focus placement into onboarding controls when guided onboarding starts
- explicit `:focus-visible` ring styling for interactive controls (`button`, `input`, `textarea`, `select`, links, tabbable elements)
- container-level focus context highlighting (`.panel-list` / `.panel-card` with `:focus-within`)

## Reduced Motion Baseline

Implemented:
- user toggle in overlay Accessibility section: `Reduced motion mode`
- persisted preference in local storage (`officeclaw:reduced-motion`)
- startup preference read from storage, with fallback to system `prefers-reduced-motion`
- reduced-motion CSS profile disables/minimizes animations and transitions for:
  - explicit UI toggle (`.overlay-root.reduced-motion`)
  - system preference (`@media (prefers-reduced-motion: reduce)`)

## Contrast and Visual Checklist

Checklist for manual verification:
- text remains readable across panel backgrounds (default body copy, metadata, warning/error/success labels)
- focus ring is clearly visible on dark surfaces for all keyboard-reachable controls
- disabled controls remain distinguishable from enabled controls
- hover/focus states remain perceivable without relying on color alone (focus ring + border changes)

## Validation

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
```
