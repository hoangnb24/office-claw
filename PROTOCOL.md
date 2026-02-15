# PROTOCOL.md — Realtime World Protocol (Client ↔ World Server)
_Last updated: 2026-02-14

This document specifies the realtime protocol between the **Web Client** (Three.js + UI overlay) and the **World Server** (Director + simulation). It is designed around:
- **Semantic events** (human-readable “truth timeline”)
- **Goals/paths** for smooth movement
- **Low-rate snapshots** for authoritative correction
- **Commands** for user intent (requests, assignments, approvals)

> Principle: **Server is the director, client is renderer + input + interpolation.**

---

## 1) Transport and session

### 1.1 Transport
- WebSocket (WSS in production).
- Messages are JSON objects (UTF-8).

### 1.2 Connection lifecycle
1. Client connects to `/ws/world`
2. Client sends `hello`
3. Server replies `hello_ack` with session + protocol version
4. Client sends `subscribe` (which channels it wants)
5. Server starts streaming according to subscription

### 1.3 Heartbeats
- Client sends `ping` every 15s
- Server replies `pong`
- Either side may close if no heartbeat for 45s

---

## 2) Message envelope (required fields)

All messages MUST include:

```json
{
  "type": "hello | hello_ack | subscribe | event | snapshot | agent_goal | agent_stream | chat | command | ack | error | ping | pong",
  "id": "unique_message_id",
  "ts": 1739500000,
  "v": 1,
  "payload": {}
}
```

**Field notes**
- `id`: UUID/ULID recommended; used for de-duplication.
- `ts`: Unix seconds or milliseconds (choose one and keep consistent).
- `v`: protocol version (start at 1).
- Runtime schema contract: `contracts/schemas/protocol-envelope.schema.json`.

---

## 3) Entity identifiers and coordinates

### 3.1 IDs
- Canonical source of truth: `DOMAIN_MODEL.md` and `contracts/schemas/identifiers.schema.json`.
- `agent_id`: `^agent_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$` (example: `agent_research_1`)
- `project_id`: `^proj_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$` (example: `proj_abc`)
- `task_id`: `^task_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$` (example: `task_1`)
- `artifact_id`: `^art_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$` (example: `art_1`)
- `decision_id`: `^dec_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$` (example: `dec_1`)
- `poi_id`: `^poi_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$` (example: `poi_meeting_table`)

### 3.2 Coordinates
- World coordinates are 3D: `[x, y, z]`
- Use `y=0` for floor plane.
- If you use a grid for navigation:
  - convert grid cell to world point using `grid.origin` and `cell_size` (defined in scene manifest).

---

## 4) Channels and subscriptions

### 4.1 Subscribe message (client → server)
```json
{
  "type": "subscribe",
  "id": "sub_001",
  "ts": 1739500000,
  "v": 1,
  "payload": {
    "scene_id": "cozy_office_v0",
    "channels": {
      "events": true,
      "snapshots": true,
      "goals": true,
      "chat": true,
      "agent_stream": false
    }
  }
}
```

### 4.2 Server behavior
- Server should start by sending an initial `snapshot` (full state) after subscription.
- If the client subscribes to `goals`, server sends `agent_goal` on intent changes.
- If the client subscribes to `agent_stream`, server may send OpenClaw stream deltas (`type="agent_stream"`).

---

## 5) Message types (server → client)

### 5.1 `event` (semantic, append-only)
Events are the “truth timeline” for UX (event feed + highlights).

```json
{
  "type": "event",
  "id": "evt_123",
  "ts": 1739500010,
  "v": 1,
  "payload": {
    "name": "kickoff_started",
    "project_id": "proj_abc",
    "poi_id": "poi_meeting_table",
    "participants": ["agent_bd", "agent_research_1", "agent_eng_1"],
    "meta": {
      "title": "Kickoff meeting",
      "summary": "We will research competitors and draft copy."
    }
  }
}
```

