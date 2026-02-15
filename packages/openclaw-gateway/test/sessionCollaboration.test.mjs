import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConsultEventMetadata,
  CollaborationPolicyError,
  createSessionCollaborationHooks
} from "../src/index.mjs";

function baseRequest() {
  return {
    requesterAgentId: "agent_bd",
    specialistAgentId: "agent_research_1",
    projectId: "proj_alpha",
    objective: "Need competitor synthesis for kickoff",
    contextSummary: "Kickoff event happened; waiting on research direction.",
    parentTaskId: "task_research_42",
    parentEventId: "evt_1001"
  };
}

test("requestConsult enforces requester/specialist policy", async () => {
  const gatewayClient = {
    chatCompletions: async () => ({ ok: true })
  };

  const hooks = createSessionCollaborationHooks({
    gatewayClient,
    policy: {
      allowedRequesterAgents: ["agent_bd"],
      allowedSpecialistAgents: ["agent_research_1"]
    }
  });

  await assert.rejects(
    () =>
      hooks.requestConsult({
        ...baseRequest(),
        requesterAgentId: "agent_random"
      }),
    (error) => {
      assert.ok(error instanceof CollaborationPolicyError);
      assert.equal(error.code, "REQUESTER_NOT_ALLOWED");
      return true;
    }
  );

  await assert.rejects(
    () =>
      hooks.requestConsult({
        ...baseRequest(),
        specialistAgentId: "agent_unlisted"
      }),
    (error) => {
      assert.ok(error instanceof CollaborationPolicyError);
      assert.equal(error.code, "SPECIALIST_NOT_ALLOWED");
      return true;
    }
  );
});

test("requestConsult calls gateway with session-tool wrapper payload and returns trace metadata", async () => {
  let capturedInput = null;
  const gatewayClient = {
    chatCompletions: async (input) => {
      capturedInput = input;
      return { id: "cmpl_consult_1" };
    }
  };

  const hooks = createSessionCollaborationHooks({
    gatewayClient,
    policy: {
      allowedRequesterAgents: ["agent_bd"],
      allowedSpecialistAgents: ["agent_research_1"]
    }
  });

  const result = await hooks.requestConsult(baseRequest());
  assert.equal(result.response.id, "cmpl_consult_1");

  assert.equal(capturedInput.agentId, "agent_bd");
  assert.equal(capturedInput.sessionKey, "agent:agent_bd:officeclaw:channel:proj_alpha");
  assert.equal(capturedInput.metadata.trace.requester_session_key, capturedInput.sessionKey);
  assert.equal(
    capturedInput.metadata.trace.specialist_session_key,
    "agent:agent_research_1:officeclaw:channel:proj_alpha"
  );
  assert.ok(Array.isArray(capturedInput.tools));
  assert.ok(capturedInput.tools.some((tool) => tool.function?.name === "sessions_send"));

  assert.equal(result.eventMetadata.status, "requested");
  assert.equal(result.eventMetadata.project_id, "proj_alpha");
  assert.equal(result.eventMetadata.requester_agent_id, "agent_bd");
  assert.equal(result.eventMetadata.specialist_agent_id, "agent_research_1");
  assert.match(result.trace.consult_id, /^consult_/);
});

test("requestConsultHistory produces history trace metadata", async () => {
  const gatewayClient = {
    chatCompletions: async () => ({ id: "cmpl_history_1" })
  };
  const hooks = createSessionCollaborationHooks({
    gatewayClient
  });

  const result = await hooks.requestConsultHistory(baseRequest());
  assert.equal(result.response.id, "cmpl_history_1");
  assert.equal(result.eventMetadata.status, "history_requested");
});

test("buildConsultEventMetadata keeps traceability fields", () => {
  const trace = {
    consult_id: "consult_abc",
    consult_type: "bd_to_specialist",
    policy_version: "v0",
    requester_agent_id: "agent_bd",
    specialist_agent_id: "agent_research_1",
    requester_session_key: "agent:agent_bd:officeclaw:channel:proj_alpha",
    specialist_session_key: "agent:agent_research_1:officeclaw:channel:proj_alpha",
    project_id: "proj_alpha",
    parent_task_id: "task_1",
    parent_event_id: "evt_1",
    urgency: "normal"
  };

  const eventMetadata = buildConsultEventMetadata(trace, "resolved", {
    consult_outcome: "accepted"
  });
  assert.equal(eventMetadata.consult_id, "consult_abc");
  assert.equal(eventMetadata.status, "resolved");
  assert.equal(eventMetadata.consult_outcome, "accepted");
});
