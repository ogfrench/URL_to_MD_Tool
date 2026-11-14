# Product Passport: URL_to_MD_Tool

**Source inspection, 14 November 2026:** inspected the Python converter and its tests; located CLI, server, collection/merge components and Next.js UI. No network conversion, browser session, CI run or deployed journey was performed for this update.

## Capability ownership

| User outcome | Canonical implementation | Proof route |
| --- | --- | --- |
| Convert a permitted webpage to Markdown or PDF | `Code/converter.py`, `Code/rules.py`, `Code/output.py` | `tests/test_converter.py`, `tests/test_rules.py`, `tests/test_output.py`; inspect actual output and attribution |
| Convert from CLI or service | `Code/cli.py`, `Code/server.py`, `Code/jobs.py` | `tests/test_cli.py`, `tests/test_server.py`, `tests/test_jobs.py`; use representative success/error requests |
| Extract/merge related resources | `Code/combine_pdfs.py`, `Code/helpers.py` | `tests/test_extract_links.py` and actual PDF content/page-order review |
| Use the frontend | `app/page.jsx`, `lib/url.js`, `lib/format.js` | `npm run lint`, `npm run typecheck`, `npm run build` and real browser response inspection |

The converter invokes Playwright and applies content rules. Treat remote HTML and URLs as untrusted input and check redirect handling, timeouts and forbidden/private targets in the correct server-side boundary before approving network-related changes. Do not treat browser automation as permission to bypass a site's controls.

## Engineering workflow

1. Trace frontend request → Python API/job → Playwright extraction → final persisted or downloaded artifact. Do not create a second parser or conflate frontend rendering with successful extraction.
2. Run the focused Python test first (for example `python -m pytest tests/test_converter.py`), then `python -m pytest tests` when converter, routing or job contracts change. For UI-only edits, use the project's npm scripts and a representative browser flow.
3. Assert at least one invalid URL, timeout/failed page, unauthorized target or malformed output case alongside a valid extraction when modifying those boundaries. Check actual Markdown and PDF bytes, not just HTTP 200.
4. `.github/workflows/ci.yml` contains frontend and backend jobs for PR/main validation. Preserve both surfaces; optimize runner duplication only after inspecting branch rules, status requirements and timings.
5. Record exact SHA, commands, result artifacts, skipped checks and whether the real site or external hosts were observed; use **passed / failed / blocked / not_run**.

**Evidence status:** source navigation reviewed; tests and external user journeys **not_run**. See `AGENTS.md` for project constraints.