**Recommended event names**
- `office_created`
- `request_submitted`
- `request_accepted`
- `kickoff_started`
- `kickoff_finished`
- `tasks_created`
- `task_assigned`
- `task_started`
- `task_progress` (optional; safe progress previews for UI/3D “thinking” feedback)
- `task_blocked`
- `decision_requested`
- `decision_resolved`
- `artifact_created`
- `artifact_delivered`
- `review_requested`
- `review_approved`
- `review_changes_requested`
- `task_done`

**`task_progress` (optional)**
Use this to make LLM latency feel alive without streaming hidden reasoning.
- Keep it **low-rate** (e.g., 1–2 updates/sec max per active task).
- Keep it **safe + short** (no chain-of-thought; use user-facing step labels / short previews).

Example:
```json
{
  "type": "event",
  "id": "evt_124",
  "ts": 1739500011,
  "v": 1,
  "payload": {
    "name": "task_progress",
    "project_id": "proj_abc",
    "task_id": "task_2",
    "agent_id": "agent_eng_1",
    "kind": "code",
    "percent": 45,
    "preview_text": "Generating API handlers (routes + validators)…"
  }
}
```

**Event ordering**
- Events must be delivered in-order per connection.
- Include a monotonically increasing `seq` if you want robust replay:

```json
"payload": {
  "seq": 42,
  "name": "artifact_delivered"
}
```

### 5.2 `agent_goal` (semantic movement + path)
Sent whenever the director changes an agent’s intent.

```json
{
  "type": "agent_goal",
  "id": "goal_777",
  "ts": 1739500015,
  "v": 1,
  "payload": {
    "agent_id": "agent_research_1",
    "goal": {
      "kind": "go_to_poi",
      "poi_id": "poi_research_desk_1"
    },
    "path": [[1.0,0,-0.2],[1.2,0,-0.2],[1.4,0,0.0]],
    "speed_mps": 1.2,
    "arrival_radius": 0.15
  }
}
```

**Client behavior**
- Client animates agent along the path at `speed_mps`.
- Client switches animation based on `goal.kind` + state (walking/working).
- Server may send a new `agent_goal` that overrides the prior one at any time.

### 5.3 `snapshot` (authoritative correction)
Snapshots are low-rate authoritative state. Start at 2–5 Hz (tunable).

```json
{
  "type": "snapshot",
  "id": "snap_888",
  "ts": 1739500020,
  "v": 1,
  "payload": {
    "scene_id": "cozy_office_v0",
    "agents": [
      {"agent_id":"agent_research_1","pos":[1.2,0,-0.2],"state":"WalkingToPOI","task_id":"task_1"},
      {"agent_id":"agent_eng_1","pos":[-0.3,0,1.7],"state":"WorkingAtPOI","task_id":"task_2"}
    ],
    "projects": [
      {"project_id":"proj_abc","status":"executing","title":"Landing page plan"}
    ],
    "tasks": [
      {"task_id":"task_1","project_id":"proj_abc","title":"Research competitors","status":"in_progress","assignee":"agent_research_1"},
      {"task_id":"task_2","project_id":"proj_abc","title":"Draft copy","status":"planned","assignee":"agent_eng_1"}
    ],
    "artifacts": [
      {"artifact_id":"art_1","project_id":"proj_abc","type":"report","version":1,"status":"delivered","poi_id":"poi_delivery_shelf"}
    ],
    "decisions": [
      {"decision_id":"dec_1","project_id":"proj_abc","status":"open","prompt":"Who is the target audience?","options":["Tech users","General consumers"]}
    ],
    "office_decor": [
      {"decor_id":"trophy_espresso_machine","anchor_id":"trophy_shelf_01","unlocked_by_project_id":"proj_abc"}
    ]
  }
}
```

**Correction rules**
- If client-rendered position deviates, client should “ease” to snapshot position (no hard teleport unless error is large).
- Snapshots can be delta-compressed later; v0 can be full state.

