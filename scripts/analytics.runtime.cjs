const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const source = fs.readFileSync(__dirname + "/../tracking/analytics.js", "utf8");
const mapStore = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) || null, setItem: (k, v) => m.set(k, v) };
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
        ...options.saved,
        time: options.expired ? 0 : Date.now(),
      }),
    );
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
  const window = { addEventListener() {} };
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
        : Promise.resolve({ ok: true, json: () => Promise.resolve(config) }),
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
test("known public schedule anchors initialize vendors while unknown fragments remain suppressed",async()=>{
 const a=await setup({allowedFragments:['events','tickets']},{url:'https://neochosen.com/#events',saved:{analytics:true,marketing:true}});assert.equal(a.window.fbq.queue.filter(c=>c[1]==='PageView').length,1);assert.ok(a.document.getElementById('khg-metricool'));
 const b=await setup({allowedFragments:['events','tickets']},{url:'https://neochosen.com/#private-person',saved:{analytics:true,marketing:true}});assert.equal(b.window.fbq,undefined);assert.equal(b.document.getElementById('khg-metricool'),undefined);
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
test("campaign referrers and consented Meta click attribution survive while Metricool does not receive fbclid",async()=>{
 const a=await setup({}, {url:'https://neochosen.com/piano-guys/?utm_source=facebook&fbclid=CampaignClick_Example',referrer:'https://neochosen.com/?utm_source=facebook&utm_medium=paid_social',saved:{analytics:true,marketing:true}});
 assert.equal(a.window.fbq.queue.filter(c=>c[1]==='PageView').length,1);assert.equal(a.document.getElementById('khg-metricool'),undefined);assert.ok(!a.commands().find(c=>c[0]==='config')[2].page_location.includes('fbclid'));
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
