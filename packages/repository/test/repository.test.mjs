import assert from "node:assert/strict";
import { InMemoryAdapter, RepositoryLayer } from "../src/index.mjs";

function seed() {
  return {
    projects: [
      {
        project_id: "proj_repo_1",
        title: "Repository Layer Fixture",
        status: "executing"
      }
    ],
    tasks: [
      {
        task_id: "task_repo_1",
        project_id: "proj_repo_1",
        title: "Draft copy",
        status: "blocked",
        assignee: "agent_eng_1"
      }
    ],
    decisions: [
      {
        decision_id: "dec_repo_1",
        project_id: "proj_repo_1",
        status: "open",
        prompt: "Choose audience",
        task_id: "task_repo_1"
      }
    ],
    artifacts: [
      {
        artifact_id: "art_repo_1",
        project_id: "proj_repo_1",
        type: "copy_doc",
        status: "delivered",
        version: 1,
        task_id: "task_repo_1"
      }
    ]
  };
}

async function testCrudReadsAndWrites() {
  const layer = new RepositoryLayer(new InMemoryAdapter(seed()));

  await layer.withTransaction((repos) => {
    repos.projects.upsert({
      project_id: "proj_repo_2",
      title: "Second project",
      status: "created"
    });
    repos.tasks.create({
      task_id: "task_repo_2",
      project_id: "proj_repo_2",
      title: "Research",
      status: "planned",
      assignee: "agent_research_1"
    });
  });

  const created = await layer.read((repos) => repos.tasks.get("task_repo_2"));
  assert.equal(created?.status, "planned");
  assert.equal(created?.project_id, "proj_repo_2");
}

async function testAtomicRollback() {
  const layer = new RepositoryLayer(new InMemoryAdapter(seed()));

  await assert.rejects(async () => {
    await layer.withTransaction((repos) => {
      repos.tasks.updateStatus("task_repo_1", "in_progress");
      throw new Error("force rollback");
    });
  });

  const task = await layer.read((repos) => repos.tasks.get("task_repo_1"));
  assert.equal(task?.status, "blocked");
}

async function testLifecycleTransactionWrappers() {
  const layer = new RepositoryLayer(new InMemoryAdapter(seed()));

  await layer.resolveDecisionAndResumeTask({
    project_id: "proj_repo_1",
    decision_id: "dec_repo_1",
    task_id: "task_repo_1",
    agent_id: "agent_eng_1"
  });

  const resolved = await layer.read((repos) => repos.decisions.get("dec_repo_1"));
  const resumed = await layer.read((repos) => repos.tasks.get("task_repo_1"));
  assert.equal(resolved?.status, "resolved");
  assert.equal(resumed?.status, "in_progress");

  await layer.approveArtifactAndCompleteTask({
    project_id: "proj_repo_1",
    artifact_id: "art_repo_1",
    task_id: "task_repo_1"
  });

  const artifact = await layer.read((repos) => repos.artifacts.get("art_repo_1"));
  const taskDone = await layer.read((repos) => repos.tasks.get("task_repo_1"));
  assert.equal(artifact?.status, "approved");
  assert.equal(taskDone?.status, "done");
}

async function testCommandReceiptIdempotency() {
  const layer = new RepositoryLayer(new InMemoryAdapter(seed()));

  const first = await layer.withTransaction((repos) =>
    repos.commandReceipts.record({
      project_id: "proj_repo_1",
      idempotency_key: "cmd_123",
      outcome: { type: "ack", in_reply_to: "cmd_123" }
    })
  );
  assert.equal(first.created, true);

  const second = await layer.withTransaction((repos) =>
    repos.commandReceipts.record({
      project_id: "proj_repo_1",
      idempotency_key: "cmd_123",
      outcome: { type: "ack", in_reply_to: "cmd_123" }
    })
  );
  assert.equal(second.created, false);
}

async function testCommandReceiptSeedFallbackKey() {
  const layer = new RepositoryLayer(
    new InMemoryAdapter({
      ...seed(),
      command_receipts: [
        {
          project_id: "proj_repo_1",
          idempotency_key: "cmd_seed",
          outcome: { type: "ack", in_reply_to: "cmd_seed" }
        }
      ]
    })
  );

  const seeded = await layer.read((repos) => repos.commandReceipts.get("proj_repo_1", "cmd_seed"));
  assert.ok(seeded);
  assert.equal(seeded.idempotency_key, "cmd_seed");
  assert.equal(seeded.outcome.type, "ack");
}