### 5.4 `chat` (BD-only conversational surface)
```json
{
  "type": "chat",
  "id": "chat_201",
  "ts": 1739500030,
  "v": 1,
  "payload": {
    "thread_id": "bd_main",
    "from": "agent_bd",
    "to": "user",
    "text": "I broke your request into 4 tasks. Want me to auto-assign them?",
    "suggested_actions": [
      {"action":"auto_assign","label":"Auto-assign tasks"},
      {"action":"open_task_board","label":"Review tasks"},
      {"action":"clarify","label":"Answer a question"}
    ]
  }
}
```

### 5.5 `agent_stream` (optional): token/thought streaming from OpenClaw
Use this when you want to **visualize OpenClaw latency** (typing, “thinking” VFX, holographic terminals) instead of hiding it behind a single looping animation.

**Server → Client**

```json
{
  "type": "agent_stream",
  "id": "msg_901",
  "ts": 1739500123,
  "v": 1,
  "payload": {
    "stream_id": "oc_run_abc123",
    "agent_id": "agent_eng",
    "project_id": "proj_123",
    "task_id": "task_7",
    "kind": "token | thought | code",
    "seq": 17,
    "delta": "...partial text...",
    "done": false
  }
}
```

**Notes**
- `stream_id` lets the client group deltas into one visual effect.
- `seq` is monotonically increasing per `stream_id` (helps reordering).
- `kind` is purely a rendering hint (you can render `code` as terminal text, `thought` as floating nodes).
- When `done=true`, the client should finalize/flush that stream.

---

## 6) Message types (client → server)

### 6.1 `hello`
```json
{
  "type": "hello",
  "id": "hello_001",
  "ts": 1739500000,
  "v": 1,
  "payload": {
    "client": {
      "name": "officeclaw-web",
      "build": "dev",
      "platform": "web"
    },
    "supported_versions": [1]
  }
}
```

`supported_versions` is optional for v1 clients and enables deterministic version negotiation when multiple protocol majors are deployed.

### 6.2 `command`
Commands represent user intent. Server validates and replies with `ack` (success) or `error`.

Canonical command payload/response contracts live in `contracts/schemas/commands.schema.json`.

#### 6.2.1 Submit a request
```json
{
  "type": "command",
  "id": "cmd_001",
  "ts": 1739500100,
  "v": 1,
  "payload": {
    "name": "submit_request",
    "data": {
      "text": "Create a landing page plan + copy + design brief",
      "constraints": {"tone":"friendly","length":"short"},
      "attachments": []
    }
  }
}
```

#### 6.2.2 Assign a task to an agent (drag-to-agent)
```json
{
  "type": "command",
  "id": "cmd_002",
  "ts": 1739500110,
  "v": 1,
  "payload": {
    "name": "assign_task",
    "data": {
      "task_id": "task_1",
      "agent_id": "agent_research_1"
    }
  }
}
```

#### 6.2.3 Auto-assign tasks
```json
{
  "type": "command",
  "id": "cmd_003",
  "ts": 1739500120,
  "v": 1,
  "payload": {
    "name": "auto_assign",
    "data": {
      "project_id": "proj_abc"
    }
  }
}
```

#### 6.2.4 Resolve a decision (unblock)
```json
{
  "type": "command",
  "id": "cmd_004",
  "ts": 1739500130,
  "v": 1,
  "payload": {
    "name": "resolve_decision",
    "data": {
      "decision_id": "dec_1",
      "choice": "Tech users",
      "note": "Primary: developers; secondary: product teams."
    }
  }
}
```

#### 6.2.5 Review actions (approve / request changes / split)
```json
{
  "type": "command",
  "id": "cmd_005",
  "ts": 1739500140,
  "v": 1,
  "payload": {
    "name": "approve_artifact",
    "data": {
      "artifact_id": "art_1"
    }
  }
}
```

