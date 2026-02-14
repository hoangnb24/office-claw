# POI_AND_INTERACTIONS.md — Interaction Map (World ↔ UI ↔ Server)
_Last updated: 2026-02-14

This document defines **what the user can click**, **what UI opens**, **what commands are sent**, and **what server events/snapshots should follow**.

> Goal: every “thing” in the office has a clear semantic purpose: it either helps create work, see work, unblock work, or accept work.

---

## 1) Interaction vocabulary (v0)

### 1.1 World targets
- **POI**: semantic area (Inbox, Task Board, Meeting Table, etc.)
- **Agent**: NPC character (BD, Research, Engineer)
- **Artifact object**: a physical deliverable (folder/paper stack) placed at Delivery Shelf/Inbox
- **Task sticky**: a UI object on the Task Board (drag to assign)

### 1.2 UI panels
- `InboxPanel`
- `TaskBoardPanel`
- `AgentInspectorPanel`
- `EventFeedPanel`
- `ArtifactViewerPanel`
- `DecisionPanel`
- `ChatPanel` (BD-only)

### 1.3 Client-side actions (local)
These require no server command:
- Hover highlight
- POI Focus Mode (camera frame + highlight a clicked POI/agent)
- Walk-to-interact (auto-path the avatar into `interaction_radius_m` before triggering POI actions)
- Camera focus / follow agent
- Open/close UI panels
- Select agent/task in UI

---

## 2) POIs (v0) — behaviors and mappings

### 2.1 Reception / Inbox — `poi_reception_inbox`
**Purpose:** sandbox entry point; requests arrive here as cards/folders.

**World interactions**
- Click POI → (if out of range, walk there) enter POI Focus Mode + open `InboxPanel` (anchored to inbox)
- Button in panel → “Submit Request”

**Commands**
- `submit_request` (required)

**Expected server events**
- `request_submitted`
- `request_accepted`
- `kickoff_started` (if auto-kickoff enabled)
- `tasks_created` (after kickoff planning)

**World feedback**
- Request card appears on inbox tray
- BD agent turns/walks toward inbox (optional)
- Event feed logs the request

---

### 2.2 Task Board — `poi_task_board`
**Purpose:** canonical task visibility + assignments.

**World interactions**
- Click POI → (if out of range, walk there) enter POI Focus Mode + open `TaskBoardPanel` (anchored to board)
- Drag task sticky → agent (assignment)

**Commands**
- `assign_task`
- `auto_assign` (optional)
- `reprioritize_task` (optional v0.2)

**Expected server events**
- `task_assigned`
- `task_started`
- `task_blocked` (if blocked)
- `task_done`

**World feedback**
- Task sticky moves column (To Do → Doing → Done)
- Agent state label updates
- Event feed logs assignment/start
- Optional: show 3–6 “preview stickies” physically on the board (click opens task details in overlay)

---

### 2.3 Meeting Table — `poi_meeting_table`
**Purpose:** ceremonies (kickoff/brainstorm/review) are visible and diegetic.

**World interactions**
- Click POI → (if out of range, walk there) focus camera (v0)
- Optional debug action: “Start Kickoff” (dev-only)

**Commands**
- None required for v0 (director triggers meetings automatically)
- Optional: `start_kickoff` (dev-only)

**Expected server events**
- `kickoff_started`
- `kickoff_finished`
- `review_requested`

**World feedback**
- Agents path to meeting table (via `agent_goal`)
- Agents enter `InMeeting` state/animation
- Meeting summary appears in event feed

---

### 2.4 Research Desk — `poi_research_desk_1`
**Purpose:** where “research-type” tasks visibly happen.

**World interactions**
- Click POI → (if out of range, walk there) open `AgentInspectorPanel` filtered to research tasks (optional convenience)

**Commands**
- None (work is server-driven)

**Expected server events**
- `task_started` (research task)
- `artifact_created` / `artifact_delivered` (report)
- `task_done`

**World feedback**
- Research agent walks here and “works”
- Optional: while working, render a tiny in-world “progress preview” (from `event.task_progress`) near the desk/agent
- Report artifact later appears on delivery shelf

---

### 2.5 Dev Desk / Terminal — `poi_dev_desk_1`
**Purpose:** where build/coding tasks visibly happen.

**World interactions**
- Click POI → (if out of range, walk there) open inspector focused to engineering agent/task (optional)

**Commands**
- None (work is server-driven)

