# Runtime Sync Hygiene Report (bd-2i3)

Generated: 2026-02-15T12:48:00Z

## Commands

1. `npm --prefix apps/client-web run assets:sync:prune`
2. `npm --prefix apps/client-web run assets:verify`
3. `npm --prefix apps/client-web run typecheck`
4. `npm --prefix apps/client-web run build`

## Sync output

```text
> @officeclaw/client-web@0.1.0 assets:sync:prune
> node ../../tools/sync-runtime-assets.mjs --source-glb ../../assets/glb --source-scenes ../../assets/scenes --target-assets public/assets --target-scenes public/scenes --prune

Mode: sync
Prune stale outputs: yes
Source files scanned: 9
Copied: 0
Updated: 0
Unchanged: 9
Stale: 0
Pruned: 0
```

## Verify output

```text
> @officeclaw/client-web@0.1.0 assets:verify
> node ../../tools/sync-runtime-assets.mjs --source-glb ../../assets/glb --source-scenes ../../assets/scenes --target-assets public/assets --target-scenes public/scenes --check

Mode: check
Prune stale outputs: no
Source files scanned: 9
Copied: 0
Updated: 0
Unchanged: 9
Stale: 0
Pruned: 0
```

## Runtime tree snapshot

### apps/client-web/public/assets
```text
apps/client-web/public/assets/agent1_animations.glb
apps/client-web/public/assets/agent1_skeleton.glb
apps/client-web/public/assets/blocker_cone.glb
apps/client-web/public/assets/desk.glb
apps/client-web/public/assets/inbox.glb
apps/client-web/public/assets/office_shell.glb
apps/client-web/public/assets/shelf.glb
apps/client-web/public/assets/task_board.glb
```

### apps/client-web/public/scenes
```text
apps/client-web/public/scenes/cozy_office_v0.scene.json
```

## Notes

- `assets:*` npm scripts now pass explicit source/target arguments, so `npm --prefix apps/client-web ...` works reliably.
- Sync is idempotent in current state, with zero drift and zero stale runtime outputs.
