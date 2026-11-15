import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const analyticsScript = stripTypeScriptTypes(readFileSync(new URL('../src/scripts/analytics.ts', import.meta.url), 'utf8'))
  .replace("import './analytics-control.js';", '')
  .replace(/export\s*\{\s*\};?/, '')
  .replaceAll('import.meta.env.PUBLIC_POSTHOG_KEY', "'test-key'")
  .replaceAll('import.meta.env.PUBLIC_POSTHOG_HOST', "'https://example.test'")
  .replace("import('posthog-js')", 'loadPostHog()');

function projectPath(slug) {
  return slug ? `/posts/${slug}` : '/posts';
}

async function browserPage({
  project = null,
  search = '',
  referrer = '',
  sessionId = 'session-a',
  sessionStorage = new Map(),
} = {}) {
  const listeners = {};
  const events = [];
  const projectPage = project ? { dataset: { project: project.name, slug: project.slug, category: 'Test' } } : null;
  const documentElement = { scrollTop: 0, scrollHeight: 1000, offsetHeight: 1000 };
  const body = { scrollTop: 0, scrollHeight: 1000, offsetHeight: 1000 };
  const document = {
    referrer,
    hidden: false,
    documentElement,
    body,
    querySelector: (selector) => selector === '[data-analytics-project-page]' ? projectPage : null,
    querySelectorAll: () => [],
    addEventListener: (name, callback) => (listeners[name] ??= []).push(callback),
  };
  const window = {
    location: {
      search,
      protocol: 'https:',
      hostname: 'hanparkdesign.com',
      origin: 'https://hanparkdesign.com',
      pathname: projectPath(project?.slug),
    },
    sessionStorage: {
      getItem: (key) => sessionStorage.get(key) ?? null,
      setItem: (key, value) => sessionStorage.set(key, value),
    },
    innerWidth: 1280,
    innerHeight: 800,
    scrollY: 0,
    setInterval() {},
    addEventListener: (name, callback) => (listeners[name] ??= []).push(callback),
    __hanApplyAnalyticsControl: () => false,
  };
  const posthog = {
    init() {},
    capture(event, properties) { events.push({ event, properties }); },
    has_opted_out_capturing: () => false,
    opt_in_capturing() {},
    opt_out_capturing() {},
    startSessionRecording() {},
    stopSessionRecording() {},
    onSessionId(callback) { callback(sessionId, 'window-a'); return () => {}; },
    get_session_id: () => sessionId,
  };
  class Element {}
  const context = vm.createContext({
    window,
    document,
    Element,
    URL,
    URLSearchParams,
    getComputedStyle: () => ({ display: 'block' }),
    loadPostHog: () => Promise.resolve({ default: posthog }),
  });

  vm.runInContext(analyticsScript, context);
  await new Promise(setImmediate);

  return {
    events,
    restore: () => listeners.pageshow?.forEach((callback) => callback({ persisted: true })),
  };
}

function explorationEvents(...pages) {
  return pages.flatMap((page) => page.events.filter(({ event }) => event === 'explore_another_project'));
}

test('tracks every consecutive project transition through list and home pages, including returns', async () => {
  const sessionStorage = new Map();
  const valley = await browserPage({ project: { name: 'Valley', slug: 'valley' }, sessionStorage });
  const projects = await browserPage({ sessionStorage });
  const mediheal = await browserPage({ project: { name: 'Mediheal', slug: 'mediheal' }, sessionStorage });
  const home = await browserPage({ sessionStorage });
  const kijibae = await browserPage({ project: { name: 'Kijibae', slug: 'kijibae' }, sessionStorage });
  const valleyAgain = await browserPage({ project: { name: 'Valley', slug: 'valley' }, sessionStorage });

  assert.deepEqual(
    explorationEvents(valley, projects, mediheal, home, kijibae, valleyAgain).map(({ properties }) => ({
      project: properties.project,
      slug: properties.slug,
      destination_project: properties.destination_project,
      destination_slug: properties.destination_slug,
    })),
    [
      { project: 'Valley', slug: 'valley', destination_project: 'Mediheal', destination_slug: 'mediheal' },
      { project: 'Mediheal', slug: 'mediheal', destination_project: 'Kijibae', destination_slug: 'kijibae' },
      { project: 'Kijibae', slug: 'kijibae', destination_project: 'Valley', destination_slug: 'valley' },
    ],
  );
});

test('does not duplicate same-project reloads and tracks bfcache back/forward navigation once', async () => {
  const sessionStorage = new Map();
  const valley = await browserPage({ project: { name: 'Valley', slug: 'valley' }, sessionStorage });
  const valleyReload = await browserPage({ project: { name: 'Valley', slug: 'valley' }, sessionStorage });
  const mediheal = await browserPage({ project: { name: 'Mediheal', slug: 'mediheal' }, sessionStorage });

  valley.restore();
  valley.restore();
  mediheal.restore();
  mediheal.restore();

  assert.deepEqual(explorationEvents(valleyReload), []);
  assert.deepEqual(
    explorationEvents(mediheal).map(({ properties }) => [properties.slug, properties.destination_slug]),
    [['valley', 'mediheal'], ['valley', 'mediheal']],
  );
  assert.deepEqual(
    explorationEvents(valley).map(({ properties }) => [properties.slug, properties.destination_slug]),
    [['mediheal', 'valley']],
  );
});

test('resets the previous project when the PostHog session changes', async () => {
  const sessionStorage = new Map();
  const valley = await browserPage({ project: { name: 'Valley', slug: 'valley' }, sessionStorage, sessionId: 'session-a' });
  const mediheal = await browserPage({ project: { name: 'Mediheal', slug: 'mediheal' }, sessionStorage, sessionId: 'session-b' });
  const kijibae = await browserPage({ project: { name: 'Kijibae', slug: 'kijibae' }, sessionStorage, sessionId: 'session-b' });

  assert.deepEqual(
    explorationEvents(valley, mediheal, kijibae).map(({ properties }) => [properties.slug, properties.destination_slug]),
    [['mediheal', 'kijibae']],
  );
});

test('adds navigation_v2 properties and preserves session attribution', async () => {
  const sessionStorage = new Map();
  const valley = await browserPage({
    project: { name: 'Valley', slug: 'valley' },
    search: '?utm_source=portfolio&utm_medium=referral&utm_campaign=launch&utm_content=hero',
    sessionStorage,
  });
  const mediheal = await browserPage({ project: { name: 'Mediheal', slug: 'mediheal' }, sessionStorage });
  const [transition] = explorationEvents(valley, mediheal);

  assert.deepEqual(
    {
      ...transition.properties,
    },
    {
      project: 'Valley',
      slug: 'valley',
      destination_project: 'Mediheal',
      destination_slug: 'mediheal',
      tracking_version: 'navigation_v2',
      utm_source: 'portfolio',
      utm_medium: 'referral',
      utm_campaign: 'launch',
      utm_content: 'hero',
      entry_source: 'external',
    },
  );
});
