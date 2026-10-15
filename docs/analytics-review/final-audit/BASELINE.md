# Independent baseline — October 15, 2026

Saved before corrections in this audit. GitHub snapshots and local status are retained in each site subdirectory here. This supersedes reliance on the earlier report as independent evidence.

| Review requirement | KHG | Visit Kirtland | RTG | NEOChosen |
|---|---|---|---|---|
| Metricool verification | BLOCKED: supplied 31-hex tag rejected; generated snippet absent | BLOCKED: syntax only | BLOCKED: syntax only | BLOCKED: syntax only |
| Privacy notice | PARTIAL: draft supplement exists; approval pending | PARTIAL: draft /privacy/; approval pending | PARTIAL: draft /privacy/; approval pending | PARTIAL: draft /privacy/; approval pending |
| Consent implementation | PARTIAL: cross-tab storage clearing needs regression | PARTIAL: same runtime issue | PARTIAL: same runtime issue | PARTIAL: same runtime issue |
| GA4 verification | BLOCKED: blank | PARTIAL: G-1WEVH2BDTJ; prior account observation, not independently reproduced yet | PARTIAL: G-FWRDG3GXS4; prior account observation, not independently reproduced yet | BLOCKED: blank |
| Meta Pixel verification | BLOCKED: blank | BLOCKED: blank | BLOCKED: blank | BLOCKED: blank |
| Unit tests | PARTIAL: prior evidence; fresh run pending | PARTIAL: prior evidence; fresh run pending | PARTIAL: prior evidence; fresh run pending | PARTIAL: prior evidence; fresh run pending |
| Build checks | PARTIAL: fresh run pending | NOT APPLICABLE: static checked-in site; asset sync pending | PARTIAL: local dry run pending | PARTIAL: static build pending |
| GitHub Actions | PASS: exact-head review success | PASS: exact-head review success | PASS: exact-head review success | PASS: exact-head verify success |
| PR documentation | PARTIAL: independent evidence update pending | PARTIAL: independent evidence update pending | PARTIAL: independent evidence update pending | PARTIAL: independent evidence update pending |
| Production tracking disabled | PARTIAL: release flags false; fresh synthetic/live-source checks pending | PARTIAL: same | PARTIAL: same | PARTIAL: same |

All four existing branches are clean, have no local-only commits relative to their tracking refs, and match GitHub branch heads. Actual Visit repository is Teancum1820/VisitKirtland; Teancum1820/Visit-Kirtland returns 404. No replacement was created.

Starting heads: KHG 01aebe2f03ed953ec6a1bb12a0b498cb10af476f; Visit 44c9ac68a485a758d7b60a3fe99c8255954454cb; RTG 5bf977882f51b99c04cc984817d20a8177b6e369; NEOChosen f7cb58f2ab67df3712e1cad8dda5ef2a1670f669.

GitHub has no submitted reviews or inline review threads on these PRs. Three issue comments are external Workers check reports, to be inspected. Joe's requests are supplied in the assignment and a matching Gmail thread was found. No comment is being marked resolved by assumption.

The existing non-deployment workflows were inspected before running commands. Visit's main/manual Pages deployment is excluded. KHG/RTG/NEO connected Cloudflare builds are guarded by a first-command WORKERS_CI hold; their failed Workers checks must be distinguished from successful QA. No push, deployment, publication, merge or analytics account change has occurred in this audit.
