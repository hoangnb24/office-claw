import assert from "node:assert/strict";
import {
  createSimulationRuntime,
  createWorldStateStore,
  validateSnapshotCoherence
} from "../src/index.mjs";
import { loadSceneNavGridRuntime } from "../src/nav/manifestNav.mjs";

function createDeterministicNow(start = 1_700_000_000_000, step = 11) {
  let current = start;
  return () => {
    current += step;
    return current;
  };
}

function distanceXZ(a, b) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dz * dz);
}

function runDeterministicScenario() {
  const simulation = createSimulationRuntime({
    tickRateHz: 20,
    now: createDeterministicNow()
  });

  simulation.enqueueCommand({
    name: "assign_task",
    data: {
      task_id: "task_copy",
      agent_id: "agent_eng_1"
    }
  });
  simulation.enqueueCommand({
    name: "resolve_decision",
    data: {
      decision_id: "dec_audience",
      choice: "Tech users"
    }
  });
  simulation.enqueueCommand({
    name: "approve_artifact",
    data: {
      artifact_id: "art_research_report_v1"
    }
  });
  simulation.enqueueCommand({
    name: "split_into_tasks",
    data: {
      artifact_id: "art_research_report_v1",
      task_titles: ["Draft CTA variants", "Write launch email"]
    }
  });

  simulation.tick(4);
  return {
    snapshot: simulation.getSnapshot("cozy_office_v0"),
    stats: simulation.getStats()
  };
}

function testTickRateIsConfigurableAndObservable() {
  const simulation = createSimulationRuntime({
    tickRateHz: 17,
    now: createDeterministicNow()
  });

  let stats = simulation.getStats();
  assert.equal(stats.tick_rate_hz, 17);
  assert.equal(stats.tick_interval_ms, Math.floor(1000 / 17));
  assert.equal(stats.tick_count, 0);

  simulation.tick();
  simulation.tick();
  stats = simulation.getStats();
  assert.equal(stats.tick_count, 2);
  assert.equal(stats.seq, 2);
  assert.equal(stats.clock_ms, stats.tick_interval_ms * 2);
  assert.ok(stats.last_tick_ts !== null);

  simulation.setTickRateHz(3);
  assert.equal(simulation.getStats().tick_rate_hz, 10);
  simulation.setTickRateHz(42);
  assert.equal(simulation.getStats().tick_rate_hz, 20);
}

function testDeterministicReplayProducesIdenticalOutputs() {
  const firstRun = runDeterministicScenario();
  const secondRun = runDeterministicScenario();

  assert.deepEqual(firstRun.snapshot, secondRun.snapshot);
  assert.deepEqual(firstRun.stats.seq, secondRun.stats.seq);
  assert.deepEqual(firstRun.stats.clock_ms, secondRun.stats.clock_ms);
}

function testSnapshotCoherenceAndMonotonicClock() {
  const simulation = createSimulationRuntime({
    tickRateHz: 10,
    now: createDeterministicNow()
  });
  const before = simulation.getStats();
  simulation.tick();
  const afterOneTick = simulation.getStats();
  simulation.tick(2);
  const afterThreeTicks = simulation.getStats();

  assert.ok(afterOneTick.seq > before.seq);
  assert.ok(afterThreeTicks.seq > afterOneTick.seq);
  assert.ok(afterThreeTicks.clock_ms > afterOneTick.clock_ms);

  const snapshot = simulation.getSnapshot();
  const coherence = validateSnapshotCoherence(snapshot);
  assert.equal(coherence.ok, true, coherence.issues.join("; "));
}

