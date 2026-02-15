import {
  cellToWorld as navCellToWorld,
  findPathOnGrid,
  serializeNavGrid,
  worldToCell as navWorldToCell
} from "./nav/pathfinding.mjs";
import { loadSceneNavGridRuntime } from "./nav/manifestNav.mjs";
import { adaptOpenClawStructuredOutput } from "./openclaw/outputAdapters.mjs";

const DEFAULT_SCENE_ID = "cozy_office_v0";
const PLAYER_AGENT_ID = "agent_bd";
const CEREMONY_OVERRIDE_TICKS = Object.freeze({
  kickoff: 2,
  review: 2
});
const AGENT_FSM_STATE = Object.freeze({
  Idle: "IdleAtHome",
  Walking: "WalkingToPOI",
  Working: "WorkingAtPOI",
  InMeeting: "InMeeting",
  Blocked: "BlockedWaiting",
  SeekingUser: "SeekingUserDecision"
});
const AGENT_FSM_ALLOWED_TRANSITIONS = Object.freeze({
  [AGENT_FSM_STATE.Idle]: new Set([
    AGENT_FSM_STATE.Walking,
    AGENT_FSM_STATE.InMeeting,
    AGENT_FSM_STATE.Blocked,
    AGENT_FSM_STATE.SeekingUser
  ]),
  [AGENT_FSM_STATE.Walking]: new Set([
    AGENT_FSM_STATE.Idle,
    AGENT_FSM_STATE.Working,
    AGENT_FSM_STATE.InMeeting,
    AGENT_FSM_STATE.Blocked,
    AGENT_FSM_STATE.SeekingUser
  ]),
  [AGENT_FSM_STATE.Working]: new Set([
    AGENT_FSM_STATE.Idle,
    AGENT_FSM_STATE.Walking,
    AGENT_FSM_STATE.InMeeting,
    AGENT_FSM_STATE.Blocked,
    AGENT_FSM_STATE.SeekingUser
  ]),
  [AGENT_FSM_STATE.InMeeting]: new Set([
    AGENT_FSM_STATE.Idle,
    AGENT_FSM_STATE.Walking,
    AGENT_FSM_STATE.Working,
    AGENT_FSM_STATE.Blocked,
    AGENT_FSM_STATE.SeekingUser
  ]),
  [AGENT_FSM_STATE.Blocked]: new Set([
    AGENT_FSM_STATE.Idle,
    AGENT_FSM_STATE.Walking,
    AGENT_FSM_STATE.Working,
    AGENT_FSM_STATE.InMeeting,
    AGENT_FSM_STATE.SeekingUser
  ]),
  [AGENT_FSM_STATE.SeekingUser]: new Set([
    AGENT_FSM_STATE.Idle,
    AGENT_FSM_STATE.Walking,
    AGENT_FSM_STATE.Working,
    AGENT_FSM_STATE.InMeeting,
    AGENT_FSM_STATE.Blocked
  ])
});
const ARTIFACT_STATUS = Object.freeze({
  Created: "created",
  Delivered: "delivered",
  InReview: "in_review",
  Approved: "approved",
  ChangesRequested: "changes_requested",
  Superseded: "superseded",
  Archived: "archived"
});
const ARTIFACT_ALLOWED_TRANSITIONS = Object.freeze({
  [ARTIFACT_STATUS.Created]: new Set([ARTIFACT_STATUS.Delivered, ARTIFACT_STATUS.Superseded]),
  [ARTIFACT_STATUS.Delivered]: new Set([
    ARTIFACT_STATUS.InReview,
    ARTIFACT_STATUS.Approved,
    ARTIFACT_STATUS.ChangesRequested,
    ARTIFACT_STATUS.Superseded
  ]),
  [ARTIFACT_STATUS.InReview]: new Set([
    ARTIFACT_STATUS.Approved,
    ARTIFACT_STATUS.ChangesRequested,
    ARTIFACT_STATUS.Superseded
  ]),
  [ARTIFACT_STATUS.ChangesRequested]: new Set([
    ARTIFACT_STATUS.InReview,
    ARTIFACT_STATUS.Superseded
  ]),
  [ARTIFACT_STATUS.Approved]: new Set([ARTIFACT_STATUS.Archived, ARTIFACT_STATUS.Superseded]),
  [ARTIFACT_STATUS.Superseded]: new Set([ARTIFACT_STATUS.Archived]),
  [ARTIFACT_STATUS.Archived]: new Set()
});
const ARTIFACT_VERSION_ID_RE = /^(art_[a-z][a-z0-9]*(?:_[a-z0-9]+)*?)(?:_v([1-9][0-9]*))?$/;
const OPENCLAW_RUN_STATUS = Object.freeze({
  Started: "started",
  Running: "running",
  Completed: "completed",
  Failed: "failed",
  Cancelled: "cancelled"
});
const OPENCLAW_RUN_ALLOWED_TRANSITIONS = Object.freeze({
  [OPENCLAW_RUN_STATUS.Started]: new Set([
    OPENCLAW_RUN_STATUS.Running,
    OPENCLAW_RUN_STATUS.Completed,
    OPENCLAW_RUN_STATUS.Failed,
    OPENCLAW_RUN_STATUS.Cancelled
  ]),
  [OPENCLAW_RUN_STATUS.Running]: new Set([
    OPENCLAW_RUN_STATUS.Completed,
    OPENCLAW_RUN_STATUS.Failed,
    OPENCLAW_RUN_STATUS.Cancelled
  ]),
  [OPENCLAW_RUN_STATUS.Completed]: new Set(),
  [OPENCLAW_RUN_STATUS.Failed]: new Set(),
  [OPENCLAW_RUN_STATUS.Cancelled]: new Set()
});
const PLAYER_POS_CACHE_FRESHNESS_TICKS = 6;
const SEEK_USER_STEP_DISTANCE_PER_TICK = 0.35;
const SEEK_USER_FALLBACK_POI_ID = "poi_lounge";
const DEFAULT_SEEK_USER_FALLBACK_BY_SCENE = Object.freeze({
  cozy_office_v0: Object.freeze([0.4, 0, -0.1])
});
const DEFAULT_DECOR_ANCHORS_BY_SCENE = Object.freeze({
  cozy_office_v0: Object.freeze([
    Object.freeze({ group_id: "trophy_shelf", anchor_id: "trophy_shelf_01" }),
    Object.freeze({ group_id: "trophy_shelf", anchor_id: "trophy_shelf_02" })
  ])
});
const DECOR_UNLOCK_BY_OUTCOME = Object.freeze({
  artifact_approved: Object.freeze({
    decor_prefix: "trophy_artifact_delivery",
    preferred_anchor_group: "trophy_shelf"
  }),
  decision_resolved: Object.freeze({
    decor_prefix: "plaque_decision_resolution",
    preferred_anchor_group: "trophy_shelf"
  }),
  completed: Object.freeze({
    decor_prefix: "plant_completed_project",
    preferred_anchor_group: "trophy_shelf"
  })
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortById(values, idKey) {
  return [...values].sort((a, b) => String(a[idKey]).localeCompare(String(b[idKey])));
}

function zeroVec3() {
  return [0, 0, 0];
}

function sanitizeIdToken(value, fallback = "id") {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const collapsed = normalized.replace(/^_+|_+$/g, "").replace(/_+/g, "_");
  return collapsed || fallback;
}

function stableHash(text) {
  const source = typeof text === "string" ? text : String(text);
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function normalizeDecorAnchors(rawAnchors) {
  if (!Array.isArray(rawAnchors)) {
    return [];
  }
  const seen = new Set();
  const normalized = [];
  for (const raw of rawAnchors) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const anchorId =
      typeof raw.anchor_id === "string" && raw.anchor_id.trim().length > 0 ? raw.anchor_id.trim() : null;
    if (!anchorId || seen.has(anchorId)) {
      continue;
    }
    seen.add(anchorId);
    normalized.push({
      group_id:
        typeof raw.group_id === "string" && raw.group_id.trim().length > 0 ? raw.group_id.trim() : "default",
      anchor_id: anchorId
    });
  }
  normalized.sort((left, right) => left.anchor_id.localeCompare(right.anchor_id));
  return normalized;
}

function normalizePoiAnchors(rawPoiAnchors) {
  if (!Array.isArray(rawPoiAnchors)) {
    return [];
  }
  const seen = new Set();
  const normalized = [];
  for (const raw of rawPoiAnchors) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const poiId = typeof raw.poi_id === "string" && raw.poi_id.trim().length > 0 ? raw.poi_id.trim() : null;
    const anchorId =
      typeof raw.anchor_id === "string" && raw.anchor_id.trim().length > 0 ? raw.anchor_id.trim() : null;
    const pos = Array.isArray(raw.pos) && raw.pos.length === 3 ? raw.pos : null;
    if (!poiId || !anchorId || !pos || !pos.every((token) => Number.isFinite(token))) {
      continue;
    }
    const key = `${poiId}:${anchorId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({
      poi_id: poiId,
      anchor_id: anchorId,
      pos: [pos[0], pos[1], pos[2]]
    });
  }
  normalized.sort((left, right) => {
    if (left.poi_id === right.poi_id) {
      return left.anchor_id.localeCompare(right.anchor_id);
    }
    return left.poi_id.localeCompare(right.poi_id);
  });
  return normalized;
}

function seededEntities() {
  return {
    projects: [
      {
        project_id: "proj_boot",
        title: "Bootstrap OfficeClaw",
        status: "executing"
      },
      {
        project_id: "proj_abc",
        title: "Landing Page Plan",
        status: "executing"
      }
    ],
    agents: [
      {
        agent_id: "agent_bd",
        state: "IdleAtHome",
        pos: [0.4, 0, -0.1]
      },
      {
        agent_id: "agent_research_1",
        state: "WorkingAtPOI",
        pos: [1.2, 0, -0.2],
        task_id: "task_research"
      },
      {
        agent_id: "agent_eng_1",
        state: "IdleAtHome",
        pos: [-0.3, 0, 1.7]
      }
    ],
    tasks: [
      {
        task_id: "task_copy",
        project_id: "proj_abc",
        title: "Draft copy",
        status: "planned"
      },
      {
        task_id: "task_research",
        project_id: "proj_abc",
        title: "Research competitors",
        status: "in_progress",
        assignee: "agent_research_1"
      }
    ],
    artifacts: [
      {
        artifact_id: "art_research_report_v1",
        project_id: "proj_abc",
        type: "report",
        status: "delivered",
        version: 1,
        task_id: "task_research",
        poi_id: "poi_delivery_shelf"
      }
    ],
    decisions: [
      {
        decision_id: "dec_audience",
        project_id: "proj_abc",
        status: "open",
        prompt: "Who is the target audience?",
        options: ["Tech users", "General consumers"]
      }
    ],
    officeDecor: [
      {
        decor_id: "plant_bootstrap_1",
        project_id: "proj_boot",
        anchor_id: "trophy_shelf_01",
        unlocked_by_project_id: "proj_boot",
        outcome: "completed"
      }
    ]
  };
}

function createMaps(seed) {
  const projects = new Map(seed.projects.map((item) => [item.project_id, clone(item)]));
  const agents = new Map(seed.agents.map((item) => [item.agent_id, clone(item)]));
  const tasks = new Map(seed.tasks.map((item) => [item.task_id, clone(item)]));
  const artifacts = new Map(seed.artifacts.map((item) => [item.artifact_id, clone(item)]));
  const decisions = new Map(seed.decisions.map((item) => [item.decision_id, clone(item)]));
  const officeDecor = new Map(seed.officeDecor.map((item) => [item.decor_id, clone(item)]));
  return {
    projects,
    agents,
    tasks,
    artifacts,
    decisions,
    officeDecor
  };
}

export function validateSnapshotCoherence(snapshot) {
  const issues = [];
  const projectIds = new Set(snapshot.projects.map((project) => project.project_id));
  const taskIds = new Set(snapshot.tasks.map((task) => task.task_id));
  const agentIds = new Set(snapshot.agents.map((agent) => agent.agent_id));

  for (const task of snapshot.tasks) {
    if (!projectIds.has(task.project_id)) {
      issues.push(`task ${task.task_id} references missing project ${task.project_id}`);
    }
    if (task.assignee && !agentIds.has(task.assignee)) {
      issues.push(`task ${task.task_id} assignee missing agent ${task.assignee}`);
    }
  }

  for (const agent of snapshot.agents) {
    if (agent.task_id && !taskIds.has(agent.task_id)) {
      issues.push(`agent ${agent.agent_id} references missing task ${agent.task_id}`);
    }
  }

  for (const artifact of snapshot.artifacts) {
    if (!projectIds.has(artifact.project_id)) {
      issues.push(`artifact ${artifact.artifact_id} references missing project ${artifact.project_id}`);
    }
    if (artifact.task_id && !taskIds.has(artifact.task_id)) {
      issues.push(`artifact ${artifact.artifact_id} references missing task ${artifact.task_id}`);
    }
  }

  for (const decision of snapshot.decisions) {
    if (!projectIds.has(decision.project_id)) {
      issues.push(`decision ${decision.decision_id} references missing project ${decision.project_id}`);
    }
    if (decision.task_id && !taskIds.has(decision.task_id)) {
      issues.push(`decision ${decision.decision_id} references missing task ${decision.task_id}`);
    }
  }

  const seenDecorIds = new Set();
  const decorRows = Array.isArray(snapshot.office_decor) ? snapshot.office_decor : [];
  for (const decor of decorRows) {
    if (!decor || typeof decor !== "object") {
      issues.push("office_decor row must be an object");
      continue;
    }
    if (typeof decor.decor_id !== "string" || decor.decor_id.trim().length === 0) {
      issues.push("office_decor row missing decor_id");
    } else if (seenDecorIds.has(decor.decor_id)) {
      issues.push(`office_decor duplicate decor_id ${decor.decor_id}`);
    } else {
      seenDecorIds.add(decor.decor_id);
    }
    if (typeof decor.anchor_id !== "string" || decor.anchor_id.trim().length === 0) {
      issues.push(`office_decor ${decor.decor_id || "<unknown>"} missing anchor_id`);
    }
    if (typeof decor.project_id === "string" && !projectIds.has(decor.project_id)) {
      issues.push(`office_decor ${decor.decor_id || "<unknown>"} references missing project ${decor.project_id}`);
    }
    if (
      typeof decor.unlocked_by_project_id === "string" &&
      !projectIds.has(decor.unlocked_by_project_id)
    ) {
      issues.push(
        `office_decor ${decor.decor_id || "<unknown>"} references missing unlocked_by_project_id ${decor.unlocked_by_project_id}`
      );
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
}

export function createWorldStateStore({
  sceneId = DEFAULT_SCENE_ID,
  sceneNavLoader = loadSceneNavGridRuntime
} = {}) {
  const seed = seededEntities();
  const state = createMaps(seed);
  let activeSceneId =
    typeof sceneId === "string" && sceneId.trim().length > 0 ? sceneId.trim() : DEFAULT_SCENE_ID;
  let splitTaskCounter = 0;
  let requestCounter = 0;
  let rerunTaskCounter = 0;
  const taskRuntime = new Map();
  const agentRuntime = new Map();
  const decisionRuntime = new Map();
  const openClawRunsByTask = new Map();
  const taskDecisionBlocker = new Map();
  const taskBlockedPriorStatus = new Map();
  const pausedProjects = new Set();
  const navGridByScene = new Map();
  const navLoadMetaByScene = new Map();
  const decorAnchorsByScene = new Map();
  const poiAnchorsByScene = new Map();
  let lastMovePlan = null;
  let generatedDecisionCounter = 0;
  let decisionTransitionSeq = 0;
  let openClawRunCounter = 0;
  let openClawRunTransitionSeq = 0;
  let worldTickCount = 0;
  let openClawArtifactCounter = 0;
  let openClawDecisionCounter = 0;
  let openClawFollowUpTaskCounter = 0;
  let seekUserFallbackPos = zeroVec3();
  let seekUserFallbackSource = "seeded_player_pos";
  let seekUserFallbackPoiId = null;
  const playerPosCache = {
    pos: null,
    facing: null,
    updated_tick: null,
    freshness_window_ticks: PLAYER_POS_CACHE_FRESHNESS_TICKS
  };

  for (const task of state.tasks.values()) {
    taskRuntime.set(task.task_id, {
      ticks_in_progress: task.status === "in_progress" ? 1 : 0,
      progress_bucket: task.status === "in_progress" ? 1 : 0,
      last_transition:
        task.status === "in_progress" ? "started" : task.status === "done" ? "done" : "planned"
    });
  }

  for (const agent of state.agents.values()) {
    agentRuntime.set(agent.agent_id, {
      base_state: agent.state,
      override_stack: [],
      transition_count: 0,
      invariant_violations: 0,
      last_transition: "seed"
    });
  }

  for (const decision of state.decisions.values()) {
    decisionRuntime.set(decision.decision_id, {
      transition_count: 1,
      blocked_task_ids: new Set(
        typeof decision.task_id === "string" ? [decision.task_id] : []
      ),
      history: [
        {
          seq: ++decisionTransitionSeq,
          status: decision.status,
          reason: "seed",
          choice: null
        }
      ]
    });
    if (typeof decision.task_id === "string") {
      taskDecisionBlocker.set(decision.task_id, decision.decision_id);
    }
  }

  function ensureTaskRuntime(taskId) {
    if (!taskRuntime.has(taskId)) {
      taskRuntime.set(taskId, {
        ticks_in_progress: 0,
        progress_bucket: 0,
        last_transition: "planned"
      });
    }
    return taskRuntime.get(taskId);
  }

  function ensureAgent(agentId) {
    if (!state.agents.has(agentId)) {
      state.agents.set(agentId, {
        agent_id: agentId,
        state: AGENT_FSM_STATE.Idle,
        pos: zeroVec3()
      });
    }
    if (!agentRuntime.has(agentId)) {
      agentRuntime.set(agentId, {
        base_state: AGENT_FSM_STATE.Idle,
        override_stack: [],
        transition_count: 0,
        invariant_violations: 0,
        last_transition: "spawn"
      });
    }
    return state.agents.get(agentId);
  }

  function isVec3(value) {
    return Array.isArray(value) && value.length === 3 && value.every((n) => Number.isFinite(n));
  }

  function cloneVec3(value) {
    return [value[0], value[1], value[2]];
  }

  const seededPlayer = state.agents.get(PLAYER_AGENT_ID);
  if (seededPlayer && isVec3(seededPlayer.pos)) {
    seekUserFallbackPos = cloneVec3(seededPlayer.pos);
  }

  function distanceXZ(a, b) {
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    return Math.sqrt(dx * dx + dz * dz);
  }

  function stepTowardTarget(from, to, maxStepDistance) {
    const total = distanceXZ(from, to);
    if (!Number.isFinite(total) || total <= 1e-6 || maxStepDistance <= 0) {
      return cloneVec3(from);
    }
    const t = Math.min(1, maxStepDistance / total);
    return [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t
    ];
  }

  function playerPosCacheStatus() {
    if (!playerPosCache.pos || !isVec3(playerPosCache.pos) || !Number.isInteger(playerPosCache.updated_tick)) {
      return "unavailable";
    }
    const ageTicks = Math.max(0, worldTickCount - playerPosCache.updated_tick);
    return ageTicks <= playerPosCache.freshness_window_ticks ? "fresh" : "stale";
  }

  function resolveSeekUserTargetPos() {
    const status = playerPosCacheStatus();
    if (status === "fresh" && playerPosCache.pos && isVec3(playerPosCache.pos)) {
      return {
        pos: cloneVec3(playerPosCache.pos),
        source: "player_pos_cache_fresh"
      };
    }
    return {
      pos: cloneVec3(seekUserFallbackPos),
      source: status === "stale" ? "fallback_stale_cache" : "fallback_unavailable_cache"
    };
  }

  function applySeekUserApproach(agent) {
    if (!agent || typeof agent !== "object") {
      return "seek_user_no_agent";
    }
    if (!isVec3(agent.pos)) {
      agent.pos = cloneVec3(seekUserFallbackPos);
    }
    const target = resolveSeekUserTargetPos();
    agent.pos = stepTowardTarget(agent.pos, target.pos, SEEK_USER_STEP_DISTANCE_PER_TICK);
    if (target.source === "player_pos_cache_fresh") {
      return "seek_user_player_pos_fresh";
    }
    if (target.source === "fallback_stale_cache") {
      return "seek_user_fallback_stale";
    }
    return "seek_user_fallback_unavailable";
  }

  function serializePlayerPosCache() {
    const status = playerPosCacheStatus();
    const ageTicks =
      Number.isInteger(playerPosCache.updated_tick) && playerPosCache.updated_tick !== null
        ? Math.max(0, worldTickCount - playerPosCache.updated_tick)
        : null;
    return {
      status,
      pos: playerPosCache.pos && isVec3(playerPosCache.pos) ? cloneVec3(playerPosCache.pos) : null,
      facing: playerPosCache.facing && isVec3(playerPosCache.facing) ? cloneVec3(playerPosCache.facing) : null,
      updated_tick: Number.isInteger(playerPosCache.updated_tick) ? playerPosCache.updated_tick : null,
      age_ticks: ageTicks,
      freshness_window_ticks: playerPosCache.freshness_window_ticks,
      fallback_pos: cloneVec3(seekUserFallbackPos),
      fallback_source: seekUserFallbackSource,
      fallback_poi_id: seekUserFallbackPoiId
    };
  }

  function getDefaultDecorAnchors(sceneIdToRead = activeSceneId) {
    const sceneKey =
      typeof sceneIdToRead === "string" && sceneIdToRead.trim().length > 0 ? sceneIdToRead.trim() : DEFAULT_SCENE_ID;
    return normalizeDecorAnchors(DEFAULT_DECOR_ANCHORS_BY_SCENE[sceneKey] || []);
  }

  function getSceneDecorAnchors(sceneIdToRead = activeSceneId) {
    const sceneKey =
      typeof sceneIdToRead === "string" && sceneIdToRead.trim().length > 0 ? sceneIdToRead.trim() : DEFAULT_SCENE_ID;
    if (decorAnchorsByScene.has(sceneKey)) {
      return decorAnchorsByScene.get(sceneKey);
    }
    const fallback = getDefaultDecorAnchors(sceneKey);
    decorAnchorsByScene.set(sceneKey, fallback);
    return fallback;
  }

  function getDefaultSeekUserFallbackPos(sceneIdToRead = activeSceneId) {
    const sceneKey =
      typeof sceneIdToRead === "string" && sceneIdToRead.trim().length > 0 ? sceneIdToRead.trim() : DEFAULT_SCENE_ID;
    const configured = DEFAULT_SEEK_USER_FALLBACK_BY_SCENE[sceneKey];
    if (isVec3(configured)) {
      return cloneVec3(configured);
    }
    if (seededPlayer && isVec3(seededPlayer.pos)) {
      return cloneVec3(seededPlayer.pos);
    }
    return zeroVec3();
  }

  function getScenePoiAnchors(sceneIdToRead = activeSceneId) {
    const sceneKey =
      typeof sceneIdToRead === "string" && sceneIdToRead.trim().length > 0 ? sceneIdToRead.trim() : DEFAULT_SCENE_ID;
    if (poiAnchorsByScene.has(sceneKey)) {
      return poiAnchorsByScene.get(sceneKey);
    }
    poiAnchorsByScene.set(sceneKey, []);
    return poiAnchorsByScene.get(sceneKey);
  }

  function refreshSeekUserFallbackTarget(sceneIdToRead = activeSceneId) {
    const sceneKey =
      typeof sceneIdToRead === "string" && sceneIdToRead.trim().length > 0 ? sceneIdToRead.trim() : DEFAULT_SCENE_ID;
    const loungeAnchor = getScenePoiAnchors(sceneKey).find((anchor) => anchor.poi_id === SEEK_USER_FALLBACK_POI_ID);
    if (loungeAnchor && isVec3(loungeAnchor.pos)) {
      seekUserFallbackPos = cloneVec3(loungeAnchor.pos);
      seekUserFallbackSource = "scene_poi_anchor";
      seekUserFallbackPoiId = SEEK_USER_FALLBACK_POI_ID;
      return;
    }
    seekUserFallbackPos = getDefaultSeekUserFallbackPos(sceneKey);
    seekUserFallbackSource = "scene_default";
    seekUserFallbackPoiId = null;
  }

  function loadNavGridForScene(sceneIdToLoad = activeSceneId) {
    const key =
      typeof sceneIdToLoad === "string" && sceneIdToLoad.trim().length > 0
        ? sceneIdToLoad.trim()
        : DEFAULT_SCENE_ID;
    if (navGridByScene.has(key)) {
      refreshSeekUserFallbackTarget(key);
      return navGridByScene.get(key);
    }

    try {
      const loaded = sceneNavLoader(key);
      if (!loaded || !loaded.grid) {
        throw new Error(`sceneNavLoader returned no grid for scene ${key}`);
      }
      const normalizedDecorAnchors = normalizeDecorAnchors(loaded.decorAnchors);
      if (normalizedDecorAnchors.length > 0) {
        decorAnchorsByScene.set(key, normalizedDecorAnchors);
      } else if (!decorAnchorsByScene.has(key)) {
        decorAnchorsByScene.set(key, getDefaultDecorAnchors(key));
      }
      const normalizedPoiAnchors = normalizePoiAnchors(loaded.poiAnchors);
      poiAnchorsByScene.set(key, normalizedPoiAnchors);
      navGridByScene.set(key, loaded.grid);
      navLoadMetaByScene.set(key, {
        ok: true,
        scene_id: loaded.sceneId || key,
        manifest_path: loaded.manifestPath || null,
        error: null
      });
      refreshSeekUserFallbackTarget(key);
      return loaded.grid;
    } catch (error) {
      refreshSeekUserFallbackTarget(key);
      navLoadMetaByScene.set(key, {
        ok: false,
        scene_id: key,
        manifest_path: null,
        error: error.message
      });
      return null;
    }
  }

  function getActiveNavGrid() {
    return loadNavGridForScene(activeSceneId);
  }

  function occupiedWorldPositions(excludeAgentId) {
    const positions = [];
    for (const agent of state.agents.values()) {
      if (agent.agent_id === excludeAgentId || !isVec3(agent.pos)) {
        continue;
      }
      positions.push(cloneVec3(agent.pos));
    }
    return positions;
  }

  function getPlayerAgent() {
    return ensureAgent(PLAYER_AGENT_ID);
  }

  function ensureAgentRuntime(agentId) {
    ensureAgent(agentId);
    return agentRuntime.get(agentId);
  }

  function isKnownAgentState(state) {
    return Object.values(AGENT_FSM_STATE).includes(state);
  }

  function canTransitionAgentState(fromState, toState) {
    if (fromState === toState) {
      return true;
    }
    const allowed = AGENT_FSM_ALLOWED_TRANSITIONS[fromState];
    return Boolean(allowed && allowed.has(toState));
  }

  function effectiveAgentState(runtime) {
    if (runtime.override_stack.length > 0) {
      return runtime.override_stack[runtime.override_stack.length - 1].state;
    }
    return runtime.base_state;
  }

  function syncAgentEffectiveState(agent) {
    const runtime = ensureAgentRuntime(agent.agent_id);
    agent.state = effectiveAgentState(runtime);
  }

  function transitionAgentBaseState(agent, nextState, reason) {
    const runtime = ensureAgentRuntime(agent.agent_id);
    const targetState = isKnownAgentState(nextState) ? nextState : AGENT_FSM_STATE.Blocked;
    if (!canTransitionAgentState(runtime.base_state, targetState)) {
      runtime.invariant_violations += 1;
      runtime.last_transition = `invalid:${runtime.base_state}->${targetState}`;
      return false;
    }
    if (runtime.base_state !== targetState) {
      runtime.transition_count += 1;
    }
    runtime.base_state = targetState;
    runtime.last_transition = reason;
    syncAgentEffectiveState(agent);
    return true;
  }

  function pushAgentOverride(agent, kind, state, ticks, reason) {
    const runtime = ensureAgentRuntime(agent.agent_id);
    runtime.override_stack = runtime.override_stack.filter((entry) => entry.kind !== kind);
    runtime.override_stack.push({
      kind,
      state,
      remaining_ticks: Math.max(1, Math.floor(ticks) || 1)
    });
    runtime.last_transition = `override:${kind}:${reason}`;
    syncAgentEffectiveState(agent);
  }

  function applyOverrideTickDecay() {
    for (const agent of state.agents.values()) {
      const runtime = ensureAgentRuntime(agent.agent_id);
      if (runtime.override_stack.length === 0) {
        continue;
      }
      for (const entry of runtime.override_stack) {
        entry.remaining_ticks -= 1;
      }
      runtime.override_stack = runtime.override_stack.filter((entry) => entry.remaining_ticks > 0);
      syncAgentEffectiveState(agent);
    }
  }

  function participantsForProject(projectId) {
    const ids = new Set();
    for (const task of state.tasks.values()) {
      if (task.project_id === projectId && typeof task.assignee === "string") {
        ids.add(task.assignee);
      }
    }
    if (ids.size === 0) {
      for (const agent of state.agents.values()) {
        ids.add(agent.agent_id);
      }
    }
    return [...ids].sort((a, b) => a.localeCompare(b));
  }

  function applyCeremonyOverride(projectId, kind) {
    const ticks = CEREMONY_OVERRIDE_TICKS[kind] || 1;
    const participants = participantsForProject(projectId);
    for (const agentId of participants) {
      const agent = ensureAgent(agentId);
      pushAgentOverride(agent, kind, AGENT_FSM_STATE.InMeeting, ticks, projectId);
    }
  }

  function targetStateForTask(task) {
    if (!task || task.status === "done" || task.status === "cancelled") {
      return AGENT_FSM_STATE.Idle;
    }
    if (task.status === "blocked") {
      return AGENT_FSM_STATE.Blocked;
    }
    if (task.status === "planned") {
      return AGENT_FSM_STATE.Walking;
    }
    if (task.status === "in_progress") {
      return AGENT_FSM_STATE.Working;
    }
    return AGENT_FSM_STATE.Idle;
  }

  function targetStateForAssignedTask(task) {
    if (task?.status === "blocked" && taskDecisionBlocker.has(task.task_id)) {
      return AGENT_FSM_STATE.SeekingUser;
    }
    return targetStateForTask(task);
  }

  function serializeAgentFsm(agentId) {
    const agent = ensureAgent(agentId);
    const runtime = ensureAgentRuntime(agentId);
    return {
      agent_id: agentId,
      base_state: runtime.base_state,
      effective_state: effectiveAgentState(runtime),
      override_stack: runtime.override_stack.map((entry) => ({
        kind: entry.kind,
        state: entry.state,
        remaining_ticks: entry.remaining_ticks
      })),
      transition_count: runtime.transition_count,
      invariant_violations: runtime.invariant_violations,
      last_transition: runtime.last_transition
    };
  }

  function serializeDecisionLifecycle(decisionId) {
    const decision = state.decisions.get(decisionId);
    if (!decision) {
      return null;
    }
    const runtime = ensureDecisionRuntime(decisionId);
    const activeBlocked = [];
    for (const [taskId, blockerId] of taskDecisionBlocker.entries()) {
      if (blockerId === decisionId) {
        activeBlocked.push(taskId);
      }
    }
    return {
      decision_id: decision.decision_id,
      project_id: decision.project_id,
      task_id: decision.task_id || null,
      status: decision.status,
      choice: decision.choice || null,
      blocked_task_ids: [...runtime.blocked_task_ids].sort((a, b) => a.localeCompare(b)),
      active_blocked_task_ids: activeBlocked.sort((a, b) => a.localeCompare(b)),
      transition_count: runtime.transition_count,
      history: runtime.history.map((entry) => ({ ...entry }))
    };
  }

  function ensureDecisionRuntime(decisionId) {
    if (!decisionRuntime.has(decisionId)) {
      decisionRuntime.set(decisionId, {
        transition_count: 0,
        blocked_task_ids: new Set(),
        history: []
      });
    }
    return decisionRuntime.get(decisionId);
  }

  function recordDecisionTransition(decisionId, status, { reason = "update", choice = null } = {}) {
    const runtime = ensureDecisionRuntime(decisionId);
    runtime.transition_count += 1;
    runtime.history.push({
      seq: ++decisionTransitionSeq,
      status,
      reason,
      choice
    });
  }

  function openDecisionForTask(taskId) {
    for (const decision of state.decisions.values()) {
      if (decision.status === "open" && decision.task_id === taskId) {
        return decision;
      }
    }
    return null;
  }

  function createDecisionForTask(task, instructions) {
    generatedDecisionCounter += 1;
    const decisionId = `dec_req_${String(generatedDecisionCounter).padStart(3, "0")}`;
    const decision = {
      decision_id: decisionId,
      project_id: task.project_id,
      task_id: task.task_id,
      status: "open",
      prompt: instructions.slice(0, 240),
      options: ["Revise and resubmit", "Clarify requirements", "Escalate to user"]
    };
    state.decisions.set(decisionId, decision);
    ensureDecisionRuntime(decisionId).blocked_task_ids.add(task.task_id);
    taskDecisionBlocker.set(task.task_id, decisionId);
    recordDecisionTransition(decisionId, "open", { reason: "request_changes" });
    return decision;
  }

  function blockTaskForDecision(task, decisionId) {
    if (!task || task.status === "done" || task.status === "cancelled") {
      return;
    }
    if (!taskBlockedPriorStatus.has(task.task_id)) {
      taskBlockedPriorStatus.set(task.task_id, task.status);
    }
    task.status = "blocked";
    ensureTaskRuntime(task.task_id).last_transition = "blocked";
    interruptOpenClawRun(task.task_id, "decision_requested");
    taskDecisionBlocker.set(task.task_id, decisionId);
    ensureDecisionRuntime(decisionId).blocked_task_ids.add(task.task_id);
    if (task.assignee) {
      const agent = ensureAgent(task.assignee);
      agent.task_id = task.task_id;
      transitionAgentBaseState(agent, AGENT_FSM_STATE.SeekingUser, "decision_requested");
    }
    refreshProjectStatus(task.project_id);
  }

  function unblockTasksForDecision(decisionId) {
    const runtime = ensureDecisionRuntime(decisionId);
    const blockedTaskIds = new Set(runtime.blocked_task_ids);
    for (const [taskId, blockerId] of taskDecisionBlocker.entries()) {
      if (blockerId === decisionId) {
        blockedTaskIds.add(taskId);
      }
    }

    const resumedTaskIds = [];
    for (const taskId of blockedTaskIds) {
      const task = state.tasks.get(taskId);
      if (!task || task.status !== "blocked") {
        taskDecisionBlocker.delete(taskId);
        taskBlockedPriorStatus.delete(taskId);
        continue;
      }

      const priorStatus = taskBlockedPriorStatus.get(taskId);
      if (priorStatus === "planned") {
        task.status = "planned";
      } else if (task.assignee) {
        task.status = "in_progress";
      } else {
        task.status = "planned";
      }

      if (task.assignee) {
        const agent = ensureAgent(task.assignee);
        transitionAgentBaseState(agent, targetStateForTask(task), "decision_resolved");
      }
      ensureTaskRuntime(task.task_id).last_transition = "unblocked";
      refreshProjectStatus(task.project_id);
      taskDecisionBlocker.delete(taskId);
      taskBlockedPriorStatus.delete(taskId);
      resumedTaskIds.push(taskId);
    }

    runtime.blocked_task_ids = new Set();
    return resumedTaskIds;
  }

  function canTransitionOpenClawRunStatus(fromStatus, toStatus) {
    if (fromStatus === toStatus) {
      return true;
    }
    return OPENCLAW_RUN_ALLOWED_TRANSITIONS[fromStatus]?.has(toStatus) === true;
  }

  function recordOpenClawRunTransition(run, status, reason) {
    run.status = status;
    run.updated_tick = worldTickCount;
    run.history.push({
      seq: ++openClawRunTransitionSeq,
      status,
      reason
    });
  }

  function activeOpenClawRun(taskId) {
    const run = openClawRunsByTask.get(taskId);
    if (!run) {
      return null;
    }
    if ([OPENCLAW_RUN_STATUS.Completed, OPENCLAW_RUN_STATUS.Failed, OPENCLAW_RUN_STATUS.Cancelled].includes(run.status)) {
      return null;
    }
    return run;
  }

  function startOpenClawRun(task, agent) {
    if (!task || !agent || task.status !== "in_progress") {
      return null;
    }
    const existing = activeOpenClawRun(task.task_id);
    if (existing) {
      return existing;
    }
    openClawRunCounter += 1;
    const run = {
      run_id: `run_oc_${String(openClawRunCounter).padStart(4, "0")}`,
      project_id: task.project_id,
      task_id: task.task_id,
      agent_id: agent.agent_id,
      status: OPENCLAW_RUN_STATUS.Started,
      started_tick: worldTickCount,
      updated_tick: worldTickCount,
      history: []
    };
    recordOpenClawRunTransition(run, OPENCLAW_RUN_STATUS.Started, "working_at_poi");
    openClawRunsByTask.set(task.task_id, run);
    return run;
  }

  function interruptOpenClawRun(taskId, reason) {
    const run = activeOpenClawRun(taskId);
    if (!run) {
      return;
    }
    if (!canTransitionOpenClawRunStatus(run.status, OPENCLAW_RUN_STATUS.Cancelled)) {
      return;
    }
    recordOpenClawRunTransition(run, OPENCLAW_RUN_STATUS.Cancelled, reason);
  }

  function applyOpenClawRunStatusEvent(payload) {
    if (!payload || typeof payload !== "object") {
      return;
    }
    if (typeof payload.status !== "string") {
      return;
    }
    const normalizedStatus = payload.status.trim().toLowerCase();
    if (!Object.values(OPENCLAW_RUN_STATUS).includes(normalizedStatus)) {
      return;
    }

    let run = null;
    if (typeof payload.task_id === "string") {
      run = openClawRunsByTask.get(payload.task_id) || null;
    }
    if (!run && typeof payload.run_id === "string") {
      for (const candidate of openClawRunsByTask.values()) {
        if (candidate.run_id === payload.run_id) {
          run = candidate;
          break;
        }
      }
    }
    if (!run) {
      return;
    }

    if (!canTransitionOpenClawRunStatus(run.status, normalizedStatus)) {
      return;
    }
    recordOpenClawRunTransition(run, normalizedStatus, "status_callback");

    const task = state.tasks.get(run.task_id);
    if (!task) {
      return;
    }

    if (normalizedStatus === OPENCLAW_RUN_STATUS.Running) {
      ensureTaskRuntime(task.task_id).last_transition = "openclaw_running";
      return;
    }

    if (normalizedStatus === OPENCLAW_RUN_STATUS.Completed) {
      completeTask(task.task_id);
      return;
    }

    if (normalizedStatus === OPENCLAW_RUN_STATUS.Failed) {
      if (task.status === "in_progress") {
        task.status = "blocked";
        ensureTaskRuntime(task.task_id).last_transition = "openclaw_failed";
        if (task.assignee) {
          const agent = ensureAgent(task.assignee);
          transitionAgentBaseState(agent, AGENT_FSM_STATE.Blocked, "openclaw_failed");
        }
      }
      refreshProjectStatus(task.project_id);
    }
  }

  function nextOpenClawArtifactId() {
    openClawArtifactCounter += 1;
    return `art_oc_${String(openClawArtifactCounter).padStart(4, "0")}`;
  }

  function nextOpenClawDecisionId() {
    openClawDecisionCounter += 1;
    return `dec_oc_${String(openClawDecisionCounter).padStart(4, "0")}`;
  }

  function nextOpenClawFollowUpTaskId() {
    openClawFollowUpTaskCounter += 1;
    return `task_oc_${String(openClawFollowUpTaskCounter).padStart(4, "0")}`;
  }

  function applyMalformedOpenClawOutput(task, reason) {
    const run = activeOpenClawRun(task.task_id);
    if (run && canTransitionOpenClawRunStatus(run.status, OPENCLAW_RUN_STATUS.Failed)) {
      recordOpenClawRunTransition(run, OPENCLAW_RUN_STATUS.Failed, "malformed_output");
    }
    const decision =
      openDecisionForTask(task.task_id) ||
      createDecisionForTask(task, `OpenClaw output malformed: ${String(reason || "unknown")}`);
    blockTaskForDecision(task, decision.decision_id);
  }

  function applyOpenClawOutputEvent(payload) {
    const taskId = typeof payload?.task_id === "string" ? payload.task_id : null;
    if (!taskId) {
      return;
    }
    const task = state.tasks.get(taskId);
    if (!task || task.status === "done" || task.status === "cancelled") {
      return;
    }

    const adapted = adaptOpenClawStructuredOutput(payload.output);
    if (!adapted.ok) {
      applyMalformedOpenClawOutput(task, adapted.message);
      return;
    }

    const { artifacts, decisions, follow_up_tasks: followUpTasks } = adapted.value;
    const run = activeOpenClawRun(task.task_id);
    if (run && canTransitionOpenClawRunStatus(run.status, OPENCLAW_RUN_STATUS.Completed)) {
      recordOpenClawRunTransition(run, OPENCLAW_RUN_STATUS.Completed, "output_applied");
    }

    for (const artifact of artifacts) {
      const artifactRecord = {
        artifact_id: nextOpenClawArtifactId(),
        project_id: task.project_id,
        type: artifact.type || "note",
        status: ARTIFACT_STATUS.Delivered,
        version: 1,
        task_id: task.task_id
      };
      if (artifact.poi_id) {
        artifactRecord.poi_id = artifact.poi_id;
      }
      state.artifacts.set(artifactRecord.artifact_id, artifactRecord);
    }

    const createdDecisionIds = [];
    for (const decision of decisions) {
      const decisionId = nextOpenClawDecisionId();
      state.decisions.set(decisionId, {
        decision_id: decisionId,
        project_id: task.project_id,
        task_id: task.task_id,
        status: "open",
        prompt: decision.prompt,
        options: decision.options
      });
      ensureDecisionRuntime(decisionId);
      recordDecisionTransition(decisionId, "open", {
        reason: "openclaw_output"
      });
      createdDecisionIds.push(decisionId);
    }

    for (const followUpTask of followUpTasks) {
      const followUpTaskId = nextOpenClawFollowUpTaskId();
      state.tasks.set(followUpTaskId, {
        task_id: followUpTaskId,
        project_id: task.project_id,
        title: normalizeTaskTitle(followUpTask.title, openClawFollowUpTaskCounter),
        status: "planned"
      });
      ensureTaskRuntime(followUpTaskId);
    }

    if (createdDecisionIds.length > 0) {
      blockTaskForDecision(task, createdDecisionIds[0]);
      return;
    }

    completeTask(task.task_id);
  }

  function serializeOpenClawRun(run) {
    return {
      run_id: run.run_id,
      project_id: run.project_id,
      task_id: run.task_id,
      agent_id: run.agent_id,
      status: run.status,
      started_tick: run.started_tick,
      updated_tick: run.updated_tick,
      history: run.history.map((entry) => ({ ...entry }))
    };
  }

  function buildSnapshot(sceneIdOverride = activeSceneId) {
    return {
      scene_id: sceneIdOverride,
      agents: clone(sortById(state.agents.values(), "agent_id")),
      projects: clone(sortById(state.projects.values(), "project_id")),
      tasks: clone(sortById(state.tasks.values(), "task_id")),
      artifacts: clone(sortById(state.artifacts.values(), "artifact_id")),
      decisions: clone(sortById(state.decisions.values(), "decision_id")),
      office_decor: clone(sortById(state.officeDecor.values(), "decor_id"))
    };
  }

  function ok() {
    return { ok: true };
  }

  function fail(code, message) {
    return { ok: false, code, message };
  }

  function taskLifecycleId(requestSuffix, index) {
    return `task_req_${requestSuffix}_${String(index + 1).padStart(2, "0")}`;
  }

  function normalizeTaskTitle(fragment, fallbackIndex) {
    const text = typeof fragment === "string" ? fragment.trim() : "";
    if (!text) {
      return `Task ${fallbackIndex + 1}`;
    }
    const normalized = text.replace(/\s+/g, " ").replace(/[.!?]$/, "");
    return normalized.length <= 80 ? normalized : `${normalized.slice(0, 77)}...`;
  }

  function decomposeRequestText(text) {
    const fragments = text
      .split(/[.\n;]+/g)
      .map((fragment) => normalizeTaskTitle(fragment, 0))
      .filter((fragment) => fragment && fragment !== "Task 1");
    const seedFragments =
      fragments.length >= 3
        ? fragments.slice(0, 3)
        : [
            fragments[0] || "Clarify request scope",
            fragments[1] || "Produce initial plan",
            fragments[2] || "Prepare deliverable draft"
          ];
    return seedFragments.map((title, index) => normalizeTaskTitle(title, index));
  }

  function allProjectTasks(projectId) {
    return sortById(state.tasks.values(), "task_id").filter((task) => task.project_id === projectId);
  }

  function allProjectArtifacts(projectId) {
    return sortById(state.artifacts.values(), "artifact_id").filter((artifact) => artifact.project_id === projectId);
  }

  function allProjectDecisions(projectId) {
    return sortById(state.decisions.values(), "decision_id").filter((decision) => decision.project_id === projectId);
  }

  function projectOutcomeForDecor(projectId) {
    const artifacts = allProjectArtifacts(projectId);
    if (artifacts.some((artifact) => artifact.status === ARTIFACT_STATUS.Approved)) {
      return "artifact_approved";
    }
    const decisions = allProjectDecisions(projectId);
    if (decisions.some((decision) => decision.status === "resolved")) {
      return "decision_resolved";
    }
    return "completed";
  }

  function existingDecorForProject(projectId) {
    for (const decor of state.officeDecor.values()) {
      if (decor.unlocked_by_project_id === projectId || decor.project_id === projectId) {
        return decor;
      }
    }
    return null;
  }

  function nextDecorId(baseId) {
    if (!state.officeDecor.has(baseId)) {
      return baseId;
    }
    let counter = 2;
    let candidate = `${baseId}_${counter}`;
    while (state.officeDecor.has(candidate)) {
      counter += 1;
      candidate = `${baseId}_${counter}`;
    }
    return candidate;
  }

  function chooseDecorAnchorId(projectId, preferredGroup) {
    const anchors = getSceneDecorAnchors(activeSceneId);
    if (anchors.length === 0) {
      return null;
    }
    const groupAnchors =
      typeof preferredGroup === "string" && preferredGroup.trim().length > 0
        ? anchors.filter((anchor) => anchor.group_id === preferredGroup)
        : [];
    const candidates = groupAnchors.length > 0 ? groupAnchors : anchors;
    const occupied = new Set(
      [...state.officeDecor.values()]
        .map((item) => item.anchor_id)
        .filter((anchorId) => typeof anchorId === "string" && anchorId.trim().length > 0)
    );
    const start = stableHash(`${projectId}:${preferredGroup || "default"}`) % candidates.length;
    for (let offset = 0; offset < candidates.length; offset += 1) {
      const anchor = candidates[(start + offset) % candidates.length];
      if (!occupied.has(anchor.anchor_id)) {
        return anchor.anchor_id;
      }
    }
    return candidates[start].anchor_id;
  }

  function ensureProjectOutcomeDecor(projectId) {
    const project = state.projects.get(projectId);
    if (!project || project.status !== "completed") {
      return;
    }
    if (existingDecorForProject(projectId)) {
      return;
    }

    const outcome = projectOutcomeForDecor(projectId);
    const config = DECOR_UNLOCK_BY_OUTCOME[outcome] || DECOR_UNLOCK_BY_OUTCOME.completed;
    const anchorId = chooseDecorAnchorId(projectId, config.preferred_anchor_group);
    if (!anchorId) {
      return;
    }
    const baseDecorId = `${config.decor_prefix}_${sanitizeIdToken(projectId, "project")}`;
    const decorId = nextDecorId(baseDecorId);
    state.officeDecor.set(decorId, {
      decor_id: decorId,
      project_id: projectId,
      anchor_id: anchorId,
      unlocked_by_project_id: projectId,
      outcome
    });
  }

  function refreshProjectStatus(projectId) {
    const project = state.projects.get(projectId);
    if (!project) {
      return;
    }
    const priorStatus = project.status;
    const tasks = allProjectTasks(projectId);
    let nextStatus = "planning";
    if (tasks.length === 0) {
      nextStatus = "planning";
    } else if (tasks.every((task) => task.status === "done" || task.status === "cancelled")) {
      nextStatus = "completed";
    } else if (pausedProjects.has(projectId)) {
      nextStatus = "blocked";
    } else if (tasks.some((task) => task.status === "in_progress")) {
      nextStatus = "executing";
    } else if (tasks.some((task) => task.status === "blocked")) {
      nextStatus = "blocked";
    }
    project.status = nextStatus;
    if (nextStatus === "completed" && priorStatus !== "completed") {
      ensureProjectOutcomeDecor(projectId);
    }
  }

  function unassignAgentTask(agentId) {
    const agent = state.agents.get(agentId);
    if (!agent || !agent.task_id) {
      return;
    }
    const priorTask = state.tasks.get(agent.task_id);
    if (priorTask && priorTask.assignee === agentId && priorTask.status !== "done" && priorTask.status !== "cancelled") {
      interruptOpenClawRun(priorTask.task_id, "unassigned");
      priorTask.assignee = undefined;
      if (priorTask.status !== "blocked") {
        priorTask.status = "planned";
      }
      ensureTaskRuntime(priorTask.task_id).last_transition = "unassigned";
      refreshProjectStatus(priorTask.project_id);
    }
    delete agent.task_id;
    transitionAgentBaseState(agent, AGENT_FSM_STATE.Idle, "unassign");
  }

  function assignTaskToAgent(task, agentId, { preserveStatus = false, reason = "assigned" } = {}) {
    const agent = ensureAgent(agentId);
    if (task.assignee && task.assignee !== agentId) {
      const priorAssignee = state.agents.get(task.assignee);
      if (priorAssignee && priorAssignee.task_id === task.task_id) {
        delete priorAssignee.task_id;
        transitionAgentBaseState(priorAssignee, AGENT_FSM_STATE.Idle, "reassigned");
      }
    }
    if (agent.task_id && agent.task_id !== task.task_id) {
      unassignAgentTask(agent.agent_id);
    }

    task.assignee = agent.agent_id;
    if (!preserveStatus && task.status !== "done" && task.status !== "cancelled") {
      task.status = "planned";
    }
    const runtime = ensureTaskRuntime(task.task_id);
    if (!preserveStatus) {
      runtime.ticks_in_progress = 0;
      runtime.progress_bucket = 0;
    }
    runtime.last_transition = reason;

    agent.task_id = task.task_id;
    transitionAgentBaseState(agent, targetStateForAssignedTask(task), reason);
    refreshProjectStatus(task.project_id);
  }

  function completeTask(taskId) {
    const task = state.tasks.get(taskId);
    if (!task) {
      return;
    }
    task.status = "done";
    const runtime = ensureTaskRuntime(task.task_id);
    runtime.last_transition = "done";
    runtime.progress_bucket = 10;
    const run = activeOpenClawRun(task.task_id);
    if (run && canTransitionOpenClawRunStatus(run.status, OPENCLAW_RUN_STATUS.Completed)) {
      recordOpenClawRunTransition(run, OPENCLAW_RUN_STATUS.Completed, "task_done");
    }
    if (task.assignee) {
      const agent = state.agents.get(task.assignee);
      if (agent && agent.task_id === task.task_id) {
        delete agent.task_id;
        transitionAgentBaseState(agent, AGENT_FSM_STATE.Idle, "task_done");
      }
    }
    refreshProjectStatus(task.project_id);
  }

  function canTransitionArtifactStatus(fromStatus, toStatus) {
    if (fromStatus === toStatus) {
      return true;
    }
    return ARTIFACT_ALLOWED_TRANSITIONS[fromStatus]?.has(toStatus) === true;
  }

  function transitionArtifactStatus(artifact, toStatus) {
    if (!artifact || typeof artifact.status !== "string") {
      return false;
    }
    if (!canTransitionArtifactStatus(artifact.status, toStatus)) {
      return false;
    }
    artifact.status = toStatus;
    return true;
  }

  function parseArtifactRevisionIdentity(artifactId, versionHint = 1) {
    const normalizedHint = Number.isInteger(versionHint) && versionHint > 0 ? versionHint : 1;
    if (typeof artifactId !== "string") {
      return {
        baseId: "art_generated",
        version: normalizedHint
      };
    }
    const match = artifactId.trim().match(ARTIFACT_VERSION_ID_RE);
    if (!match) {
      return {
        baseId: "art_generated",
        version: normalizedHint
      };
    }
    const parsedVersion = match[2] ? Number.parseInt(match[2], 10) : normalizedHint;
    return {
      baseId: match[1],
      version:
        Number.isInteger(parsedVersion) && parsedVersion > 0
          ? Math.max(parsedVersion, normalizedHint)
          : normalizedHint
    };
  }

  function nextArtifactRevision(sourceArtifact) {
    const sourceVersion =
      Number.isInteger(sourceArtifact?.version) && sourceArtifact.version > 0 ? sourceArtifact.version : 1;
    const sourceIdentity = parseArtifactRevisionIdentity(sourceArtifact?.artifact_id, sourceVersion);
    let maxVersion = sourceIdentity.version;

    for (const artifact of state.artifacts.values()) {
      const identity = parseArtifactRevisionIdentity(artifact.artifact_id, artifact.version);
      if (identity.baseId !== sourceIdentity.baseId) {
        continue;
      }
      maxVersion = Math.max(maxVersion, identity.version);
    }

    let nextVersion = maxVersion + 1;
    let nextArtifactId = `${sourceIdentity.baseId}_v${nextVersion}`;
    while (state.artifacts.has(nextArtifactId)) {
      nextVersion += 1;
      nextArtifactId = `${sourceIdentity.baseId}_v${nextVersion}`;
    }
    return {
      artifact_id: nextArtifactId,
      version: nextVersion
    };
  }

  function createArtifactRevision(
    sourceArtifact,
    {
      initialStatus = ARTIFACT_STATUS.Created,
      finalStatus = ARTIFACT_STATUS.Delivered
    } = {}
  ) {
    const nextRevision = nextArtifactRevision(sourceArtifact);
    const artifactRevision = {
      artifact_id: nextRevision.artifact_id,
      project_id: sourceArtifact.project_id,
      type: sourceArtifact.type,
      status: initialStatus,
      version: nextRevision.version
    };
    if (typeof sourceArtifact.task_id === "string") {
      artifactRevision.task_id = sourceArtifact.task_id;
    }
    if (typeof sourceArtifact.poi_id === "string") {
      artifactRevision.poi_id = sourceArtifact.poi_id;
    }
    state.artifacts.set(artifactRevision.artifact_id, artifactRevision);
    if (finalStatus !== initialStatus) {
      transitionArtifactStatus(artifactRevision, finalStatus);
    }
    return artifactRevision;
  }

  function supersedeSiblingArtifacts(referenceArtifact) {
    if (!referenceArtifact || typeof referenceArtifact.task_id !== "string") {
      return;
    }
    for (const artifact of state.artifacts.values()) {
      if (artifact.artifact_id === referenceArtifact.artifact_id) {
        continue;
      }
      if (artifact.project_id !== referenceArtifact.project_id) {
        continue;
      }
      if (artifact.task_id !== referenceArtifact.task_id) {
        continue;
      }
      if (artifact.type !== referenceArtifact.type) {
        continue;
      }
      const artifactVersion = Number.isInteger(artifact.version) ? artifact.version : 0;
      const referenceVersion = Number.isInteger(referenceArtifact.version)
        ? referenceArtifact.version
        : Number.MAX_SAFE_INTEGER;
      if (artifactVersion >= referenceVersion) {
        continue;
      }
      transitionArtifactStatus(artifact, ARTIFACT_STATUS.Superseded);
    }
  }

  function applySubmitRequest(data) {
    if (typeof data.text !== "string" || data.text.trim().length === 0) {
      return fail("VALIDATION_FAILED", "submit_request requires non-empty text");
    }
    requestCounter += 1;
    const suffix = String(requestCounter).padStart(3, "0");
    const projectId = `proj_req_${suffix}`;
    const taskTitles = decomposeRequestText(data.text.trim());
    state.projects.set(projectId, {
      project_id: projectId,
      title: data.text.trim().slice(0, 80),
      status: "planning"
    });
    for (let index = 0; index < taskTitles.length; index += 1) {
      const taskId = taskLifecycleId(suffix, index);
      state.tasks.set(taskId, {
        task_id: taskId,
        project_id: projectId,
        title: taskTitles[index],
        status: "planned"
      });
      ensureTaskRuntime(taskId);
    }
    refreshProjectStatus(projectId);
    return ok();
  }

  function applyAssignTask(data) {
    if (typeof data.task_id !== "string" || typeof data.agent_id !== "string") {
      return fail("VALIDATION_FAILED", "assign_task requires task_id and agent_id");
    }
    const task = state.tasks.get(data.task_id);
    if (!task) {
      return fail("NOT_FOUND", "task not found");
    }
    if (task.status === "done" || task.status === "cancelled") {
      return fail("CONFLICT", "cannot assign terminal task");
    }
    if (pausedProjects.has(task.project_id)) {
      return fail("NOT_ALLOWED", "project dispatch is paused");
    }
    assignTaskToAgent(task, data.agent_id);
    return ok();
  }

  function applyAutoAssign(data) {
    if (typeof data.project_id !== "string") {
      return fail("VALIDATION_FAILED", "auto_assign requires project_id");
    }
    if (!state.projects.has(data.project_id)) {
      return fail("NOT_FOUND", "project not found");
    }
    if (pausedProjects.has(data.project_id)) {
      return fail("NOT_ALLOWED", "project dispatch is paused");
    }
    const idleAgents = sortById(state.agents.values(), "agent_id").filter((agent) => !agent.task_id);
    const pendingTasks = sortById(state.tasks.values(), "task_id").filter(
      (task) =>
        task.project_id === data.project_id &&
        !task.assignee &&
        task.status !== "done" &&
        task.status !== "cancelled"
    );
    const count = Math.min(idleAgents.length, pendingTasks.length);
    for (let index = 0; index < count; index += 1) {
      const agent = idleAgents[index];
      const task = pendingTasks[index];
      assignTaskToAgent(task, agent.agent_id);
    }
    return ok();
  }

  function applyResolveDecision(data) {
    if (typeof data.decision_id !== "string" || typeof data.choice !== "string") {
      return fail("VALIDATION_FAILED", "resolve_decision requires decision_id and choice");
    }
    const decision = state.decisions.get(data.decision_id);
    if (!decision) {
      return fail("NOT_FOUND", "decision not found");
    }
    if (decision.status !== "open") {
      return fail("CONFLICT", "decision is not open");
    }
    decision.status = "resolved";
    decision.choice = data.choice;
    const resumedTaskIds = unblockTasksForDecision(decision.decision_id);
    recordDecisionTransition(decision.decision_id, "resolved", {
      reason: "resolve_decision",
      choice: data.choice
    });
    ensureDecisionRuntime(decision.decision_id).resolved_task_ids = resumedTaskIds;
    refreshProjectStatus(decision.project_id);
    return ok();
  }

  function applyApproveArtifact(data) {
    if (typeof data.artifact_id !== "string") {
      return fail("VALIDATION_FAILED", "approve_artifact requires artifact_id");
    }
    const artifact = state.artifacts.get(data.artifact_id);
    if (!artifact) {
      return fail("NOT_FOUND", "artifact not found");
    }
    if (
      ![
        ARTIFACT_STATUS.Delivered,
        ARTIFACT_STATUS.InReview,
        ARTIFACT_STATUS.ChangesRequested
      ].includes(artifact.status)
    ) {
      return fail("CONFLICT", "artifact cannot be approved in current state");
    }
    if (artifact.status === ARTIFACT_STATUS.Delivered) {
      transitionArtifactStatus(artifact, ARTIFACT_STATUS.InReview);
    }
    if (!transitionArtifactStatus(artifact, ARTIFACT_STATUS.Approved)) {
      return fail("CONFLICT", "artifact approval transition rejected");
    }
    supersedeSiblingArtifacts(artifact);
    if (artifact.task_id) {
      const linkedTask = state.tasks.get(artifact.task_id);
      if (linkedTask) {
        applyCeremonyOverride(linkedTask.project_id, "review");
      }
    }
    if (artifact.task_id) {
      completeTask(artifact.task_id);
    }
    return ok();
  }

  function applyRequestChanges(data) {
    if (typeof data.artifact_id !== "string" || typeof data.instructions !== "string") {
      return fail("VALIDATION_FAILED", "request_changes requires artifact_id and instructions");
    }
    const artifact = state.artifacts.get(data.artifact_id);
    if (!artifact) {
      return fail("NOT_FOUND", "artifact not found");
    }
    if (artifact.status === ARTIFACT_STATUS.Approved) {
      return fail("CONFLICT", "cannot request changes after approval");
    }
    if (
      ![
        ARTIFACT_STATUS.Delivered,
        ARTIFACT_STATUS.InReview,
        ARTIFACT_STATUS.ChangesRequested
      ].includes(artifact.status)
    ) {
      return fail("CONFLICT", "artifact cannot be revised in current state");
    }
    if (artifact.status === ARTIFACT_STATUS.Delivered) {
      transitionArtifactStatus(artifact, ARTIFACT_STATUS.InReview);
    }
    if (!transitionArtifactStatus(artifact, ARTIFACT_STATUS.ChangesRequested)) {
      return fail("CONFLICT", "artifact change-request transition rejected");
    }
    createArtifactRevision(artifact, {
      initialStatus: ARTIFACT_STATUS.Created,
      finalStatus: ARTIFACT_STATUS.Delivered
    });
    if (artifact.task_id) {
      const task = state.tasks.get(artifact.task_id);
      if (task && task.status !== "cancelled") {
        const decision =
          openDecisionForTask(task.task_id) || createDecisionForTask(task, data.instructions);
        blockTaskForDecision(task, decision.decision_id);
        recordDecisionTransition(decision.decision_id, "open", {
          reason: "request_changes"
        });
        applyCeremonyOverride(task.project_id, "review");
      }
    }
    return ok();
  }

  function applySplitIntoTasks(data) {
    if (typeof data.artifact_id !== "string" || !Array.isArray(data.task_titles)) {
      return fail("VALIDATION_FAILED", "split_into_tasks requires artifact_id and task_titles[]");
    }
    const artifact = state.artifacts.get(data.artifact_id);
    if (!artifact) {
      return fail("NOT_FOUND", "artifact not found");
    }
    if (
      ![
        ARTIFACT_STATUS.Delivered,
        ARTIFACT_STATUS.InReview,
        ARTIFACT_STATUS.ChangesRequested
      ].includes(artifact.status)
    ) {
      return fail("CONFLICT", "artifact cannot be split in current state");
    }
    if (data.task_titles.length === 0) {
      return fail("VALIDATION_FAILED", "task_titles must not be empty");
    }
    if (artifact.status === ARTIFACT_STATUS.Delivered) {
      transitionArtifactStatus(artifact, ARTIFACT_STATUS.InReview);
    }
    for (const title of data.task_titles) {
      splitTaskCounter += 1;
      const taskId = `task_split_${String(splitTaskCounter).padStart(3, "0")}`;
      state.tasks.set(taskId, {
        task_id: taskId,
        project_id: artifact.project_id,
        title: normalizeTaskTitle(title, splitTaskCounter),
        status: "planned"
      });
      ensureTaskRuntime(taskId);
    }
    refreshProjectStatus(artifact.project_id);
    return ok();
  }

  function applyPlayerPos(data) {
    if (!isVec3(data.pos)) {
      return fail("VALIDATION_FAILED", "player_pos requires pos [x,y,z]");
    }
    if (data.facing !== undefined && !isVec3(data.facing)) {
      return fail("VALIDATION_FAILED", "facing must be [x,y,z]");
    }
    const player = getPlayerAgent();
    player.pos = cloneVec3(data.pos);
    playerPosCache.pos = cloneVec3(data.pos);
    playerPosCache.updated_tick = worldTickCount;
    if (isVec3(data.facing)) {
      player.facing = cloneVec3(data.facing);
      playerPosCache.facing = cloneVec3(data.facing);
    } else {
      delete player.facing;
      playerPosCache.facing = null;
    }
    return ok();
  }

  function applyMovePlayerTo(data) {
    if (!isVec3(data.pos)) {
      return fail("VALIDATION_FAILED", "move_player_to requires pos [x,y,z]");
    }

    const navGrid = getActiveNavGrid();
    if (!navGrid) {
      return fail("NOT_ALLOWED", `navigation grid unavailable for scene ${activeSceneId}`);
    }

    const player = getPlayerAgent();
    const startPos = isVec3(player.pos) ? cloneVec3(player.pos) : zeroVec3();
    const solve = findPathOnGrid(navGrid, startPos, data.pos, {
      occupiedWorldPositions: occupiedWorldPositions(player.agent_id)
    });
    if (!solve) {
      lastMovePlan = {
        scene_id: activeSceneId,
        status: "blocked",
        requested_target: cloneVec3(data.pos),
        start_pos: startPos
      };
      return fail("NOT_ALLOWED", "move_player_to target is unreachable or blocked");
    }

    const resolvedTarget = navCellToWorld(navGrid, solve.targetCell, data.pos[1]);
    player.pos = cloneVec3(resolvedTarget);
    transitionAgentBaseState(player, AGENT_FSM_STATE.Walking, "move_player_to");
    lastMovePlan = {
      scene_id: activeSceneId,
      status: "ok",
      requested_target: cloneVec3(data.pos),
      resolved_target: cloneVec3(resolvedTarget),
      start_cell: { ...solve.startCell },
      target_cell: { ...solve.targetCell },
      path: solve.path.map((point) => cloneVec3(point)),
      cells: solve.cells.map((cell) => ({ ...cell })),
      occupied_cell_count: solve.occupiedCellCount
    };
    return ok();
  }

  function applyStartKickoff(data) {
    if (data.project_id !== undefined && typeof data.project_id !== "string") {
      return fail("VALIDATION_FAILED", "start_kickoff project_id must be string when provided");
    }
    if (typeof data.project_id === "string" && !state.projects.has(data.project_id)) {
      return fail("NOT_FOUND", "project not found");
    }
    const projectId =
      typeof data.project_id === "string" ? data.project_id : buildSnapshot().projects[0]?.project_id;
    if (typeof projectId === "string") {
      applyCeremonyOverride(projectId, "kickoff");
    }
    return ok();
  }

  function applyReassignTask(data) {
    if (typeof data.task_id !== "string" || typeof data.to_agent_id !== "string") {
      return fail("VALIDATION_FAILED", "reassign_task requires task_id and to_agent_id");
    }
    const task = state.tasks.get(data.task_id);
    if (!task) {
      return fail("NOT_FOUND", "task not found");
    }
    if (
      typeof data.expected_task_status === "string" &&
      task.status !== data.expected_task_status
    ) {
      return fail("CONFLICT", "task status no longer matches expected_task_status");
    }
    if (
      typeof data.from_agent_id === "string" &&
      task.assignee !== data.from_agent_id
    ) {
      return fail("CONFLICT", "task assignee no longer matches from_agent_id");
    }
    if (task.status === "done" || task.status === "cancelled") {
      return fail("NOT_ALLOWED", "cannot reassign terminal task");
    }
    if (task.status === "in_progress") {
      return fail("NOT_ALLOWED", "cannot reassign in_progress task without pause semantics");
    }
    assignTaskToAgent(task, data.to_agent_id, {
      preserveStatus: task.status === "blocked",
      reason: "reassign_task"
    });
    return ok();
  }

  function cancelOpenDecisionsForTask(taskId) {
    for (const decision of state.decisions.values()) {
      if (decision.task_id !== taskId || decision.status !== "open") {
        continue;
      }
      decision.status = "cancelled";
      recordDecisionTransition(decision.decision_id, "cancelled", {
        reason: "cancel_task"
      });
      const runtime = ensureDecisionRuntime(decision.decision_id);
      runtime.blocked_task_ids.delete(taskId);
    }
    taskDecisionBlocker.delete(taskId);
    taskBlockedPriorStatus.delete(taskId);
  }

  function applyCancelTask(data) {
    if (typeof data.task_id !== "string" || data.confirm !== true) {
      return fail("VALIDATION_FAILED", "cancel_task requires task_id and confirm=true");
    }
    const task = state.tasks.get(data.task_id);
    if (!task) {
      return fail("NOT_FOUND", "task not found");
    }
    if (
      typeof data.expected_task_status === "string" &&
      task.status !== data.expected_task_status
    ) {
      return fail("CONFLICT", "task status no longer matches expected_task_status");
    }
    if (task.status === "done" || task.status === "cancelled") {
      return fail("NOT_ALLOWED", "cannot cancel terminal task");
    }
    task.status = "cancelled";
    ensureTaskRuntime(task.task_id).last_transition = "cancelled";
    interruptOpenClawRun(task.task_id, "cancel_task");
    cancelOpenDecisionsForTask(task.task_id);

    if (task.assignee) {
      const assignee = ensureAgent(task.assignee);
      if (assignee.task_id === task.task_id) {
        delete assignee.task_id;
      }
      delete task.assignee;
      transitionAgentBaseState(assignee, AGENT_FSM_STATE.Idle, "task_cancelled");
    }
    refreshProjectStatus(task.project_id);
    return ok();
  }

  function applyPauseProject(data) {
    if (typeof data.project_id !== "string") {
      return fail("VALIDATION_FAILED", "pause_project requires project_id");
    }
    const project = state.projects.get(data.project_id);
    if (!project) {
      return fail("NOT_FOUND", "project not found");
    }
    if (
      typeof data.expected_project_status === "string" &&
      project.status !== data.expected_project_status
    ) {
      return fail("CONFLICT", "project status no longer matches expected_project_status");
    }
    pausedProjects.add(project.project_id);
    for (const task of state.tasks.values()) {
      if (task.project_id !== project.project_id) {
        continue;
      }
      if (task.status === "planned" && task.assignee) {
        const agent = ensureAgent(task.assignee);
        if (agent.task_id === task.task_id) {
          transitionAgentBaseState(agent, AGENT_FSM_STATE.Blocked, "project_paused");
        }
      }
    }
    refreshProjectStatus(project.project_id);
    return ok();
  }

  function applyResumeProject(data) {
    if (typeof data.project_id !== "string") {
      return fail("VALIDATION_FAILED", "resume_project requires project_id");
    }
    const project = state.projects.get(data.project_id);
    if (!project) {
      return fail("NOT_FOUND", "project not found");
    }
    if (
      typeof data.expected_project_status === "string" &&
      project.status !== data.expected_project_status
    ) {
      return fail("CONFLICT", "project status no longer matches expected_project_status");
    }
    pausedProjects.delete(project.project_id);
    for (const task of state.tasks.values()) {
      if (task.project_id !== project.project_id || task.status !== "planned" || !task.assignee) {
        continue;
      }
      const agent = ensureAgent(task.assignee);
      if (agent.task_id === task.task_id) {
        transitionAgentBaseState(agent, AGENT_FSM_STATE.Walking, "project_resumed");
      }
    }
    refreshProjectStatus(project.project_id);
    return ok();
  }

  function applyRerunTask(data) {
    if (typeof data.source_task_id !== "string") {
      return fail("VALIDATION_FAILED", "rerun_task requires source_task_id");
    }
    if (data.mode !== undefined && data.mode !== "clone_as_new") {
      return fail("VALIDATION_FAILED", "rerun_task mode must be clone_as_new");
    }
    const sourceTask = state.tasks.get(data.source_task_id);
    if (!sourceTask) {
      return fail("NOT_FOUND", "source task not found");
    }
    if (sourceTask.status !== "done" && sourceTask.status !== "cancelled") {
      return fail("NOT_ALLOWED", "rerun_task is allowed only for done or cancelled tasks");
    }

    rerunTaskCounter += 1;
    const taskId = `task_rerun_${String(rerunTaskCounter).padStart(3, "0")}`;
    const rerunTask = {
      task_id: taskId,
      project_id: sourceTask.project_id,
      title: `${sourceTask.title} (rerun)`,
      status: "planned",
      rerun_of_task_id: sourceTask.task_id
    };
    if (typeof data.reason === "string" && data.reason.trim()) {
      rerunTask.rerun_reason = data.reason.trim();
    }
    if (data.constraints_patch && typeof data.constraints_patch === "object") {
      rerunTask.constraints_patch = clone(data.constraints_patch);
    }
    state.tasks.set(taskId, rerunTask);
    ensureTaskRuntime(taskId).last_transition = "rerun_created";
    refreshProjectStatus(sourceTask.project_id);
    return ok();
  }

  function applyCommand(payload) {
    const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
    if (!isObject(payload) || typeof payload.name !== "string" || !isObject(payload.data)) {
      return fail("VALIDATION_FAILED", "command payload requires {name,data}");
    }

    const { name, data } = payload;

    switch (name) {
      case "submit_request":
        return applySubmitRequest(data);
      case "assign_task":
        return applyAssignTask(data);
      case "auto_assign":
        return applyAutoAssign(data);
      case "resolve_decision":
        return applyResolveDecision(data);
      case "approve_artifact":
        return applyApproveArtifact(data);
      case "request_changes":
        return applyRequestChanges(data);
      case "split_into_tasks":
        return applySplitIntoTasks(data);
      case "player_pos":
        return applyPlayerPos(data);
      case "move_player_to":
        return applyMovePlayerTo(data);
      case "start_kickoff":
        return applyStartKickoff(data);
      case "reassign_task":
        return applyReassignTask(data);
      case "cancel_task":
        return applyCancelTask(data);
      case "pause_project":
        return applyPauseProject(data);
      case "resume_project":
        return applyResumeProject(data);
      case "rerun_task":
        return applyRerunTask(data);
      default:
        return fail("VALIDATION_FAILED", `unknown command: ${name}`);
    }
  }

  function applyEvent(payload) {
    if (!payload || typeof payload !== "object" || typeof payload.name !== "string") {
      return;
    }
    if (payload.name === "openclaw_run_status") {
      applyOpenClawRunStatusEvent(payload);
      return;
    }
    if (payload.name === "openclaw_output_ready") {
      applyOpenClawOutputEvent(payload);
      return;
    }
    const taskId = payload.task_id;
    if (typeof taskId === "string" && state.tasks.has(taskId)) {
      const task = state.tasks.get(taskId);
      if (payload.name === "task_started") {
        task.status = "in_progress";
        ensureTaskRuntime(task.task_id).last_transition = "started";
        if (task.assignee) {
          const agent = ensureAgent(task.assignee);
          transitionAgentBaseState(agent, AGENT_FSM_STATE.Walking, "event_task_started");
        }
        refreshProjectStatus(task.project_id);
      }
      if (payload.name === "task_done") {
        completeTask(task.task_id);
      }
    }
  }

  function advanceTick() {
    worldTickCount += 1;
    for (const agent of sortById(state.agents.values(), "agent_id")) {
      const currentTaskId = agent.task_id;
      if (!currentTaskId) {
        transitionAgentBaseState(agent, AGENT_FSM_STATE.Idle, "tick_idle");
        continue;
      }
      const task = state.tasks.get(currentTaskId);
      if (!task || task.status === "done" || task.status === "cancelled") {
        delete agent.task_id;
        transitionAgentBaseState(agent, AGENT_FSM_STATE.Idle, "task_terminal");
        continue;
      }
      const runtime = ensureTaskRuntime(task.task_id);
      if (task.status === "planned") {
        if (pausedProjects.has(task.project_id)) {
          runtime.last_transition = "paused_dispatch";
          transitionAgentBaseState(agent, AGENT_FSM_STATE.Blocked, "tick_paused_project");
          refreshProjectStatus(task.project_id);
          continue;
        }
        task.status = "in_progress";
        runtime.last_transition = "started";
        runtime.ticks_in_progress = 0;
        runtime.progress_bucket = Math.max(runtime.progress_bucket, 1);
        transitionAgentBaseState(agent, AGENT_FSM_STATE.Walking, "tick_started");
      } else if (task.status === "blocked") {
        runtime.last_transition = "blocked";
        const agentFsm = ensureAgentRuntime(agent.agent_id);
        const isSeekingUser = agentFsm.base_state === AGENT_FSM_STATE.SeekingUser;
        const blockedReason = isSeekingUser ? applySeekUserApproach(agent) : "tick_blocked";
        transitionAgentBaseState(
          agent,
          isSeekingUser ? AGENT_FSM_STATE.SeekingUser : AGENT_FSM_STATE.Blocked,
          blockedReason
        );
      } else {
        runtime.ticks_in_progress += 1;
        runtime.progress_bucket = Math.min(
          9,
          Math.max(runtime.progress_bucket, 1 + Math.floor(runtime.ticks_in_progress / 2))
        );
        runtime.last_transition = "progress";
        transitionAgentBaseState(agent, AGENT_FSM_STATE.Working, "tick_progress");
        const fsm = ensureAgentRuntime(agent.agent_id);
        if (effectiveAgentState(fsm) === AGENT_FSM_STATE.Working) {
          startOpenClawRun(task, agent);
        }
      }
      refreshProjectStatus(task.project_id);
    }
    applyOverrideTickDecay();
  }

  loadNavGridForScene(activeSceneId);

  return {
    getSceneId() {
      return activeSceneId;
    },

    setSceneId(sceneId) {
      if (typeof sceneId === "string" && sceneId.trim()) {
        activeSceneId = sceneId.trim();
        loadNavGridForScene(activeSceneId);
      }
    },

    applyCommand,
    applyEvent,
    advanceTick,

    buildSnapshot(sceneIdOverride) {
      return buildSnapshot(sceneIdOverride);
    },

    getAgentFsm(agentId) {
      if (typeof agentId !== "string" || !agentId.trim()) {
        return null;
      }
      if (!state.agents.has(agentId)) {
        return null;
      }
      return serializeAgentFsm(agentId);
    },

    getAllAgentFsm() {
      return sortById(state.agents.values(), "agent_id").map((agent) => serializeAgentFsm(agent.agent_id));
    },

    getDecisionLifecycle(decisionId) {
      if (typeof decisionId !== "string" || !decisionId.trim()) {
        return null;
      }
      return serializeDecisionLifecycle(decisionId);
    },

    getAllDecisionLifecycles() {
      return sortById(state.decisions.values(), "decision_id").map((decision) =>
        serializeDecisionLifecycle(decision.decision_id)
      );
    },

    getOpenClawRun(taskId) {
      if (typeof taskId !== "string" || !taskId.trim()) {
        return null;
      }
      const run = openClawRunsByTask.get(taskId);
      return run ? serializeOpenClawRun(run) : null;
    },

    getAllOpenClawRuns() {
      return [...openClawRunsByTask.values()]
        .sort((a, b) => a.task_id.localeCompare(b.task_id))
        .map((run) => serializeOpenClawRun(run));
    },

    getPlayerPositionContext() {
      return serializePlayerPosCache();
    },

    getNavigationState() {
      const navGrid = getActiveNavGrid();
      const load = navLoadMetaByScene.get(activeSceneId) || {
        ok: false,
        scene_id: activeSceneId,
        manifest_path: null,
        error: "navigation grid not loaded"
      };
      return {
        scene_id: activeSceneId,
        available: Boolean(navGrid),
        load: { ...load },
        grid: navGrid ? serializeNavGrid(navGrid) : null,
        last_move: lastMovePlan ? clone(lastMovePlan) : null
      };
    },

    worldToGridCell(worldPos) {
      if (!isVec3(worldPos)) {
        return null;
      }
      const navGrid = getActiveNavGrid();
      if (!navGrid) {
        return null;
      }
      const cell = navWorldToCell(navGrid, worldPos);
      return cell ? { ...cell } : null;
    },

    gridCellToWorld(cell, y = 0) {
      if (!cell || typeof cell.col !== "number" || typeof cell.row !== "number") {
        return null;
      }
      const navGrid = getActiveNavGrid();
      if (!navGrid) {
        return null;
      }
      return navCellToWorld(navGrid, cell, Number.isFinite(y) ? y : 0);
    },

    validateCoherence(snapshot) {
      return validateSnapshotCoherence(snapshot);
    }
  };
}
