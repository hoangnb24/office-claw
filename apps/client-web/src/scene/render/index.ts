export type {
  InstancingCandidateDetectionResult,
  InstancingCandidateExclusion,
  InstancingCandidateGroup,
  InstancingCompatibilityPolicy,
  InstancingExclusionReason
} from "./instancingCandidates";
export type {
  InstancedAssemblyEntry,
  InstancedAssemblyExclusion,
  InstancedAssemblyExclusionReason,
  InstancedAssemblyResult,
  InstancedObjectGroup,
  RuntimeLoadedObject
} from "./instancedAssembly";
export { detectInstancingCandidates } from "./instancingCandidates";
export { buildInstancedObjectGroups } from "./instancedAssembly";