function testLifecycleOrchestrationFlow() {
  const simulation = createSimulationRuntime({
    tickRateHz: 10,
    now: createDeterministicNow()
  });

  simulation.enqueueCommand({
    name: "submit_request",
    data: {
      text: "Research competitors. Draft launch messaging. Prepare rollout checklist."
    }
  });
  simulation.tick();

  let snapshot = simulation.getSnapshot();
  const createdProject = snapshot.projects.find((project) => project.project_id === "proj_req_001");
  assert.ok(createdProject);
  const createdTasks = snapshot.tasks.filter((task) => task.project_id === "proj_req_001");
  assert.equal(createdTasks.length, 3);
  assert.ok(createdTasks.every((task) => task.status === "planned"));

  const firstTask = createdTasks[0];
  simulation.enqueueCommand({
    name: "assign_task",
    data: {
      task_id: firstTask.task_id,
      agent_id: "agent_eng_1"
    }
  });
  simulation.tick();

  snapshot = simulation.getSnapshot();
  const startedTask = snapshot.tasks.find((task) => task.task_id === firstTask.task_id);
  assert.equal(startedTask.assignee, "agent_eng_1");
  assert.equal(startedTask.status, "in_progress");

  simulation.enqueueCommand({
    name: "auto_assign",
    data: {
      project_id: "proj_req_001"
    }
  });
  simulation.tick();
  snapshot = simulation.getSnapshot();
  const assignedCount = snapshot.tasks.filter(
    (task) => task.project_id === "proj_req_001" && typeof task.assignee === "string"
  ).length;
  assert.ok(assignedCount >= 2);

  simulation.enqueueCommand({
    name: "assign_task",
    data: {
      task_id: "task_copy",
      agent_id: "agent_eng_1"
    }
  });
  simulation.tick();
  simulation.enqueueCommand({
    name: "assign_task",
    data: {
      task_id: "task_copy",
      agent_id: "agent_bd"
    }
  });
  simulation.tick();

  snapshot = simulation.getSnapshot();
  const reassignedTask = snapshot.tasks.find((task) => task.task_id === "task_copy");
  assert.equal(reassignedTask.assignee, "agent_bd");
  const engAgent = snapshot.agents.find((agent) => agent.agent_id === "agent_eng_1");
  assert.notEqual(engAgent.task_id, "task_copy");

  simulation.enqueueCommand({
    name: "approve_artifact",
    data: {
      artifact_id: "art_research_report_v1"
    }
  });
  simulation.tick();
  snapshot = simulation.getSnapshot();
  const completedTask = snapshot.tasks.find((task) => task.task_id === "task_research");
  assert.equal(completedTask.status, "done");
}

function testProjectCompletionUnlocksDecorAtAvailableAnchor() {
  const worldState = createWorldStateStore();
  const simulation = createSimulationRuntime({
    tickRateHz: 10,
    now: createDeterministicNow(),
    worldStateStore: worldState
  });

  simulation.enqueueCommand({
    name: "assign_task",
    data: {
      task_id: "task_copy",
      agent_id: "agent_eng_1"
    }
  });
  simulation.tick();
  simulation.tick();
  simulation.enqueueEvent({
    name: "openclaw_run_status",
    task_id: "task_copy",
    status: "completed"
  });
  simulation.tick();

  simulation.enqueueCommand({
    name: "approve_artifact",
    data: {
      artifact_id: "art_research_report_v1"
    }
  });
  simulation.tick();

  let snapshot = simulation.getSnapshot();
  const completedProject = snapshot.projects.find((project) => project.project_id === "proj_abc");
  const unlockedDecor = snapshot.office_decor.filter((item) => item.unlocked_by_project_id === "proj_abc");
  assert.equal(completedProject.status, "completed");
  assert.equal(unlockedDecor.length, 1);
  assert.equal(unlockedDecor[0].anchor_id, "trophy_shelf_02");
  assert.equal(unlockedDecor[0].outcome, "artifact_approved");

  simulation.tick(3);
  snapshot = simulation.getSnapshot();
  const repeatedUnlock = snapshot.office_decor.filter((item) => item.unlocked_by_project_id === "proj_abc");
  assert.equal(repeatedUnlock.length, 1);
}

