# Asset Compression Report (`bd-295o`)

Generated: 2026-02-15T13:00:21.935Z
Toolchain: `npx @gltf-transform/cli@4.2.1`
Input root: `assets/glb`
Output root: `assets/glb/compressed`
Texture mode requested: `auto`
Texture stage applied: `webp`
KTX tool available: `no`

## Results

| Asset | Input Size (MiB) | Output Size (MiB) | Delta (MiB) | Delta % |
|---|---:|---:|---:|---:|
| `office_shell.glb` | 0.00 | 0.00 | 0.00 | 5.0% |
| `inbox.glb` | 0.00 | 0.00 | 0.00 | 5.0% |
| `task_board.glb` | 0.00 | 0.00 | 0.00 | 5.0% |
| `blocker_cone.glb` | 0.00 | 0.00 | 0.00 | 5.0% |
| `desk.glb` | 12.67 | 2.89 | 9.78 | 77.2% |
| `shelf.glb` | 12.67 | 2.89 | 9.78 | 77.2% |

## Aggregate

- Input total: 25.34 MiB
- Output total: 5.78 MiB
- Savings: 19.56 MiB (77.2%)

## Notes

- Mesh stage uses Draco (`gltf-transform draco`).
- Texture stage uses WebP fallback when `ktx` is unavailable.
- Source GLBs are unchanged; compressed assets are written to a separate output root.
