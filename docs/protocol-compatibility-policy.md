# Protocol Compatibility and Versioning Policy (bd-18y)

This policy governs how protocol changes are introduced and validated.

## Version contract

- The protocol uses major version `v` in every envelope.
- Additive-compatible changes stay on the same major version.
- Breaking changes require incrementing major version.

## Compatibility matrix

| Client vs Server | Same Major | Different Major |
|---|---|---|
| Client older | Supported if server keeps required legacy fields and semantics stable | Negotiate via `supported_versions`; fail fast if no overlap |
| Client newer | Supported if client ignores unknown fields and feature-gates new commands | Negotiate via `supported_versions`; fail fast if no overlap |

## Change classification rules

Additive-compatible:
- optional field additions
- additive event name additions
- additive command additions with deterministic unknown-command behavior

Breaking:
- adding required fields to existing messages
- incompatible meaning/type changes of existing fields
- message type removals/renames
- ordering guarantee changes

## Incompatible handshake behavior

If client and server share no supported major version:
1. Server sends `error` with code `PROTOCOL_VERSION_UNSUPPORTED`.
2. Error payload includes server-supported versions.
3. Server closes socket with protocol-incompatible reason.

## Change-management checklist

1. Classify change as additive or breaking.
2. If breaking, bump major `v` and document migration path.
3. Update `PROTOCOL.md` examples and compatibility notes.
4. Add/refresh schema fixtures in `contracts/schemas` and validation coverage.
5. Add release note with rollout order (server/client) and fallback behavior.
6. Confirm unknown-field and unknown-command handling remains deterministic.

## Validation commands

- `npm --prefix contracts run validate` (schema and fixture validation)
- targeted protocol fixture tests for version negotiation/error paths