function testArtifactLifecycleVersioningAndSplitFanout() {
  const simulation = createSimulationRuntime({
    tickRateHz: 10,
    now: createDeterministicNow()
  });

  simulation.enqueueCommand({
    name: "request_changes",
    data: {
      artifact_id: "art_research_report_v1",
      instructions: "Add stronger evidence and tighten recommendations."
    }
  });
  simulation.tick();

  let snapshot = simulation.getSnapshot();
  const artifactV1 = snapshot.artifacts.find((artifact) => artifact.artifact_id === "art_research_report_v1");
  const artifactV2 = snapshot.artifacts.find((artifact) => artifact.artifact_id === "art_research_report_v2");
  assert.ok(artifactV1);
  assert.ok(artifactV2);
  assert.equal(artifactV1.status, "changes_requested");
  assert.equal(artifactV2.status, "delivered");
  assert.equal(artifactV2.version, 2);
  assert.equal(artifactV2.task_id, "task_research");

  simulation.enqueueCommand({
    name: "split_into_tasks",
    data: {
      artifact_id: "art_research_report_v2",
      task_titles: ["Draft CTA variants", "Write launch email"]
    }
  });
  simulation.tick();

  snapshot = simulation.getSnapshot();
  const artifactV2AfterSplit = snapshot.artifacts.find(
    (artifact) => artifact.artifact_id === "art_research_report_v2"
  );
  assert.equal(artifactV2AfterSplit.status, "in_review");

  const splitTasks = snapshot.tasks
    .filter((task) => task.task_id.startsWith("task_split_"))
    .sort((a, b) => a.task_id.localeCompare(b.task_id));
  assert.equal(splitTasks.length, 2);
  assert.deepEqual(
    splitTasks.map((task) => task.title),
    ["Draft CTA variants", "Write launch email"]
  );

  simulation.enqueueCommand({
    name: "approve_artifact",
    data: {
      artifact_id: "art_research_report_v2"
    }
  });
  simulation.tick();

  snapshot = simulation.getSnapshot();
  const artifactV1AfterApprove = snapshot.artifacts.find(
    (artifact) => artifact.artifact_id === "art_research_report_v1"
  );
  const artifactV2AfterApprove = snapshot.artifacts.find(
    (artifact) => artifact.artifact_id === "art_research_report_v2"
  );
  const researchTask = snapshot.tasks.find((task) => task.task_id === "task_research");
  assert.equal(artifactV1AfterApprove.status, "superseded");
  assert.equal(artifactV2AfterApprove.status, "approved");
  assert.equal(researchTask.status, "done");
}

