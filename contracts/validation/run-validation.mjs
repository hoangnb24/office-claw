import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(rootDir, "..");

function readJson(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function readRepoJson(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function buildAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const idSchema = readJson("schemas/identifiers.schema.json");
  const commandSchema = readJson("schemas/commands.schema.json");
  const entitySchema = readJson("schemas/entities.schema.json");
  const envelopeSchema = readJson("schemas/protocol-envelope.schema.json");
  const sceneManifestSchema = readJson("schemas/scene-manifest.schema.json");

  ajv.addSchema(idSchema);
  ajv.addSchema(commandSchema);
  ajv.addSchema(entitySchema);
  ajv.addSchema(envelopeSchema);
  ajv.addSchema(sceneManifestSchema);

  return ajv;
}

function formatErrors(errors) {
  return (errors || [])
    .map((err) => `${err.instancePath || "/"} ${err.message}`)
    .join("; ");
}

function assertValid(validate, value, label) {
  if (!validate(value)) {
    const details = formatErrors(validate.errors);
    throw new Error(`${label} failed validation: ${details}`);
  }
}

function assertInvalid(validate, value, label) {
  if (validate(value)) {
    throw new Error(`${label} unexpectedly passed validation`);
  }
}

function assertExpectedEnvelopeErrorClass(validateEnvelope, fixtureCase, label) {
  if (validateEnvelope(fixtureCase.message)) {
    throw new Error(`${label} unexpectedly passed validation: ${fixtureCase.name}`);
  }
  const observedClass = classifyEnvelopeError(
    fixtureCase.message.type,
    validateEnvelope.errors || []
  );
  if (observedClass !== fixtureCase.expected_error_class) {
    throw new Error(
      `${label} class mismatch for ${fixtureCase.name}: expected ${fixtureCase.expected_error_class}, got ${observedClass}`
    );
  }
}

const allowedTransitions = {
  task: {
    planned: ["in_progress", "cancelled"],
    in_progress: ["blocked", "done", "cancelled"],
    blocked: ["in_progress", "cancelled"],
    done: [],
    cancelled: []
  },
  decision: {
    open: ["resolved", "cancelled"],
    resolved: [],
    cancelled: []
  },
  artifact: {
    created: ["delivered", "superseded"],
    delivered: ["in_review", "approved", "changes_requested", "superseded"],
    in_review: ["approved", "changes_requested", "superseded"],
    changes_requested: ["in_review", "superseded"],
    approved: ["archived", "superseded"],
    superseded: ["archived"],
    archived: []
  }
};

const payloadErrorClassByType = {
  hello: "ERR_HELLO_PAYLOAD",
  hello_ack: "ERR_HELLO_ACK_PAYLOAD",
  subscribe: "ERR_SUBSCRIBE_PAYLOAD",
  event: "ERR_EVENT_PAYLOAD",
  snapshot: "ERR_SNAPSHOT_PAYLOAD",
  agent_goal: "ERR_AGENT_GOAL_PAYLOAD",
  agent_stream: "ERR_AGENT_STREAM_PAYLOAD",
  chat: "ERR_CHAT_PAYLOAD",
  command: "ERR_COMMAND_PAYLOAD",
  ack: "ERR_ACK_PAYLOAD",
  error: "ERR_ERROR_PAYLOAD",
  ping: "ERR_PING_PAYLOAD",
  pong: "ERR_PONG_PAYLOAD"
};

function classifyEnvelopeError(type, errors) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return "ERR_ENVELOPE_SCHEMA";
  }

  const hasPayloadError = errors.some((err) => (err.instancePath || "").startsWith("/payload"));

  const hasEnvelopeError = errors.some((err) => {
    const path = err.instancePath || "";
    if (err.keyword === "if" && hasPayloadError) {
      return false;
    }
    return path === "" || path === "/type" || path === "/id" || path === "/ts" || path === "/v" || !path.startsWith("/payload");
  });

  if (hasEnvelopeError) {
    return "ERR_ENVELOPE_SCHEMA";
  }

  return payloadErrorClassByType[type] || "ERR_ENVELOPE_SCHEMA";
}

function validateTransitionSequence(kind, sequence) {
  const table = allowedTransitions[kind];
  if (!table || !Array.isArray(sequence) || sequence.length < 2) {
    return false;
  }

  for (let i = 1; i < sequence.length; i += 1) {
    const from = sequence[i - 1];
    const to = sequence[i];
    const allowed = table[from];
    if (!Array.isArray(allowed) || !allowed.includes(to)) {
      return false;
    }
  }

  return true;
}

