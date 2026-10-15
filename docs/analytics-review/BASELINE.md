# Analytics PR baseline — October 15, 2026

Authenticated as Teancum1820 using the existing GitHub CLI credential. Read-only GitHub inspection preceded source changes. All four analytics checkouts were clean and matched the remote PR heads. All default/base branches are `main`; all PRs are OPEN and DRAFT. No submitted reviews or inline review comments were returned by the authenticated API; Joe's requests in the supplied assignment are the review requirements being addressed.

| Site / verified repository | PR | Base SHA | Head SHA | Framework / current checks |
|---|---|---|---|---|
| KHG / Teancum1820/Kirtland-Heritage-Group | 21 | 7ed4299bc7c03174c9e35bceb8dd4e5625949607 | c9511de102f393f9f7fd013f09ead38c4c6885cd | Astro 7; Workers Builds success; no GitHub Actions workflow |
| Visit / Teancum1820/VisitKirtland | 6 | 7e827e0812da7b59fecdd2c50835231434c7d72d | 1ea57b48af5a329f98975de07a576da9a64f68d1 | Checked-in static site; no PR checks; Pages deploy workflow only on main/manual dispatch |
| RTG / Teancum1820/RestorationTourGroup | 25 | ba867ae4695230bda39e745f2e83c46a5a209f6f | d0e365f8769a1807af62aa47650439c8fef04e22 | TypeScript Worker + static assets; Workers Builds success; no GitHub Actions workflow |
| NEOChosen / Teancum1820/NEOChosen | 106 | 273ff5c77beba41c1180063de6fb9a129eac169e | 817d7f497220a928b275fba47dd3967f8feb0390 | Static Node build + Worker; Frontend QA and Workers Builds success |

The hyphenated Visit-Kirtland and Restoration-Tour-Group repository names in the request do not resolve. Correct identities above were verified on GitHub.

RTG PR #24 is an open draft, head `93d04faeb9f1c2c4c016cb51db1d8aba3e2e6982`, branch `codex/leading-saints-marketing-updates`, same base as #25. A non-mutating merge-tree simulation reports a content conflict in `public/leading-saints-registration.html`; the auto-merged registration JavaScript contains overlapping tracking callbacks. PR #24 adds an independent Meta loader without the shared consent gate. This requires semantic reconciliation as well as text resolution.

Every release tracking configuration has `enabled:false` and `allowLocalTesting:false`. KHG's exact supplied Metricool value is 31 ASCII hexadecimal characters; the other three are 32. No surrounding whitespace or encoding discrepancy was found. Existing runtime requires 32 hexadecimal characters. KHG GA4 and all four Meta IDs are blank. KHG points to an existing `/privacy/` page; the other three notice paths are empty.

Authenticated Cloudflare settings confirm KHG and RTG build with `npm run build`, deploy main with `npx wrangler deploy`, and upload other branches with `npx wrangler versions upload`. Nonproduction builds are enabled, watch path is `*`, and no build variables/secrets are configured. A routine push would upload a version. Branch publication must first include a tested build hold that aborts Workers Builds before uploading. No Cloudflare settings have been changed.

Branch-protection lookup: Visit and NEO return 404 (not protected). KHG and RTG return 403 (plan restriction); protection cannot be verified through this endpoint. No protection changes were made. There are no other open PRs except RTG #24 and the four analytics PRs.

Runtime: Node v24.14.0, npm 11.9.0. Existing node_modules are available; no dependency installation was needed for baseline checks. Local secret files were absent (RTG has only `.dev.vars.example`). Test environments use synthetic credentials, mocked provider calls, and local/in-memory databases. Raw baseline PR metadata, complete diffs, and test logs are retained in the site subdirectories. Historical test claims are not treated as new evidence.