function testAgentFsmTransitionsAndCeremonyOverrides() {
  const worldState = createWorldStateStore();
  const simulation = createSimulationRuntime({
    tickRateHz: 10,
    now: createDeterministicNow(),
    worldStateStore: worldState
  });

  simulation.enqueueCommand({
    name: "assign_task",
    data: {
      task_id: "task_copy",
      agent_id: "agent_eng_1"
    }
  });
  simulation.tick();

  let snapshot = simulation.getSnapshot();
  let eng = snapshot.agents.find((agent) => agent.agent_id === "agent_eng_1");
  assert.equal(eng.state, "WalkingToPOI");

  simulation.tick();
  snapshot = simulation.getSnapshot();
  eng = snapshot.agents.find((agent) => agent.agent_id === "agent_eng_1");
  assert.equal(eng.state, "WorkingAtPOI");

  simulation.enqueueCommand({
    name: "start_kickoff",
    data: {
      project_id: "proj_abc"
    }
  });
  simulation.tick();
  snapshot = simulation.getSnapshot();
  eng = snapshot.agents.find((agent) => agent.agent_id === "agent_eng_1");
  assert.equal(eng.state, "InMeeting");
  let engFsm = worldState.getAgentFsm("agent_eng_1");
  assert.equal(engFsm.base_state, "WorkingAtPOI");
  assert.equal(engFsm.override_stack.at(-1)?.kind, "kickoff");

  simulation.tick();
  snapshot = simulation.getSnapshot();
  eng = snapshot.agents.find((agent) => agent.agent_id === "agent_eng_1");
  assert.equal(eng.state, "WorkingAtPOI");
  engFsm = worldState.getAgentFsm("agent_eng_1");
  assert.equal(engFsm.override_stack.length, 0);

  simulation.enqueueCommand({
    name: "request_changes",
    data: {
      artifact_id: "art_research_report_v1",
      instructions: "Need stronger evidence"
    }
  });
  simulation.tick();
  snapshot = simulation.getSnapshot();
  const researchAgent = snapshot.agents.find((agent) => agent.agent_id === "agent_research_1");
  const researchTask = snapshot.tasks.find((task) => task.task_id === "task_research");
  const pendingDecision = snapshot.decisions.find(
    (decision) => decision.task_id === "task_research" && decision.status === "open"
  );
  assert.ok(pendingDecision, "expected open decision linked to blocked task");
  assert.equal(researchTask.status, "blocked");
  assert.equal(researchAgent.state, "InMeeting");
  let researchFsm = worldState.getAgentFsm("agent_research_1");
  assert.equal(researchFsm.base_state, "SeekingUserDecision");
  assert.equal(researchFsm.override_stack.at(-1)?.kind, "review");
  const decisionRuntimeOpen = worldState.getDecisionLifecycle(pendingDecision.decision_id);
  assert.equal(decisionRuntimeOpen.status, "open");
  assert.ok(decisionRuntimeOpen.history.length >= 1);

  simulation.tick();
  snapshot = simulation.getSnapshot();
  const researchAfterReview = snapshot.agents.find((agent) => agent.agent_id === "agent_research_1");
  assert.equal(researchAfterReview.state, "SeekingUserDecision");

  simulation.enqueueCommand({
    name: "resolve_decision",
    data: {
      decision_id: pendingDecision.decision_id,
      choice: "Tech users"
    }
  });
  simulation.tick();
  snapshot = simulation.getSnapshot();
  const researchResolved = snapshot.agents.find((agent) => agent.agent_id === "agent_research_1");
  const taskResolved = snapshot.tasks.find((task) => task.task_id === "task_research");
  const decisionResolved = snapshot.decisions.find(
    (decision) => decision.decision_id === pendingDecision.decision_id
  );
  assert.equal(taskResolved.status, "in_progress");
  assert.equal(decisionResolved.status, "resolved");
  assert.equal(researchResolved.state, "WorkingAtPOI");
  researchFsm = worldState.getAgentFsm("agent_research_1");
  assert.equal(researchFsm.invariant_violations, 0);
  const decisionRuntimeResolved = worldState.getDecisionLifecycle(pendingDecision.decision_id);
  assert.equal(decisionRuntimeResolved.active_blocked_task_ids.length, 0);
  assert.equal(decisionRuntimeResolved.status, "resolved");
}

function testCeremonyOverrideStackDedupAndDeterministicDecay() {
  const worldState = createWorldStateStore();
  const simulation = createSimulationRuntime({
    tickRateHz: 10,
    now: createDeterministicNow(),
    worldStateStore: worldState
  });

  simulation.enqueueCommand({
    name: "assign_task",
    data: {
      task_id: "task_copy",
      agent_id: "agent_eng_1"
    }
  });
  simulation.tick();

  simulation.enqueueCommand({
    name: "start_kickoff",
    data: {
      project_id: "proj_abc"
    }
  });
  simulation.tick();

  let engFsm = worldState.getAgentFsm("agent_eng_1");
  let researchFsm = worldState.getAgentFsm("agent_research_1");
  assert.equal(engFsm.override_stack.filter((entry) => entry.kind === "kickoff").length, 1);
  assert.equal(researchFsm.override_stack.filter((entry) => entry.kind === "kickoff").length, 1);
  assert.equal(engFsm.override_stack[0].remaining_ticks, 1);
  assert.equal(researchFsm.override_stack[0].remaining_ticks, 1);

  simulation.enqueueCommand({
    name: "start_kickoff",
    data: {
      project_id: "proj_abc"
    }
  });
  simulation.tick();

  engFsm = worldState.getAgentFsm("agent_eng_1");
  researchFsm = worldState.getAgentFsm("agent_research_1");
  assert.equal(engFsm.override_stack.filter((entry) => entry.kind === "kickoff").length, 1);
  assert.equal(researchFsm.override_stack.filter((entry) => entry.kind === "kickoff").length, 1);
  assert.equal(engFsm.override_stack[0].remaining_ticks, 1);
  assert.equal(researchFsm.override_stack[0].remaining_ticks, 1);

  simulation.tick();
  engFsm = worldState.getAgentFsm("agent_eng_1");
  researchFsm = worldState.getAgentFsm("agent_research_1");
  assert.equal(engFsm.override_stack.length, 0);
  assert.equal(researchFsm.override_stack.length, 0);
  assert.equal(engFsm.effective_state, engFsm.base_state);
  assert.equal(researchFsm.effective_state, researchFsm.base_state);
}

