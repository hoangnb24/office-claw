# PLAN.md — OfficeClaw Web Game (Cozy Startup • Isometric 2.5D • Three.js)
_Last updated: 2026-02-14_

This plan consolidates the product + UX flows + runtime architecture for the OfficeClaw web game application.

**Scope note (important):** The pipeline **“generate images → create 3D models → export `.glb`” will be done manually**. This plan starts **after** you already have `.glb` assets (office shell, props, characters). The focus here is: **how those components become visible, interactive, and connected to the OpenClaw-driven simulation**.

---

## 0) Goals and non-goals

### Goals
- Ship a **sandbox-based** isometric “cozy startup” office where:
  - User has a controllable avatar (click-to-move).
  - AI agents are NPCs with visible behavior, movement, and status.
  - User can submit requests, see tasks, track progress, resolve blockers, and approve deliverables.
- Integrate with existing **backend/server + OpenClaw**:
  - Server acts as the **director**.
  - Server emits **semantic events** and **agent goals/paths**.
  - Client renders the world and animates agents smoothly.
- Keep it **small numbers first** (3–5 agents), but architect for scaling later.
- Ensure the 3D office is **mechanically meaningful** (avoid “3D diorama + 2D web app”):
  - Proximity-locked interactions (walk-to-interact).
  - POI Focus Mode (camera framing + UI anchored to the clicked POI).
  - Visible “work-in-progress” cues during LLM latency (safe task progress previews).
  - Persistent cosmetic progression in the room (trophies / decor).

### Non-goals (v0)
- No multiplayer player-to-player interactions.
- No fully dynamic 3D building editor (layout changes can come later).
- No fully AI-driven movement/behavior in the client (LLM does not drive the physics).
- No automated asset generation pipeline in this document.

---

## 1) Product: the sandbox gameplay loop (v0)

1. **Create Office** (onboarding wizard)
2. **Explore Hub** (learn POIs + inspector + event feed)
3. **Submit Request** (Reception/Inbox)
4. **Auto Kickoff** (meeting event; BD decomposes into tasks)
5. **Assign Tasks** (drag-to-agent or auto-assign)
6. **Track Progress** (event feed + agent inspector)
7. **Blocked / Needs Decision** (BD asks; user resolves)
8. **Review & Approve** (artifact appears; approve/revise/split)

These flows match the approved storyboard set (Flows 1–8).

---

## 2) System overview: what talks to what

### Runtime components
- **Client (Web)**
  - Three.js renderer (isometric/orthographic camera)
  - UI overlay (React recommended for speed)
  - Interaction system (raycasting + UI-to-world highlighting)
  - Networking client (WebSocket)
- **World Server (Director)**
  - Authoritative simulation state (agents, tasks, events, POIs)
  - Agent FSM updates + pathfinding
  - Emits events + goals/paths + snapshots
- **OpenClaw Runtime**
  - Performs actual “agentic work” (tools, reasoning, outputs)
  - Returns structured results that become in-world artifacts/events

### Key principle
- **Server = “director”**
- **Client = “renderer + input + interpolation”**

---

## 3) Tech stack (recommended)

### Client
- TypeScript
- Three.js (core renderer)
- **@react-three/fiber** (Highly recommended if using React UI; allows clean declarative 3D + UI integration)
- React for UI overlays (Chat, Event Feed, Inspector, Task Board panels)
- **Zustand** (Mandatory for bridging 3D interactions ↔ 2D React UI without causing Canvas re-renders)

### Server
- TypeScript / Node (or your current backend language — this plan is protocol-driven)
- WebSocket (ws / Socket.IO)
- Simulation tick: 10–20 Hz
- Pathfinding: Grid A* (office maps are simple)

### Shared
- `shared/` package for types: event schemas, agent/task models, message enums

---

## 4) 2.5D isometric rendering approach in Three.js

### Camera
- Use an **OrthographicCamera** (locked angle) to achieve isometric feel.
- Fixed rotation and position; allow zoom in/out within limits.
- Rule: no free orbit; keep the “office diorama” readability.

