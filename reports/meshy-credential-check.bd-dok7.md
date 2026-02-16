# Meshy Credential Check (`bd-dok7`)

Generated at: `2026-02-15T14:38:10Z` (updated `2026-02-15T14:58:02Z`)  
Agent: `RainyDune` + `HazyEagle`

## Scope

Establish and verify `MESHY_API_KEY` bootstrap flow for local and CI without exposing secrets.

## Documentation Delivered

1. `docs/meshy-credential-bootstrap.md`

Coverage:

1. Local token setup and non-secret presence check
2. CI secret-injection pattern
3. Reproducible credential gate command against `tools/meshy_pipeline.py`
4. Security rules for secret handling

## Credential Gate Evidence

Evidence root:

1. `reports/client-polish/meshy/bd-dok7`

Executed command (missing-token path):

```bash
python3 tools/meshy_pipeline.py \
  --image reports/client-polish/qa/followup-bd-2jtf/20260215T142555Z/offline/offline-focus-check.png \
  --asset-id credcheck \
  --output-dir /tmp/meshy-credcheck \
  --dry-run
```

Observed result:

1. `MESHY_API_KEY` not present in current environment.
2. Failure output captured in:
   - `reports/client-polish/meshy/bd-dok7/missing-token-check.stderr.txt`
3. Error confirms expected guard:
   - `ERROR: Missing API key. Set environment variable MESHY_API_KEY with your Meshy bearer token.`

## Success Mode (Authorized Path) Status

`completed`

After credential injection via shell environment, two success-path checks were executed:

1. Local dry-run gate now succeeds with key present:

```bash
python3 tools/meshy_pipeline.py \
  --image reports/client-polish/qa/followup-bd-2jtf/20260215T142555Z/offline/offline-focus-check.png \
  --asset-id credcheck \
  --output-dir /tmp/meshy-credcheck \
  --dry-run
```

Evidence:

1. `reports/client-polish/meshy/bd-dok7/success-dry-run-20260215T145802Z.stdout.txt`
2. `reports/client-polish/meshy/bd-dok7/success-dry-run-20260215T145802Z.stderr.txt`

Observed:

1. Output includes `Dry run summary`
2. Output includes `No Meshy API calls were made.`
3. No `Missing API key` error

2. Authenticated API reachability probe (intentionally invalid payload to avoid task creation):

```bash
curl -sS -D - \
  -H "Authorization: Bearer ${MESHY_API_KEY}" \
  -H "Content-Type: application/json" \
  -X POST https://api.meshy.ai/openapi/v1/image-to-3d \
  -d '{}'
```

Evidence:

1. `reports/client-polish/meshy/bd-dok7/auth-probe-20260215T145802Z.status.txt`
2. `reports/client-polish/meshy/bd-dok7/auth-probe-20260215T145802Z.redacted.txt`
3. `reports/client-polish/meshy/bd-dok7/auth-probe-20260215T145802Z.stderr.txt`

Observed:

1. Probe response status: `HTTP 400`
2. Response message: `Invalid values: ImageURL is a required field`

Interpretation:

`HTTP 400` with schema validation error (instead of `401/403`) demonstrates the bearer token is accepted and the authorized API path is reachable.

## Success Criteria

1. Exit code `0`
2. Output includes `Dry run summary`
3. No `Missing API key` error

## Acceptance Mapping

1. Credential setup instructions documented for local + CI: **met**
2. Credential-check run captured with redacted evidence: **met** (missing-token path)
3. Missing-token and authorized-success modes documented: **met**