function assertCrossEntityRefs(snapshot) {
  const projectIds = new Set(snapshot.projects.map((project) => project.project_id));
  const taskIds = new Set(snapshot.tasks.map((task) => task.task_id));
  const agentIds = new Set(snapshot.agents.map((agent) => agent.agent_id));

  for (const task of snapshot.tasks) {
    if (!projectIds.has(task.project_id)) {
      throw new Error(`Task ${task.task_id} references unknown project ${task.project_id}`);
    }
    if (task.assignee && !agentIds.has(task.assignee)) {
      throw new Error(`Task ${task.task_id} references unknown assignee ${task.assignee}`);
    }
  }

  for (const decision of snapshot.decisions) {
    if (!projectIds.has(decision.project_id)) {
      throw new Error(
        `Decision ${decision.decision_id} references unknown project ${decision.project_id}`
      );
    }
    if (decision.task_id && !taskIds.has(decision.task_id)) {
      throw new Error(`Decision ${decision.decision_id} references unknown task ${decision.task_id}`);
    }
  }

  for (const artifact of snapshot.artifacts) {
    if (!projectIds.has(artifact.project_id)) {
      throw new Error(
        `Artifact ${artifact.artifact_id} references unknown project ${artifact.project_id}`
      );
    }
    if (artifact.task_id && !taskIds.has(artifact.task_id)) {
      throw new Error(`Artifact ${artifact.artifact_id} references unknown task ${artifact.task_id}`);
    }
  }

  for (const agent of snapshot.agents) {
    if (agent.task_id && !taskIds.has(agent.task_id)) {
      throw new Error(`Agent ${agent.agent_id} references unknown task ${agent.task_id}`);
    }
  }
}

function assertSceneManifestConsistency(scene) {
  const poiIds = new Set();

  scene.pois.forEach((poi, poiIndex) => {
    if (poiIds.has(poi.poi_id)) {
      throw new Error(`pois[${poiIndex}].poi_id is duplicated: ${poi.poi_id}`);
    }
    poiIds.add(poi.poi_id);

    if (!Array.isArray(poi.highlight_nodes) || poi.highlight_nodes.length === 0) {
      throw new Error(`pois[${poiIndex}].highlight_nodes must include at least one node`);
    }

    const anchorIds = new Set();
    poi.nav_anchors.forEach((anchor, anchorIndex) => {
      if (anchorIds.has(anchor.id)) {
        throw new Error(
          `pois[${poiIndex}].nav_anchors[${anchorIndex}].id duplicated: ${anchor.id}`
        );
      }
      anchorIds.add(anchor.id);
    });
  });

  scene.objects.forEach((object, objectIndex) => {
    if (object.poi_id && !poiIds.has(object.poi_id)) {
      throw new Error(
        `objects[${objectIndex}].poi_id references missing POI: ${object.poi_id}`
      );
    }

    if (object.interaction && !object.poi_id) {
      throw new Error(
        `objects[${objectIndex}] defines interaction but is missing poi_id for routing`
      );
    }
  });

  const grid = scene.navigation.grid;
  if (Array.isArray(grid.walkable)) {
    const expected = grid.width * grid.height;
    if (grid.walkable.length !== expected) {
      throw new Error(
        `navigation.grid.walkable length ${grid.walkable.length} does not match width*height ${expected}`
      );
    }
  }

  if (scene.decor_anchors) {
    const seenAnchorIds = new Set();
    for (const [group, anchors] of Object.entries(scene.decor_anchors)) {
      anchors.forEach((anchor, index) => {
        if (seenAnchorIds.has(anchor.anchor_id)) {
          throw new Error(
            `decor_anchors.${group}[${index}].anchor_id is duplicated: ${anchor.anchor_id}`
          );
        }
        seenAnchorIds.add(anchor.anchor_id);
      });
    }
  }
}

function assertAckErrorCorrelation(messages, label) {
  const commandIds = new Set(
    messages.filter((message) => message.type === "command").map((message) => message.id)
  );
  const terminalCounts = new Map();

  for (const message of messages) {
    if (message.type !== "ack" && message.type !== "error") {
      continue;
    }

    const inReplyTo = message.payload?.in_reply_to;
    if (!commandIds.has(inReplyTo)) {
      throw new Error(`${label}: response ${message.id} references unknown command ${inReplyTo}`);
    }

    terminalCounts.set(inReplyTo, (terminalCounts.get(inReplyTo) || 0) + 1);
  }

  for (const commandId of commandIds) {
    const count = terminalCounts.get(commandId) || 0;
    if (count !== 1) {
      throw new Error(`${label}: command ${commandId} has ${count} terminal responses (expected 1)`);
    }
  }
}