function testFsmAndTaskLifecycleInvariantsRemainStable() {
  const worldState = createWorldStateStore();
  const simulation = createSimulationRuntime({
    tickRateHz: 10,
    now: createDeterministicNow(),
    worldStateStore: worldState
  });

  simulation.enqueueCommand({
    name: "assign_task",
    data: {
      task_id: "task_copy",
      agent_id: "agent_eng_1"
    }
  });
  simulation.tick();

  simulation.enqueueCommand({
    name: "start_kickoff",
    data: {
      project_id: "proj_abc"
    }
  });
  simulation.tick();

  simulation.enqueueCommand({
    name: "request_changes",
    data: {
      artifact_id: "art_research_report_v1",
      instructions: "Need stronger evidence and sharper recommendation framing."
    }
  });
  simulation.tick();

  let snapshot = simulation.getSnapshot();
  const pendingDecision = snapshot.decisions.find(
    (decision) => decision.task_id === "task_research" && decision.status === "open"
  );
  assert.ok(pendingDecision, "expected a pending decision for task_research");

  simulation.enqueueCommand({
    name: "resolve_decision",
    data: {
      decision_id: pendingDecision.decision_id,
      choice: "Tech users"
    }
  });
  simulation.tick();

  simulation.enqueueCommand({
    name: "approve_artifact",
    data: {
      artifact_id: "art_research_report_v2"
    }
  });
  simulation.tick();

  snapshot = simulation.getSnapshot();
  const coherence = validateSnapshotCoherence(snapshot);
  assert.equal(coherence.ok, true, coherence.issues.join("; "));

  const terminalTaskIds = new Set(
    snapshot.tasks
      .filter((task) => task.status === "done" || task.status === "cancelled")
      .map((task) => task.task_id)
  );
  for (const agent of snapshot.agents) {
    if (typeof agent.task_id !== "string") {
      continue;
    }
    assert.equal(
      terminalTaskIds.has(agent.task_id),
      false,
      `agent ${agent.agent_id} should not reference terminal task ${agent.task_id}`
    );
  }

  const allFsm = worldState.getAllAgentFsm();
  assert.ok(allFsm.length > 0);
  for (const fsm of allFsm) {
    assert.equal(fsm.invariant_violations, 0, `expected no invariant violations for ${fsm.agent_id}`);
  }
}

function testOpenClawRunStartsAtWorkingPoiAndCompletesViaStatusCallback() {
  const worldState = createWorldStateStore();
  const simulation = createSimulationRuntime({
    tickRateHz: 10,
    now: createDeterministicNow(),
    worldStateStore: worldState
  });

  simulation.enqueueCommand({
    name: "assign_task",
    data: {
      task_id: "task_copy",
      agent_id: "agent_eng_1"
    }
  });
  simulation.tick();
  assert.equal(worldState.getOpenClawRun("task_copy"), null);

  simulation.tick();
  let run = worldState.getOpenClawRun("task_copy");
  assert.ok(run);
  assert.equal(run.task_id, "task_copy");
  assert.equal(run.agent_id, "agent_eng_1");
  assert.equal(run.status, "started");

  simulation.enqueueEvent({
    name: "openclaw_run_status",
    task_id: "task_copy",
    status: "running"
  });
  simulation.tick();
  run = worldState.getOpenClawRun("task_copy");
  assert.equal(run.status, "running");

  simulation.enqueueEvent({
    name: "openclaw_run_status",
    task_id: "task_copy",
    status: "completed"
  });
  simulation.tick();
  run = worldState.getOpenClawRun("task_copy");
  assert.equal(run.status, "completed");
  const snapshot = simulation.getSnapshot();
  const task = snapshot.tasks.find((item) => item.task_id === "task_copy");
  assert.equal(task.status, "done");
}

