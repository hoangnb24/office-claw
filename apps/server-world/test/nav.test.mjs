import assert from "node:assert/strict";
import { loadSceneNavGridRuntime } from "../src/nav/manifestNav.mjs";
import { createNavGridRuntime, findPathOnGrid } from "../src/nav/pathfinding.mjs";
import { createWorldStateStore } from "../src/worldState.mjs";

function testManifestNavLoad() {
  const loaded = loadSceneNavGridRuntime("cozy_office_v0", { disableCache: true });
  assert.equal(loaded.sceneId, "cozy_office_v0");
  assert.ok(loaded.grid.width > 0);
  assert.ok(loaded.grid.height > 0);
  assert.ok(Array.isArray(loaded.grid.origin));
  assert.ok(Array.isArray(loaded.decorAnchors));
  assert.ok(loaded.decorAnchors.some((anchor) => anchor.anchor_id === "trophy_shelf_01"));
  assert.ok(Array.isArray(loaded.poiAnchors));
  assert.ok(loaded.poiAnchors.some((anchor) => anchor.poi_id === "poi_reception_inbox"));
}

function testAStarAvoidsOccupiedTargetCell() {
  const grid = createNavGridRuntime({
    origin: [0, 0],
    cell_size: 1,
    width: 3,
    height: 3,
    walkable: Array(9).fill(1)
  });

  const result = findPathOnGrid(grid, [0.5, 0, 0.5], [2.5, 0, 0.5], {
    occupiedWorldPositions: [[2.5, 0, 0.5]]
  });
  assert.ok(result, "expected path result");
  assert.deepEqual(result.targetCell, { col: 1, row: 0 });
  assert.ok(result.path.length >= 2);
}

function testWorldStateMoveUsesGridRouting() {
  const grid = createNavGridRuntime({
    origin: [0, 0],
    cell_size: 1,
    width: 4,
    height: 4,
    walkable: Array(16).fill(1)
  });
  const store = createWorldStateStore({
    sceneNavLoader: (sceneId) => ({
      sceneId,
      manifestPath: "test://grid",
      grid
    })
  });

  assert.equal(
    store.applyCommand({
      name: "player_pos",
      data: { pos: [0.5, 0, 0.5] }
    }).ok,
    true
  );
  assert.equal(
    store.applyCommand({
      name: "move_player_to",
      data: { pos: [2.5, 0, 1.5] }
    }).ok,
    true
  );

  const snapshot = store.buildSnapshot();
  const player = snapshot.agents.find((agent) => agent.agent_id === "agent_bd");
  assert.deepEqual(player.pos, [2.5, 0, 1.5]);

  assert.deepEqual(store.worldToGridCell([2.5, 0, 1.5]), { col: 2, row: 1 });
  assert.deepEqual(store.gridCellToWorld({ col: 2, row: 1 }, 0), [2.5, 0, 1.5]);

  const navState = store.getNavigationState();
  assert.equal(navState.available, true);
  assert.equal(navState.last_move.status, "ok");
  assert.deepEqual(navState.last_move.target_cell, { col: 2, row: 1 });
}

function testWorldStateMoveFailsForUnreachableTarget() {
  const disconnected = createNavGridRuntime({
    origin: [0, 0],
    cell_size: 1,
    width: 3,
    height: 3,
    walkable: [1, 0, 0, 0, 0, 0, 0, 0, 1]
  });
  const store = createWorldStateStore({
    sceneNavLoader: (sceneId) => ({
      sceneId,
      manifestPath: "test://disconnected",
      grid: disconnected
    })
  });

  assert.equal(
    store.applyCommand({
      name: "player_pos",
      data: { pos: [0.5, 0, 0.5] }
    }).ok,
    true
  );
  const result = store.applyCommand({
    name: "move_player_to",
    data: { pos: [2.5, 0, 2.5] }
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "NOT_ALLOWED");

  const navState = store.getNavigationState();
  assert.equal(navState.last_move.status, "blocked");
}

function testWorldStateNormalizesInitialSceneIdForNavLookup() {
  const grid = createNavGridRuntime({
    origin: [0, 0],
    cell_size: 1,
    width: 2,
    height: 2,
    walkable: Array(4).fill(1)
  });
  const seenSceneIds = [];
  const store = createWorldStateStore({
    sceneId: "  cozy_office_v0  ",
    sceneNavLoader: (sceneId) => {
      seenSceneIds.push(sceneId);
      return {
        sceneId,
        manifestPath: "test://trimmed-scene",
        grid
      };
    }
  });

  assert.deepEqual(seenSceneIds, ["cozy_office_v0"]);
  assert.equal(store.getSceneId(), "cozy_office_v0");
  assert.equal(store.getNavigationState().available, true);
}

function testWorldStateRejectsNonFiniteVectorCommands() {
  const grid = createNavGridRuntime({
    origin: [0, 0],
    cell_size: 1,
    width: 2,
    height: 2,
    walkable: Array(4).fill(1)
  });
  const store = createWorldStateStore({
    sceneNavLoader: (sceneId) => ({
      sceneId,
      manifestPath: "test://finite-vec3",
      grid
    })
  });

  assert.equal(
    store.applyCommand({
      name: "player_pos",
      data: { pos: [Number.NaN, 0, 0] }
    }).ok,
    false
  );
  assert.equal(
    store.applyCommand({
      name: "move_player_to",
      data: { pos: [0, Number.POSITIVE_INFINITY, 0] }
    }).ok,
    false
  );
}

function testPoiFallbackIgnoresNonFiniteAnchorPositions() {
  const worldState = createWorldStateStore({
    sceneNavLoader: (sceneId) => ({
      sceneId,
      manifestPath: "test://poi-fallback",
      grid: createNavGridRuntime({
        origin: [0, 0],
        cell_size: 1,
        width: 2,
        height: 2,
        walkable: Array(4).fill(1)
      }),
      poiAnchors: [
        {
          poi_id: "poi_lounge",
          anchor_id: "poi_lounge_bad",
          pos: [Number.NaN, 0, 0]
        }
      ]
    })
  });

  const context = worldState.getPlayerPositionContext();
  assert.equal(context.fallback_source, "scene_default");
  assert.equal(context.fallback_poi_id, null);
}

function run() {
  testManifestNavLoad();
  testAStarAvoidsOccupiedTargetCell();
  testWorldStateMoveUsesGridRouting();
  testWorldStateMoveFailsForUnreachableTarget();
  testWorldStateNormalizesInitialSceneIdForNavLookup();
  testWorldStateRejectsNonFiniteVectorCommands();
  testPoiFallbackIgnoresNonFiniteAnchorPositions();
  console.log("server-world nav tests passed.");
}

run();