**Expected server events**
- `task_started` (build)
- `artifact_created` / `artifact_delivered` (patch/draft)
- `task_done`

**World feedback**
- Engineer agent walks here and “works”
- Optional: while coding, render a tiny in-world “terminal preview” (from `event.task_progress`) near the desk/agent

---

### 2.6 Delivery Shelf — `poi_delivery_shelf`
**Purpose:** physical place where deliverables appear and are reviewed.

**World interactions**
- Click POI → (if out of range, walk there) open deliverables list (anchored to shelf)
- Click a specific artifact object → open `ArtifactViewerPanel`

**Commands**
- `approve_artifact`
- `request_changes`
- `split_into_tasks`

**Expected server events**
- `review_approved` OR `review_changes_requested`
- `task_done` (when approval completes)
- `tasks_created` (when split or changes create new tasks)

**World feedback**
- Artifact objects spawn here (paper stack/folder)
- Approve plays “stamp” animation (recommended v0 “magic moment”)
- New version artifacts appear as v2, v3…

---

### 2.7 Lounge / Decision Corner — `poi_lounge`
**Purpose:** blockers are visible and resolved here (or agent approaches user).

**World interactions**
- Click POI → (if out of range, walk there) open `DecisionPanel` if any open decisions exist
- If agent approaches user: click agent → open decision UI

**Commands**
- `resolve_decision`

**Expected server events**
- `decision_requested`
- `decision_resolved`
- `task_started` (resumed) or `tasks_created` (new subtasks)

**World feedback**
- Blocked icon above agent
- Agent seeks the user by default:
  - If server has player position (via optional `command.player_pos`), agent approaches the player avatar
  - Otherwise agent rendezvous/waits near lounge
- After decision, agent returns to station

---

## 3) Agent interactions (clicking agents)

### 3.1 Click agent → `AgentInspectorPanel`
**Shows**
- role/name
- current state (Idle/Walking/Working/InMeeting/Blocked)
- current task + definition of done
- blockers and “needs from user”

**Actions**
- “Ask BD about this” (opens chat; no direct chat with other agents)
- “Focus camera”
- If blocked: open decision panel

No required server commands to open inspector; state comes from `snapshot` + `agent_goal`.

---

## 4) Task interactions (drag-and-drop)

### 4.1 Drag task sticky → agent
**Client**
- Optimistically shows assignment intent (ghost highlight)
- Sends `assign_task` command on drop

**Server**
- Validates: task exists, agent exists, agent available, task status allows assignment
- Responds `ack` or `error`
- Emits `event.task_assigned`
- Emits `agent_goal` to send agent to required POI
- Updates `snapshot`

---

## 5) Artifact interactions (review loop)

### 5.1 Open artifact viewer
- Client opens viewer and requests content if not cached.
- Optional server command: `fetch_artifact_content` (only if content is not embedded by URL/ref in snapshot).

### 5.2 Approve
- Client sends `approve_artifact`
- Server emits `review_approved`, marks task(s) done, updates snapshot

### 5.3 Request changes
- Client sends `request_changes` with instructions
- Server emits `review_changes_requested`
- Server creates new revision task(s) and assigns (or queues)
- Snapshot reflects new tasks and artifact versions

### 5.4 Split into tasks
- Client sends `split_into_tasks`
- Server emits `tasks_created` and updates snapshot

---

## 6) Event feed → world highlighting
When the user clicks an event entry:
- Client highlights `poi_id` (if present) using scene manifest `highlight_nodes`
- Client highlights `participants` agents (glow outline)
- Optional camera pan to POI anchor

No server commands required.

---

## 7) Flow checklists (acceptance criteria)

### Flow 3 (Submit request)
- Inbox click triggers walk-to-interact, then opens request form
- `submit_request` returns `ack`
- Request card appears at inbox
- Event feed contains `request_submitted`

### Flow 5 (Assign tasks)
- Task board shows 3–6 tasks
- Drag to agent sends `assign_task` and results in `task_assigned`
- Agent walks to correct POI via goal/path

### Flow 7 (Blocked)
- Agent shows blocked icon and decision appears
- User resolves decision via `resolve_decision`
- Agent resumes working and event feed logs resolution

### Flow 8 (Review & approve)
- Artifact object appears on delivery shelf
- User opens viewer and approves or requests changes
- Approval includes a visible in-world “stamp” interaction beat
- Task goes to Done on approval; new tasks appear on changes/split

---
