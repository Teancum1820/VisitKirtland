import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
let browserModule = process.env.ANALYTICS_PLAYWRIGHT_MODULE;
if (!browserModule) {
  try {
    browserModule = require.resolve("playwright");
  } catch {
    browserModule = require.resolve("playwright-core");
  }
}
const { chromium } = await import(pathToFileURL(browserModule).href);
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const out = path.resolve(
  process.env.ANALYTICS_QA_OUT || path.join(root, ".qa/analytics-review"),
);
await fs.mkdir(out, { recursive: true });
const siteKey = "visit";
const assetRoot = path.join(root, "site");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    if (req.method !== "GET") {
      res.writeHead(405);
      res.end();
      return;
    }
    const url = new URL(req.url, "http://127.0.0.1");
    let file = path.resolve(assetRoot, "." + decodeURIComponent(url.pathname));
    if (file !== assetRoot && !file.startsWith(assetRoot + path.sep))
      throw Error("Invalid path");
    let info = await fs.stat(file).catch(() => null);
    if (!info && !path.extname(file)) {
      file += ".html";
      info = await fs.stat(file).catch(() => null);
    }
    if (info?.isDirectory()) file = path.join(file, "index.html");
    const body = await fs.readFile(file);
    res.writeHead(200, {
      "content-type": types[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const localPort = server.address().port;
const sites = {
  khg: {
    port: 8891,
    routes: [
      "/",
      "/contact/",
      "/events/parade-of-trees/",
      "/privacy/analytics-review/",
    ],
    hash: "4510a3f600e674fbd59fa0193b69fe3",
  },
  visit: {
    port: 8892,
    routes: [
      "/",
      "/church-history-locations/",
      "/2026-family-reunions/",
      "/family-reunion/millet-reunion/",
      "/family-reunion/harris-reunion/",
      "/privacy/",
    ],
    hash: "46026cbfb05c35eaff5c4900bcd965bb",
  },
  neo: {
    port: 8893,
    routes: [
      "/",
      "/piano-guys/",
      "/vip-dinner/",
      "/lakewood/",
      "/fairlawn/",
      "/chesterland/",
      "/thank-you/lakewood/",
      "/privacy/",
    ],
    hash: "1a629a9567d67d551e83d8c4e0081e3d",
  },
  rtg: {
    port: 8894,
    routes: [
      "/",
      "/our-tours",
      "/leading-saints-registration",
      "/missouri-illinois-church-history-june-2027",
      "/privacy/",
    ],
    hash: "186b8b755be1269fee75993c4c64b16d",
  },
};
const info = sites[siteKey];
info.port = localPort;
for (const k of Object.keys(sites)) if (k !== siteKey) delete sites[k];
const results = [];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
});

async function fixture(
  site,
  enabled,
  viewport = { width: 1440, height: 1000 },
) {
  const context = await browser.newContext({
    viewport,
    serviceWorkers: "block",
  });
  const requests = [],
    errors = [],
    events = [];
  await context.exposeBinding("__record", (_source, provider, args) =>
    events.push({ provider, args }),
  );
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (enabled && url.includes("/tracking/analytics-config.json")) {
      const folder = { khg: "dist", visit: "site", neo: "dist", rtg: "public" }[
        site
      ];
      const config = JSON.parse(
        await fs.readFile(
          path.join(root, folder, "tracking/analytics-config.json"),
          "utf8",
        ),
      );
      Object.assign(config, {
        enabled: true,
        allowLocalTesting: true,
        ga4MeasurementId: "G-TEST12345",
        metaPixelId: "123456789012345",
      });
      return route.fulfill({ json: config });
    }
    if (url.includes("googletagmanager.com/gtag/js")) {
      requests.push({ provider: "ga4", url });
      return route.fulfill({
        contentType: "text/javascript",
        body: 'for(const a of window.dataLayer||[])window.__record("ga4",Array.from(a)); window.gtag=(...a)=>window.__record("ga4",a);',
      });
    }
    if (url.includes("connect.facebook.net/en_US/fbevents.js")) {
      requests.push({ provider: "meta", url });
      return route.fulfill({
        contentType: "text/javascript",
        body: 'for(const a of window.fbq.queue)window.__record("meta",Array.from(a)); window.fbq.callMethod=(...a)=>window.__record("meta",a);',
      });
    }
    if (url.includes("tracker.metricool.com/resources/be.js")) {
      requests.push({ provider: "metricool", url });
      return route.fulfill({
        contentType: "text/javascript",
        body: 'window.beTracker={t:p=>window.__record("metricool",[p])};',
      });
    }
    // Do not deliver synthetic test traffic to any analytics endpoint.
    if (
      /google-analytics|facebook\.com\/tr|metricool\.com|cloudflareinsights|doubleclick|googleadservices/.test(
        url,
      )
    )
      return route.fulfill({ status: 204, body: "" });
    if (route.request().method() !== "GET")
      return route.fulfill({ status: 405, body: "No real submissions in QA" });
    // Only local pages/APIs execute. External analytics, embeds and navigation cannot receive test activity.
    const external = new URL(url).hostname !== "127.0.0.1";
    if (
      external &&
      (route.request().resourceType() === "document" ||
        ["fetch", "xhr", "ping", "eventsource", "websocket"].includes(
          route.request().resourceType(),
        ) ||
        (route.request().resourceType() === "script" &&
          new URL(url).hostname !== "cdn.tailwindcss.com"))
    )
      return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return {
    context,
    page,
    requests,
    errors,
    events,
    url: `http://127.0.0.1:${sites[site].port}`,
  };
}

try {
  // Real cross-tab storage events; all providers remain intercepted fixtures.
  {
    const a = await fixture(siteKey, true);
    try {
      await a.page.goto(a.url + "/", { waitUntil: "load" });
      await a.page
        .getByRole("button", {
          name: "Allow analytics and marketing",
          exact: true,
        })
        .click();
      await a.page.waitForFunction(() => Boolean(window.gtag && window.fbq));
      const other = await a.context.newPage();
      await other.goto(a.url + "/", { waitUntil: "load" });
      await other.waitForFunction(() => Boolean(window.gtag && window.fbq));
      await a.page.evaluate(() => {
        window.__consentStorageEvent = false;
        addEventListener("storage", (event) => {
          if (event.key !== null || event.storageArea !== localStorage) return;
          window.__consentStorageEvent = true;
          window.KHGAnalytics.track("ticket_button_click", {
            button_name: "after_storage_clear",
          });
        });
      });
      await Promise.all([
        a.page.waitForEvent("load"),
        other.evaluate(() => localStorage.clear()),
      ]);
      await a.page.locator("#khg-consent").waitFor();
      assert.equal(
        await a.page.evaluate(() =>
          localStorage.getItem("khg-tracking-consent-v1"),
        ),
        null,
      );
      assert.ok(
        a.events.some(
          (e) =>
            e.provider === "ga4" &&
            e.args[0] === "consent" &&
            e.args[1] === "update" &&
            e.args[2]?.analytics_storage === "denied",
        ),
      );
      assert.ok(
        a.events.some(
          (e) =>
            e.provider === "meta" &&
            e.args[0] === "consent" &&
            e.args[1] === "revoke",
        ),
      );
      assert.ok(
        !a.events.some(
          (e) =>
            e.args[0] === "event" &&
            e.args[2]?.button_name === "after_storage_clear",
        ),
      );
      assert.deepEqual(a.errors, []);
      results.push({
        site: siteKey,
        mode: "cross-tab-local-storage-clear",
        result: "PASS",
        real_storage_event: true,
      });
    } finally {
      await a.context.close();
    }
  }
  for (const [site, info] of Object.entries(sites)) {
    for (const [label, viewport] of Object.entries({
      desktop: { width: 1440, height: 1000 },
      mobile: { width: 390, height: 844 },
    })) {
      const a = await fixture(site, false, viewport);
      const pages = [];
      for (const route of info.routes) {
        const [, response] = await Promise.all([
          a.page.waitForResponse((r) =>
            r.url().endsWith("/tracking/analytics-config.json"),
          ),
          a.page.goto(a.url + route, { waitUntil: "domcontentloaded" }),
        ]);
        await a.page.waitForFunction(() => Boolean(window.KHGAnalytics));
        await a.page.waitForLoadState("load");
        assert.equal(response.status(), 200, site + route);
        assert.equal(a.requests.length, 0, "disabled config vendor requests");
        assert.equal(await a.page.locator("#khg-consent").count(), 0);
        if (route.includes("/privacy/")) {
          assert.equal(
            await a.page.locator("main").count(),
            1,
            "One main landmark on draft notice",
          );
          assert.equal(
            await a.page.evaluate(() => {
              const ids = [...document.querySelectorAll("[id]")].map(
                (el) => el.id,
              );
              return new Set(ids).size === ids.length;
            }),
            true,
            "Unique notice IDs",
          );
          assert.equal(
            await a.page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 2,
            ),
            false,
            "Privacy notice overflow",
          );
          await a.page.screenshot({
            path: path.join(out, `${site}-${label}-privacy.png`),
            fullPage: true,
          });
        }
        pages.push({
          route,
          title: await a.page.title(),
          overflow: await a.page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 2,
          ),
          annotatedLinks: await a.page
            .locator("a[data-analytics-event]")
            .count(),
        });
      }
      await a.page.goto(a.url, { waitUntil: "load" });
      await a.page.screenshot({
        path: path.join(out, `${site}-${label}-disabled.png`),
      });
      assert.deepEqual(a.errors, [], "Page exceptions");
      results.push({
        site,
        mode: "exact-disabled",
        viewport: label,
        pages,
        vendor_requests: a.requests.length,
        errors: a.errors,
      });
      await a.context.close();
    }
    const a = await fixture(site, true);
    await a.page.goto(a.url, { waitUntil: "load" });
    await a.page.locator("#khg-consent").waitFor();
    assert.equal(a.requests.length, 0, "pre-consent");
    await a.page
      .getByRole("button", { name: "Decline optional", exact: true })
      .click();
    assert.equal(a.requests.length, 0, "denied consent");
    await a.page.reload({ waitUntil: "load" });
    assert.equal(
      await a.page.locator("#khg-consent").count(),
      0,
      "persisted denial",
    );
    assert.equal(a.requests.length, 0, "persisted denial requests");
    await a.page
      .getByRole("button", { name: "Tracking preferences", exact: true })
      .click();
    await a.page
      .getByRole("button", { name: "Allow analytics", exact: true })
      .click();
    await a.page.waitForFunction(() => Boolean(window.gtag));
    if (site !== "khg")
      await a.page.waitForFunction(() => Boolean(window.beTracker));
    await a.page.waitForFunction(() => !document.querySelector("#khg-consent"));
    assert.equal(a.requests.filter((r) => r.provider === "ga4").length, 1);
    assert.equal(a.requests.filter((r) => r.provider === "meta").length, 0);
    assert.equal(
      a.requests.filter((r) => r.provider === "metricool").length,
      site === "khg" ? 0 : 1,
    );
    if (site !== "khg") {
      const metric = a.events.find((e) => e.provider === "metricool");
      assert.equal(metric.args[0].hash, info.hash);
    }
    assert.equal(
      a.events.filter((e) => e.provider === "ga4" && e.args[0] === "config")
        .length,
      1,
      "single page view owner",
    );
    await a.page
      .getByRole("button", { name: "Tracking preferences", exact: true })
      .click();
    await a.page
      .getByRole("button", {
        name: "Allow analytics and marketing",
        exact: true,
      })
      .click();
    await a.page.waitForFunction(() => Boolean(window.fbq?.callMethod));
    assert.equal(a.requests.filter((r) => r.provider === "meta").length, 1);
    const beforeWithdraw = a.requests.length;
    await a.page
      .getByRole("button", { name: "Tracking preferences", exact: true })
      .click();
    await Promise.all([
      a.page.waitForEvent("load"),
      a.page
        .getByRole("button", { name: "Decline optional", exact: true })
        .click(),
    ]);
    await a.page.waitForFunction(() => Boolean(window.KHGAnalytics));
    assert.equal(
      a.requests.length,
      beforeWithdraw,
      "withdrawal reload starts no new tags",
    );
    assert.deepEqual(a.errors, [], "Consent page exceptions");
    results.push({
      site,
      mode: "synthetic-consent",
      before_consent: 0,
      denied: 0,
      persistence: "passed",
      analytics_only: "passed",
      marketing_opt_in: "passed",
      withdrawal: "passed",
      metricool_hash: info.hash,
      metricool_dispatch:
        site === "khg" ? "blocked-invalid-length" : "correct hash",
      events: a.events,
      errors: a.errors,
    });
    await a.context.close();
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const b = await fixture(site, true, viewport);
      await b.context.addInitScript(() => {
        try {
          localStorage.setItem(
            "khg-tracking-consent-v1",
            JSON.stringify({
              analytics: true,
              marketing: true,
              time: Date.now(),
            }),
          );
        } catch {
          /* Sandboxed third-party frames cannot access site storage. */
        }
      });
      const buttons = [];
      for (const route of info.routes) {
        await b.page.goto(b.url + route, { waitUntil: "load" });
        await b.page.waitForFunction(() => Boolean(window.gtag));
        const count = await b.page.locator("a[data-analytics-event]").count();
        for (let i = 0; i < count; i++) {
          const anchor = b.page.locator("a[data-analytics-event]").nth(i);
          if (!(await anchor.isVisible())) continue;
          const definition = await anchor.evaluate((el) => ({
            href: el.href,
            key: el.dataset.analyticsKey,
            event: el.dataset.analyticsEvent,
            button: el.dataset.analyticsButton,
          }));
          const before = b.events.length;
          // Dispatch a real DOM click through the browser; cancel navigation in
          // a QA-only final bubble listener so every CTA on the page is checked.
          await anchor.evaluate((el) => {
            let runtimeCanceled;
            el.addEventListener(
              "click",
              (e) => {
                runtimeCanceled = e.defaultPrevented;
                e.preventDefault();
              },
              { once: true },
            );
            el.click();
            if (runtimeCanceled) throw Error("Analytics canceled navigation");
          });
          await b.page.waitForFunction(() => true);
          const sent = b.events
            .slice(before)
            .filter((e) => e.provider === "ga4" && e.args[0] === "event");
          assert.equal(
            sent.length,
            1,
            "exactly one custom event: " + definition.button,
          );
          assert.equal(sent[0].args[1], definition.event);
          assert.equal(
            sent[0].args[2].destination_url,
            new URL(definition.href).origin + new URL(definition.href).pathname,
          );
          assert.ok(
            !b.events.some(
              (e) =>
                e.args.includes("Purchase") ||
                e.args.includes("purchase") ||
                e.args.includes("CompleteRegistration"),
            ),
          );
          buttons.push({ ...definition, route });
        }
      }
      assert.deepEqual(b.errors, [], "CTA page exceptions");
      results.push({
        site,
        mode: "synthetic-cta",
        viewport: viewport.width,
        visible_buttons_tested: buttons.length,
        buttons,
        errors: b.errors,
      });
      await b.context.close();
    }
  }
} finally {
  await fs.writeFile(
    path.join(out, "browser-results.json"),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await fs.writeFile(
    path.join(out, "tested-sha.txt"),
    execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }),
  );
}
console.log(
  JSON.stringify(
    results.map(({ events, buttons, ...row }) => row),
    null,
    2,
  ),
);
