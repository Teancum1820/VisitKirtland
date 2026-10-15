# Analytics tracking — review implementation

Tracking is disabled until existing provider ownership, IDs, consent/privacy notice and deployment are reviewed. Configuration: `tracking/analytics-config.json` (under public/ or site/ where applicable). No secrets belong in this public file.

Set the verified IDs, correct allowedHosts and privacyNoticeUrl before enabled=true. Every new provider waits for explicit visitor consent. Analytics consent covers GA4 and Metricool; marketing consent covers Meta. GPC/DNT disables these new trackers. Preferences persist for 180 days. Withdrawal reloads the page to stop vendor automatic collection. No click/form history is replayed after consent. Existing Cloudflare analytics is preserved independently.

Do not add another gtag/GTM or pixel installation. The runtime refuses another existing owner; reconcile through that owner instead. GA4 owns one automatic page_view per document; these static multipage sites have no virtual route dispatcher. Retain outbound-click enhanced measurement, but do not sum it with custom intent events. Review automatic form interactions and disable them for conversion reporting because form_submit alone does not prove a saved submission. Do not mark click-outs as purchases.

Stable link metadata is generated from known URLs, not visible labels. Form success hooks run after the existing server acknowledgement. No form fields or record identifiers are sent. GA4 page_location keeps only campaign vocabulary; other query strings/fragments are stripped. Meta/Metricool are suppressed on pages with non-UTM query parameters or fragments because those vendors read the real document URL. Review GA4 enhanced-measurement parameter collection before activation.

Run the focused tests documented in the handoff. Production publication requires Joe's privacy review and explicit approval of this change; main auto-deploys on KHG/NEO/Visit. No new accounts, provider settings, advertising, purchases, emails, production submissions, database changes or server-side CAPI are part of this implementation.

Use `document.dispatchEvent(new CustomEvent("khg:form-success", {detail:{form_type:"a configured type",submission_key:"local deduplication key"}}))` only in an authoritative success callback. The key stays local. A provider dispatch/queue is not a delivery receipt.

Site-specific current account and consent decisions are recorded in docs/analytics-review/; cross-site historical outbound assumptions must not be used for activation.

## October 14 continuation

Metricool Brand 7369612; exact supplied hash `46026cbfb05c35eaff5c4900bcd965bb`. Brand IDs are documentation metadata; only the tag hash is passed to the supported JavaScript tracker. Global activation stays disabled pending privacy review and provider checks.


Consent timestamps in the future are rejected. Existing event names are retained. No Purchase or CompleteRegistration event is added.

Existing 2026 family reunion registration links have explicit navigation-intent metadata. These historical links are not confirmed registrations or current 2027 event conversions. The separate reunion app has no verified completion hook. The idempotent tracking helper preserves newer checked-in site content; do not regenerate from stale VK2.0 source.

## October 15 review

See [the complete review](docs/analytics-review/README.md) for draft notices, verified account mappings, current evidence and activation blockers. Every release config remains disabled. Draft notices explicitly document that existing vendor cookies are not deleted on withdrawal. Public privacy/settings links remain available while disabled.
