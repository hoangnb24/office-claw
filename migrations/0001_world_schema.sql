PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created', 'planning', 'executing', 'blocked', 'completed', 'archived')),
  created_ts TEXT NOT NULL,
  updated_ts TEXT NOT NULL,
  archived_ts TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_ts TEXT NOT NULL,
  updated_ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_agent_sessions (
  project_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  session_key TEXT NOT NULL,
  session_status TEXT NOT NULL DEFAULT 'active' CHECK (session_status IN ('active', 'paused', 'closed')),
  last_used_ts TEXT,
  PRIMARY KEY (project_id, agent_id),
  UNIQUE (session_key),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 2,
  assignee_agent_id TEXT,
  blocked_reason TEXT,
  created_ts TEXT NOT NULL,
  updated_ts TEXT NOT NULL,
  started_ts TEXT,
  completed_ts TEXT,
  cancelled_ts TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_agent_id) REFERENCES agents(agent_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  decision_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  task_id TEXT,
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'cancelled')),
  resolution_choice TEXT,
  resolution_note TEXT,
  created_ts TEXT NOT NULL,
  updated_ts TEXT NOT NULL,
  resolved_ts TEXT,
  cancelled_ts TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  task_id TEXT,
  artifact_type TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  status TEXT NOT NULL CHECK (
    status IN ('created', 'delivered', 'in_review', 'approved', 'changes_requested', 'superseded', 'archived')
  ),
  title TEXT NOT NULL,
  content_ref TEXT,
  poi_id TEXT,
  created_ts TEXT NOT NULL,
  updated_ts TEXT NOT NULL,
  approved_ts TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS world_events (
  event_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  seq INTEGER NOT NULL CHECK (seq > 0),
  ts TEXT NOT NULL,
  name TEXT NOT NULL,
  poi_id TEXT,
  participants_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  UNIQUE (project_id, seq)
);

CREATE TABLE IF NOT EXISTS office_decor (
  decor_instance_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  decor_id TEXT NOT NULL,
  anchor_id TEXT NOT NULL,
  unlocked_by_project_id TEXT,
  created_ts TEXT NOT NULL,
  updated_ts TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS command_receipts (
  receipt_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  command_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  error_code TEXT,
  response_json TEXT NOT NULL,
  created_ts TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  UNIQUE (project_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS world_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_ts TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_status_updated
  ON tasks(project_id, status, updated_ts DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status
  ON tasks(assignee_agent_id, status);

CREATE INDEX IF NOT EXISTS idx_decisions_project_status_created
  ON decisions(project_id, status, created_ts DESC);

CREATE INDEX IF NOT EXISTS idx_artifacts_project_status_created
  ON artifacts(project_id, status, created_ts DESC);

CREATE INDEX IF NOT EXISTS idx_artifacts_project_poi_status
  ON artifacts(project_id, poi_id, status);

CREATE INDEX IF NOT EXISTS idx_events_project_seq
  ON world_events(project_id, seq);

CREATE INDEX IF NOT EXISTS idx_events_project_ts
  ON world_events(project_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_project_created
  ON world_snapshots(project_id, created_ts DESC);

CREATE INDEX IF NOT EXISTS idx_command_receipts_project_key
  ON command_receipts(project_id, idempotency_key);
