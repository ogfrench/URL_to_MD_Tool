# Product Passport: URL_to_MD_Tool

> Initial documentation-derived navigation map, 9 November 2026. **Not source-verified.** This file is not a release certificate. Inspect current executable source and tests before asserting behavior or changing implementation.

## Purpose
Web-page to Markdown and PDF collection tool.

## Documented capability areas
- Convert pages to Markdown or PDF
- batch-convert collections
- merge PDF outputs
- troubleshoot failed conversion

## Candidate entry points
- `FastAPI UI`
- `CLI`

## Candidate source owners
- `Code/server.py`
- `Code/cli.py`
- `Code/converter.py`
- `logs/`

## Technology described in repository documentation
Python; FastAPI; Playwright; Next.js.

## Verification and evidence
**Source inspection:** not completed for this seed map. **Execution:** no commands, real journeys, negative cases, deployment or host acceptance were run for this map. Start with `README.md`, `CLAUDE.md` where present, actual implementation and existing tests. Record concrete paths, commands, assertions, revision, environment and blocked/failed/not_run states here or in dedicated `features/<id>.md` entries as evidence accumulates.

## Required upkeep
When a capability, entry point, ownership boundary or integration changes, update this product map in the same PR after checking code and any executed tests. Do not claim a test passed merely because it is listed here. For recurring architecture faults invoke Architecture Gardener, without duplicating the Product Passport's behavioral scope. See `.claude/rules/product-passport.md`.