```json
{
  "type": "command",
  "id": "cmd_006",
  "ts": 1739500150,
  "v": 1,
  "payload": {
    "name": "request_changes",
    "data": {
      "artifact_id": "art_1",
      "instructions": "Shorten the headline and add 2 more CTA options."
    }
  }
}
```

```json
{
  "type": "command",
  "id": "cmd_007",
  "ts": 1739500160,
  "v": 1,
  "payload": {
    "name": "split_into_tasks",
    "data": {
      "artifact_id": "art_1",
      "task_titles": ["Draft 3 headline variants", "Create 2 CTA variants"]
    }
  }
}
```

#### 6.2.6 (Optional v0) Client player movement
If you want server authority over player position, add:
- `move_player_to` (goal + path) OR
- send periodic `player_pos`

This is optional for v0; many teams keep player movement client-only initially.

If you want “needy agents” to physically approach the player when blocked, the server needs a rough player position.
You can send it as a lightweight optional command (server may ignore if unused):

```json
{
  "type": "command",
  "id": "cmd_008",
  "ts": 1739500165,
  "v": 1,
  "payload": {
    "name": "player_pos",
    "data": {
      "pos": [0.1, 0, 0.2],
      "facing": [0, 0, 1]
    }
  }
}
```

---

## 7) Server responses: `ack` and `error`

### 7.1 `ack`
```json
{
  "type": "ack",
  "id": "ack_001",
  "ts": 1739500101,
  "v": 1,
  "payload": {
    "in_reply_to": "cmd_001",
    "status": "ok"
  }
}
```

### 7.2 `error`
```json
{
  "type": "error",
  "id": "err_001",
  "ts": 1739500101,
  "v": 1,
  "payload": {
    "in_reply_to": "cmd_001",
    "code": "VALIDATION_FAILED",
    "message": "Request text is required."
  }
}
```

**Common error codes**
- `VALIDATION_FAILED`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `NOT_ALLOWED`
- `INTERNAL`

For deterministic command/error handling policy and UI-safe recovery mappings, see `COMMAND_TAXONOMY.md`.

---

## 8) Flow sequencing (canonical examples)

### Flow: Submit request → kickoff → tasks created
1. Client: `command.submit_request`
2. Server: `ack`
3. Server: `event.request_submitted`
4. Server: `event.request_accepted`
5. Server: `event.kickoff_started` + `agent_goal` for participants to go to meeting
6. Server: `event.tasks_created`
7. Server: `event.kickoff_finished`
8. Server: `snapshot` reflecting new project/tasks

### Flow: Deliverable ready → review → approve
1. Server: `event.artifact_delivered` (poi=delivery shelf)
2. Server: `snapshot` includes artifact at `poi_delivery_shelf`
3. Client: user opens viewer (local UI)
4. Client: `command.approve_artifact`
5. Server: `ack`
6. Server: `event.review_approved` + `event.task_done`
7. Server: `snapshot` reflects done state

---

## 9) Reconnect/Resync Extension (v1-compatible)

This section defines how clients recover from disconnects without forcing a cold restart every time.

### 9.1 Client reconnect policy
- Client attempts reconnect with bounded exponential backoff:
  - attempt 1: 1s
  - attempt 2: 2s
  - attempt 3: 4s
  - attempt 4+: cap at 8s + jitter (0–500ms)
- While disconnected, client enters a stale-state UX mode:
  - freeze new commands
  - keep last rendered state visible
  - show reconnect status + retry count
- After reconnect success, client sends `hello` followed by `subscribe` as normal.

### 9.2 Resume cursor in `hello` (optional fields)
Clients that support replay add a `resume` block:

```json
{
  "type": "hello",
  "id": "hello_reconnect_001",
  "ts": 1739501000,
  "v": 1,
  "payload": {
    "client": {
      "name": "officeclaw-web",
      "build": "dev",
      "platform": "web"
    },
    "resume": {
      "last_seq": 4242,
      "last_snapshot_id": "snap_888",
      "scene_id": "cozy_office_v0"
    }
  }
}
```

