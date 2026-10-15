# Tracking validation — October 15, 2026

All results below were independently reproduced locally. Historical claims of 70 tests or 62 ticket checks are not counted as fresh evidence. Current source under review: 165518ad80d5c9ed5af916d39de3f51415df429e; original base: main at 7e827e0812da7b59fecdd2c50835231434c7d72d. A later documentation-only commit may follow. Exact tested commits are recorded per command, not inferred from the latest PR head.

## Four-repository results

| Site / verified repository and PR | Automated evidence | Visible CTA checks | Build / other checks |
|---|---|---|---|
| Kirtland Heritage Group / Kirtland-Heritage-Group #21 | 65 application + 33 analytics tests | 2 desktop / 2 mobile | Astro build: 36 pages; typecheck passed |
| Visit Kirtland / VisitKirtland #6 | 34 analytics/configuration tests | 4 desktop / 4 mobile | Checked-in static assets; selective synchronization and clean diff passed |
| Restoration Tour Group / RestorationTourGroup #25 | 78 application + 35 analytics tests | 7 desktop / 7 mobile, plus four complete form/payment scenarios | Typecheck, lint and Wrangler local dry run passed |
| NEOChosen / NEOChosen #106 | 9 breakfast-function + 35 analytics/form tests; site checks and raffle checks passed | 83 desktop / 67 mobile | Static build, lint, typecheck and configured formatting checks passed |

Each repository has its own copies of this report and command/browser evidence; this repository's exact logs follow. Counts are categories, not a claim that every site uses the same test framework.

## Visit Kirtland

Static checked-in site; Node built-in test runner; PowerShell asset helper. Runtime used: Node v24.14.0, npm 11.9.0; browser tooling Playwright 1.63.0 with installed Chromium. Existing locked dependencies were present locally; restoration was not needed for these local runs. No local production secret files were present. Test credentials are synthetic. Worker/database tests use mocked requests and local/in-memory databases; RTG's build is explicitly Wrangler deploy --dry-run and does not execute the production flags printed from configuration.

| Command | Exact commit tested | Result | Evidence |
|---|---|---|---|
| node --test scripts/analytics.runtime.cjs | ffadea1060b9124759415b9c0112d9ebbc5f6525 | PASS (0) | [log 1](evidence/check-1.txt) |
| pwsh -NoProfile -File tools/add-tracking.ps1 | ffadea1060b9124759415b9c0112d9ebbc5f6525 | PASS (0) | [log 2](evidence/check-2.txt) |
| git diff --exit-code | ffadea1060b9124759415b9c0112d9ebbc5f6525 | PASS (0) | [log 3](evidence/check-3.txt) |

Browser command: node scripts/analytics.browser.mjs. Tested commit: 165518ad80d5c9ed5af916d39de3f51415df429e. Provider receipt remains NOT VERIFIED. [Structured browser evidence](evidence/browser-results.json) contains page routes, visible button IDs/destinations and the consent matrix result. Desktop/mobile widths are 1440 and 390 pixels.

For KHG, a 5-second timeout occurred in an existing D1 mailbox-preference case during an unconstrained parallel run. Limiting Vitest to two workers yielded 65/65 application tests and the analytics suite without changing assertions or increasing test timeouts. The earlier layout-import and NEO page-count errors were corrected before the final successful builds. Visit's browser fixture initially attempted storage access inside a sandboxed embedded document; the fixture now safely excludes unavailable frame storage, and the successful run has no page exceptions.

## Reproduce browser checks safely

Run the repository's audited local build first where one exists. Visit uses the checked-in site and the selective tools/add-tracking.ps1 helper; do not regenerate it from stale VK2.0 source. The browser runner starts its own loopback GET-only server. All form and provider responses are intercepted. External document navigation, analytics requests and nonlocal fetch/XHR are blocked; existing public styling/images/fonts may load for visual checks. It never reads production credentials.

Use the existing Playwright 1.63.0 tooling, or install that test-only package and Chromium in a separate tooling directory. Set ANALYTICS_PLAYWRIGHT_MODULE to its absolute index.mjs path if this repository does not have Playwright installed (KHG and Visit do not declare it as an application dependency). In the review workspace this was ../analytics-neo/node_modules/playwright/index.mjs. Set ANALYTICS_QA_OUT to an absolute output directory, then run node scripts/analytics.browser.mjs. Screenshots and raw local logs are retained in Analytics_Review_2026-10-15/visit/browser on the review machine; no unnecessary binaries are committed. The runner records its tested SHA.

## CI and publishing boundary

The new Analytics review (no deployment) workflow runs on pull_request, has contents:read only and persist-credentials:false, requires no production secrets, and performs local checks. Dependencies are restored with npm ci --ignore-scripts where applicable. It does not deploy or publish artifacts.

Hosted run links and final status are recorded in the PR description after the branch push; [PR checks](https://github.com/Teancum1820/VisitKirtland/pull/6/checks) identify the exact head. No not-yet-run workflow is represented as passing here. The NEO baseline successful Frontend QA run was 38635235575; that historical run is not evidence for these revisions.

KHG/RTG/NEO Cloudflare settings were read before running commands or pushing: main deployment uses npx wrangler deploy, branch builds use npx wrangler versions upload, and every build first runs npm run build. The first command now aborts whenever WORKERS_CI is present, before framework/bundle/upload steps. Local smoke checks of npm run build with WORKERS_CI=1 exited 1 with ANALYTICS_REVIEW_HOLD. Cloudflare's upload check is therefore expected to fail intentionally; it is separate from test success. [Cloudflare documents WORKERS_CI](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/). No Cloudflare account settings changed. Visit's existing main/manual GitHub Pages deployment workflow was inspected and not dispatched. No production publishing branch was pushed.

Skipped: live provider receipt, real external checkout/registration completion, production migrations, account setting changes and publishing are unauthorized. KHG has no lint script; Visit has no compiler/package build and uses checked-in assets. Visit's full regeneration script deletes/rebuilds site from older source and was intentionally not run. Full unrelated repository formatting cleanup is outside scope. No skipped or unavailable check is counted as passed.

## Changed files since the inspected analytics head

- .github/workflows/analytics-review.yml
- .gitignore
- content/privacy.html
- scripts/analytics.browser.mjs
- scripts/analytics.runtime.cjs
- site/privacy/index.html
- site/tracking/analytics-config.json
- site/tracking/analytics.js
- tools/add-tracking.ps1
- tracking/analytics-config.json
- tracking/analytics.js