function testOpenClawRunFailureAndCancellationInterruptSemantics() {
  const worldState = createWorldStateStore();
  const simulation = createSimulationRuntime({
    tickRateHz: 10,
    now: createDeterministicNow(),
    worldStateStore: worldState
  });

  simulation.enqueueCommand({
    name: "assign_task",
    data: {
      task_id: "task_copy",
      agent_id: "agent_eng_1"
    }
  });
  simulation.tick();
  simulation.tick();
  assert.equal(worldState.getOpenClawRun("task_copy")?.status, "started");

  simulation.enqueueEvent({
    name: "openclaw_run_status",
    task_id: "task_copy",
    status: "failed"
  });
  simulation.tick();
  let run = worldState.getOpenClawRun("task_copy");
  let snapshot = simulation.getSnapshot();
  let task = snapshot.tasks.find((item) => item.task_id === "task_copy");
  assert.equal(run.status, "failed");
  assert.equal(task.status, "blocked");

  simulation.enqueueCommand({
    name: "cancel_task",
    data: {
      task_id: "task_copy",
      confirm: true,
      expected_task_status: "blocked"
    }
  });
  simulation.tick();
  run = worldState.getOpenClawRun("task_copy");
  snapshot = simulation.getSnapshot();
  task = snapshot.tasks.find((item) => item.task_id === "task_copy");
  assert.equal(run.status, "failed");
  assert.equal(task.status, "cancelled");

  simulation.enqueueCommand({
    name: "rerun_task",
    data: {
      source_task_id: "task_copy",
      mode: "clone_as_new"
    }
  });
  simulation.tick();
  const rerunTask = simulation
    .getSnapshot()
    .tasks.find((item) => item.rerun_of_task_id === "task_copy");
  assert.ok(rerunTask);
  simulation.enqueueCommand({
    name: "assign_task",
    data: {
      task_id: rerunTask.task_id,
      agent_id: "agent_eng_1"
    }
  });
  simulation.tick();
  simulation.tick();
  assert.equal(worldState.getOpenClawRun(rerunTask.task_id)?.status, "started");

  simulation.enqueueCommand({
    name: "cancel_task",
    data: {
      task_id: rerunTask.task_id,
      confirm: true,
      expected_task_status: "in_progress"
    }
  });
  simulation.tick();
  const rerunRun = worldState.getOpenClawRun(rerunTask.task_id);
  const rerunSnapshot = simulation.getSnapshot();
  const cancelledRerun = rerunSnapshot.tasks.find((item) => item.task_id === rerunTask.task_id);
  assert.equal(rerunRun.status, "cancelled");
  assert.equal(cancelledRerun.status, "cancelled");
}

