import { randomUUID } from "node:crypto";
import { buildOfficeClawSessionKey } from "../../../contracts/utils/session-key.mjs";

const DEFAULT_POLICY = Object.freeze({
  version: "v0",
  allowedRequesterAgents: ["agent_bd"],
  allowedSpecialistAgents: ["agent_research_1", "agent_eng_1", "agent_ops_1"],
  allowSelfConsult: false,
  allowedUrgency: ["low", "normal", "high"]
});

function asNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CollaborationPolicyError("INVALID_INPUT", `${label} must be a non-empty string`);
  }
  return value.trim();
}

function toSet(values, fallback) {
  if (!Array.isArray(values)) {
    return new Set(fallback);
  }
  return new Set(values.filter((value) => typeof value === "string" && value.length > 0));
}

function normalizePolicy(input) {
  return {
    version:
      typeof input?.version === "string" && input.version.length > 0
        ? input.version
        : DEFAULT_POLICY.version,
    allowedRequesterAgents: toSet(
      input?.allowedRequesterAgents,
      DEFAULT_POLICY.allowedRequesterAgents
    ),
    allowedSpecialistAgents: toSet(
      input?.allowedSpecialistAgents,
      DEFAULT_POLICY.allowedSpecialistAgents
    ),
    allowSelfConsult:
      typeof input?.allowSelfConsult === "boolean"
        ? input.allowSelfConsult
        : DEFAULT_POLICY.allowSelfConsult,
    allowedUrgency: toSet(input?.allowedUrgency, DEFAULT_POLICY.allowedUrgency)
  };
}

function validateConsultRequest(policy, request) {
  const requesterAgentId = asNonEmptyString(request.requesterAgentId, "requesterAgentId");
  const specialistAgentId = asNonEmptyString(request.specialistAgentId, "specialistAgentId");
  const projectId = asNonEmptyString(request.projectId, "projectId");
  const objective = asNonEmptyString(request.objective, "objective");
  const urgency =
    typeof request.urgency === "string" && request.urgency.length > 0
      ? request.urgency
      : "normal";

  if (!policy.allowedRequesterAgents.has(requesterAgentId)) {
    throw new CollaborationPolicyError(
      "REQUESTER_NOT_ALLOWED",
      `Requester is not allowed to open consults: ${requesterAgentId}`
    );
  }
  if (!policy.allowedSpecialistAgents.has(specialistAgentId)) {
    throw new CollaborationPolicyError(
      "SPECIALIST_NOT_ALLOWED",
      `Specialist is not allowed for consults: ${specialistAgentId}`
    );
  }
  if (!policy.allowSelfConsult && requesterAgentId === specialistAgentId) {
    throw new CollaborationPolicyError(
      "SELF_CONSULT_BLOCKED",
      "Requester and specialist must be different agents"
    );
  }
  if (!policy.allowedUrgency.has(urgency)) {
    throw new CollaborationPolicyError(
      "URGENCY_NOT_ALLOWED",
      `Urgency value is not allowed by policy: ${urgency}`
    );
  }

  return {
    requesterAgentId,
    specialistAgentId,
    projectId,
    objective,
    urgency,
    contextSummary:
      typeof request.contextSummary === "string" ? request.contextSummary : undefined,
    parentTaskId:
      typeof request.parentTaskId === "string" ? request.parentTaskId : undefined,
    parentEventId:
      typeof request.parentEventId === "string" ? request.parentEventId : undefined,
    model:
      typeof request.model === "string" && request.model.length > 0
        ? request.model
        : "gpt-4o-mini"
  };
}

function buildConsultTrace(input, policy) {
  const requesterSessionKey = buildOfficeClawSessionKey(input.requesterAgentId, input.projectId);
  const specialistSessionKey = buildOfficeClawSessionKey(input.specialistAgentId, input.projectId);

  return {
    consult_id: `consult_${randomUUID()}`,
    consult_type: "bd_to_specialist",
    policy_version: policy.version,
    created_ts: new Date().toISOString(),
    requester_agent_id: input.requesterAgentId,
    specialist_agent_id: input.specialistAgentId,
    requester_session_key: requesterSessionKey,
    specialist_session_key: specialistSessionKey,
    project_id: input.projectId,
    parent_task_id: input.parentTaskId ?? null,
    parent_event_id: input.parentEventId ?? null,
    urgency: input.urgency,
    objective: input.objective
  };
}

