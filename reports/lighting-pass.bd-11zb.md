# Final Lighting and Background Pass (bd-11zb)

Generated: 2026-02-15T12:59:55Z
Primary file: `apps/client-web/src/scene/OfficeScene.tsx`

## Objective

Tune scene lighting/background toward a cohesive cozy-office mood while preserving interaction readability for POIs, highlights, and agents.

## Before/After Parameter Comparison

| Parameter | Before | After | Effect |
|---|---|---|---|
| Background color | `#13161f` | `#1c2129` | slightly warmer base tone, less stark blue-black backdrop |
| Fog | none | `fog(#1c2129, near=8, far=24)` | adds depth falloff and reduces flat horizon contrast |
| Ground color | `#1e2937` | `#242d37` | improves separation from dark background and object silhouettes |
| Ambient intensity | `0.62` | `0.50` | reduces wash-out, preserves shape contrast |
| Hemisphere sky/ground | `#9db3d1 / #171d2a` | `#d7c8ac / #1f2530` | warmer top fill with cooler floor bounce for cozy tone |
| Hemisphere intensity | `0.28` | `0.40` | smoother midtone transitions on props/agents |
| Key light color | default | `#ffd6a3` | warm late-afternoon key light |
| Key intensity | `0.72` | `0.86` | stronger focal readability on interactive props |
| Key position | `[5, 8, 3]` | `[4.4, 7.2, 2.6]` | slightly tighter, lower-angle directional emphasis |
| Fill light | none | directional `#89a8d2 @ 0.20`, position `[-5.5, 5.2, -4.2]` | soft cool fill to prevent crush in shadowed sides |

## Readability Notes

1. POI highlight markers retain warm emissive contrast and remain visually distinct against new background/fog values.
2. Reduced ambient plus added fill preserves geometry definition without making interactive surfaces muddy.
3. Lighting stack remains lightweight (ambient + hemisphere + 2 directional lights) to avoid over-stylization and keep runtime cost predictable.

## Validation

```bash
npm --prefix apps/client-web run typecheck
npm --prefix apps/client-web run build
```

- Typecheck: pass
- Build: pass