function assertFlowEventOrder(messages, expectedEventNames, label) {
  const actualEventNames = messages
    .filter((message) => message.type === "event")
    .map((message) => message.payload?.name);

  if (actualEventNames.length !== expectedEventNames.length) {
    throw new Error(
      `${label}: expected ${expectedEventNames.length} events but found ${actualEventNames.length}`
    );
  }

  expectedEventNames.forEach((name, index) => {
    if (actualEventNames[index] !== name) {
      throw new Error(
        `${label}: event index ${index} expected "${name}" but found "${actualEventNames[index]}"`
      );
    }
  });
}

function assertHelloHandshakeFixture(fixture, validateEnvelope) {
  const successMessages = fixture.success.messages;
  const incompatibleMessages = fixture.incompatible.messages;

  successMessages.forEach((message, index) =>
    assertValid(validateEnvelope, message, `hello-handshake.success[${index}]`)
  );
  incompatibleMessages.forEach((message, index) =>
    assertValid(validateEnvelope, message, `hello-handshake.incompatible[${index}]`)
  );

  const hello = successMessages[0];
  const helloAck = successMessages[1];
  if (hello.type !== "hello" || helloAck.type !== "hello_ack") {
    throw new Error("hello-handshake.success must be hello followed by hello_ack");
  }
  if (hello.ts >= helloAck.ts) {
    throw new Error("hello-handshake.success hello_ack must occur after hello");
  }

  const badHello = incompatibleMessages[0];
  const badError = incompatibleMessages[1];
  if (badHello.type !== "hello" || badError.type !== "error") {
    throw new Error("hello-handshake.incompatible must be hello followed by error");
  }
  if (badError.payload.in_reply_to !== badHello.id) {
    throw new Error("hello-handshake.incompatible error must reference hello id in_reply_to");
  }
}

function assertSubscribeInitialSnapshotFixture(fixture, validateEnvelope) {
  fixture.messages.forEach((message, index) =>
    assertValid(validateEnvelope, message, `subscribe-initial-snapshot.messages[${index}]`)
  );

  const subscribe = fixture.messages.find((message) => message.type === "subscribe");
  const snapshot = fixture.messages.find((message) => message.type === "snapshot");
  if (!subscribe || !snapshot) {
    throw new Error("subscribe-initial-snapshot fixture requires subscribe and snapshot messages");
  }
  if (subscribe.ts >= snapshot.ts) {
    throw new Error("subscribe-initial-snapshot snapshot must be emitted after subscribe");
  }
  if (subscribe.payload.scene_id !== snapshot.payload.scene_id) {
    throw new Error("subscribe-initial-snapshot scene_id mismatch between subscribe and snapshot");
  }
}

