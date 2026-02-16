# AGENTS.md (contracts)

Scope: `contracts/**`

## Start Here

- Validator runner: `contracts/validation/run-validation.mjs`
- Session key gate: `contracts/validation/session-key-validation.mjs`
- Protocol envelope schema: `contracts/schemas/protocol-envelope.schema.json`
- Commands schema: `contracts/schemas/commands.schema.json`
- Scene manifest schema: `contracts/schemas/scene-manifest.schema.json`

## Contract Change Workflow

1. Update schema and matching fixtures together.
2. Keep positive and negative fixtures aligned.
3. Re-run validation before touching downstream runtime code.

## Commands

```bash
npm --prefix contracts run validate
npm --prefix contracts run validate:session-key
```

## Required Validation

- Contract edits are incomplete unless both commands above pass.
