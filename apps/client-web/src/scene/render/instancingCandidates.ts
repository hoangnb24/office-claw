import type { SceneObjectSpec } from "../loader";

export type InstancingExclusionReason =
  | "missing_instance_group"
  | "has_interaction"
  | "has_poi_binding"
  | "has_highlight_nodes"
  | "has_collider"
  | "single_member_bucket";

export interface InstancingCandidateExclusion {
  objectId: string;
  reason: InstancingExclusionReason;
  details?: Record<string, string>;
}

export interface InstancingCompatibilityPolicy {
  castShadow: boolean;
  receiveShadow: boolean;
  cullDistanceM: number | null;
}

export interface InstancingCandidateGroup {
  instanceGroup: string;
  compatibilityKey: string;
  sourceUrl: string;
  renderPolicy: InstancingCompatibilityPolicy;
  objectIds: string[];
}

export interface InstancingCandidateDetectionResult {
  groups: InstancingCandidateGroup[];
  exclusions: InstancingCandidateExclusion[];
}

interface CandidateBucket {
  instanceGroup: string;
  sourceUrl: string;
  renderPolicy: InstancingCompatibilityPolicy;
  compatibilityKey: string;
  objectIds: string[];
}

function normalizeInstanceGroup(rawGroup: string | undefined): string | null {
  if (typeof rawGroup !== "string") {
    return null;
  }
  const trimmed = rawGroup.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRenderPolicy(spec: SceneObjectSpec): InstancingCompatibilityPolicy {
  return {
    castShadow: spec.render_policy?.cast_shadow ?? true,
    receiveShadow: spec.render_policy?.receive_shadow ?? true,
    cullDistanceM: spec.render_policy?.cull_distance_m ?? null
  };
}

function buildCompatibilityKey(
  instanceGroup: string,
  sourceUrl: string,
  renderPolicy: InstancingCompatibilityPolicy
): string {
  const cullDistanceToken =
    renderPolicy.cullDistanceM === null ? "none" : String(renderPolicy.cullDistanceM);
  return [
    `instance_group=${instanceGroup}`,
    `url=${sourceUrl}`,
    `cast_shadow=${renderPolicy.castShadow ? "1" : "0"}`,
    `receive_shadow=${renderPolicy.receiveShadow ? "1" : "0"}`,
    `cull_distance_m=${cullDistanceToken}`
  ].join("|");
}

function sortByObjectId(
  left: { objectId: string; reason: string },
  right: { objectId: string; reason: string }
): number {
  const idCompare = left.objectId.localeCompare(right.objectId);
  if (idCompare !== 0) {
    return idCompare;
  }
  return left.reason.localeCompare(right.reason);
}

export function detectInstancingCandidates(
  objectSpecs: readonly SceneObjectSpec[]
): InstancingCandidateDetectionResult {
  const sortedObjectSpecs = [...objectSpecs].sort((left, right) =>
    left.id.localeCompare(right.id)
  );

  const exclusions: InstancingCandidateExclusion[] = [];
  const buckets = new Map<string, CandidateBucket>();

  for (const objectSpec of sortedObjectSpecs) {
    const instanceGroup = normalizeInstanceGroup(objectSpec.instance_group);
    if (!instanceGroup) {
      exclusions.push({
        objectId: objectSpec.id,
        reason: "missing_instance_group"
      });
      continue;
    }

    if (objectSpec.interaction) {
      exclusions.push({
        objectId: objectSpec.id,
        reason: "has_interaction"
      });
      continue;
    }

    if (objectSpec.poi_id) {
      exclusions.push({
        objectId: objectSpec.id,
        reason: "has_poi_binding"
      });
      continue;
    }

    if ((objectSpec.highlight_nodes ?? []).length > 0) {
      exclusions.push({
        objectId: objectSpec.id,
        reason: "has_highlight_nodes"
      });
      continue;
    }

    if (objectSpec.collider !== false && objectSpec.collider !== undefined) {
      exclusions.push({
        objectId: objectSpec.id,
        reason: "has_collider"
      });
      continue;
    }

    const renderPolicy = normalizeRenderPolicy(objectSpec);
    const compatibilityKey = buildCompatibilityKey(
      instanceGroup,
      objectSpec.url,
      renderPolicy
    );

    const bucket = buckets.get(compatibilityKey);
    if (bucket) {
      bucket.objectIds.push(objectSpec.id);
      continue;
    }

    buckets.set(compatibilityKey, {
      instanceGroup,
      sourceUrl: objectSpec.url,
      renderPolicy,
      compatibilityKey,
      objectIds: [objectSpec.id]
    });
  }

  const groups: InstancingCandidateGroup[] = [];

  for (const bucket of buckets.values()) {
    bucket.objectIds.sort((left, right) => left.localeCompare(right));

    if (bucket.objectIds.length < 2) {
      const singletonObjectId = bucket.objectIds[0];
      if (singletonObjectId) {
        exclusions.push({
          objectId: singletonObjectId,
          reason: "single_member_bucket",
          details: {
            instance_group: bucket.instanceGroup,
            compatibility_key: bucket.compatibilityKey
          }
        });
      }
      continue;
    }

    groups.push({
      instanceGroup: bucket.instanceGroup,
      compatibilityKey: bucket.compatibilityKey,
      sourceUrl: bucket.sourceUrl,
      renderPolicy: bucket.renderPolicy,
      objectIds: bucket.objectIds
    });
  }

  groups.sort((left, right) => {
    const groupCompare = left.instanceGroup.localeCompare(right.instanceGroup);
    if (groupCompare !== 0) {
      return groupCompare;
    }
    return left.compatibilityKey.localeCompare(right.compatibilityKey);
  });
  exclusions.sort(sortByObjectId);

  return {
    groups,
    exclusions
  };
}
