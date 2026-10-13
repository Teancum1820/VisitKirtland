/* KHG tracking v1. Shared source; provider configuration is intentionally explicit. */
(() => {
  "use strict";
  if (window.KHGAnalytics) return;
  const script = document.currentScript;
  const base = new URL(".", script.src);
  const consentKey = "khg-tracking-consent-v1";
  let config,
    consent = { analytics: false, marketing: false };
  const loaded = new Set(),
    sent = new Set();
  const safe = (fn) => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };
  const restricted = () =>
    /\/(admin|staff-login|preview)(\/|$|-)/.test(location.pathname);
  const privacySignal = () =>
    navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
  const canonical = (value) => {
    try {
      const u = new URL(value, location.href);
      return /^https?:$/.test(u.protocol) ? u.origin + u.pathname : "";
    } catch {
      return "";
    }
  };
  const utms = () => {
    const result = {};
    for (const [key, value] of new URL(location.href).searchParams) {
      // Campaign vocabulary only; no arbitrary free text, contact fields or click/session IDs.
      if (
        /^utm_(source|medium|campaign|content|term)$/.test(key) &&
        /^[a-z][a-z0-9_-]{0,79}$/.test(value) &&
        !/\d{7}/.test(value)
      )
        result[key] = value;
    }
    return result;
  };
  const pageLocation = () => {
    const url = new URL(canonical(location.href));
    Object.entries(utms()).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.href;
  };
  const allowed = (kind) =>
    config?.enabled === true &&
    !restricted() &&
    !privacySignal() &&
    consent[kind] === true;
  const load = (id, url, onload) => {
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = url;
    s.async = true;
    if (onload) s.onload = onload;
    document.head.appendChild(s);
  };
  const keyOnce = (platform, key) => {
    if (!key) return true;
    const full = "khg-analytics:" + platform + ":" + key;
    if (sent.has(full) || safe(() => sessionStorage.getItem(full)) === "1")
      return false;
    sent.add(full);
    safe(() => sessionStorage.setItem(full, "1"));
    return true;
  };
  function initialize() {
    if (
      allowed("analytics") &&
      /^G-[A-Z0-9]+$/.test(config.ga4MeasurementId) &&
      !loaded.has("ga4")
    ) {
      // Refuse a second owner. Existing GTM/gtag must instead integrate this event map.
      if (
        !window.gtag &&
        !document.querySelector('script[src*="googletagmanager.com"]')
      ) {
        loaded.add("ga4");
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () {
          window.dataLayer.push(arguments);
        };
        window.gtag("consent", "default", {
          analytics_storage: "denied",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        });
        window.gtag("consent", "update", { analytics_storage: "granted" });
        window.gtag("js", new Date());
        window.gtag("config", config.ga4MeasurementId, {
          send_page_view: true,
          page_location: pageLocation(),
          page_referrer: canonical(document.referrer),
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
        });
        load(
          "khg-ga4",
          "https://www.googletagmanager.com/gtag/js?id=" +
            config.ga4MeasurementId,
        );
      }
    }
    // Meta and Metricool read the real document URL. Suppress on sensitive query strings.
    const safeVendorUrl = (value, marketing) => {
      if (!value) return true;
      const url = new URL(value);
      const safeQuery = [...url.searchParams].every(([key, value]) =>
        (/^utm_(source|medium|campaign|content|term)$/.test(key) &&
          /^[a-z][a-z0-9_-]{0,79}$/.test(value) && !/\d{7}/.test(value)) ||
        (marketing && key === "fbclid" && /^[A-Za-z0-9_-]{1,512}$/.test(value))
      );
      return /^https?:$/.test(url.protocol) && safeQuery &&
        (!url.hash || config.allowedFragments?.includes(url.hash.slice(1)));
    };
    const safeDocumentUrl = safeVendorUrl(location.href, true) && safeVendorUrl(document.referrer, true);
    const safeMetricoolUrl = safeVendorUrl(location.href, false) && safeVendorUrl(document.referrer, false);
    if (
      allowed("marketing") &&
      safeDocumentUrl &&
      /^\d{5,25}$/.test(config.metaPixelId) &&
      !loaded.has("meta") &&
      !window.fbq
    ) {
      loaded.add("meta");
      const fbq = function () {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
        else fbq.queue.push(arguments);
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      window.fbq = fbq;
      window._fbq = fbq;
      window.fbq("set", "autoConfig", false, config.metaPixelId);
      window.fbq("consent", "grant");
      window.fbq("init", config.metaPixelId);
      window.fbq("track", "PageView");
      load("khg-meta", "https://connect.facebook.net/en_US/fbevents.js");
      const content =
        config.contentRoutes?.[location.pathname.replace(/\/$/, "") || "/"];
      if (content)
        window.fbq("track", "ViewContent", {
          content_name: content.event_title,
          content_ids: [content.event_slug],
          content_type: "product",
        });
    }
    if (
      allowed("analytics") &&
      safeMetricoolUrl &&
      /^[a-f0-9]{32}$/i.test(config.metricoolHash) &&
      !loaded.has("metricool") &&
      !window.beTracker &&
      !document.querySelector('script[src*="tracker.metricool.com"]')
    ) {
      loaded.add("metricool");
      load(
        "khg-metricool",
        "https://tracker.metricool.com/resources/be.js",
        () => {
          if (allowed("analytics"))
            safe(() => window.beTracker?.t({ hash: config.metricoolHash }));
        },
      );
    }
  }
  const stringFields = [
    "event_slug",
    "event_title",
    "event_location",
    "event_date",
    "button_name",
    "ticket_provider",
    "link_type",
    "form_type",
    "payment_option",
  ];
  function clean(params) {
    const result = { page_location: pageLocation() };
    for (const k of stringFields)
      if (
        typeof params[k] === "string" &&
        params[k].length <= 100 &&
        !/[@\r\n]|\d{7}/.test(params[k])
      )
        result[k] = params[k];
    if (params.destination_url)
      result.destination_url = canonical(params.destination_url);
    return result;
  }
  function emit(name, params = {}, unique = "") {
    if (
      !/^(ticket_button_click|registration_button_click|vip_dinner_click|schedule_button_click|event_details_click|generate_lead|begin_checkout)$/.test(
        name,
      )
    )
      return;
    initialize();
    const data = clean(params);
    if (allowed("analytics") && loaded.has("ga4") && keyOnce("ga4", unique))
      safe(() =>
        window.gtag("event", name, {
          ...data,
          send_to: config.ga4MeasurementId,
          transport_type: "beacon",
        }),
      );
    if (allowed("marketing") && loaded.has("meta") && keyOnce("meta", unique))
      safe(() => {
        const standard = {
          generate_lead: "Lead",
          begin_checkout: "InitiateCheckout",
        }[name];
        const custom = {
          ticket_button_click: "TicketButtonClick",
          registration_button_click: "RegistrationButtonClick",
          vip_dinner_click: "VipDinnerClick",
          schedule_button_click: "ScheduleButtonClick",
          event_details_click: "EventDetailsClick",
        }[name];
        window.fbq(
          standard ? "track" : "trackCustom",
          standard || custom,
          data,
        );
      });
  }
  function applyConsent(value) {
    const old = consent;
    consent = {
      analytics: value?.analytics === true,
      marketing: value?.marketing === true,
    };
    if (privacySignal()) consent = { analytics: false, marketing: false };
    // Reload on withdrawal because already-loaded vendor auto-measurement may keep running.
    if (
      (old.analytics && !consent.analytics) ||
      (old.marketing && !consent.marketing)
    ) {
      safe(() =>
        window.gtag?.("consent", "update", {
          analytics_storage: consent.analytics ? "granted" : "denied",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        }),
      );
      if (!consent.marketing) safe(() => window.fbq?.("consent", "revoke"));
      safe(() =>
        localStorage.setItem(
          consentKey,
          JSON.stringify({ ...consent, time: Date.now() }),
        ),
      );
      location.reload();
      return;
    }
    safe(() =>
      localStorage.setItem(
        consentKey,
        JSON.stringify({ ...consent, time: Date.now() }),
      ),
    );
    document.getElementById("khg-consent")?.remove();
    initialize();
  }
  function preferences() {
    if (
      !config?.enabled ||
      restricted() ||
      privacySignal() ||
      document.getElementById("khg-consent")
    )
      return;
    const box = document.createElement("section");
    box.id = "khg-consent";
    box.setAttribute("role", "region");
    box.setAttribute("aria-label", "Tracking preferences");
    box.style.cssText =
      "position:fixed;bottom:16px;left:16px;right:16px;max-width:700px;margin:auto;z-index:9999;background:white;color:#172b3a;border:1px solid #657482;padding:20px;box-shadow:0 4px 24px #0003;font:16px/1.5 system-ui;border-radius:10px";
    const p = document.createElement("p");
    p.textContent =
      "May we use analytics to measure website visits and marketing cookies to measure campaign interest? You can change your choice at any time.";
    box.appendChild(p);
    if (config.privacyNoticeUrl) {
      const a = document.createElement("a");
      a.href = config.privacyNoticeUrl;
      a.textContent = "Privacy notice";
      box.appendChild(a);
    }
    [
      ["Decline optional", false, false],
      ["Allow analytics", true, false],
      ["Allow analytics and marketing", true, true],
    ].forEach(([label, analytics, marketing]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText =
        "margin:8px 8px 0 0;padding:9px 14px;border:1px solid #334;background:#fff;color:#172b3a;border-radius:5px;cursor:pointer";
      b.onclick = () => applyConsent({ analytics, marketing });
      box.appendChild(b);
    });
    document.body.appendChild(box);
  }
  document.addEventListener(
    "click",
    (event) => {
      safe(() => {
        const a = event.target.closest?.("a");
        if (!a) return;
        if (
          !a.dataset.analyticsEvent &&
          config?.manualOutboundClicks === true
        ) {
          const destination = canonical(a.href);
          if (
            destination &&
            !config.allowedHosts.includes(new URL(destination).hostname)
          ) {
            initialize();
            if (allowed("analytics") && loaded.has("ga4"))
              safe(() =>
                window.gtag("event", "click", {
                  page_location: pageLocation(),
                  link_url: destination,
                  link_domain: new URL(destination).hostname,
                  outbound: true,
                  send_to: config.ga4MeasurementId,
                  transport_type: "beacon",
                }),
              );
          }
          return;
        }
        const definition = config?.linkEvents?.[a.dataset.analyticsKey];
        if (!definition) return;
        emit(a.dataset.analyticsEvent, {
          ...definition,
          link_type:
            a.dataset.analyticsEvent === "event_details_click"
              ? "event_details"
              : definition.link_type,
          button_name: a.dataset.analyticsButton,
          destination_url: a.href,
        });
        // No preventDefault, navigation delays, or changes to the destination.
      });
    },
    true,
  );
  document.addEventListener("khg:form-success", (event) =>
    safe(() => {
      const d = event.detail || {};
      if (!config?.formTypes?.includes(d.form_type) || !d.submission_key)
        return;
      emit(
        "generate_lead",
        { form_type: d.form_type },
        "lead:" + d.form_type + ":" + d.submission_key,
      );
    }),
  );
  document.addEventListener("khg:checkout-start", (event) =>
    safe(() => {
      const d = event.detail || {};
      if (!d.submission_key || !config?.formTypes?.includes(d.form_type))
        return;
      emit(
        "begin_checkout",
        { form_type: d.form_type, payment_option: d.payment_option },
        "checkout:" + d.submission_key,
      );
    }),
  );
  window.KHGAnalytics = { setConsent: applyConsent, preferences, track: emit };
  document.addEventListener("khg:consent-change", (e) =>
    safe(() => applyConsent(e.detail)),
  );
  window.addEventListener("storage", (e) => {
    if (e.key === consentKey) location.reload();
  });
  fetch(new URL("analytics-config.json", base), {
    credentials: "same-origin",
    cache: "no-cache",
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((value) => {
      config = value;
      if (!config?.enabled) return;
      if (
        restricted() ||
        (!config.allowedHosts?.includes(location.hostname) &&
          !(
            ["localhost", "127.0.0.1", "::1"].includes(location.hostname) &&
            config.allowLocalTesting === true
          ))
      ) {
        config.enabled = false;
        return;
      }
      // Activation requires a reviewed privacy notice and verified provider IDs.
      if (!config.privacyNoticeUrl) {
        config.enabled = false;
        return;
      }
      const saved = safe(() =>
        JSON.parse(localStorage.getItem(consentKey) || "null"),
      );
      const validSaved =
        saved &&
        Number.isFinite(saved.time) &&
        Date.now() - saved.time < 180 * 86400000;
      if (validSaved)
        consent = {
          analytics: saved.analytics === true,
          marketing: saved.marketing === true,
        };
      if (privacySignal()) consent = { analytics: false, marketing: false };
      initialize();
      if (!validSaved) preferences();
      const settings = document.createElement("button");
      settings.type = "button";
      settings.textContent = "Tracking preferences";
      settings.onclick = preferences;
      settings.style.cssText =
        "display:block;margin:12px auto;padding:8px;background:#fff;color:#172b3a;border:1px solid #657482;border-radius:4px";
      document.body.appendChild(settings);
    })
    .catch(() => {});
})();
