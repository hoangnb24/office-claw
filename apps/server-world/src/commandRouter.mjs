import { createWorldStateStore } from "./worldState.mjs";

const ID_MAX_LENGTH = 128;
const MAX_TASK_TITLE_COUNT = 16;
const COMMAND_TEXT_LIMITS = Object.freeze({
  submit_request_text: 2000,
  resolve_decision_choice: 280,
  request_changes_instructions: 4000,
  split_task_title: 160,
  override_reason: 400
});
const TASK_STATUSES = new Set(["planned", "in_progress", "blocked", "done", "cancelled"]);
const PROJECT_STATUSES = new Set([
  "created",
  "planning",
  "executing",
  "blocked",
  "completed",
  "archived"
]);

const ALLOWED_COMMANDS = new Set([
  "submit_request",
  "assign_task",
  "auto_assign",
  "resolve_decision",
  "approve_artifact",
  "request_changes",
  "split_into_tasks",
  "player_pos",
  "move_player_to",
  "start_kickoff",
  "reassign_task",
  "cancel_task",
  "pause_project",
  "resume_project",
  "rerun_task"
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isVec3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
}

function failValidation(message) {
  return {
    ok: false,
    code: "VALIDATION_FAILED",
    message
  };
}

function normalizeIdentifier(value, fieldName) {
  if (typeof value !== "string") {
    return failValidation(`${fieldName} must be a string`);
  }
  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
  if (!normalized) {
    return failValidation(`${fieldName} must be non-empty`);
  }
  if (normalized.length > ID_MAX_LENGTH) {
    return failValidation(`${fieldName} exceeds max length ${ID_MAX_LENGTH}`);
  }
  return { ok: true, value: normalized };
}

function sanitizeTextField(value, fieldName, maxLength, { preserveNewlines = false } = {}) {
  if (typeof value !== "string") {
    return failValidation(`${fieldName} must be a string`);
  }
  let normalized = value.normalize("NFKC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (preserveNewlines) {
    normalized = normalized
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } else {
    normalized = normalized.replace(/\s+/g, " ").trim();
  }
  if (!normalized) {
    return failValidation(`${fieldName} must be non-empty`);
  }
  if (normalized.length > maxLength) {
    normalized = normalized.slice(0, maxLength).trimEnd();
  }
  return { ok: true, value: normalized };
}

function normalizeEnumField(value, fieldName, allowedValues) {
  if (typeof value !== "string") {
    return failValidation(`${fieldName} must be a string`);
  }
  const normalized = value.trim().toLowerCase();
  if (!allowedValues.has(normalized)) {
    return failValidation(`${fieldName} must be one of: ${[...allowedValues].join(", ")}`);
  }
  return { ok: true, value: normalized };
}

function sanitizeOptionalReason(data, fieldName) {
  if (data.reason === undefined) {
    return { ok: true, value: undefined, sanitized: false };
  }
  const reason = sanitizeTextField(data.reason, fieldName, COMMAND_TEXT_LIMITS.override_reason, {
    preserveNewlines: true
  });
  if (!reason.ok) {
    return reason;
  }
  return { ok: true, value: reason.value, sanitized: reason.value !== data.reason };
}

export function validateAndSanitizeCommandPayload(payload) {
  if (!isObject(payload)) {
    return failValidation("command payload must be an object");
  }

  const { name, data } = payload;
  if (typeof name !== "string" || !isObject(data)) {
    return failValidation("command payload requires {name,data}");
  }
  if (!ALLOWED_COMMANDS.has(name)) {
    return failValidation(`unknown command: ${name}`);
  }

  let sanitizedData = {};
  let sanitizedTextFields = 0;

  switch (name) {
    case "submit_request": {
      if (!hasOnlyKeys(data, ["text"])) {
        return failValidation("submit_request accepts only {text}");
      }
      const text = sanitizeTextField(
        data.text,
        "submit_request.text",
        COMMAND_TEXT_LIMITS.submit_request_text
      );
      if (!text.ok) {
        return text;
      }
      sanitizedTextFields += text.value !== data.text ? 1 : 0;
      sanitizedData = { text: text.value };
      break;
    }
    case "assign_task": {
      if (!hasOnlyKeys(data, ["task_id", "agent_id"])) {
        return failValidation("assign_task accepts only {task_id,agent_id}");
      }
      const taskId = normalizeIdentifier(data.task_id, "assign_task.task_id");
      if (!taskId.ok) {
        return taskId;
      }
      const agentId = normalizeIdentifier(data.agent_id, "assign_task.agent_id");
      if (!agentId.ok) {
        return agentId;
      }
      sanitizedData = {
        task_id: taskId.value,
        agent_id: agentId.value
      };
      break;
    }
    case "auto_assign": {
      if (!hasOnlyKeys(data, ["project_id"])) {
        return failValidation("auto_assign accepts only {project_id}");
      }
      const projectId = normalizeIdentifier(data.project_id, "auto_assign.project_id");
      if (!projectId.ok) {
        return projectId;
      }
      sanitizedData = { project_id: projectId.value };
      break;
    }
    case "resolve_decision": {
      if (!hasOnlyKeys(data, ["decision_id", "choice"])) {
        return failValidation("resolve_decision accepts only {decision_id,choice}");
      }
      const decisionId = normalizeIdentifier(data.decision_id, "resolve_decision.decision_id");
      if (!decisionId.ok) {
        return decisionId;
      }
      const choice = sanitizeTextField(
        data.choice,
        "resolve_decision.choice",
        COMMAND_TEXT_LIMITS.resolve_decision_choice
      );
      if (!choice.ok) {
        return choice;
      }
      sanitizedTextFields += choice.value !== data.choice ? 1 : 0;
      sanitizedData = {
        decision_id: decisionId.value,
        choice: choice.value
      };
      break;
    }
    case "approve_artifact": {
      if (!hasOnlyKeys(data, ["artifact_id"])) {
        return failValidation("approve_artifact accepts only {artifact_id}");
      }
      const artifactId = normalizeIdentifier(data.artifact_id, "approve_artifact.artifact_id");
      if (!artifactId.ok) {
        return artifactId;
      }
      sanitizedData = { artifact_id: artifactId.value };
      break;
    }
    case "request_changes": {
      if (!hasOnlyKeys(data, ["artifact_id", "instructions"])) {
        return failValidation("request_changes accepts only {artifact_id,instructions}");
      }
      const artifactId = normalizeIdentifier(data.artifact_id, "request_changes.artifact_id");
      if (!artifactId.ok) {
        return artifactId;
      }
      const instructions = sanitizeTextField(
        data.instructions,
        "request_changes.instructions",
        COMMAND_TEXT_LIMITS.request_changes_instructions,
        { preserveNewlines: true }
      );
      if (!instructions.ok) {
        return instructions;
      }
      sanitizedTextFields += instructions.value !== data.instructions ? 1 : 0;
      sanitizedData = {
        artifact_id: artifactId.value,
        instructions: instructions.value
      };
      break;
    }
    case "split_into_tasks": {
      if (!hasOnlyKeys(data, ["artifact_id", "task_titles"])) {
        return failValidation("split_into_tasks accepts only {artifact_id,task_titles}");
      }
      const artifactId = normalizeIdentifier(data.artifact_id, "split_into_tasks.artifact_id");
      if (!artifactId.ok) {
        return artifactId;
      }
      if (!Array.isArray(data.task_titles)) {
        return failValidation("split_into_tasks.task_titles must be an array");
      }
      if (data.task_titles.length === 0) {
        return failValidation("split_into_tasks.task_titles must contain at least one title");
      }
      if (data.task_titles.length > MAX_TASK_TITLE_COUNT) {
        return failValidation(
          `split_into_tasks.task_titles exceeds max count ${MAX_TASK_TITLE_COUNT}`
        );
      }
      const titles = [];
      for (const [index, titleValue] of data.task_titles.entries()) {
        const title = sanitizeTextField(
          titleValue,
          `split_into_tasks.task_titles[${index}]`,
          COMMAND_TEXT_LIMITS.split_task_title
        );
        if (!title.ok) {
          return title;
        }
        sanitizedTextFields += title.value !== titleValue ? 1 : 0;
        titles.push(title.value);
      }
      sanitizedData = {
        artifact_id: artifactId.value,
        task_titles: titles
      };
      break;
    }
    case "player_pos": {
      if (!hasOnlyKeys(data, ["pos", "facing"])) {
        return failValidation("player_pos accepts only {pos,facing}");
      }
      if (!isVec3(data.pos)) {
        return failValidation("player_pos.pos must be [x,y,z]");
      }
      if (data.facing !== undefined && !isVec3(data.facing)) {
        return failValidation("player_pos.facing must be [x,y,z] when provided");
      }
      sanitizedData = {
        pos: [...data.pos]
      };
      if (data.facing) {
        sanitizedData.facing = [...data.facing];
      }
      break;
    }
    case "move_player_to": {
      if (!hasOnlyKeys(data, ["pos"])) {
        return failValidation("move_player_to accepts only {pos}");
      }
      if (!isVec3(data.pos)) {
        return failValidation("move_player_to.pos must be [x,y,z]");
      }
      sanitizedData = {
        pos: [...data.pos]
      };
      break;
    }
    case "start_kickoff": {
      if (!hasOnlyKeys(data, ["project_id"])) {
        return failValidation("start_kickoff accepts only {project_id}");
      }
      if (data.project_id !== undefined) {
        const projectId = normalizeIdentifier(data.project_id, "start_kickoff.project_id");
        if (!projectId.ok) {
          return projectId;
        }
        sanitizedData.project_id = projectId.value;
      }
      break;
    }
    case "reassign_task": {
      if (
        !hasOnlyKeys(data, [
          "task_id",
          "from_agent_id",
          "to_agent_id",
          "reason",
          "expected_task_status"
        ])
      ) {
        return failValidation(
          "reassign_task accepts only {task_id,from_agent_id,to_agent_id,reason,expected_task_status}"
        );
      }
      const taskId = normalizeIdentifier(data.task_id, "reassign_task.task_id");
      if (!taskId.ok) {
        return taskId;
      }
      const toAgentId = normalizeIdentifier(data.to_agent_id, "reassign_task.to_agent_id");
      if (!toAgentId.ok) {
        return toAgentId;
      }
      sanitizedData = {
        task_id: taskId.value,
        to_agent_id: toAgentId.value
      };
      if (data.from_agent_id !== undefined) {
        const fromAgentId = normalizeIdentifier(data.from_agent_id, "reassign_task.from_agent_id");
        if (!fromAgentId.ok) {
          return fromAgentId;
        }
        sanitizedData.from_agent_id = fromAgentId.value;
      }
      if (data.expected_task_status !== undefined) {
        const expectedTaskStatus = normalizeEnumField(
          data.expected_task_status,
          "reassign_task.expected_task_status",
          TASK_STATUSES
        );
        if (!expectedTaskStatus.ok) {
          return expectedTaskStatus;
        }
        sanitizedData.expected_task_status = expectedTaskStatus.value;
      }
      const reason = sanitizeOptionalReason(data, "reassign_task.reason");
      if (!reason.ok) {
        return reason;
      }
      if (reason.value !== undefined) {
        sanitizedData.reason = reason.value;
      }
      sanitizedTextFields += reason.sanitized ? 1 : 0;
      break;
    }
    case "cancel_task": {
      if (!hasOnlyKeys(data, ["task_id", "reason", "confirm", "expected_task_status"])) {
        return failValidation(
          "cancel_task accepts only {task_id,reason,confirm,expected_task_status}"
        );
      }
      const taskId = normalizeIdentifier(data.task_id, "cancel_task.task_id");
      if (!taskId.ok) {
        return taskId;
      }
      if (data.confirm !== true) {
        return failValidation("cancel_task.confirm must be true");
      }
      sanitizedData = {
        task_id: taskId.value,
        confirm: true
      };
      if (data.expected_task_status !== undefined) {
        const expectedTaskStatus = normalizeEnumField(
          data.expected_task_status,
          "cancel_task.expected_task_status",
          TASK_STATUSES
        );
        if (!expectedTaskStatus.ok) {
          return expectedTaskStatus;
        }
        sanitizedData.expected_task_status = expectedTaskStatus.value;
      }
      const reason = sanitizeOptionalReason(data, "cancel_task.reason");
      if (!reason.ok) {
        return reason;
      }
      if (reason.value !== undefined) {
        sanitizedData.reason = reason.value;
      }
      sanitizedTextFields += reason.sanitized ? 1 : 0;
      break;
    }
    case "pause_project": {
      if (!hasOnlyKeys(data, ["project_id", "reason", "scope", "expected_project_status"])) {
        return failValidation(
          "pause_project accepts only {project_id,reason,scope,expected_project_status}"
        );
      }
      const projectId = normalizeIdentifier(data.project_id, "pause_project.project_id");
      if (!projectId.ok) {
        return projectId;
      }
      sanitizedData = {
        project_id: projectId.value,
        scope: "dispatch_only"
      };
      if (data.scope !== undefined && data.scope !== "dispatch_only") {
        return failValidation("pause_project.scope must be dispatch_only when provided");
      }
      if (data.expected_project_status !== undefined) {
        const expectedProjectStatus = normalizeEnumField(
          data.expected_project_status,
          "pause_project.expected_project_status",
          PROJECT_STATUSES
        );
        if (!expectedProjectStatus.ok) {
          return expectedProjectStatus;
        }
        sanitizedData.expected_project_status = expectedProjectStatus.value;
      }
      const reason = sanitizeOptionalReason(data, "pause_project.reason");
      if (!reason.ok) {
        return reason;
      }
      if (reason.value !== undefined) {
        sanitizedData.reason = reason.value;
      }
      sanitizedTextFields += reason.sanitized ? 1 : 0;
      break;
    }
    case "resume_project": {
      if (!hasOnlyKeys(data, ["project_id", "reason", "expected_project_status"])) {
        return failValidation("resume_project accepts only {project_id,reason,expected_project_status}");
      }
      const projectId = normalizeIdentifier(data.project_id, "resume_project.project_id");
      if (!projectId.ok) {
        return projectId;
      }
      sanitizedData = { project_id: projectId.value };
      if (data.expected_project_status !== undefined) {
        const expectedProjectStatus = normalizeEnumField(
          data.expected_project_status,
          "resume_project.expected_project_status",
          PROJECT_STATUSES
        );
        if (!expectedProjectStatus.ok) {
          return expectedProjectStatus;
        }
        sanitizedData.expected_project_status = expectedProjectStatus.value;
      }
      const reason = sanitizeOptionalReason(data, "resume_project.reason");
      if (!reason.ok) {
        return reason;
      }
      if (reason.value !== undefined) {
        sanitizedData.reason = reason.value;
      }
      sanitizedTextFields += reason.sanitized ? 1 : 0;
      break;
    }
    case "rerun_task": {
      if (!hasOnlyKeys(data, ["source_task_id", "mode", "reason", "constraints_patch"])) {
        return failValidation("rerun_task accepts only {source_task_id,mode,reason,constraints_patch}");
      }
      const sourceTaskId = normalizeIdentifier(data.source_task_id, "rerun_task.source_task_id");
      if (!sourceTaskId.ok) {
        return sourceTaskId;
      }
      sanitizedData = {
        source_task_id: sourceTaskId.value,
        mode: "clone_as_new"
      };
      if (data.mode !== undefined && data.mode !== "clone_as_new") {
        return failValidation("rerun_task.mode must be clone_as_new when provided");
      }
      const reason = sanitizeOptionalReason(data, "rerun_task.reason");
      if (!reason.ok) {
        return reason;
      }
      if (reason.value !== undefined) {
        sanitizedData.reason = reason.value;
      }
      sanitizedTextFields += reason.sanitized ? 1 : 0;
      if (data.constraints_patch !== undefined) {
        if (!isObject(data.constraints_patch)) {
          return failValidation("rerun_task.constraints_patch must be an object when provided");
        }
        sanitizedData.constraints_patch = JSON.parse(JSON.stringify(data.constraints_patch));
      }
      break;
    }
    default:
      return failValidation(`unknown command: ${name}`);
  }

  return {
    ok: true,
    payload: {
      name,
      data: sanitizedData
    },
    sanitized_text_fields: sanitizedTextFields
  };
}

export function createCommandRouter({ commandHandler } = {}) {
  const fallbackWorldState = createWorldStateStore();

  return {
    handle(payload) {
      const handler = commandHandler || ((commandPayload) => fallbackWorldState.applyCommand(commandPayload));
      const validation = validateAndSanitizeCommandPayload(payload);
      if (!validation.ok) {
        return validation;
      }
      const result = handler(validation.payload);
      if (!result || result.ok !== true) {
        return result;
      }
      return {
        ...result,
        sanitized_payload: validation.payload,
        sanitized_text_fields: validation.sanitized_text_fields
      };
    }
  };
}
