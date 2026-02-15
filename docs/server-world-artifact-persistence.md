# Artifact Persistence and Version History Retrieval (`bd-19j`)

Last updated: 2026-02-14

## Scope

Implemented artifact persistence enhancements in `packages/repository/src/repositoryLayer.mjs`:
- artifact metadata/content-reference model
- immutable version-chain semantics
- retrieval APIs for viewer and audit surfaces

## Model Additions

Artifacts now support persisted metadata fields in the repository layer:
- `content_ref` (nullable)
  - `kind=uri` with `uri`, optional `mime_type`, optional `sha256`
  - `kind=inline_text` with `text`, optional `mime_type`
  - `kind=blob` with `blob_id`, optional `mime_type`, optional `sha256`
- `metadata` (object)
- `version_root_id`
- `version_parent_id`

## Immutable Version-Chain Semantics

Enforced invariants on `artifacts.create(...)`:
- `version` must be a positive integer
- root artifacts (`version=1`) initialize `version_root_id`
- non-root artifacts (`version>1`) must provide a valid `version_parent_id`
- child version must equal `parent.version + 1`
- child must keep parent `project_id` and `type`
- duplicate version numbers within the same chain are rejected

Added `artifacts.createRevision(...)` helper:
- creates next immutable revision from parent
- auto-wires `version`, `version_root_id`, `version_parent_id`
- supports content-ref/metadata overrides for new revision material

## Retrieval APIs

Repository artifact retrieval surface:
- `artifacts.getContentReference(artifact_id)`
- `artifacts.listVersionHistory(artifact_id)`
- `artifacts.getViewerRecord(artifact_id)`

High-level `RepositoryLayer` APIs:
- `getArtifactViewerRecord(artifactId)`
- `getArtifactAuditTrail(artifactId)` (includes version-history + related artifact events)

## Tests

Extended `packages/repository/test/repository.test.mjs` with:
- `testArtifactVersionChainAndRetrievalApis`
- `testArtifactVersionChainImmutability`

These cover:
- revision creation from parent
- persisted content refs and metadata
- version-history retrieval order
- audit-trail retrieval across chain
- invalid chain creation rejection
- duplicate version rejection within chain

## Validation

```bash
npm --prefix packages/repository test
```