function testOpenClawOutputAdapterCreatesArtifactsDecisionsAndFollowUps() {
  const worldState = createWorldStateStore();
  const simulation = createSimulationRuntime({
    tickRateHz: 10,
    now: createDeterministicNow(),
    worldStateStore: worldState
  });

  simulation.enqueueCommand({
    name: "assign_task",
    data: {
      task_id: "task_copy",
      agent_id: "agent_eng_1"
    }
  });
  simulation.tick();
  simulation.tick();

  simulation.enqueueEvent({
    name: "openclaw_output_ready",
    task_id: "task_copy",
    output: {
      summary: "Generated first draft deliverables.",
      artifacts: [{ type: "report", title: "Landing page draft" }],
      decisions: [{ prompt: "Ship as-is?", options: ["Ship", "Revise"] }],
      follow_up_tasks: ["Prepare final polish pass"]
    }
  });
  simulation.tick();

  const snapshot = simulation.getSnapshot();
  const adaptedArtifact = snapshot.artifacts.find((item) => item.task_id === "task_copy" && item.artifact_id.startsWith("art_oc_"));
  const adaptedDecision = snapshot.decisions.find((item) => item.task_id === "task_copy" && item.decision_id.startsWith("dec_oc_"));
  const followUpTask = snapshot.tasks.find((item) => item.task_id.startsWith("task_oc_"));
  const adaptedTask = snapshot.tasks.find((item) => item.task_id === "task_copy");
  const run = worldState.getOpenClawRun("task_copy");

  assert.ok(adaptedArtifact);
  assert.equal(adaptedArtifact.type, "report");
  assert.ok(adaptedDecision);
  assert.equal(adaptedDecision.status, "open");
  assert.ok(followUpTask);
  assert.equal(followUpTask.status, "planned");
  assert.equal(adaptedTask.status, "blocked");
  assert.equal(run.status, "completed");
}

function testOpenClawOutputMalformedFallbackBlocksTaskSafely() {
  const worldState = createWorldStateStore();
  const simulation = createSimulationRuntime({
    tickRateHz: 10,
    now: createDeterministicNow(),
    worldStateStore: worldState
  });

  simulation.enqueueCommand({
    name: "assign_task",
    data: {
      task_id: "task_copy",
      agent_id: "agent_eng_1"
    }
  });
  simulation.tick();
  simulation.tick();

  simulation.enqueueEvent({
    name: "openclaw_output_ready",
    task_id: "task_copy",
    output: {
      summary: "No usable fields"
    }
  });
  simulation.tick();

  const snapshot = simulation.getSnapshot();
  const task = snapshot.tasks.find((item) => item.task_id === "task_copy");
  const fallbackDecision = snapshot.decisions.find(
    (item) => item.task_id === "task_copy" && item.status === "open"
  );
  const run = worldState.getOpenClawRun("task_copy");

  assert.equal(task.status, "blocked");
  assert.ok(fallbackDecision);
  assert.match(fallbackDecision.prompt, /malformed/i);
  assert.equal(run.status, "failed");
}

function testPlayerPosCacheFreshnessAndSeekUserFallbackBehavior() {
  const worldState = createWorldStateStore();
  const simulation = createSimulationRuntime({
    tickRateHz: 10,
    now: createDeterministicNow(),
    worldStateStore: worldState
  });

  simulation.enqueueCommand({
    name: "request_changes",
    data: {
      artifact_id: "art_research_report_v1",
      instructions: "Need user clarification before proceeding."
    }
  });
  simulation.tick();
  simulation.tick();

  let snapshot = simulation.getSnapshot();
  let researchAgent = snapshot.agents.find((agent) => agent.agent_id === "agent_research_1");
  let fsm = worldState.getAgentFsm("agent_research_1");
  let playerPosContext = worldState.getPlayerPositionContext();

  assert.equal(fsm.base_state, "SeekingUserDecision");
  assert.equal(playerPosContext.status, "unavailable");
  assert.equal(fsm.last_transition, "seek_user_fallback_unavailable");

  const freshTarget = [4, 0, 4];
  const beforeFreshDistance = distanceXZ(researchAgent.pos, freshTarget);
  simulation.enqueueCommand({
    name: "player_pos",
    data: {
      pos: freshTarget,
      facing: [0, 0, 1]
    }
  });
  simulation.tick();

  snapshot = simulation.getSnapshot();
  researchAgent = snapshot.agents.find((agent) => agent.agent_id === "agent_research_1");
  fsm = worldState.getAgentFsm("agent_research_1");
  playerPosContext = worldState.getPlayerPositionContext();

  assert.equal(playerPosContext.status, "fresh");
  assert.equal(fsm.last_transition, "seek_user_player_pos_fresh");
  assert.ok(distanceXZ(researchAgent.pos, freshTarget) < beforeFreshDistance);

  simulation.tick(8);
  snapshot = simulation.getSnapshot();
  researchAgent = snapshot.agents.find((agent) => agent.agent_id === "agent_research_1");
  playerPosContext = worldState.getPlayerPositionContext();
  assert.equal(playerPosContext.status, "stale");

  const beforeFallbackDistance = distanceXZ(researchAgent.pos, playerPosContext.fallback_pos);
  simulation.tick();
  snapshot = simulation.getSnapshot();
  researchAgent = snapshot.agents.find((agent) => agent.agent_id === "agent_research_1");
  fsm = worldState.getAgentFsm("agent_research_1");
  assert.equal(fsm.last_transition, "seek_user_fallback_stale");
  assert.ok(distanceXZ(researchAgent.pos, playerPosContext.fallback_pos) < beforeFallbackDistance);
}

