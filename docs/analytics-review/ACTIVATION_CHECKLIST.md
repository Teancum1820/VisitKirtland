# Activation checklist — owner approval required later

- [ ] Joe reviews the source diff and site-specific privacy draft, contact/retention details, cookie handling and effective date. Drafts are not legal certification.
- [ ] All relevant existing account IDs, domains and ownership/access assignments are verified. Unknowns remain blank; Metricool tags remain UNVERIFIED until generated evidence is supplied.
- [ ] Review automatic GA4 form/outbound measurements, query redaction and the existing RTG Ads link/personalized-advertising setting. Do not count automatic form_submit as a confirmed registration or purchase.
- [ ] Review explicit event definitions, session-scoped deduplication limits and external ticket/booking attribution. Confirmed provider receipt is still unavailable. RTG Meta/Metricool may be suppressed on session-bearing confirmation URLs.
- [ ] Review operational dependencies for RTG's included PR #24 work, including migration 0007_itinerary_leads.sql and email/recipient flags. No remote migration, email or registration was executed during this task.
- [ ] Approve a specific reviewed release separately. Keep all PRs draft and unmerged until that decision.
- [ ] Remove the Workers build hold only as an explicitly approved publication change. Connected builds would otherwise upload a version; a successful test workflow does not authorize publishing. Visit's main/manual Pages workflow also publishes.
- [ ] Review and authorize publication of privacy notices before any publishing action. KHG's existing privacy page is unchanged by this review; the proposed supplement is separate.
- [ ] Enable providers only in a separately authorized activation step after approval. Global enabled=false and allowLocalTesting=false remain mandatory for this assignment.
- [ ] Plan owner-authorized live receipt verification without artificial real-world conversions; never treat synthetic receiver output as provider data.

No item on this future checklist authorizes this agent to merge, deploy, activate accounts, change production privacy text, or send Joe a message now.
