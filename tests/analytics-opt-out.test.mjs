import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const controlScript = readFileSync(new URL('../src/scripts/analytics-control.js', import.meta.url), 'utf8');
const analyticsScript = stripTypeScriptTypes(readFileSync(new URL('../src/scripts/analytics.ts', import.meta.url), 'utf8'))
  .replace("import './analytics-control.js';", '')
  .replace(/export\s*\{\s*\};?/, '')
  .replaceAll('import.meta.env.PUBLIC_POSTHOG_KEY', "'test-key'")
  .replaceAll('import.meta.env.PUBLIC_POSTHOG_HOST', "'https://example.test'")
  .replace("import('posthog-js')", 'loadPostHog()');
const storageKey = 'hanparkdesign:posthog-disabled';
const cookieName = 'hanparkdesign-posthog-disabled';

function browser({ search = '', storage = new Map(), cookies = new Map(), storageFails = false, cookieFails = false, optedOut = false, delayedImport = false } = {}) {
  const listeners = {};
  const calls = { init: 0, imports: 0, optIn: 0, optOut: 0 };
  const cookieWrites = [];
  const document = {
    referrer: '',
    querySelector: () => null,
    addEventListener() {},
    get cookie() {
      if (cookieFails) throw new Error('Cookies unavailable');
      return [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    },
    set cookie(value) {
      if (cookieFails) throw new Error('Cookies unavailable');
      cookieWrites.push(value);
      const [pair] = value.split(';');
      const [key, val] = pair.split('=');
      if (value.includes('Max-Age=0;')) cookies.delete(key);
      else cookies.set(key, val);
    },
  };
  const window = {
    location: { search, protocol: 'https:', hostname: 'hanparkdesign.com', origin: 'https://hanparkdesign.com', pathname: '/' },
    get localStorage() {
      if (storageFails) throw new Error('Storage unavailable');
      return { getItem: (key) => storage.get(key) ?? null, setItem: (key, val) => storage.set(key, val), removeItem: (key) => storage.delete(key) };
    },
    sessionStorage: { getItem: () => null, setItem() {} },
    addEventListener: (name, fn) => (listeners[name] ??= []).push(fn),
  };
  const posthog = {
    init() { calls.init++; },
    capture() {},
    has_opted_out_capturing: () => optedOut,
    opt_in_capturing(options) { assert.equal(options.captureEventName, false); calls.optIn++; optedOut = false; },
    opt_out_capturing() { calls.optOut++; optedOut = true; },
    startSessionRecording() {},
    stopSessionRecording() {},
  };
  let resolveImport;
  const imported = new Promise((resolve) => { resolveImport = () => resolve({ default: posthog }); });
  const context = vm.createContext({ window, document, URL, URLSearchParams, loadPostHog: () => {
    calls.imports++;
    return delayedImport ? imported : Promise.resolve({ default: posthog });
  } });
  vm.runInContext(controlScript, context);
  return {
    window, storage, cookies, cookieWrites, calls,
    disabled: () => window.__hanApplyAnalyticsControl(),
    start: async () => { vm.runInContext(analyticsScript, context); await new Promise(setImmediate); },
    restore: () => listeners.pageshow?.forEach((fn) => fn({ persisted: true })),
    resolveImport,
  };
}

test('OFF persists to both stores, blocks SDK and Vercel, and survives new tabs', async () => {
  const first = browser({ search: '?analytics=off' });
  await first.start();
  assert.equal(first.storage.get(storageKey), 'true');
  assert.equal(first.cookies.get(cookieName), 'true');
  assert.match(first.cookieWrites[0], /Max-Age=31536000; Path=\/; SameSite=Lax; Secure$/);
  assert.equal(first.window.webAnalyticsBeforeSend({}), null);
  assert.equal(first.calls.imports, 0);
  for (const pathname of ['/', '/posts', '/posts/mediheal']) {
    const next = browser({ storage: first.storage, cookies: first.cookies });
    next.window.location.pathname = pathname;
    await next.start();
    assert.equal(next.disabled(), true);
    assert.equal(next.calls.init, 0);
  }
});

test('cookie alone blocks initialization after localStorage is cleared', async () => {
  const first = browser({ search: '?analytics=off' });
  first.storage.clear();
  const next = browser({ storage: first.storage, cookies: first.cookies });
  await next.start();
  assert.equal(next.disabled(), true);
  assert.equal(next.calls.imports, 0);
});

test('localStorage failures do not prevent cookie writes, reads, or deletion', async () => {
  const first = browser({ search: '?analytics=off', storageFails: true });
  const next = browser({ cookies: first.cookies, storageFails: true });
  await next.start();
  assert.equal(next.calls.init, 0);
  assert.equal(next.disabled(), true);
  const enabled = browser({ search: '?analytics=on', cookies: first.cookies, storageFails: true });
  await enabled.start();
  assert.equal(enabled.cookies.has(cookieName), false);
  assert.equal(enabled.calls.init, 1);
});

test('cookie failures do not prevent localStorage persistence', async () => {
  const first = browser({ search: '?analytics=off', cookieFails: true });
  const next = browser({ storage: first.storage, cookieFails: true });
  await next.start();
  assert.equal(next.disabled(), true);
  assert.equal(next.calls.init, 0);
});

test('legacy localStorage-only opt-out still blocks initialization', async () => {
  const page = browser({ storage: new Map([[storageKey, 'true']]) });
  await page.start();
  assert.equal(page.calls.imports, 0);
});

test('either disabled marker wins over an enabled value in the other store', () => {
  for (const [localValue, cookieValue] of [['true', 'false'], ['false', 'true']]) {
    assert.equal(browser({ storage: new Map([[storageKey, localValue]]), cookies: new Map([[cookieName, cookieValue]]) }).disabled(), true);
  }
});

test('ON removes both markers and explicitly resumes PostHog without an opt-in event', async () => {
  const page = browser({ search: '?analytics=on', storage: new Map([[storageKey, 'true']]), cookies: new Map([[cookieName, 'true']]), optedOut: true });
  await page.start();
  assert.equal(page.storage.has(storageKey), false);
  assert.equal(page.cookies.has(cookieName), false);
  assert.equal(page.disabled(), false);
  assert.equal(page.calls.init, 1);
  assert.equal(page.calls.optIn, 1);
});

test('ordinary pages and bfcache restoration respect existing PostHog opt-out', async () => {
  const page = browser({ optedOut: true });
  await page.start();
  page.restore();
  assert.equal(page.calls.optIn, 0);
});

test('restoring an old ON page cannot erase a newer OFF choice', async () => {
  const oldPage = browser({ search: '?analytics=on' });
  await oldPage.start();
  browser({ search: '?analytics=off', storage: oldPage.storage, cookies: oldPage.cookies });
  oldPage.restore();
  assert.equal(oldPage.disabled(), true);
  assert.equal(oldPage.storage.get(storageKey), 'true');
  assert.equal(oldPage.cookies.get(cookieName), 'true');
  assert.equal(oldPage.calls.optOut, 1);
});

test('OFF still blocks repeated checks when both persistence mechanisms fail', async () => {
  const page = browser({ search: '?analytics=off', storageFails: true, cookieFails: true });
  page.window.location.search = '';
  assert.equal(page.disabled(), true);
  await page.start();
  assert.equal(page.calls.imports, 0);
});

test('opt-out during SDK download prevents initialization', async () => {
  const page = browser({ delayedImport: true });
  await page.start();
  browser({ search: '?analytics=off', storage: page.storage, cookies: page.cookies });
  page.resolveImport();
  await new Promise(setImmediate);
  assert.equal(page.calls.init, 0);
  assert.equal(page.window.__hanPostHogInitialized, false);
});

test('fresh visitors remain enabled and similarly named cookies do not disable analytics', async () => {
  const page = browser({ cookies: new Map([[`other-${cookieName}`, 'true']]) });
  await page.start();
  assert.equal(page.calls.init, 1);
  const event = {};
  assert.equal(page.window.webAnalyticsBeforeSend(event), event);
});

test('Layout installs the shared control before analytics modules run', () => {
  const layout = readFileSync(new URL('../src/layouts/Layout.astro', import.meta.url), 'utf8');
  assert.ok(layout.includes("import analyticsControlScript from '../scripts/analytics-control.js?raw'"));
  assert.ok(layout.indexOf('<script is:inline set:html={analyticsControlScript}>') < layout.indexOf("import '../scripts/analytics'"));
});