function assertReconnectResyncFlowFixture(fixture, validateEnvelope) {
  fixture.messages.forEach((message, index) =>
    assertValid(validateEnvelope, message, `golden-flow-reconnect-resync.messages[${index}]`)
  );

  const hello = fixture.messages.find((message) => message.type === "hello");
  const helloAck = fixture.messages.find((message) => message.type === "hello_ack");
  const subscribe = fixture.messages.find((message) => message.type === "subscribe");
  const snapshot = fixture.messages.find((message) => message.type === "snapshot");

  if (!hello || !helloAck || !subscribe || !snapshot) {
    throw new Error(
      "golden-flow-reconnect-resync requires hello, hello_ack, subscribe, and snapshot messages"
    );
  }

  const resumeCursor = hello.payload?.resume?.last_seq;
  const resumeStatus = helloAck.payload?.resume?.status;
  const replayFromSeq = helloAck.payload?.resume?.replay_from_seq;
  if (!Number.isInteger(resumeCursor) || resumeCursor < 0) {
    throw new Error(
      "golden-flow-reconnect-resync hello payload.resume.last_seq must be a non-negative integer"
    );
  }
  if (resumeStatus !== "resumed") {
    throw new Error(
      `golden-flow-reconnect-resync expected hello_ack resume.status="resumed" but found "${resumeStatus}"`
    );
  }
  if (!Number.isInteger(replayFromSeq) || replayFromSeq !== resumeCursor + 1) {
    throw new Error(
      "golden-flow-reconnect-resync replay_from_seq must equal hello resume last_seq + 1"
    );
  }

  if (hello.ts >= helloAck.ts || helloAck.ts >= subscribe.ts || subscribe.ts >= snapshot.ts) {
    throw new Error(
      "golden-flow-reconnect-resync message timestamps must be ordered hello -> hello_ack -> subscribe -> snapshot"
    );
  }

  const replayEvents = fixture.messages.filter((message) => message.type === "event");
  if (replayEvents.length === 0) {
    throw new Error("golden-flow-reconnect-resync requires replay event messages");
  }

  let previousSeq = null;
  replayEvents.forEach((event, index) => {
    const seq = event.payload?.seq;
    if (!Number.isInteger(seq)) {
      throw new Error(
        `golden-flow-reconnect-resync event ${event.id} is missing integer payload.seq`
      );
    }
    if (index === 0 && seq !== replayFromSeq) {
      throw new Error(
        `golden-flow-reconnect-resync first replay seq must equal replay_from_seq (${replayFromSeq})`
      );
    }
    if (seq < replayFromSeq) {
      throw new Error(
        `golden-flow-reconnect-resync event ${event.id} seq ${seq} is below replay_from_seq ${replayFromSeq}`
      );
    }
    if (previousSeq !== null && seq <= previousSeq) {
      throw new Error(
        `golden-flow-reconnect-resync replay event seq must be strictly increasing; saw ${seq} after ${previousSeq}`
      );
    }
    previousSeq = seq;
  });

  assertCrossEntityRefs(snapshot.payload);
  const projectIds = new Set(snapshot.payload.projects.map((project) => project.project_id));
  const taskIds = new Set(snapshot.payload.tasks.map((task) => task.task_id));
  const agentIds = new Set(snapshot.payload.agents.map((agent) => agent.agent_id));
  for (const event of replayEvents) {
    const payload = event.payload || {};
    if (!projectIds.has(payload.project_id)) {
      throw new Error(
        `golden-flow-reconnect-resync event ${event.id} references unknown project ${payload.project_id}`
      );
    }
    if (payload.task_id && !taskIds.has(payload.task_id)) {
      throw new Error(
        `golden-flow-reconnect-resync event ${event.id} references unknown task ${payload.task_id}`
      );
    }
    if (payload.agent_id && !agentIds.has(payload.agent_id)) {
      throw new Error(
        `golden-flow-reconnect-resync event ${event.id} references unknown agent ${payload.agent_id}`
      );
    }
  }
}

function assertHeartbeatPolicyFixture(fixture, validateEnvelope) {
  const { ping_interval_s: pingInterval, timeout_s: timeout } = fixture.policy;
  if (pingInterval !== 15 || timeout !== 45) {
    throw new Error("heartbeat policy fixture must define 15s ping interval and 45s timeout");
  }

  fixture.messages.forEach((message, index) =>
    assertValid(validateEnvelope, message, `heartbeat-policy.messages[${index}]`)
  );

  const pings = fixture.messages.filter((message) => message.type === "ping");
  const pongs = fixture.messages.filter((message) => message.type === "pong");
  if (pings.length !== pongs.length) {
    throw new Error("heartbeat-policy fixture requires one pong for each ping");
  }

  pings.forEach((ping, index) => {
    const pong = pongs[index];
    if (ping.payload.nonce !== pong.payload.nonce) {
      throw new Error(`heartbeat-policy nonce mismatch for pair index ${index}`);
    }
    if (pong.ts - ping.ts > timeout) {
      throw new Error(`heartbeat-policy pong exceeded timeout for nonce ${ping.payload.nonce}`);
    }
    if (index > 0) {
      const delta = ping.ts - pings[index - 1].ts;
      if (delta !== pingInterval) {
        throw new Error(
          `heartbeat-policy expected ping interval ${pingInterval}s but observed ${delta}s`
        );
      }
    }
  });
}

function hydrateSceneManifest(scene) {
  return {
    sceneId: scene.scene_id,
    poiById: new Map(scene.pois.map((poi) => [poi.poi_id, poi])),
    objectById: new Map(scene.objects.map((object) => [object.id, object])),
    spawnAgentIds: new Set(Object.keys(scene.spawns?.agents || {}))
  };
}

