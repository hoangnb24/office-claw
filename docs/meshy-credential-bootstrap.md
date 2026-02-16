# Meshy Credential Bootstrap

This document defines secure local and CI setup for `MESHY_API_KEY` and the reproducible credential check gate.

## Local Setup

1. Export token in your shell session:

```bash
export MESHY_API_KEY="<your_meshy_token>"
```

2. Verify presence without printing secret value:

```bash
if [ -n "${MESHY_API_KEY:-}" ]; then
  echo "MESHY_API_KEY is set"
else
  echo "MESHY_API_KEY is missing"
fi
```

3. Run the pipeline credential gate check (uses existing image path and dry-run mode):

```bash
python3 tools/meshy_pipeline.py \
  --image reports/client-polish/qa/followup-bd-2jtf/20260215T142555Z/offline/offline-focus-check.png \
  --asset-id credcheck \
  --output-dir /tmp/meshy-credcheck \
  --dry-run
```

Expected success pattern:

1. Exit code `0`
2. Output includes `Dry run summary`
3. Output does not include `Missing API key`

## CI Setup (GitHub Actions)

1. Store token as repository/org secret:
   - `MESHY_API_KEY`
2. Inject secret only for the job/step that runs Meshy checks:

```yaml
env:
  MESHY_API_KEY: ${{ secrets.MESHY_API_KEY }}
```

3. Run the same credential gate command in CI:

```bash
python3 tools/meshy_pipeline.py \
  --image reports/client-polish/qa/followup-bd-2jtf/20260215T142555Z/offline/offline-focus-check.png \
  --asset-id credcheck \
  --output-dir /tmp/meshy-credcheck \
  --dry-run
```

## Security Rules

1. Never commit token values to git.
2. Never print full token values in logs.
3. Rotate `MESHY_API_KEY` if accidental exposure is suspected.

