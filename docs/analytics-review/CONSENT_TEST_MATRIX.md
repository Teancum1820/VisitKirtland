# Consent test matrix

Evidence: Node runtime tests and [browser summary](evidence/browser-results.json). Browser sources are committed in scripts/analytics.browser.mjs; RTG also uses scripts/leading-saints.browser.mjs. Test flags and IDs are in memory or intercepted responses; checked-in release files remain disabled.

| Behavior | Evidence / result |
|---|---|
| Globally disabled, including user acceptance and success callbacks | Runtime and exact-release browser checks: no optional provider execution |
| No initial choice | Zero optional provider scripts before consent; no replay of earlier clicks |
| Decline | Zero optional provider scripts; denial persists on browser reload |
| Analytics only | Synthetic GA4 and valid-syntax Metricool only; no Meta |
| Analytics plus marketing | Synthetic Meta permitted only when separately enabled and URL privacy checks pass |
| Withdrawal | Consent denied/revoked; future custom events and late Metricool callback blocked; reload initializes no new optional tags |
| Existing cookies | Not deleted by this implementation; draft notices explicitly explain browser site-data removal and that previously sent information is not retracted |
| Consent reload / route handling | Origin-local storage retained across multipage documents; explicit settings button reopens a saved choice; other websites/www origins have separate storage |
| Missing / expired / future / corrupted state | Fail closed; only boolean choices with a valid timestamp are accepted |
| Storage quota failure on withdrawal | Older stored grant removed before reload |
| Missing provider IDs/config | No malformed provider request; no application exception |
| Privacy notice input | Only same-origin absolute paths accepted; script/external/protocol-relative URLs rejected |
| GPC / Do Not Track / protected routes / unapproved host | Optional tracking blocked |
| Navigation | Analytics does not cancel clicks or alter destination URLs/UTMs; visible CTA tests check event name and canonical event destination |
| Forms and completed transactions | Only acknowledged callbacks; clicks/thank-you visits are insufficient; RTG failure/success/idempotency/receipt cases use local intercepted responses |

Preferences last up to 180 days per origin. Restricted staff/admin/preview routes do not initialize these trackers. Existing Cloudflare analytics and operational hosting/security/form processing are separate; these tests do not certify all third-party cookie behavior or regulatory compliance. Automatic vendor features need account-owner review before activation.
