const AGENT_ID_PATTERN = /^agent_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const PROJECT_ID_PATTERN = /^proj_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const DOMAIN = "officeclaw";
const CHANNEL = "channel";

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

export function assertValidAgentId(agentId) {
  assertNonEmptyString(agentId, "agentId");
  if (!AGENT_ID_PATTERN.test(agentId)) {
    throw new Error(`Invalid agentId format: ${agentId}`);
  }
}

export function assertValidProjectId(projectId) {
  assertNonEmptyString(projectId, "projectId");
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new Error(`Invalid projectId format: ${projectId}`);
  }
}

export function buildOfficeClawSessionKey(agentId, projectId) {
  assertValidAgentId(agentId);
  assertValidProjectId(projectId);
  return `agent:${agentId}:${DOMAIN}:${CHANNEL}:${projectId}`;
}

export function parseOfficeClawSessionKey(sessionKey) {
  assertNonEmptyString(sessionKey, "sessionKey");

  const parts = sessionKey.split(":");
  if (parts.length !== 5) {
    throw new Error(`Invalid session key segment count: ${sessionKey}`);
  }

  const [prefix, agentId, domain, channel, projectId] = parts;
  if (prefix !== "agent" || domain !== DOMAIN || channel !== CHANNEL) {
    throw new Error(`Invalid session key namespace: ${sessionKey}`);
  }

  assertValidAgentId(agentId);
  assertValidProjectId(projectId);

  return { agentId, projectId };
}

export function isOfficeClawSessionKey(sessionKey) {
  try {
    parseOfficeClawSessionKey(sessionKey);
    return true;
  } catch {
    return false;
  }
}

export const SESSION_KEY_RULES = Object.freeze({
  format: "agent:{agent_id}:officeclaw:channel:{project_id}",
  agentIdPattern: String(AGENT_ID_PATTERN),
  projectIdPattern: String(PROJECT_ID_PATTERN)
});
