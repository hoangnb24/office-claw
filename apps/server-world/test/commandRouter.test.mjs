import assert from "node:assert/strict";
import { createCommandRouter, validateAndSanitizeCommandPayload } from "../src/commandRouter.mjs";

function testValidateAndSanitizeSubmitRequest() {
  const result = validateAndSanitizeCommandPayload({
    name: "submit_request",
    data: {
      text: " \u0007Build   launch\nplan   "
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.name, "submit_request");
  assert.equal(result.payload.data.text, "Build launch plan");
  assert.equal(result.sanitized_text_fields, 1);
}

function testRejectUnknownFields() {
  const result = validateAndSanitizeCommandPayload({
    name: "assign_task",
    data: {
      task_id: "task_copy",
      agent_id: "agent_eng_1",
      debug: true
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "VALIDATION_FAILED");
}

function testRouterPassesSanitizedPayloadToHandler() {
  let seenPayload = null;
  const router = createCommandRouter({
    commandHandler: (payload) => {
      seenPayload = payload;
      return { ok: true };
    }
  });

  const result = router.handle({
    name: "request_changes",
    data: {
      artifact_id: " art_research_report_v1 ",
      instructions: "  tighten intro\t\n\n\nand add references\u0001 "
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.sanitized_text_fields, 1);
  assert.deepEqual(seenPayload, {
    name: "request_changes",
    data: {
      artifact_id: "art_research_report_v1",
      instructions: "tighten intro \n\nand add references"
    }
  });
}

function testRejectUnknownCommand() {
  const router = createCommandRouter();
  const result = router.handle({
    name: "not_real",
    data: {}
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "VALIDATION_FAILED");
  assert.match(result.message, /unknown command/);
}

function testOverrideCommandSanitization() {
  const result = validateAndSanitizeCommandPayload({
    name: "reassign_task",
    data: {
      task_id: " task_copy ",
      to_agent_id: " agent_eng_1 ",
      reason: "  shift ownership\tto engineering  ",
      expected_task_status: " BLOCKED "
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.name, "reassign_task");
  assert.deepEqual(result.payload.data, {
    task_id: "task_copy",
    to_agent_id: "agent_eng_1",
    reason: "shift ownership to engineering",
    expected_task_status: "blocked"
  });
  assert.equal(result.sanitized_text_fields, 1);
}

function testOverrideCommandValidationFailures() {
  const badCancel = validateAndSanitizeCommandPayload({
    name: "cancel_task",
    data: {
      task_id: "task_copy",
      confirm: false
    }
  });
  assert.equal(badCancel.ok, false);
  assert.equal(badCancel.code, "VALIDATION_FAILED");
  assert.match(badCancel.message, /confirm must be true/);

  const badRerun = validateAndSanitizeCommandPayload({
    name: "rerun_task",
    data: {
      source_task_id: "task_copy",
      mode: "reopen_in_place"
    }
  });
  assert.equal(badRerun.ok, false);
  assert.equal(badRerun.code, "VALIDATION_FAILED");
  assert.match(badRerun.message, /clone_as_new/);
}

function run() {
  testValidateAndSanitizeSubmitRequest();
  testRejectUnknownFields();
  testRouterPassesSanitizedPayloadToHandler();
  testRejectUnknownCommand();
  testOverrideCommandSanitization();
  testOverrideCommandValidationFailures();
  console.log("server-world command router security tests passed.");
}

run();
