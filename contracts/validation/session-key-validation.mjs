import {
  buildOfficeClawSessionKey,
  isOfficeClawSessionKey,
  parseOfficeClawSessionKey,
  SESSION_KEY_RULES
} from "../utils/session-key.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(fn, expectedSubstring) {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
    if (
      expectedSubstring &&
      !(error instanceof Error && error.message.includes(expectedSubstring))
    ) {
      throw new Error(
        `Expected error containing "${expectedSubstring}", got "${error.message}"`
      );
    }
  }

  if (!threw) {
    throw new Error("Expected function to throw");
  }
}

function testDeterministicKey() {
  const a = buildOfficeClawSessionKey("agent_bd", "proj_alpha");
  const b = buildOfficeClawSessionKey("agent_bd", "proj_alpha");
  assert(
    a === "agent:agent_bd:officeclaw:channel:proj_alpha",
    "Key should match canonical format"
  );
  assert(a === b, "Session key generation must be deterministic");
}

function testRoundTripParsing() {
  const key = buildOfficeClawSessionKey("agent_research_1", "proj_client_portal");
  const parsed = parseOfficeClawSessionKey(key);
  assert(parsed.agentId === "agent_research_1", "Round-trip agentId mismatch");
  assert(parsed.projectId === "proj_client_portal", "Round-trip projectId mismatch");
}

function testCollisionAvoidance() {
  const agentIds = ["agent_bd", "agent_eng_1", "agent_research_1"];
  const projectIds = ["proj_alpha", "proj_beta", "proj_gamma"];
  const keys = new Set();

  for (const agentId of agentIds) {
    for (const projectId of projectIds) {
      keys.add(buildOfficeClawSessionKey(agentId, projectId));
    }
  }

  assert(
    keys.size === agentIds.length * projectIds.length,
    "Distinct agent/project pairs should produce distinct session keys"
  );
}

function testInvalidInputs() {
  assertThrows(
    () => buildOfficeClawSessionKey("agent:bad", "proj_alpha"),
    "Invalid agentId format"
  );
  assertThrows(
    () => buildOfficeClawSessionKey("agent_bd", "proj:bad"),
    "Invalid projectId format"
  );
  assertThrows(
    () => parseOfficeClawSessionKey("agent:agent_bd:officeclaw:channel"),
    "segment count"
  );
  assertThrows(
    () => parseOfficeClawSessionKey("user:agent_bd:officeclaw:channel:proj_alpha"),
    "namespace"
  );
}

function testPredicate() {
  const valid = buildOfficeClawSessionKey("agent_bd", "proj_alpha");
  assert(isOfficeClawSessionKey(valid), "Valid session key should pass predicate");
  assert(
    !isOfficeClawSessionKey("agent:agent_bd:other:channel:proj_alpha"),
    "Invalid session key should fail predicate"
  );
}

function testRulesConstant() {
  assert(
    SESSION_KEY_RULES.format === "agent:{agent_id}:officeclaw:channel:{project_id}",
    "Format rule constant must match canonical strategy"
  );
}

function run() {
  testDeterministicKey();
  testRoundTripParsing();
  testCollisionAvoidance();
  testInvalidInputs();
  testPredicate();
  testRulesConstant();
  console.log("Session key validation passed");
}

run();
