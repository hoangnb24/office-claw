const MAX_ARTIFACTS = 8;
const MAX_DECISIONS = 4;
const MAX_FOLLOW_UP_TASKS = 12;
const MAX_TEXT_LENGTH = 400;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.slice(0, maxLength);
}

function normalizeArtifact(entry, index) {
  if (!isObject(entry)) {
    return null;
  }
  const type = normalizeText(entry.type, "note", 64).toLowerCase();
  return {
    type: type || "note",
    title: normalizeText(
      entry.title ?? entry.summary ?? entry.description,
      `OpenClaw output ${index + 1}`,
      160
    ),
    poi_id: normalizeText(entry.poi_id, "", 128) || null
  };
}

function normalizeDecision(entry) {
  if (!isObject(entry)) {
    return null;
  }
  const prompt = normalizeText(entry.prompt, "", 240);
  if (!prompt) {
    return null;
  }
  const options = Array.isArray(entry.options)
    ? entry.options
        .map((option) => normalizeText(option, "", 120))
        .filter(Boolean)
        .slice(0, 6)
    : [];
  return {
    prompt,
    options: options.length > 0 ? options : ["Approve", "Revise", "Escalate"]
  };
}

function normalizeFollowUpTask(entry, index) {
  if (typeof entry === "string") {
    const title = normalizeText(entry, "", 160);
    return title ? { title } : null;
  }
  if (isObject(entry)) {
    const title = normalizeText(entry.title ?? entry.task_title, "", 160);
    return title ? { title } : null;
  }
  return {
    title: `Follow-up task ${index + 1}`
  };
}

export function adaptOpenClawStructuredOutput(output) {
  if (!isObject(output)) {
    return {
      ok: false,
      code: "MALFORMED_OUTPUT",
      message: "openclaw output must be an object"
    };
  }

  const artifacts = Array.isArray(output.artifacts)
    ? output.artifacts.slice(0, MAX_ARTIFACTS).map(normalizeArtifact).filter(Boolean)
    : [];
  const decisions = Array.isArray(output.decisions)
    ? output.decisions.slice(0, MAX_DECISIONS).map(normalizeDecision).filter(Boolean)
    : [];
  const followUpTasks = Array.isArray(output.follow_up_tasks)
    ? output.follow_up_tasks
        .slice(0, MAX_FOLLOW_UP_TASKS)
        .map(normalizeFollowUpTask)
        .filter(Boolean)
    : [];

  if (artifacts.length === 0 && decisions.length === 0 && followUpTasks.length === 0) {
    return {
      ok: false,
      code: "MALFORMED_OUTPUT",
      message: "openclaw output must include artifacts, decisions, or follow_up_tasks"
    };
  }

  return {
    ok: true,
    value: {
      summary: normalizeText(output.summary, "", 240) || null,
      artifacts,
      decisions,
      follow_up_tasks: followUpTasks
    }
  };
}
