# AGENTS.md (assets)

Scope: `assets/**`

## Canonical Source of Runtime Assets

- GLBs: `assets/glb/**`
- Scene manifests: `assets/scenes/**`

Runtime mirrors are copied to:

- `apps/client-web/public/assets/**`
- `apps/client-web/public/scenes/**`

## Commands

```bash
npm --prefix apps/client-web run assets:sync
npm --prefix apps/client-web run assets:verify
node tools/glb-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --asset-root assets/glb --report reports/glb-preflight-report.latest.md
node tools/nav-preflight.mjs --scene assets/scenes/cozy_office_v0.scene.json --out reports/nav-preflight-report.latest.md
```

## Notes

- Keep scene manifest URLs root-served (`/assets/<file>.glb`).
- Treat `assets/` as canonical and `apps/client-web/public/` as synchronized runtime output.