### World orientation
- Treat **floor as XZ plane**, Y as vertical.
- Convert tile/grid coordinates → world XZ for pathing and placement.

### Lighting (cozy vibe)
- Start simple:
  - 1–2 warm key lights + soft fill
  - Ambient light
  - Optional: baked AO in textures (best for performance)
- Keep real-time shadows minimal in v0 (shadows are expensive).

---

## 5) Asset readiness contract (what your `.glb` must provide)

Since assets are manual, the runtime needs consistency. Establish a contract so all `.glb` behaves predictably.

### 5.1 Global conventions
- Unit scale: **1 unit = 1 meter**
- Pivot points:
  - Characters pivot at feet center
  - Props pivot at their base center
- Orientation:
  - Forward direction for characters is consistent (e.g., +Z)

### 5.2 Required asset categories
- `office_shell.glb` (floor + walls + big fixtures)
- `props/*.glb` (desk, chair, plant, shelf, etc.)
- `agents/*.glb` (BD, Research, Engineer)

### 5.3 Required runtime metadata
You need a way to attach interaction/collision/POI data. Two workable options:

**Option A — Scene Manifest (recommended for v0)**
Maintain a JSON file in repo that defines:
- which `.glb` to load
- where to place it
- whether it’s interactive/collidable
- its POI/interaction type
- its “anchor points” (e.g., stand position for working)

**Option B — glTF “extras”**
Embed metadata inside glTF nodes (`extras`) for object types, interaction ids, anchors.
This is powerful but adds DCC workflow complexity.

Start with **Option A**, then migrate later if needed.

### 5.4 Required animation contract (Characters)
To allow the `AgentRenderer` to map FSM states to visual movement predictably, all agent `.glb` files must contain exact string-matched animation clips:
- `Idle` (breathing, standing still)
- `Walk` (standard locomotion)
- `Work_Typing` (sitting/standing at a desk, typing)
- `Think` (scratching head, looking at screen — crucial for LLM latency)
- `Carry` (holding an artifact — optional for v0)

---

## 6) World model: POIs, objects, and interactivity

### 6.1 Named POIs (Points of Interest)
POIs are the “semantic anchors” for agent behavior and user actions.

**v0 POIs**
- `poi_reception_inbox`
- `poi_task_board`
- `poi_meeting_table`
- `poi_research_desk_1`
- `poi_dev_desk_1`
- `poi_delivery_shelf`
- `poi_lounge`

Each POI has:
- `poi_id`
- `type`
- `nav_anchor`: world position agents walk to
- `capacity`
- `interaction`: what happens when the user clicks/uses it
- `highlights`: world nodes to glow/outline when referenced by an event

### 6.2 Object types
- **Static props**: decorative, not interactive
- **Colliders**: block movement (walls, cabinets)
- **Interactables**: clickable with UI actions (Task Board, Inbox, Delivery Shelf)
- **Markers/anchors**: invisible helper nodes for navigation and seating positions

### 6.3 Interaction patterns (UX)
- Hover highlight + tooltip
- Click enters **POI Focus Mode**:
  - highlight the POI
  - smoothly frame it with the camera
  - open the relevant panel **anchored to that POI** (clipboard-style overlay by default)
- **Proximity lock (walk-to-interact):** if the player is outside the POI’s `interaction_radius_m`, path the avatar there first, then open the panel on arrival
- Context actions remain in UI overlay for v0, but the UI should *feel attached to the world* (POI focus + anchored placement; optional `<Html transform>` for light in-world UI)
- World reacts: glow, camera focus, characters walk and animate

### 6.4 “Magic moments” requirements (v0)
These are low-risk UX beats that prevent the 3D layer from becoming decorative:
- **Walk-to-interact** for all POIs that open panels (Inbox, Task Board, Delivery Shelf).
- **Blocked agents seek the user:** when blocked, an agent either approaches the player avatar (if player position is available) or rendezvous at the lounge; show a short chat bubble prompt.
- **Tactile approvals:** approval is a visible in-world interaction beat (stamp animation + camera framing + optional SFX) even if the Artifact Viewer remains a React overlay.
- **Optional:** show short “task progress” previews in-world while agents work (e.g., tiny hologram/clipboard near the working agent).