`resume.last_seq` is the last fully-processed server sequence number (events/goals/snapshots stream).

### 9.3 `hello_ack` resume outcomes
Server returns resume disposition in `hello_ack.payload.resume`:

```json
{
  "type": "hello_ack",
  "id": "hello_ack_901",
  "ts": 1739501001,
  "v": 1,
  "payload": {
    "session_id": "sess_abc",
    "protocol_version": 1,
    "resume": {
      "status": "resumed | snapshot_required | unsupported",
      "reason": "CURSOR_OK | CURSOR_STALE | CURSOR_UNKNOWN | REPLAY_UNAVAILABLE | SERVER_RESTARTED",
      "replay_from_seq": 4243
    }
  }
}
```

### 9.4 Server responsibilities
- If `status=resumed`:
  - replay missed messages from `replay_from_seq`
  - preserve ordering guarantees
  - finish with a fresh `snapshot` checkpoint
- If `status=snapshot_required`:
  - skip replay
  - send full authoritative `snapshot` immediately after `subscribe`
- If `status=unsupported`:
  - proceed as baseline v1 without replay
  - client must treat it as cold reconnect

### 9.5 Failure modes and deterministic handling
- `CURSOR_STALE`: cursor older than replay retention window -> send full snapshot.
- `CURSOR_UNKNOWN`: sequence not recognized -> send full snapshot.
- `REPLAY_UNAVAILABLE`: replay store degraded/unavailable -> send full snapshot.
- `SERVER_RESTARTED`: in-memory cursor history lost -> send full snapshot.

The server should emit an informational `event` for observability when fallback occurs:
- `resync_fallback_snapshot` with `reason` and optional `last_seq`.

### 9.6 Replay boundaries and snapshot fallback rules
- Replay is best-effort and bounded by retention policy.
- Snapshot is always the final authority after any replay burst.
- Client must discard speculative local state if a snapshot disagrees.
- If replay stream is interrupted again, client restarts reconnect from latest acked `last_seq`.

### 9.7 Rollout and compatibility strategy
- All new `resume` fields are optional and additive under protocol `v:1`.
- Legacy clients omit `resume` and continue to work unchanged.
- Servers may gate replay behind a feature flag while still supporting snapshot fallback.
- No existing message type is removed or redefined by this extension.

---

## 10) Versioning and compatibility
- `v` in every envelope is the protocol major version.
- Canonical policy reference: `docs/protocol-compatibility-policy.md`.

### 10.1 Change classes
- Additive-compatible change (same `v`):
  - optional fields added to existing payloads
  - new event names added without changing old semantics
  - new command names added (unknown commands remain deterministic `error`)
- Breaking change (requires `v+1`):
  - required field added to existing message type
  - meaning/type of existing field changed incompatibly
  - message ordering guarantees changed
  - message type removed or renamed

### 10.2 Handshake behavior for incompatible versions
- Client sends `hello.payload.supported_versions` (optional, recommended) with descending preference.
- Server chooses highest mutually supported version and returns it in `hello_ack.payload.protocol_version`.
- If no overlap exists:
  - server returns `error` with:
    - `code`: `PROTOCOL_VERSION_UNSUPPORTED`
    - `message`: human-readable upgrade guidance
    - `payload.supported_versions`: server-supported list
  - server closes the socket with a protocol-incompatible reason.

### 10.3 Compatibility matrix rules
- Client older than server (same major):
  - server must preserve old required fields and tolerate missing new optional fields.
- Client newer than server (same major):
  - client must ignore unknown fields and avoid sending feature-gated commands unless negotiated.
- Different major versions:
  - negotiation via `supported_versions` if possible, otherwise fail fast with deterministic error.

---

## 11) Security and abuse considerations (v0)
- All commands must be validated server-side.
- Rate limit commands (especially chat and submit_request).
- Sanitize any text displayed in UI.
- Avoid sending full world state to BD chat LLM; send a short summary/context only.

---