function run() {
  const ajv = buildAjv();
  const validateProject = ajv.getSchema("https://officeclaw.dev/schemas/entities.schema.json#/$defs/project");
  const validateAgent = ajv.getSchema("https://officeclaw.dev/schemas/entities.schema.json#/$defs/agent");
  const validateTask = ajv.getSchema("https://officeclaw.dev/schemas/entities.schema.json#/$defs/task");
  const validateDecision = ajv.getSchema("https://officeclaw.dev/schemas/entities.schema.json#/$defs/decision");
  const validateArtifact = ajv.getSchema("https://officeclaw.dev/schemas/entities.schema.json#/$defs/artifact");
  const validateCommandPayload = ajv.getSchema(
    "https://officeclaw.dev/schemas/commands.schema.json#/$defs/command_payload"
  );
  const validateAckPayload = ajv.getSchema(
    "https://officeclaw.dev/schemas/commands.schema.json#/$defs/ack_payload"
  );
  const validateErrorPayload = ajv.getSchema(
    "https://officeclaw.dev/schemas/commands.schema.json#/$defs/error_payload"
  );
  const validateEnvelope = ajv.getSchema("https://officeclaw.dev/schemas/protocol-envelope.schema.json");
  const validateSceneManifest = ajv.getSchema(
    "https://officeclaw.dev/schemas/scene-manifest.schema.json"
  );

  if (
    !validateProject ||
    !validateAgent ||
    !validateTask ||
    !validateDecision ||
    !validateArtifact ||
    !validateCommandPayload ||
    !validateAckPayload ||
    !validateErrorPayload ||
    !validateEnvelope ||
    !validateSceneManifest
  ) {
    throw new Error("Failed to compile one or more validators");
  }

  const golden = readJson("fixtures/golden-session.fixture.json");

  assertValid(validateProject, golden.project, "golden.project");
  golden.agents.forEach((item, index) => assertValid(validateAgent, item, `golden.agents[${index}]`));
  golden.tasks.forEach((item, index) => assertValid(validateTask, item, `golden.tasks[${index}]`));
  golden.decisions.forEach((item, index) =>
    assertValid(validateDecision, item, `golden.decisions[${index}]`)
  );
  golden.artifacts.forEach((item, index) =>
    assertValid(validateArtifact, item, `golden.artifacts[${index}]`)
  );
  golden.messages.forEach((item, index) =>
    assertValid(validateEnvelope, item, `golden.messages[${index}]`)
  );
  assertAckErrorCorrelation(golden.messages, "golden.messages");

  const compatibilityEvent = structuredClone(golden.messages.find((item) => item.type === "event"));
  if (!compatibilityEvent) {
    throw new Error("golden fixture missing event message");
  }
  compatibilityEvent.payload.future_optional = "allowed_in_backward_compatible_messages";
  assertValid(validateEnvelope, compatibilityEvent, "backward-compatible event payload");

  const snapshotMessage = golden.messages.find((item) => item.type === "snapshot");
  if (!snapshotMessage) {
    throw new Error("golden fixture missing snapshot message");
  }
  assertCrossEntityRefs(snapshotMessage.payload);

  const projectIds = new Set([golden.project.project_id]);
  const taskIds = new Set(golden.tasks.map((task) => task.task_id));
  const decisionIds = new Set(golden.decisions.map((decision) => decision.decision_id));
  const artifactIds = new Set(golden.artifacts.map((artifact) => artifact.artifact_id));
  const agentIds = new Set(golden.agents.map((agent) => agent.agent_id));

  for (const message of golden.messages) {
    if (message.type === "event") {
      const payload = message.payload;
      if (!projectIds.has(payload.project_id)) {
        throw new Error(`Event ${message.id} references unknown project ${payload.project_id}`);
      }
      if (payload.task_id && !taskIds.has(payload.task_id)) {
        throw new Error(`Event ${message.id} references unknown task ${payload.task_id}`);
      }
      if (payload.decision_id && !decisionIds.has(payload.decision_id)) {
        throw new Error(`Event ${message.id} references unknown decision ${payload.decision_id}`);
      }
      if (payload.artifact_id && !artifactIds.has(payload.artifact_id)) {
        throw new Error(`Event ${message.id} references unknown artifact ${payload.artifact_id}`);
      }
      if (payload.agent_id && !agentIds.has(payload.agent_id)) {
        throw new Error(`Event ${message.id} references unknown agent ${payload.agent_id}`);
      }
    }

    if (message.type === "command" && message.payload.name === "resolve_decision") {
      const decisionId = message.payload.data.decision_id;
      if (!decisionIds.has(decisionId)) {
        throw new Error(`Command ${message.id} references unknown decision ${decisionId}`);
      }
    }
  }

  if (!validateTransitionSequence("task", golden.transition_sequences.task)) {
    throw new Error("Golden task lifecycle sequence is invalid");
  }
  if (!validateTransitionSequence("decision", golden.transition_sequences.decision)) {
    throw new Error("Golden decision lifecycle sequence is invalid");
  }
  if (!validateTransitionSequence("artifact", golden.transition_sequences.artifact)) {
    throw new Error("Golden artifact lifecycle sequence is invalid");
  }

  const invalidIds = readJson("fixtures/invalid-ids.fixture.json");
  assertInvalid(validateProject, invalidIds.project, "invalid-ids.project");
  assertInvalid(validateTask, invalidIds.task, "invalid-ids.task");
  assertInvalid(validateEnvelope, invalidIds.message, "invalid-ids.message");

  const invalidTransitions = readJson("fixtures/illegal-transitions.fixture.json");
  if (validateTransitionSequence("task", invalidTransitions.task)) {
    throw new Error("illegal task transition unexpectedly passed");
  }
  if (validateTransitionSequence("decision", invalidTransitions.decision)) {
    throw new Error("illegal decision transition unexpectedly passed");
  }
  if (validateTransitionSequence("artifact", invalidTransitions.artifact)) {
    throw new Error("illegal artifact transition unexpectedly passed");
  }

  const invalidPayloads = readJson("fixtures/invalid-payloads.fixture.json");
  for (const fixtureCase of invalidPayloads.cases) {
    assertExpectedEnvelopeErrorClass(validateEnvelope, fixtureCase, "invalid payload fixture");
  }

  const requiredFieldCoverage = readJson("fixtures/required-fields.fixture.json");
  for (const fixtureCase of requiredFieldCoverage.cases) {
    assertExpectedEnvelopeErrorClass(
      validateEnvelope,
      fixtureCase,
      "required field coverage fixture"
    );
  }

  const helloHandshakeFixture = readJson("fixtures/hello-handshake.fixture.json");
  assertHelloHandshakeFixture(helloHandshakeFixture, validateEnvelope);

  const subscribeSnapshotFixture = readJson("fixtures/subscribe-initial-snapshot.fixture.json");
  assertSubscribeInitialSnapshotFixture(subscribeSnapshotFixture, validateEnvelope);
  const subscribeSnapshot = subscribeSnapshotFixture.messages.find(
    (message) => message.type === "snapshot"
  );
  if (!subscribeSnapshot) {
    throw new Error("subscribe-initial-snapshot fixture requires snapshot payload");
  }
  assertCrossEntityRefs(subscribeSnapshot.payload);

  const heartbeatFixture = readJson("fixtures/heartbeat-policy.fixture.json");
  assertHeartbeatPolicyFixture(heartbeatFixture, validateEnvelope);

  const commandCatalog = readJson("fixtures/command-taxonomy.fixture.json");
  commandCatalog.commands.forEach((message, index) => {
    assertValid(validateEnvelope, message, `command-taxonomy.commands[${index}]`);
    assertValid(
      validateCommandPayload,
      message.payload,
      `command-taxonomy.commands[${index}].payload`
    );
  });

  commandCatalog.responses.forEach((message, index) => {
    assertValid(validateEnvelope, message, `command-taxonomy.responses[${index}]`);
    if (message.type === "ack") {
      assertValid(
        validateAckPayload,
        message.payload,
        `command-taxonomy.responses[${index}].payload`
      );
    }
    if (message.type === "error") {
      assertValid(
        validateErrorPayload,
        message.payload,
        `command-taxonomy.responses[${index}].payload`
      );
    }
  });
  assertAckErrorCorrelation(
    [...commandCatalog.commands, ...commandCatalog.responses],
    "command-taxonomy"
  );

  const invalidCorrelationCases = readJson("fixtures/invalid-ack-error-correlation.fixture.json");
  for (const fixtureCase of invalidCorrelationCases.cases) {
    fixtureCase.messages.forEach((message, index) => {
      assertValid(
        validateEnvelope,
        message,
        `invalid-ack-error-correlation.${fixtureCase.name}.messages[${index}]`
      );
    });

    let observedError = "";
    try {
      assertAckErrorCorrelation(
        fixtureCase.messages,
        `invalid-ack-error-correlation.${fixtureCase.name}`
      );
    } catch (error) {
      observedError = String(error.message || error);
    }

    if (!observedError) {
      throw new Error(
        `invalid-ack-error-correlation fixture unexpectedly passed: ${fixtureCase.name}`
      );
    }

    if (!observedError.includes(fixtureCase.expected_error_contains)) {
      throw new Error(
        `invalid-ack-error-correlation mismatch for ${fixtureCase.name}: expected substring "${fixtureCase.expected_error_contains}", got "${observedError}"`
      );
    }
  }

  const submitKickoffFlow = readJson("fixtures/golden-flow-submit-kickoff.fixture.json");
  submitKickoffFlow.messages.forEach((message, index) => {
    assertValid(validateEnvelope, message, `golden-flow-submit-kickoff.messages[${index}]`);
  });
  assertAckErrorCorrelation(submitKickoffFlow.messages, "golden-flow-submit-kickoff");
  assertFlowEventOrder(
    submitKickoffFlow.messages,
    ["request_submitted", "request_accepted", "kickoff_started", "tasks_created"],
    "golden-flow-submit-kickoff"
  );
  const flowProjectIds = new Set(
    submitKickoffFlow.messages
      .filter((message) => message.type === "event")
      .map((message) => message.payload.project_id)
  );
  if (flowProjectIds.size !== 1) {
    throw new Error("golden-flow-submit-kickoff: events must reference exactly one project_id");
  }
  const tasksCreatedEvent = submitKickoffFlow.messages.find(
    (message) => message.type === "event" && message.payload?.name === "tasks_created"
  );
  const createdTaskIds = tasksCreatedEvent?.payload?.meta?.task_ids;
  if (!Array.isArray(createdTaskIds) || createdTaskIds.length === 0) {
    throw new Error(
      "golden-flow-submit-kickoff: tasks_created meta.task_ids must contain at least one task id"
    );
  }

  const artifactApproveFlow = readJson("fixtures/golden-flow-artifact-approve.fixture.json");
  artifactApproveFlow.messages.forEach((message, index) => {
    assertValid(validateEnvelope, message, `golden-flow-artifact-approve.messages[${index}]`);
  });
  assertAckErrorCorrelation(artifactApproveFlow.messages, "golden-flow-artifact-approve");
  assertFlowEventOrder(
    artifactApproveFlow.messages,
    ["artifact_delivered", "review_approved", "task_done"],
    "golden-flow-artifact-approve"
  );
  const approveSnapshot = artifactApproveFlow.messages.find(
    (message) => message.type === "snapshot"
  );
  if (!approveSnapshot) {
    throw new Error("golden-flow-artifact-approve: snapshot message is required");
  }
  assertCrossEntityRefs(approveSnapshot.payload);
  const doneTask = approveSnapshot.payload.tasks.find((task) => task.task_id === "task_content_200");
  if (!doneTask || doneTask.status !== "done") {
    throw new Error("golden-flow-artifact-approve: expected task_content_200 status done in snapshot");
  }
  const approvedArtifact = approveSnapshot.payload.artifacts.find(
    (artifact) => artifact.artifact_id === "art_copy_v1_200"
  );
  if (!approvedArtifact || approvedArtifact.status !== "approved") {
    throw new Error(
      "golden-flow-artifact-approve: expected art_copy_v1_200 status approved in snapshot"
    );
  }

  const blockedDecisionFlow = readJson("fixtures/golden-flow-blocked-decision.fixture.json");
  blockedDecisionFlow.messages.forEach((message, index) => {
    assertValid(validateEnvelope, message, `golden-flow-blocked-decision.messages[${index}]`);
  });
  assertAckErrorCorrelation(blockedDecisionFlow.messages, "golden-flow-blocked-decision");
  assertFlowEventOrder(
    blockedDecisionFlow.messages,
    ["task_blocked", "decision_requested", "decision_resolved", "task_started"],
    "golden-flow-blocked-decision"
  );
  const blockedSnapshot = blockedDecisionFlow.messages.find(
    (message) => message.type === "snapshot"
  );
  if (!blockedSnapshot) {
    throw new Error("golden-flow-blocked-decision: snapshot message is required");
  }
  assertCrossEntityRefs(blockedSnapshot.payload);
  const resumedTask = blockedSnapshot.payload.tasks.find((task) => task.task_id === "task_copy_300");
  if (!resumedTask || resumedTask.status !== "in_progress") {
    throw new Error(
      "golden-flow-blocked-decision: expected task_copy_300 status in_progress in snapshot"
    );
  }
  const resolvedDecision = blockedSnapshot.payload.decisions.find(
    (decision) => decision.decision_id === "dec_audience_300"
  );
  if (!resolvedDecision || resolvedDecision.status !== "resolved") {
    throw new Error(
      "golden-flow-blocked-decision: expected dec_audience_300 status resolved in snapshot"
    );
  }

  const assignProgressFlow = readJson("fixtures/golden-flow-assign-progress.fixture.json");
  assignProgressFlow.messages.forEach((message, index) => {
    assertValid(validateEnvelope, message, `golden-flow-assign-progress.messages[${index}]`);
  });
  assertAckErrorCorrelation(assignProgressFlow.messages, "golden-flow-assign-progress");
  assertFlowEventOrder(
    assignProgressFlow.messages,
    ["task_assigned", "task_started", "task_progress"],
    "golden-flow-assign-progress"
  );
  const assignSnapshot = assignProgressFlow.messages.find(
    (message) => message.type === "snapshot"
  );
  if (!assignSnapshot) {
    throw new Error("golden-flow-assign-progress: snapshot message is required");
  }
  assertCrossEntityRefs(assignSnapshot.payload);
  const assignedTask = assignSnapshot.payload.tasks.find((task) => task.task_id === "task_copy_400");
  if (!assignedTask || assignedTask.status !== "in_progress" || assignedTask.assignee !== "agent_eng_1") {
    throw new Error(
      "golden-flow-assign-progress: expected task_copy_400 status in_progress assigned to agent_eng_1"
    );
  }
  const assignedAgent = assignSnapshot.payload.agents.find((agent) => agent.agent_id === "agent_eng_1");
  if (!assignedAgent || assignedAgent.task_id !== "task_copy_400") {
    throw new Error(
      "golden-flow-assign-progress: expected agent_eng_1 task_id to reflect task_copy_400"
    );
  }
  const progressEvent = assignProgressFlow.messages.find(
    (message) => message.type === "event" && message.payload?.name === "task_progress"
  );
  const progressPercent = progressEvent?.payload?.percent;
  const progressPreview = progressEvent?.payload?.preview_text;
  if (!Number.isFinite(progressPercent) || progressPercent <= 0 || progressPercent >= 100) {
    throw new Error(
      "golden-flow-assign-progress: task_progress percent must be a bounded in-progress value (1-99)"
    );
  }
  if (typeof progressPreview !== "string" || progressPreview.trim().length === 0) {
    throw new Error(
      "golden-flow-assign-progress: task_progress preview_text must be a non-empty string"
    );
  }

  const reconnectResyncFlow = readJson("fixtures/golden-flow-reconnect-resync.fixture.json");
  assertReconnectResyncFlowFixture(reconnectResyncFlow, validateEnvelope);

  const validScene = readRepoJson("assets/scenes/cozy_office_v0.scene.json");
  assertValid(validateSceneManifest, validScene, "valid scene manifest");
  assertSceneManifestConsistency(validScene);
  const hydrated = hydrateSceneManifest(validScene);
  if (hydrated.poiById.size === 0 || hydrated.objectById.size === 0) {
    throw new Error("Scene hydration failed to produce runtime POI/object maps");
  }

  const invalidScenes = readJson("fixtures/invalid-scene-manifest.fixture.json");
  for (const fixtureCase of invalidScenes.cases) {
    const schemaValid = validateSceneManifest(fixtureCase.manifest);
    let observedError = "";

    if (!schemaValid) {
      observedError = formatErrors(validateSceneManifest.errors);
    } else {
      try {
        assertSceneManifestConsistency(fixtureCase.manifest);
      } catch (error) {
        observedError = String(error.message || error);
      }
    }

    if (!observedError) {
      throw new Error(
        `invalid scene fixture unexpectedly passed: ${fixtureCase.name}`
      );
    }

    if (!observedError.includes(fixtureCase.expected_error_contains)) {
      throw new Error(
        `invalid scene fixture mismatch for ${fixtureCase.name}: expected substring "${fixtureCase.expected_error_contains}", got "${observedError}"`
      );
    }
  }

  console.log("All contract validations passed.");
}

run();