---

## 7) Scene Manifest (example and required fields)

Create: `assets/scenes/cozy_office_v0.scene.json`

```json
{
  "scene_id": "cozy_office_v0",
  "office_shell": {
    "url": "/cdn/office_shell.glb",
    "position": [0,0,0],
    "rotation": [0,0,0],
    "scale": [1,1,1]
  },
  "pois": [
    {
      "poi_id": "poi_reception_inbox",
      "type": "inbox",
      "nav_anchor": [2.4, 0, -1.2],
      "highlight_nodes": ["ReceptionDesk", "InboxTray"],
      "interaction_radius_m": 1.25,
      "ui_anchor": {"pos":[2.25, 1.05, -1.15], "facing":[-1,0,0], "size":[1.2,0.8]},
      "camera_framing": {"kind":"poi", "offset":[0.0, 1.2, 1.8], "zoom": 1.05}
    },
    {
      "poi_id": "poi_task_board",
      "type": "task_board",
      "nav_anchor": [1.2, 0, 2.0],
      "highlight_nodes": ["TaskBoardWall"],
      "interaction_radius_m": 1.25,
      "ui_anchor": {"pos":[1.20, 1.10, 1.80], "facing":[0,0,-1], "size":[1.4,0.9]},
      "camera_framing": {"kind":"poi", "offset":[0.0, 1.2, 1.8], "zoom": 1.05}
    }
  ],
  "objects": [
    {
      "id": "desk_01",
      "url": "/cdn/props/desk.glb",
      "position": [0.5, 0, 0.4],
      "rotation": [0, 1.57, 0],
      "scale": [1,1,1],
      "collider": true,
      "interactive": false
    },
    {
      "id": "delivery_shelf",
      "url": "/cdn/props/shelf.glb",
      "position": [-1.0, 0, 2.2],
      "rotation": [0, 0, 0],
      "interactive": true,
      "interaction_type": "delivery_shelf",
      "poi_id": "poi_delivery_shelf",
      "interaction_radius_m": 1.25
    }
  ],
  "navigation": {
    "grid": {
      "origin": [-4, -4],
      "cell_size": 0.25,
      "width": 32,
      "height": 32,
      "walkable": "base64_or_array"
    }
  }
}
```

**Why this matters:** it lets your engine load `.glb` and know:
- what can be clicked
- what blocks movement
- where agents stand for actions
- what to highlight when events happen

---

## 8) Client runtime: scene graph and rendering modules

### 8.1 Recommended scene graph
- `SceneRoot`
  - `EnvironmentRoot` (office shell)
  - `PropsRoot` (instanced props)
  - `AgentsRoot` (characters)
  - `VFXRoot` (highlights, indicators)
  - `DebugRoot` (grid/path debug)

### 8.2 Module breakdown (client)
- `AssetManager`
  - loads `.glb` (GLTFLoader)
  - caches by URL
  - returns clones/instances
- `SceneLoader`
  - loads the scene manifest
  - populates scene graph
- `InteractionManager`
  - raycasting
  - hover/click
  - dispatches actions to UI + world
- `HighlightManager`
  - glow outlines or simple emissive swap (v0)
  - “flash” POIs when event feed clicked
- `NavGrid`
  - converts world↔grid coords
  - shows debug overlay
- `AgentRenderer`
  - creates agent mesh instances
  - animates movement along paths
  - plays animations based on state
- `UIOverlay`
  - Chat (BD)
  - Event Feed
  - Agent Inspector
  - Task Board
  - Artifact Viewer

---

## 9) Interaction system details (making components clickable and meaningful)

### 9.1 Raycasting and hit testing
- Use a single raycast each frame for hover (or at 10–20 Hz to reduce cost)
- On click:
  - determine target object id
  - map to interaction type
  - call UI action (open panel, focus camera, select agent)

