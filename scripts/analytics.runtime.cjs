const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const source = fs.readFileSync(__dirname + "/../tracking/analytics.js", "utf8");
const mapStore = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) || null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
};
async function setup(overrides = {}, options = {}) {
  const config = {
    enabled: true,
    allowedHosts: ["neochosen.com"],
    privacyNoticeUrl: "/privacy/",
    ga4MeasurementId: "G-TEST12345",
    metaPixelId: "123456789012345",
    metricoolHash: "a".repeat(32),
    formTypes: ["contact"],
    contentRoutes: {
      "/piano-guys": {
        event_title: "The Piano Guys Live",
        event_slug: "piano-guys",
      },
    },
    linkEvents: {
      piano: {
        event_slug: "piano-guys",
        event_title: "The Piano Guys Live",
        ticket_provider: "ticketmaster",
        link_type: "ticket_outbound",
      },
    },
    ...overrides,
  };
  const listeners = {},
    nodes = [],
    localStorage = mapStore(),
    sessionStorage = mapStore();
  if (options.saved)
    localStorage.setItem(
      "khg-tracking-consent-v1",
      JSON.stringify({
        analytics: false,
        marketing: false,
        ...options.saved,
        time: options.future
          ? Date.now() + 86400000
          : options.expired
            ? 0
            : Date.now(),
      }),
    );
  if (options.rawSaved !== undefined)
    localStorage.setItem("khg-tracking-consent-v1", options.rawSaved);
  const el = (tag) => ({
    tag,
    children: [],
    style: {},
    setAttribute() {},
    appendChild(n) {
      this.children.push(n);
      nodes.push(n);
    },
    remove() {
      this.removed = true;
    },
  });
  const document = {
    currentScript: { src: "https://neochosen.com/tracking/analytics.js" },
    referrer: options.referrer || "https://facebook.com/",
    head: el("head"),
    body: el("body"),
    createElement: el,
    getElementById: (id) => nodes.find((n) => n.id === id && !n.removed),
    querySelector: () => (options.existingTag ? {} : null),
    addEventListener: (n, f) => {
      (listeners[n] ??= []).push(f);
    },
  };
  const url = new URL(
    options.url ||
      "https://neochosen.com/piano-guys/?utm_source=facebook&utm_medium=paid_social",
  );
  let reloads = 0;
  const windowListeners = {};
  const window = {
    addEventListener: (name, fn) => (windowListeners[name] ??= []).push(fn),
  };
  if (options.existingPixel) window.fbq = () => {};
  const ctx = {
    window,
    document,
    localStorage,
    sessionStorage,
    URL,
    navigator: {
      globalPrivacyControl: !!options.gpc,
      doNotTrack: options.dnt ? "1" : "0",
    },
    location: {
      href: url.href,
      hostname: url.hostname,
      pathname: url.pathname,
      hash: url.hash,
      reload() {
        reloads++;
      },
    },
    fetch: () =>
      options.failFetch
        ? Promise.reject(Error())
        : Promise.resolve({
            ok: true,
            json: () => Promise.resolve(options.missingConfig ? null : config),
          }),
    Date,
    Set,
    Object,
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  await new Promise((r) => setImmediate(r));
  const commands = () =>
    Array.from(window.dataLayer || [], (a) => Array.from(a));
  const fire = (n, detail) => {
    for (const f of listeners[n] || []) f({ detail });
  };
  const click = () => {
    for (const f of listeners.click || [])
      f({
        target: {
          closest: () => ({
            dataset: {
              analyticsEvent: "ticket_button_click",
              analyticsKey: "piano",
              analyticsButton: "hero_piano",
            },
            href: "https://www.ticketmaster.com/event/TEST?email=private@example.com#token",
          }),
        },
      });
  };
  return {
    ctx,
    localStorage,
    config,
    window,
    document,
    nodes,
    fire,
    click,
    rawClick: (anchor) => {
      for (const f of listeners.click || [])
        f({ target: { closest: () => anchor } });
    },
    fireWindow: (name, event) => {
      for (const fn of windowListeners[name] || []) fn(event);
    },
    sessionStorage,
    commands,
    reloads: () => reloads,
    runAgain: () => vm.runInContext(source, ctx),
  };
}
test("no provider scripts or events before consent, no retroactive clicks", async () => {
  const a = await setup();
  a.click();
  assert.equal(a.commands().length, 0);
  assert.equal(a.nodes.filter((n) => n.tag === "script").length, 0);
  a.window.KHGAnalytics.setConsent({ analytics: true });
  assert.equal(a.commands().filter((c) => c[0] === "event").length, 0);
  assert.equal(a.commands().filter((c) => c[0] === "config").length, 1);
});
test("one GA initialization, one Meta PageView, no duplicate listeners", async () => {
  const a = await setup({}, { saved: { analytics: true, marketing: true } });
  a.runAgain();
  a.window.KHGAnalytics.setConsent({ analytics: true, marketing: true });
  assert.equal(a.commands().filter((c) => c[0] === "config").length, 1);
  assert.equal(a.window.fbq.queue.filter((c) => c[1] === "PageView").length, 1);
  assert.equal(
    a.window.fbq.queue.filter((c) => c[1] === "ViewContent").length,
    1,
  );
  a.click();
  assert.equal(
    a.commands().filter((c) => c[1] === "ticket_button_click").length,
    1,
  );
});
test("only analytics consent loads GA/Metricool, no Meta", async () => {
  const a = await setup({}, { saved: { analytics: true, marketing: false } });
  assert.equal(a.window.fbq, undefined);
  assert.ok(a.document.getElementById("khg-ga4"));
  assert.ok(a.document.getElementById("khg-metricool"));
});
test("one custom click and correct parameters without purchase semantics", async () => {
  const a = await setup({}, { saved: { analytics: true, marketing: true } });
  a.click();
  const c = a.commands().find((c) => c[0] === "event");
  assert.equal(c[1], "ticket_button_click");
  assert.equal(c[2].ticket_provider, "ticketmaster");
  assert.equal(c[2].destination_url, "https://www.ticketmaster.com/event/TEST");
  assert.ok(!JSON.stringify(a.commands()).includes("private@"));
  assert.equal(
    a.window.fbq.queue.filter((c) => c[1] === "TicketButtonClick").length,
    1,
  );
  assert.equal(a.window.fbq.queue.filter((c) => c[1] === "Purchase").length, 0);
});
test("only configured acknowledged form success, local per-record deduplication", async () => {
  const a = await setup({}, { saved: { analytics: true, marketing: true } });
  a.fire("submit", {});
  a.fire("khg:form-success", { form_type: "contact" });
  a.fire("khg:form-success", { form_type: "unknown", submission_key: "a" });
  assert.equal(a.commands().filter((c) => c[0] === "event").length, 0);
  a.fire("khg:form-success", {
    form_type: "contact",
    submission_key: "record-secret",
    email: "private@example.com",
  });
  a.fire("khg:form-success", {
    form_type: "contact",
    submission_key: "record-secret",
  });
  assert.equal(a.commands().filter((c) => c[1] === "generate_lead").length, 1);
  assert.ok(!JSON.stringify(a.commands()).includes("record-secret"));
  assert.ok(!JSON.stringify(a.commands()).includes("private@"));
  assert.equal(a.window.fbq.queue.filter((c) => c[1] === "Lead").length, 1);
});
test("clicks and forged purchase name cannot create a purchase", async () => {
  const a = await setup({}, { saved: { analytics: true, marketing: true } });
  a.window.KHGAnalytics.track("purchase", { value: 100 });
  assert.equal(a.commands().filter((c) => c[0] === "event").length, 0);
});
test("manual outbound fallback is explicit, sanitized, and does not add a Meta conversion", async () => {
  const a = await setup(
    { manualOutboundClicks: true },
    { saved: { analytics: true, marketing: true } },
  );
  a.rawClick({
    dataset: {},
    href: "https://example.com/tour?email=private@example.com",
  });
  const events = a.commands().filter((c) => c[0] === "event");
  assert.equal(events.length, 1);
  assert.equal(events[0][1], "click");
  assert.equal(events[0][2].link_url, "https://example.com/tour");
  assert.equal(
    a.window.fbq.queue.filter((c) => c[0] === "trackCustom").length,
    0,
  );
  a.rawClick({ dataset: {}, href: "https://neochosen.com/contact/" });
  assert.equal(a.commands().filter((c) => c[0] === "event").length, 1);
});
test("disabled config, missing privacy, blocked fetch fail closed", async () => {
  for (const [cfg, opt] of [
    [{ enabled: false }, {}],
    [{ privacyNoticeUrl: "" }, {}],
    [{}, { failFetch: true }],
  ]) {
    const a = await setup(cfg, opt);
    a.window.KHGAnalytics.setConsent({ analytics: true, marketing: true });
    a.click();
    assert.equal(a.commands().length, 0);
  }
});
test("unapproved host, private routes, GPC, DNT prevent all new providers", async () => {
  for (const opt of [
    { url: "https://unapproved.example/" },
    { url: "https://neochosen.com/admin/" },
    { gpc: true },
    { dnt: true },
  ]) {
    const a = await setup(
      {},
      { ...opt, saved: { analytics: true, marketing: true } },
    );
    a.window.KHGAnalytics.setConsent({ analytics: true, marketing: true });
    a.click();
    assert.equal(a.commands().length, 0);
    assert.equal(a.window.fbq, undefined);
  }
});
test("sensitive document query suppresses URL-reading vendors and sanitizes GA", async () => {
  const a = await setup(
    {},
    {
      url: "https://neochosen.com/piano-guys/?email=private@example.com&session_id=cs_live_123456&flag=yes",
      saved: { analytics: true, marketing: true },
    },
  );
  assert.equal(a.window.fbq, undefined);
  assert.equal(a.document.getElementById("khg-metricool"), undefined);
  const c = a.commands().find((c) => c[0] === "config");
  assert.equal(c[2].page_location, "https://neochosen.com/piano-guys/");
});
test("existing GTM/pixel is not double initialized", async () => {
  const a = await setup(
    {},
    {
      existingTag: true,
      existingPixel: true,
      saved: { analytics: true, marketing: true },
    },
  );
  assert.equal(a.document.getElementById("khg-ga4"), undefined);
  assert.equal(a.document.getElementById("khg-meta"), undefined);
});
test("known public schedule anchors initialize vendors while unknown fragments remain suppressed", async () => {
  const a = await setup(
    { allowedFragments: ["events", "tickets"] },
    {
      url: "https://neochosen.com/#events",
      saved: { analytics: true, marketing: true },
    },
  );
  assert.equal(a.window.fbq.queue.filter((c) => c[1] === "PageView").length, 1);
  assert.ok(a.document.getElementById("khg-metricool"));
  const b = await setup(
    { allowedFragments: ["events", "tickets"] },
    {
      url: "https://neochosen.com/#private-person",
      saved: { analytics: true, marketing: true },
    },
  );
  assert.equal(b.window.fbq, undefined);
  assert.equal(b.document.getElementById("khg-metricool"), undefined);
});
test("URL-reading vendors do not receive sensitive referrer queries", async () => {
  const a = await setup(
    {},
    {
      referrer: "https://example.com/?email=private@example.com",
      saved: { analytics: true, marketing: true },
    },
  );
  assert.equal(a.window.fbq, undefined);
  assert.equal(a.document.getElementById("khg-metricool"), undefined);
  assert.equal(
    a.commands().find((c) => c[0] === "config")[2].page_referrer,
    "https://example.com/",
  );
});
test("campaign referrers and consented Meta click attribution survive while Metricool does not receive fbclid", async () => {
  const a = await setup(
    {},
    {
      url: "https://neochosen.com/piano-guys/?utm_source=facebook&fbclid=CampaignClick_Example",
      referrer:
        "https://neochosen.com/?utm_source=facebook&utm_medium=paid_social",
      saved: { analytics: true, marketing: true },
    },
  );
  assert.equal(a.window.fbq.queue.filter((c) => c[1] === "PageView").length, 1);
  assert.equal(a.document.getElementById("khg-metricool"), undefined);
  assert.ok(
    !a
      .commands()
      .find((c) => c[0] === "config")[2]
      .page_location.includes("fbclid"),
  );
});
test("withdrawal applies denial and reloads to stop automatic vendor events", async () => {
  const a = await setup({}, { saved: { analytics: true, marketing: true } });
  a.window.KHGAnalytics.setConsent({ analytics: false, marketing: false });
  assert.equal(a.reloads(), 1);
  assert.equal(a.commands().at(-1)[2].analytics_storage, "denied");
  assert.equal(a.window.fbq.queue.at(-1)[1], "revoke");
});
test("expired consent requests new choice, no provider initializes", async () => {
  const a = await setup(
    {},
    { saved: { analytics: true, marketing: true }, expired: true },
  );
  assert.ok(a.document.getElementById("khg-consent"));
  assert.equal(a.commands().length, 0);
});
test("broken analytics dispatch never throws or cancels navigation", async () => {
  const a = await setup({}, { saved: { analytics: true, marketing: true } });
  a.window.gtag = () => {
    throw Error("blocked");
  };
  a.window.fbq = () => {
    throw Error("blocked");
  };
  assert.doesNotThrow(a.click);
  assert.doesNotThrow(() =>
    a.fire("khg:form-success", { form_type: "contact", submission_key: "x" }),
  );
});

test("future-dated consent fails closed", async () => {
  const a = await setup(
    {},
    { saved: { analytics: true, marketing: true }, future: true },
  );
  assert.equal(a.nodes.filter((n) => n.tag === "script").length, 0);
});
test("invalid Metricool hash cannot load a tag or use a brand ID as a hash", async () => {
  for (const hash of [
    "4510a3f600e674fbd59fa0193b69fe3",
    "6874036",
    "",
    "x".repeat(32),
  ]) {
    const a = await setup(
      { metricoolHash: hash },
      { saved: { analytics: true } },
    );
    assert.equal(a.document.getElementById("khg-metricool"), undefined);
  }
});
test("Metricool receives the configured hash once after analytics consent", async () => {
  const hash = "1a629a9567d67d551e83d8c4e0081e3d";
  const a = await setup({ metricoolHash: hash });
  const received = [];
  a.window.beTracker = { t: (p) => received.push(p) };
  a.window.KHGAnalytics.setConsent({ analytics: true });
  // A pre-existing vendor owner must be preserved, so use a fresh fixture.
  assert.equal(a.document.getElementById("khg-metricool"), undefined);
  const b = await setup(
    { metricoolHash: hash },
    { saved: { analytics: true } },
  );
  b.window.beTracker = { t: (p) => received.push(p) };
  b.document.getElementById("khg-metricool").onload();
  b.window.KHGAnalytics.setConsent({ analytics: true });
  assert.equal(received.length, 1);
  assert.equal(received[0].hash, hash);
});
test("payment link intent stays separate from checkout and purchase", async () => {
  const a = await setup({}, { saved: { analytics: true, marketing: true } });
  a.window.KHGAnalytics.track("payment_link_click", {
    ticket_provider: "stripe",
    destination_url: "https://buy.stripe.com/example",
  });
  const events = a.commands().filter((c) => c[0] === "event");
  assert.equal(events.length, 1);
  assert.equal(events[0][1], "payment_link_click");
  assert.equal(
    a.window.fbq.queue.filter(
      (c) => c[1] === "Purchase" || c[1] === "InitiateCheckout",
    ).length,
    0,
  );
});

test("release config has exact authorized mapping and stays dormant", () => {
  const config = JSON.parse(
    fs.readFileSync(__dirname + "/../tracking/analytics-config.json", "utf8"),
  );
  const expected = {
    enabled: false,
    allowLocalTesting: false,
    allowedHosts: ["visitkirtland.com", "www.visitkirtland.com"],
    ga4MeasurementId: "G-1WEVH2BDTJ",
    metaPixelId: "",
    metricoolBrandId: 7369612,
    metricoolHash: "46026cbfb05c35eaff5c4900bcd965bb",
  };
  for (const [key, value] of Object.entries(expected))
    assert.deepEqual(config[key], value, key);
});
test("missing provider IDs remain safe after consent", async () => {
  const a = await setup(
    { ga4MeasurementId: "", metaPixelId: "", metricoolHash: "" },
    { saved: { analytics: true, marketing: true } },
  );
  assert.equal(a.nodes.filter((n) => n.tag === "script").length, 0);
  a.click();
  assert.equal(a.commands().filter((c) => c[0] === "event").length, 0);
});

test("checked-in Visit deployment assets match their canonical tracking source", () => {
  for (const name of ["analytics.js", "analytics-config.json"])
    assert.equal(
      fs.readFileSync(__dirname + "/../tracking/" + name, "utf8"),
      fs.readFileSync(__dirname + "/../site/tracking/" + name, "utf8"),
    );
});

test("Metricool rejects whitespace, encoding tricks, wrong types and script injection", async () => {
  const hash = "a".repeat(32);
  for (const value of [
    undefined,
    null,
    [],
    [hash],
    {},
    6874036,
    " " + hash,
    hash + " ",
    hash + "\n",
    "\u200b" + hash,
    "%61".repeat(32),
    "<script>alert(1)</script>",
    "javascript:alert(1)",
    hash + '\" onload=alert(1)',
  ]) {
    const a = await setup(
      { metricoolHash: value },
      { saved: { analytics: true } },
    );
    assert.equal(
      a.document.getElementById("khg-metricool"),
      undefined,
      String(value),
    );
  }
});
test("all three syntactically valid reported brand hashes work only in a synthetic fixture", async () => {
  for (const hash of [
    "46026cbfb05c35eaff5c4900bcd965bb",
    "186b8b755be1269fee75993c4c64b16d",
    "1a629a9567d67d551e83d8c4e0081e3d",
    "A".repeat(32),
  ]) {
    const a = await setup(
      { metricoolHash: hash },
      { saved: { analytics: true } },
    );
    assert.ok(a.document.getElementById("khg-metricool"));
  }
});
test("disabled feature stays inert even after acceptance and acknowledged success", async () => {
  const a = await setup(
    { enabled: false },
    { saved: { analytics: true, marketing: true } },
  );
  a.window.KHGAnalytics.setConsent({ analytics: true, marketing: true });
  a.click();
  a.fire("khg:form-success", {
    form_type: "contact",
    submission_key: "synthetic",
  });
  assert.equal(a.nodes.filter((n) => n.tag === "script").length, 0);
  assert.equal(a.commands().length, 0);
  assert.ok(a.nodes.some((n) => n.textContent === "Tracking preferences"));
});
test("declined consent survives another page load without a new prompt", async () => {
  const a = await setup();
  a.window.KHGAnalytics.setConsent({ analytics: false, marketing: false });
  const b = await setup(
    {},
    { rawSaved: a.localStorage.getItem("khg-tracking-consent-v1") },
  );
  assert.equal(b.nodes.filter((n) => n.tag === "script").length, 0);
  assert.equal(b.document.getElementById("khg-consent"), undefined);
  b.window.KHGAnalytics.preferences();
  assert.ok(b.document.getElementById("khg-consent"));
});
test("corrupted consent shapes fail closed", async () => {
  for (const rawSaved of [
    "{",
    "null",
    '"yes"',
    JSON.stringify({ analytics: true, time: Date.now() }),
    JSON.stringify({ analytics: true, marketing: "yes", time: Date.now() }),
    JSON.stringify({ analytics: 1, marketing: false, time: Date.now() }),
  ]) {
    const a = await setup({}, { rawSaved });
    assert.equal(a.nodes.filter((n) => n.tag === "script").length, 0);
  }
});
test("unsafe notice paths cannot activate providers or create unsafe links", async () => {
  for (const privacyNoticeUrl of [
    "javascript:alert(1)",
    "https://evil.example/privacy",
    "//evil.example/",
    "/\\evil.example/",
    " /privacy/",
    {},
    ["/privacy/"],
  ]) {
    const a = await setup(
      { privacyNoticeUrl },
      { saved: { analytics: true, marketing: true } },
    );
    a.window.KHGAnalytics.setConsent({ analytics: true, marketing: true });
    a.click();
    assert.equal(a.nodes.filter((n) => n.tag === "script").length, 0);
    assert.equal(a.nodes.filter((n) => n.tag === "a").length, 0);
  }
});
test("provider IDs reject coercible arrays and malformed identifiers", async () => {
  for (const ids of [
    { ga4MeasurementId: ["G-TEST12345"], metaPixelId: ["123456789012345"] },
    { ga4MeasurementId: undefined, metaPixelId: undefined },
    { ga4MeasurementId: 'G-TEST"<script>', metaPixelId: "12345?script" },
  ]) {
    const a = await setup(
      { ...ids, metricoolHash: "" },
      { saved: { analytics: true, marketing: true } },
    );
    assert.equal(a.nodes.filter((n) => n.tag === "script").length, 0);
    assert.equal(a.commands().length, 0);
  }
});
test("withdrawal blocks future custom events and delayed Metricool initialization", async () => {
  const a = await setup({}, { saved: { analytics: true, marketing: true } });
  const tag = a.document.getElementById("khg-metricool");
  let calls = 0;
  a.window.beTracker = { t: () => calls++ };
  a.window.KHGAnalytics.setConsent({ analytics: false, marketing: false });
  a.click();
  a.fire("khg:form-success", {
    form_type: "contact",
    submission_key: "after-withdrawal",
  });
  tag.onload();
  assert.equal(calls, 0);
  assert.equal(a.commands().filter((c) => c[0] === "event").length, 0);
  const b = await setup(
    {},
    { rawSaved: a.localStorage.getItem("khg-tracking-consent-v1") },
  );
  assert.equal(b.nodes.filter((n) => n.tag === "script").length, 0);
});
test("storage quota failure removes the previous grant before withdrawal reload", async () => {
  const a = await setup({}, { saved: { analytics: true, marketing: true } });
  a.localStorage.setItem = () => {
    throw Error("quota");
  };
  a.window.KHGAnalytics.setConsent({ analytics: false, marketing: false });
  assert.equal(a.localStorage.getItem("khg-tracking-consent-v1"), null);
  assert.equal(a.reloads(), 1);
});

test("missing configuration document remains inert after user actions", async () => {
  const a = await setup({}, { missingConfig: true });
  a.window.KHGAnalytics.setConsent({ analytics: true, marketing: true });
  a.click();
  assert.equal(a.nodes.filter((n) => n.tag === "script").length, 0);
});

test("clearing local storage in another tab revokes collection before reloading", async () => {
  const a = await setup();
  a.window.KHGAnalytics.setConsent({ analytics: true, marketing: true });
  a.localStorage.removeItem("khg-tracking-consent-v1");
  a.fireWindow("storage", { key: null, storageArea: a.localStorage });
  assert.equal(a.reloads(), 1);
  assert.equal(a.commands().at(-1)[2].analytics_storage, "denied");
  assert.equal(a.window.fbq.queue.at(-1)[1], "revoke");
  const count = a.commands().length;
  a.click();
  assert.equal(a.commands().length, count);
  assert.equal(a.localStorage.getItem("khg-tracking-consent-v1"), null);
});

test("consent removal in another tab revokes without rewriting its preference", async () => {
  const a = await setup();
  a.window.KHGAnalytics.setConsent({ analytics: true, marketing: true });
  a.localStorage.removeItem("khg-tracking-consent-v1");
  a.fireWindow("storage", {
    key: "khg-tracking-consent-v1",
    storageArea: a.localStorage,
  });
  assert.equal(a.reloads(), 1);
  assert.equal(a.commands().at(-1)[2].analytics_storage, "denied");
  assert.equal(a.localStorage.getItem("khg-tracking-consent-v1"), null);
});

test("unrelated local or session storage changes do not reload consent", async () => {
  const a = await setup();
  a.window.KHGAnalytics.setConsent({ analytics: true, marketing: true });
  a.fireWindow("storage", { key: "unrelated", storageArea: a.localStorage });
  a.fireWindow("storage", { key: null, storageArea: a.sessionStorage });
  a.fireWindow("storage", {
    key: "khg-tracking-consent-v1",
    storageArea: a.sessionStorage,
  });
  assert.equal(a.reloads(), 0);
  a.click();
  assert.equal(a.commands().at(-1)[0], "event");
});