function testSeekUserFallbackPrefersLoungePoiAnchorWhenAvailable() {
  const loungePos = [6, 0, -3];
  const worldState = createWorldStateStore({
    sceneNavLoader: (sceneId) => {
      const loaded = loadSceneNavGridRuntime(sceneId, { disableCache: true });
      return {
        ...loaded,
        poiAnchors: [
          {
            poi_id: "poi_lounge",
            anchor_id: "poi_lounge_nav_01",
            pos: loungePos
          }
        ]
      };
    }
  });
  const simulation = createSimulationRuntime({
    tickRateHz: 10,
    now: createDeterministicNow(),
    worldStateStore: worldState
  });

  simulation.enqueueCommand({
    name: "request_changes",
    data: {
      artifact_id: "art_research_report_v1",
      instructions: "Need to sync with the user before continuing."
    }
  });
  simulation.tick();
  simulation.tick();

  let snapshot = simulation.getSnapshot();
  let researchAgent = snapshot.agents.find((agent) => agent.agent_id === "agent_research_1");
  let context = worldState.getPlayerPositionContext();
  assert.equal(context.status, "unavailable");
  assert.deepEqual(context.fallback_pos, loungePos);
  assert.equal(context.fallback_source, "scene_poi_anchor");
  assert.equal(context.fallback_poi_id, "poi_lounge");

  const beforeDistance = distanceXZ(researchAgent.pos, loungePos);
  simulation.tick();
  snapshot = simulation.getSnapshot();
  researchAgent = snapshot.agents.find((agent) => agent.agent_id === "agent_research_1");
  context = worldState.getPlayerPositionContext();
  assert.ok(distanceXZ(researchAgent.pos, loungePos) < beforeDistance);
  assert.deepEqual(context.fallback_pos, loungePos);
}

function run() {
  testTickRateIsConfigurableAndObservable();
  testDeterministicReplayProducesIdenticalOutputs();
  testSnapshotCoherenceAndMonotonicClock();
  testLifecycleOrchestrationFlow();
  testProjectCompletionUnlocksDecorAtAvailableAnchor();
  testArtifactLifecycleVersioningAndSplitFanout();
  testAgentFsmTransitionsAndCeremonyOverrides();
  testCeremonyOverrideStackDedupAndDeterministicDecay();
  testFsmAndTaskLifecycleInvariantsRemainStable();
  testOpenClawRunStartsAtWorkingPoiAndCompletesViaStatusCallback();
  testOpenClawRunFailureAndCancellationInterruptSemantics();
  testOpenClawOutputAdapterCreatesArtifactsDecisionsAndFollowUps();
  testOpenClawOutputMalformedFallbackBlocksTaskSafely();
  testPlayerPosCacheFreshnessAndSeekUserFallbackBehavior();
  testSeekUserFallbackPrefersLoungePoiAnchorWhenAvailable();
  console.log("server-world simulation tests passed.");
}

run();
