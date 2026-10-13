# Analytics tracking — review implementation

Tracking is disabled until existing provider ownership, IDs, consent/privacy notice and deployment are reviewed. Configuration: `tracking/analytics-config.json` (under public/ or site/ where applicable). No secrets belong in this public file.

Set the verified IDs, correct allowedHosts and privacyNoticeUrl before enabled=true. Every new provider waits for explicit visitor consent. Analytics consent covers GA4 and Metricool; marketing consent covers Meta. GPC/DNT disables these new trackers. Preferences persist for 180 days. Withdrawal reloads the page to stop vendor automatic collection. No click/form history is replayed after consent. Existing Cloudflare analytics is preserved independently.

Do not add another gtag/GTM or pixel installation. The runtime refuses another existing owner; reconcile through that owner instead. GA4 owns one automatic page_view per document; these static multipage sites have no virtual route dispatcher. Retain outbound-click enhanced measurement, but do not sum it with custom intent events. Review automatic form interactions and disable them for conversion reporting because form_submit alone does not prove a saved submission. Do not mark click-outs as purchases.

Stable link metadata is generated from known URLs, not visible labels. Form success hooks run after the existing server acknowledgement. No form fields or record identifiers are sent. GA4 page_location keeps only campaign vocabulary; other query strings/fragments are stripped. Meta/Metricool are suppressed on pages with non-UTM query parameters or fragments because those vendors read the real document URL. Review GA4 enhanced-measurement parameter collection before activation.

Run the focused tests documented in the handoff. Production publication needs Caleb's approval of this change; main auto-deploys on KHG/NEO/Visit. No new accounts, provider settings, advertising, purchases, emails, production submissions, database changes or server-side CAPI are part of this implementation.

Use `document.dispatchEvent(new CustomEvent("khg:form-success", {detail:{form_type:"a configured type",submission_key:"local deduplication key"}}))` only in an authoritative success callback. The key stays local. A provider dispatch/queue is not a delivery receipt.

RTG only: manualOutboundClicks=true emits sanitized GA4 outbound click events because its audited enhanced measurement was disabled. Set it false before enabling automatic outbound clicks. Other sites leave this option absent/false. Known public NEO schedule anchors are allowed explicitly; arbitrary fragments remain suppressed.