async function testArtifactVersionChainAndRetrievalApis() {
  const layer = new RepositoryLayer(new InMemoryAdapter(seed()));

  await layer.withTransaction((repos) => {
    repos.events.append({
      project_id: "proj_repo_1",
      name: "review_changes_requested",
      artifact_id: "art_repo_1"
    });
    repos.artifacts.createRevision({
      parent_artifact_id: "art_repo_1",
      artifact_id: "art_repo_2",
      status: "delivered",
      content_ref: {
        kind: "uri",
        uri: "s3://officeclaw/artifacts/art_repo_2.md",
        mime_type: "text/markdown"
      },
      metadata: {
        generated_by: "agent_eng_1",
        summary: "Revised copy with stronger evidence"
      }
    });
    repos.events.append({
      project_id: "proj_repo_1",
      name: "artifact_delivered",
      artifact_id: "art_repo_2"
    });
  });

  const viewer = await layer.getArtifactViewerRecord("art_repo_2");
  assert.ok(viewer);
  assert.equal(viewer.artifact.version, 2);
  assert.equal(viewer.artifact.version_parent_id, "art_repo_1");
  assert.equal(viewer.artifact.version_root_id, "art_repo_1");
  assert.equal(viewer.content_reference.content_ref.kind, "uri");
  assert.deepEqual(
    viewer.version_history.map((artifact) => artifact.artifact_id),
    ["art_repo_1", "art_repo_2"]
  );

  const audit = await layer.getArtifactAuditTrail("art_repo_2");
  assert.ok(audit);
  assert.deepEqual(
    audit.audit_events.map((event) => event.name),
    ["review_changes_requested", "artifact_delivered"]
  );
}

async function testArtifactVersionChainImmutability() {
  const layer = new RepositoryLayer(new InMemoryAdapter(seed()));

  await assert.rejects(async () => {
    await layer.withTransaction((repos) =>
      repos.artifacts.create({
        artifact_id: "art_repo_v2_invalid",
        project_id: "proj_repo_1",
        type: "copy_doc",
        status: "created",
        version: 2
      })
    );
  }, /version_parent_id is required/);

  await assert.rejects(async () => {
    await layer.withTransaction((repos) => {
      repos.artifacts.createRevision({
        parent_artifact_id: "art_repo_1",
        artifact_id: "art_repo_2",
        status: "created"
      });
      repos.artifacts.create({
        artifact_id: "art_repo_2_dup",
        project_id: "proj_repo_1",
        type: "copy_doc",
        status: "created",
        version: 2,
        version_parent_id: "art_repo_1",
        version_root_id: "art_repo_1"
      });
    });
  }, /already exists for chain/);
}

async function testOfficeDecorPersistenceAndHydrationReads() {
  const layer = new RepositoryLayer(new InMemoryAdapter(seed()));

  await layer.withTransaction((repos) => {
    repos.officeDecor.upsert({
      decor_id: "trophy_artifact_delivery_proj_repo_1",
      project_id: "proj_repo_1",
      anchor_id: "trophy_shelf_01",
      unlocked_by_project_id: "proj_repo_1",
      outcome: "artifact_approved"
    });
    repos.officeDecor.upsert({
      decor_id: "plant_completed_project_proj_repo_1",
      project_id: "proj_repo_1",
      anchor_id: "trophy_shelf_02",
      unlocked_by_project_id: "proj_repo_1",
      outcome: "completed"
    });
  });

  const decorRows = await layer.read((repos) => repos.officeDecor.listByProject("proj_repo_1"));
  assert.equal(decorRows.length, 2);
  assert.deepEqual(
    decorRows.map((row) => row.decor_id).sort(),
    ["plant_completed_project_proj_repo_1", "trophy_artifact_delivery_proj_repo_1"]
  );
  assert.equal(
    decorRows.some((row) => row.anchor_id === "trophy_shelf_01" && row.outcome === "artifact_approved"),
    true
  );
  assert.equal(
    decorRows.some((row) => row.anchor_id === "trophy_shelf_02" && row.outcome === "completed"),
    true
  );
}

async function run() {
  await testCrudReadsAndWrites();
  await testAtomicRollback();
  await testLifecycleTransactionWrappers();
  await testCommandReceiptIdempotency();
  await testCommandReceiptSeedFallbackKey();
  await testArtifactVersionChainAndRetrievalApis();
  await testArtifactVersionChainImmutability();
  await testOfficeDecorPersistenceAndHydrationReads();
  console.log("Repository layer tests passed.");
}

run();