function systemPromptForConsult() {
  return [
    "You are coordinating specialist consultation through OpenClaw session tools.",
    "Use `sessions_send` to consult the target specialist session key.",
    "Respond with concise actionable guidance and consult outcomes."
  ].join(" ");
}

function userPromptForConsult(input, trace) {
  const lines = [
    `Open a specialist consult for objective: ${input.objective}`,
    `Target specialist session: ${trace.specialist_session_key}`,
    `Urgency: ${input.urgency}`,
    `Consult trace id: ${trace.consult_id}`
  ];
  if (input.contextSummary) {
    lines.push(`Context: ${input.contextSummary}`);
  }
  if (input.parentTaskId) {
    lines.push(`Parent task: ${input.parentTaskId}`);
  }
  if (input.parentEventId) {
    lines.push(`Parent event: ${input.parentEventId}`);
  }
  return lines.join("\n");
}

function toolSpecs(trace) {
  return [
    {
      type: "function",
      function: {
        name: "sessions_send",
        description: "Send a consult request to another session key.",
        parameters: {
          type: "object",
          required: ["to_session_key", "message"],
          properties: {
            to_session_key: {
              type: "string",
              const: trace.specialist_session_key
            },
            message: {
              type: "string"
            },
            metadata: {
              type: "object"
            }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "sessions_history",
        description: "Read conversation history from a session key for traceability.",
        parameters: {
          type: "object",
          required: ["session_key"],
          properties: {
            session_key: {
              type: "string",
              const: trace.specialist_session_key
            },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 50
            }
          }
        }
      }
    }
  ];
}

export class CollaborationPolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CollaborationPolicyError";
    this.code = code;
  }
}

export function buildConsultEventMetadata(trace, status, extra = {}) {
  return {
    consult_id: trace.consult_id,
    consult_type: trace.consult_type,
    policy_version: trace.policy_version,
    requester_agent_id: trace.requester_agent_id,
    specialist_agent_id: trace.specialist_agent_id,
    requester_session_key: trace.requester_session_key,
    specialist_session_key: trace.specialist_session_key,
    project_id: trace.project_id,
    parent_task_id: trace.parent_task_id,
    parent_event_id: trace.parent_event_id,
    urgency: trace.urgency,
    status,
    ...extra
  };
}

export function createSessionCollaborationHooks({ gatewayClient, policy } = {}) {
  if (!gatewayClient || typeof gatewayClient.chatCompletions !== "function") {
    throw new Error("gatewayClient.chatCompletions is required");
  }

  const normalizedPolicy = normalizePolicy(policy);

  return {
    policy: normalizedPolicy,

    async requestConsult(request) {
      const input = validateConsultRequest(normalizedPolicy, request);
      const trace = buildConsultTrace(input, normalizedPolicy);

      const response = await gatewayClient.chatCompletions({
        agentId: input.requesterAgentId,
        sessionKey: trace.requester_session_key,
        model: input.model,
        messages: [
          { role: "system", content: systemPromptForConsult() },
          { role: "user", content: userPromptForConsult(input, trace) }
        ],
        tools: toolSpecs(trace),
        tool_choice: "auto",
        metadata: {
          trace,
          consult_kind: "bd_to_specialist"
        }
      });

      return {
        trace,
        response,
        eventMetadata: buildConsultEventMetadata(trace, "requested")
      };
    },

    async requestConsultHistory(request) {
      const input = validateConsultRequest(normalizedPolicy, request);
      const trace = buildConsultTrace(input, normalizedPolicy);

      const response = await gatewayClient.chatCompletions({
        agentId: input.requesterAgentId,
        sessionKey: trace.requester_session_key,
        model: input.model,
        messages: [
          { role: "system", content: "Summarize specialist consult history relevant to this request." },
          {
            role: "user",
            content: `Retrieve and summarize recent consult history for ${trace.specialist_session_key}`
          }
        ],
        tools: toolSpecs(trace),
        tool_choice: "auto",
        metadata: {
          trace,
          consult_kind: "bd_to_specialist_history"
        }
      });

      return {
        trace,
        response,
        eventMetadata: buildConsultEventMetadata(trace, "history_requested")
      };
    }
  };
}