### 9.2 Hover state UX
- Hover highlight via:
  - emissive material swap (cheap)
  - outline pass (nicer, more complex)
- Tooltip shows:
  - name
  - short “what this does” line
  - shortcut key (optional)

### 9.3 Click actions mapping
- **Rule:** POI clicks use **walk-to-interact** + **POI Focus Mode** (highlight + camera framing), then open an anchored panel.
- Click Inbox → (if far, path avatar) Focus Inbox → Open Request panel + list requests
- Click Task Board → (if far, path avatar) Focus Task Board → Open tasks panel
- Click Delivery Shelf → (if far, path avatar) Focus Shelf → Open Deliverables list
- Click agent → Focus agent → Open Agent Inspector
- Click meeting table → Focus camera (and optionally “start kickoff” in debug)

### 9.4 “World reacts to UI”
- Clicking an event in the Event Feed:
  - highlights the POI + involved agents
  - camera pans to the room (optional)
- Approving a deliverable:
  - the artifact object animates “stamping approved”
  - task moves to Done on Task Board UI
  - event logged

---

## 10) Movement + pathing: grid-first, server-authoritative

### 10.1 Why grid-first
- Office layouts are rectilinear; grid A* is reliable and simple.
- Grid matches your earlier tilemap approach and director model.

### 10.2 Where pathfinding happens
**Recommended: server computes paths**
- Server knows collisions, occupancy, and can keep authority.
- Client animates along the path for smoothness.

### 10.3 Client-side movement animation
- Client receives `agent_goal` with a `path` of world points.
- Client moves agent along points at a fixed speed.
- Server sends occasional corrections (snapshots).

### 10.4 Player movement
- For v0, client can path player locally (grid A* client-side) for responsiveness.
- Server still validates and can correct if needed (optional for v0).

---

## 11) Agent simulation: deterministic FSM + director overrides

### 11.1 Agent roles (v0)
- BD/PM agent (chat-enabled, coordinator)
- Research agent
- Engineer agent

### 11.2 Minimal FSM states
- `IdleAtHome`
- `WalkingToPOI(poi_id)`
- `WorkingAtPOI(poi_id, task_id)`
- `InMeeting(meeting_id)`
- `DeliveringArtifact(artifact_id)`
- `SeekingUserDecision(decision_id)` (agent should attempt to approach player; fallback rendezvous at lounge)
- `WalkingToPlayer(player_id)` (optional v0; used for “needy agent” blockers)
- `BlockedWaiting(decision_id)`

### 11.3 Director event overrides
Events like “Kickoff Meeting” temporarily override normal task execution:
1) Director emits kickoff event
2) Agents assigned to meeting get a high-priority override:
   - goal: go to meeting table
3) When meeting ends:
   - override removed
   - agents return to their tasks

---

## 12) Networking contract (client ↔ server)

### 12.1 Message categories
- **Events** (semantic, sparse)
- **Goals/Paths** (movement intentions)
- **Snapshots** (authoritative corrections at low rate)
- **Chat** (BD agent only)
- **Commands** (user actions)

### 12.2 Example schemas

**Event**
```json
{
  "type": "event",
  "id": "evt_001",
  "ts": 1739500000,
  "name": "kickoff_started",
  "payload": {
    "project_id": "proj_123",
    "poi_id": "poi_meeting_table",
    "participants": ["agent_bd", "agent_research", "agent_eng"]
  }
}
```

**Agent goal/path**
```json
{
  "type": "agent_goal",
  "ts": 1739500001,
  "agent_id": "agent_research",
  "goal": { "kind": "go_to_poi", "poi_id": "poi_research_desk_1" },
  "path": [[1.0,0,-0.2],[1.2,0,-0.2],[1.4,0,0.0]]
}
```

