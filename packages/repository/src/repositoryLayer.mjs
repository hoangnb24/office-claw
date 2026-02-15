const TASK_STATUSES = new Set(["planned", "in_progress", "blocked", "done", "cancelled"]);
const DECISION_STATUSES = new Set(["open", "resolved", "cancelled"]);
const ARTIFACT_STATUSES = new Set([
  "created",
  "delivered",
  "in_review",
  "approved",
  "changes_requested",
  "superseded",
  "archived"
]);
const CONTENT_REF_KINDS = new Set(["uri", "inline_text", "blob"]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nowIso() {
  return new Date().toISOString();
}

function requireStatus(allowed, value, name) {
  if (!allowed.has(value)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
}

function receiptKey(projectId, idempotencyKey) {
  return `${projectId}::${idempotencyKey}`;
}

function requirePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function normalizeContentReference(contentRef) {
  if (contentRef == null) {
    return null;
  }
  if (!isObject(contentRef)) {
    throw new Error("artifact.content_ref must be an object when provided");
  }
  if (typeof contentRef.kind !== "string" || !CONTENT_REF_KINDS.has(contentRef.kind)) {
    throw new Error("artifact.content_ref.kind must be one of: uri, inline_text, blob");
  }

  if (contentRef.kind === "uri") {
    if (typeof contentRef.uri !== "string" || contentRef.uri.trim().length === 0) {
      throw new Error("artifact.content_ref.uri is required for kind=uri");
    }
    return {
      kind: "uri",
      uri: contentRef.uri.trim(),
      mime_type: typeof contentRef.mime_type === "string" ? contentRef.mime_type : null,
      sha256: typeof contentRef.sha256 === "string" ? contentRef.sha256 : null
    };
  }

  if (contentRef.kind === "inline_text") {
    if (typeof contentRef.text !== "string") {
      throw new Error("artifact.content_ref.text is required for kind=inline_text");
    }
    return {
      kind: "inline_text",
      text: contentRef.text,
      mime_type: typeof contentRef.mime_type === "string" ? contentRef.mime_type : "text/plain"
    };
  }

  if (typeof contentRef.blob_id !== "string" || contentRef.blob_id.trim().length === 0) {
    throw new Error("artifact.content_ref.blob_id is required for kind=blob");
  }
  return {
    kind: "blob",
    blob_id: contentRef.blob_id.trim(),
    mime_type: typeof contentRef.mime_type === "string" ? contentRef.mime_type : null,
    sha256: typeof contentRef.sha256 === "string" ? contentRef.sha256 : null
  };
}

function normalizeArtifactMetadata(metadata) {
  if (metadata == null) {
    return {};
  }
  if (!isObject(metadata)) {
    throw new Error("artifact.metadata must be an object when provided");
  }
  return structuredClone(metadata);
}

function artifactRootId(artifact) {
  return artifact.version_root_id || artifact.artifact_id;
}

function buildRepositories(ctx) {
  return {
    projects: {
      get(projectId) {
        return ctx.get("projects", projectId);
      },
      upsert(project) {
        const row = {
          ...project,
          updated_ts: nowIso()
        };
        return ctx.upsert("projects", project.project_id, row);
      },
      listByStatus(status) {
        return ctx.list("projects", (row) => row.status === status);
      }
    },

    tasks: {
      get(taskId) {
        return ctx.get("tasks", taskId);
      },
      create(task) {
        requireStatus(TASK_STATUSES, task.status, "task.status");
        const row = {
          ...task,
          created_ts: nowIso(),
          updated_ts: nowIso()
        };
        return ctx.insert("tasks", task.task_id, row);
      },
      upsert(task) {
        requireStatus(TASK_STATUSES, task.status, "task.status");
        const existing = ctx.get("tasks", task.task_id);
        const row = {
          ...existing,
          ...task,
          updated_ts: nowIso()
        };
        if (!existing) {
          row.created_ts = nowIso();
        }
        return ctx.upsert("tasks", task.task_id, row);
      },
      updateStatus(taskId, status) {
        requireStatus(TASK_STATUSES, status, "task.status");
        const existing = ctx.get("tasks", taskId);
        if (!existing) {
          throw new Error(`Task not found: ${taskId}`);
        }
        return ctx.upsert("tasks", taskId, {
          ...existing,
          status,
          updated_ts: nowIso()
        });
      },
      listByProjectStatus(projectId, status) {
        return ctx.list(
          "tasks",
          (row) => row.project_id === projectId && (status ? row.status === status : true)
        );
      },
      listByAssigneeStatus(agentId, statuses) {
        const filter = statuses ? new Set(statuses) : null;
        return ctx.list(
          "tasks",
          (row) =>
            row.assignee === agentId &&
            (!filter || filter.has(row.status))
        );
      }
    },

    decisions: {
      get(decisionId) {
        return ctx.get("decisions", decisionId);
      },
      create(decision) {
        requireStatus(DECISION_STATUSES, decision.status, "decision.status");
        const row = {
          ...decision,
          created_ts: nowIso(),
          updated_ts: nowIso()
        };
        return ctx.insert("decisions", decision.decision_id, row);
      },
      updateStatus(decisionId, status) {
        requireStatus(DECISION_STATUSES, status, "decision.status");
        const existing = ctx.get("decisions", decisionId);
        if (!existing) {
          throw new Error(`Decision not found: ${decisionId}`);
        }
        return ctx.upsert("decisions", decisionId, {
          ...existing,
          status,
          updated_ts: nowIso()
        });
      },
      listOpenByProject(projectId) {
        return ctx.list(
          "decisions",
          (row) => row.project_id === projectId && row.status === "open"
        );
      }
    },

    artifacts: {
      get(artifactId) {
        return ctx.get("artifacts", artifactId);
      },
      create(artifact) {
        requireStatus(ARTIFACT_STATUSES, artifact.status, "artifact.status");
        requirePositiveInteger(artifact.version, "artifact.version");
        if (typeof artifact.artifact_id !== "string" || artifact.artifact_id.trim().length === 0) {
          throw new Error("artifact.artifact_id is required");
        }
        if (typeof artifact.project_id !== "string" || artifact.project_id.trim().length === 0) {
          throw new Error("artifact.project_id is required");
        }
        if (typeof artifact.type !== "string" || artifact.type.trim().length === 0) {
          throw new Error("artifact.type is required");
        }

        const parentId =
          typeof artifact.version_parent_id === "string" && artifact.version_parent_id.trim()
            ? artifact.version_parent_id.trim()
            : null;
        let rootId =
          typeof artifact.version_root_id === "string" && artifact.version_root_id.trim()
            ? artifact.version_root_id.trim()
            : null;

        if (parentId) {
          const parent = ctx.get("artifacts", parentId);
          if (!parent) {
            throw new Error(`artifact parent not found: ${parentId}`);
          }
          if (parent.project_id !== artifact.project_id) {
            throw new Error("artifact project_id must match parent project_id");
          }
          if (parent.type !== artifact.type) {
            throw new Error("artifact type must match parent type");
          }
          const expectedVersion = parent.version + 1;
          if (artifact.version !== expectedVersion) {
            throw new Error(`artifact.version must equal parent.version + 1 (${expectedVersion})`);
          }
          const parentRoot = artifactRootId(parent);
          if (rootId && rootId !== parentRoot) {
            throw new Error("artifact.version_root_id must match parent chain root");
          }
          rootId = parentRoot;
        } else if (artifact.version === 1) {
          rootId = rootId || artifact.artifact_id;
        } else {
          throw new Error("artifact.version_parent_id is required for version > 1");
        }

        const duplicateVersion = ctx.list(
          "artifacts",
          (row) => artifactRootId(row) === rootId && row.version === artifact.version
        );
        if (duplicateVersion.length > 0) {
          throw new Error(
            `artifact version ${artifact.version} already exists for chain ${rootId}`
          );
        }

        const row = {
          ...artifact,
          version_root_id: rootId,
          version_parent_id: parentId,
          content_ref: normalizeContentReference(artifact.content_ref),
          metadata: normalizeArtifactMetadata(artifact.metadata),
          created_ts: nowIso(),
          updated_ts: nowIso()
        };
        return ctx.insert("artifacts", artifact.artifact_id, row);
      },
      createRevision(input) {
        if (!isObject(input)) {
          throw new Error("artifacts.createRevision requires an object");
        }
        const parentId =
          typeof input.parent_artifact_id === "string" ? input.parent_artifact_id.trim() : "";
        if (!parentId) {
          throw new Error("artifacts.createRevision requires parent_artifact_id");
        }
        const parent = ctx.get("artifacts", parentId);
        if (!parent) {
          throw new Error(`artifact parent not found: ${parentId}`);
        }

        const artifactId =
          typeof input.artifact_id === "string" ? input.artifact_id.trim() : "";
        if (!artifactId) {
          throw new Error("artifacts.createRevision requires artifact_id");
        }

        const row = {
          artifact_id: artifactId,
          project_id: input.project_id || parent.project_id,
          type: input.type || parent.type,
          status: input.status || "created",
          version: parent.version + 1,
          version_parent_id: parent.artifact_id,
          version_root_id: artifactRootId(parent),
          task_id: input.task_id === undefined ? parent.task_id : input.task_id,
          poi_id: input.poi_id === undefined ? parent.poi_id : input.poi_id,
          content_ref: input.content_ref ?? null,
          metadata: input.metadata ?? {}
        };
        return this.create(row);
      },
      updateStatus(artifactId, status) {
        requireStatus(ARTIFACT_STATUSES, status, "artifact.status");
        const existing = ctx.get("artifacts", artifactId);
        if (!existing) {
          throw new Error(`Artifact not found: ${artifactId}`);
        }
        return ctx.upsert("artifacts", artifactId, {
          ...existing,
          status,
          updated_ts: nowIso()
        });
      },
      getContentReference(artifactId) {
        const artifact = ctx.get("artifacts", artifactId);
        if (!artifact) {
          return null;
        }
        return {
          artifact_id: artifact.artifact_id,
          version: artifact.version,
          status: artifact.status,
          content_ref: artifact.content_ref || null,
          metadata: artifact.metadata || {}
        };
      },
      listVersionHistory(artifactId) {
        const artifact = ctx.get("artifacts", artifactId);
        if (!artifact) {
          throw new Error(`Artifact not found: ${artifactId}`);
        }
        const rootId = artifactRootId(artifact);
        return ctx
          .list("artifacts", (row) => artifactRootId(row) === rootId)
          .sort((a, b) => a.version - b.version || a.artifact_id.localeCompare(b.artifact_id));
      },
      getViewerRecord(artifactId) {
        const artifact = ctx.get("artifacts", artifactId);
        if (!artifact) {
          return null;
        }
        return {
          artifact,
          version_history: this.listVersionHistory(artifactId),
          content_reference: this.getContentReference(artifactId)
        };
      },
      listByProjectStatus(projectId, status) {
        return ctx.list(
          "artifacts",
          (row) => row.project_id === projectId && (status ? row.status === status : true)
        );
      }
    },

    events: {
      append(event) {
        const seq = event.seq || ctx.nextProjectSeq(event.project_id);
        const id = event.id || `${event.project_id}:${seq}`;
        const row = {
          ...event,
          id,
          seq,
          ts: event.ts || nowIso()
        };
        return ctx.insert("world_events", id, row);
      },
      listByProjectSinceSeq(projectId, sinceSeq = 0) {
        return ctx
          .list("world_events", (row) => row.project_id === projectId && row.seq > sinceSeq)
          .sort((a, b) => a.seq - b.seq);
      },
      listByArtifact(artifactId) {
        return ctx
          .list("world_events", (row) => row.artifact_id === artifactId)
          .sort((a, b) => {
            const left = Number.isInteger(a.seq) ? a.seq : Number.MAX_SAFE_INTEGER;
            const right = Number.isInteger(b.seq) ? b.seq : Number.MAX_SAFE_INTEGER;
            return left - right;
          });
      }
    },

    officeDecor: {
      upsert(item) {
        const id = item.decor_id;
        if (!id) {
          throw new Error("officeDecor.upsert requires decor_id");
        }
        const row = {
          ...item,
          updated_ts: nowIso()
        };
        return ctx.upsert("office_decor", id, row);
      },
      listByProject(projectId) {
        return ctx.list("office_decor", (row) => row.project_id === projectId);
      }
    },

    commandReceipts: {
      get(projectId, idempotencyKey) {
        return ctx.get("command_receipts", receiptKey(projectId, idempotencyKey));
      },
      record(receipt) {
        const key = receiptKey(receipt.project_id, receipt.idempotency_key);
        const existing = ctx.get("command_receipts", key);
        if (existing) {
          return {
            created: false,
            row: existing
          };
        }
        const row = {
          ...receipt,
          created_ts: nowIso()
        };
        ctx.insert("command_receipts", key, row);
        return {
          created: true,
          row
        };
      }
    }
  };
}

export class RepositoryLayer {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async read(work) {
    return this.adapter.read((ctx) => work(buildRepositories(ctx)));
  }

  async withTransaction(work) {
    return this.adapter.transaction((ctx) => work(buildRepositories(ctx)));
  }

  async resolveDecisionAndResumeTask(input) {
    return this.withTransaction((repos) => {
      const decision = repos.decisions.updateStatus(input.decision_id, "resolved");
      const task = repos.tasks.updateStatus(input.task_id, "in_progress");
      repos.events.append({
        project_id: input.project_id,
        name: "decision_resolved",
        decision_id: input.decision_id,
        task_id: input.task_id,
        agent_id: input.agent_id
      });
      repos.events.append({
        project_id: input.project_id,
        name: "task_started",
        task_id: input.task_id,
        agent_id: input.agent_id
      });
      return {
        decision,
        task
      };
    });
  }

  async approveArtifactAndCompleteTask(input) {
    return this.withTransaction((repos) => {
      const artifact = repos.artifacts.updateStatus(input.artifact_id, "approved");
      const task = repos.tasks.updateStatus(input.task_id, "done");
      repos.events.append({
        project_id: input.project_id,
        name: "review_approved",
        artifact_id: input.artifact_id,
        task_id: input.task_id
      });
      repos.events.append({
        project_id: input.project_id,
        name: "task_done",
        task_id: input.task_id,
        artifact_id: input.artifact_id
      });
      return {
        artifact,
        task
      };
    });
  }

  async getArtifactViewerRecord(artifactId) {
    return this.read((repos) => repos.artifacts.getViewerRecord(artifactId));
  }

  async getArtifactAuditTrail(artifactId) {
    return this.read((repos) => {
      const viewer = repos.artifacts.getViewerRecord(artifactId);
      if (!viewer) {
        return null;
      }
      const seenEventIds = new Set();
      const auditEvents = [];
      for (const version of viewer.version_history) {
        for (const event of repos.events.listByArtifact(version.artifact_id)) {
          if (seenEventIds.has(event.id)) {
            continue;
          }
          seenEventIds.add(event.id);
          auditEvents.push(event);
        }
      }
      auditEvents.sort((a, b) => {
        const left = Number.isInteger(a.seq) ? a.seq : Number.MAX_SAFE_INTEGER;
        const right = Number.isInteger(b.seq) ? b.seq : Number.MAX_SAFE_INTEGER;
        return left - right;
      });
      return {
        ...viewer,
        audit_events: auditEvents
      };
    });
  }
}
