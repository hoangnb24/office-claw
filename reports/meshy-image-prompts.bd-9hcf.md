# Meshy Reference Image Prompt Pack (`bd-9hcf`)

Date: 2026-02-15  
Agent: HazyEagle  
Status: Ready for user image generation into `assets/images/`

## Goal
Produce clean, curated reference images for Sprint A environment assets so `bd-9hcf` can resume with high-quality, intentional inputs.

## Global Style Direction (apply to all prompts)
- Cozy startup office, warm and welcoming, modern but lived-in.
- Stylized realism (not photoreal, not cartoon), clean forms, readable silhouettes.
- Warm key light + soft ambient fill, gentle shadows, no harsh contrast.
- Palette: warm wood, slate blue accents, muted teal, soft amber practical lights.
- No people, no UI overlays, no logos, no text labels, no watermark.
- Keep object boundaries clear and unobstructed for image-to-3d extraction.

## Global Negative Prompt (append to every prompt)
`people, person, character, hands, text, letters, numbers, logo, watermark, blurry, noisy, low detail, overexposed, underexposed, fisheye, extreme perspective, cluttered background, cropped object, duplicate object, broken geometry`

## Recommended Output Settings
- Resolution: `1536x1536` (or at least `1024x1024`)
- Composition: subject centered, full object visible
- Camera: 3/4 view for props, isometric/cutaway for room shell
- Save as PNG in `assets/images/` with filenames below

## Asset Prompt List

### 1) `office_shell`
Filename: `assets/images/office_shell_ref_main.png`

Prompt:
`Isometric cutaway cozy startup office interior shell, no roof, floor and walls visible, warm modern materials, wood floor, soft wall accents, practical lamps, clean architecture for game environment, clear readable geometry, no loose props, no characters, stylized realistic 3D concept art, centered composition, neutral backdrop`

Optional alt view filename: `assets/images/office_shell_ref_alt.png`  
Optional alt prompt:
`Three-quarter wide shot of the same cozy office shell from the opposite corner, matching materials and lighting, clear wall/floor boundaries, production-ready environment concept for 3D modeling, no props pile-up, no characters, no text`

### 2) `prop_inbox`
Filename: `assets/images/prop_inbox_ref_main.png`

Prompt:
`Single physical office inbox tray for document intake, matte metal and wood details, cozy startup aesthetic, placed on plain neutral studio background, centered and fully visible, clean silhouette, stylized realistic product render, soft warm lighting`

Optional alt view filename: `assets/images/prop_inbox_ref_alt.png`  
Optional alt prompt:
`Same inbox tray from a 3/4 top angle, matching materials, simple background, object isolated and uncropped, high readability for 3D conversion`

### 3) `prop_task_board`
Filename: `assets/images/prop_task_board_ref_main.png`

Prompt:
`Wall-mounted office task board, cork and glass hybrid design, sticky notes and cards as abstract shapes without readable text, cozy startup visual style, isolated object, neutral background, centered, stylized realistic 3D concept render, soft warm lighting`

Optional alt view filename: `assets/images/prop_task_board_ref_alt.png`  
Optional alt prompt:
`Three-quarter angled view of the same wall task board, frame depth visible, no readable text, no logos, isolated on clean background, high-detail stylized realism`

### 4) `prop_delivery_shelf`
Filename: `assets/images/prop_delivery_shelf_ref_main.png`

Prompt:
`Compact office delivery shelf unit for finished artifacts, open cubbies, warm wood with dark metal frame, cozy startup office style, isolated on neutral background, full object visible, centered, stylized realistic 3D product concept`

Optional alt view filename: `assets/images/prop_delivery_shelf_ref_alt.png`  
Optional alt prompt:
`Three-quarter side view of the same delivery shelf, clear depth and shelf spacing, clean background, soft warm key light, no clutter, no text`

### 5) `prop_dev_desk`
Filename: `assets/images/prop_dev_desk_ref_main.png`

Prompt:
`Modern developer desk workstation, simple desk surface with monitor stand and minimal accessories, cozy startup office aesthetic, wood and dark metal materials, isolated object on neutral background, centered full view, stylized realistic 3D concept render`

Optional alt view filename: `assets/images/prop_dev_desk_ref_alt.png`  
Optional alt prompt:
`Three-quarter perspective of the same developer desk, clean silhouette, readable legs and surface proportions, minimal accessories, no logos, no text, soft warm studio lighting`

### 6) `prop_blocker_cone`
Filename: `assets/images/prop_blocker_cone_ref_main.png`

Prompt:
`Office safety blocker cone marker, compact stylized cone with subtle startup-office aesthetic, clean geometry, isolated on neutral background, centered full object, stylized realistic product render, soft warm lighting`

Optional alt view filename: `assets/images/prop_blocker_cone_ref_alt.png`  
Optional alt prompt:
`Three-quarter angle of the same blocker cone marker, slightly rotated to show profile, isolated object, clean background, high edge definition for 3D extraction`

## Acceptance Checklist Before Resuming `bd-9hcf`
- [ ] All six `*_ref_main.png` images exist in `assets/images/`.
- [ ] Visual style is consistent across all six images.
- [ ] No text/logo/watermark appears in any image.
- [ ] Objects are not cropped and have clear silhouettes.
- [ ] User approves this reference pack before new Meshy runs.