**Snapshot**
```json
{
  "type": "snapshot",
  "ts": 1739500002,
  "agents": [
    {"id":"agent_research","pos":[1.2,0,-0.2],"state":"WalkingToPOI"},
    {"id":"agent_eng","pos":[-0.3,0,1.7],"state":"WorkingAtPOI"}
  ],
  "tasks": [
    {"id":"task_1","status":"in_progress","assignee":"agent_research"}
  ]
}
```

**Command (client → server)**
```json
{
  "type": "command",
  "id": "cmd_900",
  "ts": 1739500003,
  "name": "submit_request",
  "payload": {
    "text": "Create a landing page plan + copy + design brief",
    "constraints": {"tone":"friendly","length":"short"}
  }
}
```

### 12.3 Bandwidth strategy
- Prefer **goals/paths** rather than constant x/y updates.
- Snapshots at low rate (e.g., 2–5 Hz) for correction.
- Events on-demand.

---

## 13) UI overlay: panels and their data sources
> v0 note: panels remain standard React overlays for speed, but they should open in **POI Focus Mode** and be visually **anchored to the clicked POI** (not a generic full-screen modal unless the content truly requires it).

### 13.1 Event Feed (right panel)
- Source: server `event` messages
- Actions:
  - click event → highlight POI + agents
  - optionally “jump camera”

### 13.2 Agent Inspector (click agent)
- Shows:
  - role, name, avatar
  - current task + substeps
  - state label (“Researching competitors”)
  - blockers + what it needs from user
- Source: snapshot + agent_goal + task model

### 13.3 Task Board
- Shows:
  - To Do / Doing / Done
  - drag task to agent (sends command)
  - auto-assign button
- Source: project/task state from server

### 13.4 Inbox / Request panel
- submit requests (sandbox entry point)
- Source: command → server → event + new project/tasks

### 13.5 Artifact Viewer (Deliverables)
- open artifact content
- Approve / Request changes / Split tasks
- Source: artifact metadata + content ref

### 13.6 Chat (BD agent only)
- Source: chat messages; BD summarizes system
- BD is the single conversational “front door”

---

## 14) Artifacts as world objects (deliverables in the office)

### Artifact life-cycle
1) OpenClaw completes a task → server creates `artifact_created`
2) Server spawns artifact at `poi_delivery_shelf`
3) Client renders an artifact object (paper stack, folder, etc.)
4) User clicks it → artifact viewer opens
5) Approve:
   - server marks tasks done, artifact approved
6) Request changes:
   - server creates new tasks; artifact remains as v1; new v2 later
7) Split tasks:
   - server creates follow-up tasks

### Artifact representation
- Use a generic “paper/folder” prop and attach UI metadata:
  - title
  - type icon
  - status

---

## 15) Persistence and replay (recommended, even for v0)

### Store
- Projects
- Tasks
- Artifacts (metadata + content refs)
- Event log (append-only)
- Office decor (cosmetic trophies/unlocks + placements)

### Benefits
- Debugging “why did the agent do that?”
- Replay a session for demos
- Recover state after server restart
- Visual progression: the office changes over time as work ships (trophies / decor)

---

## 16) Performance plan (keep it smooth in browsers)

### Must-do
- Instancing for repeated props (chairs, plants).
- Keep draw calls low (merge static meshes if needed).
- Avoid heavy real-time shadows in v0.
- Use compressed textures if possible (later optimization step).

### Instrumentation
- FPS overlay in dev mode
- Count draw calls and triangles
- Log asset sizes and load times

---

## 17) Testing strategy

### Unit tests
- Director event scheduling
- Agent FSM transitions
- Task state transitions
- Protocol validation

### Integration tests
- Full flow tests:
  - request submitted → kickoff → tasks → artifacts → approve
- Simulated client that consumes events/goals

### Visual/QA checks
- Hover/click hitboxes are correct
- Camera panning/zoom constraints
- POI highlight correctness

---

## 18) Implementation milestones (v0)

### M0 — Three.js foundation
**Deliverables**
- Orthographic camera locked isometric
- Load `office_shell.glb`
- Load props from scene manifest
- Basic lighting and ground

**DoD**
- Office renders consistently on desktop browsers
- Stable camera + resize works

### M1 — Interactivity core
**Deliverables**
- Raycast hover + click selection
- Highlight manager
- POI Focus Mode scaffolding (camera framing + anchored panel placement)
- Click agent opens inspector (stub)
- Click POI opens corresponding panel (stub)

**DoD**
- All primary POIs are clickable and show a panel
- No “dead clicks” on key objects

### M2 — Player movement
**Deliverables**
- Click-to-move (client-side path)
- Collision prevents walking through walls/props
- Camera follow user toggle
- Walk-to-interact: clicking a POI from afar paths the avatar to `interaction_radius_m`, then triggers the POI interaction

**DoD**
- Movement feels reliable and responsive

### M3 — NPC agents rendered + moved by server goals
**Deliverables**
- Agent renderer + animation states
- WebSocket connection + receive `agent_goal` paths
- Smooth interpolation and correction via snapshots

**DoD**
- Agents walk to meeting room when server triggers event

### M4 — Event Feed + Highlights
**Deliverables**
- Event feed UI
- Clicking events highlights POIs + agents
- Camera focus on event (optional)
- Optional: surface `task_progress` previews as tiny in-world “working” readouts near agents (safe, short text)

**DoD**
- Event feed is the “truth timeline”

### M5 — Tasks + Task Board interactions
**Deliverables**
- Task board UI
- Drag task to agent (sends command)
- Auto-assign command
- Task status updates driven by server

**DoD**
- Task loop works end-to-end visually

### M6 — Artifacts + Review & Approve
**Deliverables**
- Artifacts appear in-world (Delivery Shelf)
- Artifact viewer with Approve/Revise/Split
- Approval is a tactile in-world beat (stamp animation + camera framing; viewer can remain overlay)
- Server persists artifact versions

**DoD**
- Flow 8 complete: deliverable → approve → done

### M7 — Blocked / Needs Decision
**Deliverables**
- Blocker icon above agent
- Decision panel with 2–3 options
- Blocked agent seeks the user (approach avatar if player pos is available; else rendezvous at lounge)
- Unblock updates tasks and agent resumes

**DoD**
- Flow 7 complete

### M8 — Cozy polish pass
**Deliverables**
- Micro-animations (idle typing, coffee)
- Better highlight visuals
- SFX (optional)
- Performance pass: instancing, reduce draw calls
- Cosmetic progression: trophies / decor anchors + optional dynamic desk clutter (purely visual)

**DoD**
- “Feels alive” and stays stable under load

---

## 19) Repo layout (suggested)

```
/apps
  /client-web
  /server-world
/packages
  /shared-types
  /simulation (director + FSM + pathfinding)
/assets
  /scenes
  /props
  /agents
/docs
  PLAN.md
  PROTOCOL.md
  SCENE_MANIFESTS.md
```

---

## 20) Immediate next actions (to start building now)

1) **Write the scene manifest format** and commit the first `cozy_office_v0.scene.json`.
2) Implement client:
   - scene loader (shell + props)
   - raycast hover/click
   - highlight manager
3) Implement server protocol stubs:
   - connect, subscribe, heartbeat
   - send a fake “kickoff event” that moves agents to meeting table
4) Add UI overlay:
   - event feed (even if dummy)
   - agent inspector (even if dummy)

This gets you a playable demo fast and gives you the foundation for OpenClaw integration.

---

## Appendix A — “Must-have” POI interactions (v0 quick reference)

- Inbox/Reception:
  - submit request
  - list requests
- Task Board:
  - view tasks
  - drag assign
  - auto-assign
- Meeting Table:
  - focus camera
  - show meeting summary
- Delivery Shelf:
  - open deliverables
  - approve/revise/split
- Lounge:
  - decision prompts appear here (or agent approaches user)

---

## Appendix B — Safety rails for complexity (keep sandbox readable)
- One “active project” in focus; older projects go to backlog.
- WIP limit: max 3 tasks in Doing.
- Only BD agent is chat-enabled.
- Meetings/events are bounded in time (start/end), always logged.

---
