import type posthog from 'posthog-js';

const posthogKey = import.meta.env.PUBLIC_POSTHOG_KEY?.trim();
const posthogHost = import.meta.env.PUBLIC_POSTHOG_HOST?.trim().replace(/\/$/, '');
const analyticsDisabledStorageKey = 'hanparkdesign:posthog-disabled';

declare global {
  interface Window {
    __hanPostHogInitialized?: boolean;
  }
}

type PostHogClient = typeof posthog;
type QueuedEvent = {
  event: string;
  properties: Record<string, string | number>;
};

let posthogClient: PostHogClient | null = null;
const queuedEvents: QueuedEvent[] = [];

function isAnalyticsDisabled() {
  const analyticsControl = new URLSearchParams(window.location.search).get('analytics');
  let disabled = analyticsControl === 'off';

  try {
    if (analyticsControl === 'off') {
      window.localStorage.setItem(analyticsDisabledStorageKey, 'true');
    } else if (analyticsControl === 'on') {
      window.localStorage.removeItem(analyticsDisabledStorageKey);
      disabled = false;
    } else {
      disabled = window.localStorage.getItem(analyticsDisabledStorageKey) === 'true';
    }
  } catch {
    // If storage is unavailable, the URL switch still applies to the current page.
  }

  return disabled;
}

function capture(event: string, properties: Record<string, string | number>) {
  if (!posthogClient) {
    if (queuedEvents.length < 20) queuedEvents.push({ event, properties });
    return;
  }

  try {
    // Semantic clicks may navigate immediately, so bypass the event batch while
    // retaining PostHog's keepalive/retry transport behavior.
    posthogClient.capture(event, properties, { send_instantly: true });
  } catch {
    // Analytics must never interrupt navigation or other site interactions.
  }
}

async function initializePostHog(key: string, host: string) {
  try {
    // Keep the SDK out of the render-critical bundle while starting it as soon as this
    // lightweight event layer is ready.
    const { default: posthog } = await import('posthog-js');

    posthog.init(key, {
      api_host: host,
      autocapture: true,
      capture_pageview: true,
      capture_heatmaps: true,
      disable_session_recording: false,
      person_profiles: 'never',
      ip: false,
      mask_personal_data_properties: true,
      custom_personal_data_properties: ['email'],
      session_recording: {
        maskAllInputs: true,
        captureJsonLd: false,
      },
    });

    posthogClient = posthog;
    queuedEvents.splice(0).forEach(({ event, properties }) => {
      capture(event, properties);
    });
  } catch {
    // A blocked or unavailable analytics client must not affect the website.
  }
}

function getDeviceType() {
  if (window.innerWidth <= 767) return 'mobile';
  if (window.innerWidth <= 1024) return 'tablet';
  return 'desktop';
}

function getVisibleProjectPosition(clickedCard: HTMLElement) {
  const visibleCards = Array.from(
    document.querySelectorAll<HTMLElement>('[data-analytics-project-card]'),
  ).filter((card) => getComputedStyle(card).display !== 'none');

  const index = visibleCards.indexOf(clickedCard);
  return index >= 0 ? index + 1 : 0;
}

function setupClickEvents() {
  document.addEventListener('click', (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;

    const projectCard = event.target.closest<HTMLElement>('[data-analytics-project-card]');
    if (projectCard) {
      capture('open_project', {
        project: projectCard.dataset.project || 'unknown',
        slug: projectCard.dataset.slug || 'unknown',
        category: projectCard.dataset.category || 'unknown',
        source: 'projects_grid',
        position: getVisibleProjectPosition(projectCard),
      });
      return;
    }

    const profileHighlight = event.target.closest<HTMLElement>('[data-analytics-project-highlight]');
    if (profileHighlight) {
      capture('project_highlight_click', {
        project: profileHighlight.dataset.project || 'unknown',
        slug: profileHighlight.dataset.slug || 'unknown',
        source: 'profile_highlights',
      });
      return;
    }

    const contactLink = event.target.closest<HTMLElement>('[data-analytics-contact]');
    if (contactLink) {
      capture('contact_click', {
        contact_type: contactLink.dataset.analyticsContact || 'unknown',
        source: 'profile',
      });
      return;
    }

    const profileLink = event.target.closest<HTMLElement>('[data-analytics-profile-source]');
    if (profileLink) {
      capture('open_profile', {
        source: profileLink.dataset.analyticsProfileSource || 'unknown',
      });
    }
  }, { capture: true });
}

function captureProjectsEntry() {
  if (window.location.pathname.replace(/\/$/, '') !== '/posts') return;

  try {
    const referrer = new URL(document.referrer);
    const referrerPath = referrer.pathname.replace(/\/$/, '') || '/';
    if (referrer.origin !== window.location.origin || referrerPath !== '/') return;

    capture('enter_projects', {
      source: 'homepage',
      device_type: getDeviceType(),
    });
  } catch {
    // Empty or invalid referrers are intentionally ignored.
  }
}

function getScrollDepth() {
  const documentElement = document.documentElement;
  const body = document.body;
  const scrollTop = Math.max(window.scrollY, documentElement.scrollTop, body.scrollTop);
  const scrollHeight = Math.max(
    documentElement.scrollHeight,
    documentElement.offsetHeight,
    body.scrollHeight,
    body.offsetHeight,
  );

  if (scrollHeight <= 0) return 100;
  return Math.min(100, Math.round(((scrollTop + window.innerHeight) / scrollHeight) * 100));
}

function setupProjectEngagement() {
  const projectPage = document.querySelector<HTMLElement>('[data-analytics-project-page]');
  if (!projectPage) return;

  let engagedSeconds = 0;
  let maxScrollDepth = getScrollDepth();
  let hasCaptured = false;

  const maybeCapture = () => {
    if (hasCaptured || engagedSeconds < 15 || maxScrollDepth < 50) return;
    hasCaptured = true;

    capture('project_engaged', {
      project: projectPage.dataset.project || 'unknown',
      slug: projectPage.dataset.slug || 'unknown',
      category: projectPage.dataset.category || 'unknown',
      engaged_seconds: engagedSeconds,
      scroll_depth: maxScrollDepth,
    });
  };

  const updateScrollDepth = () => {
    maxScrollDepth = Math.max(maxScrollDepth, getScrollDepth());
    maybeCapture();
  };

  window.setInterval(() => {
    if (!document.hidden) engagedSeconds += 1;
    updateScrollDepth();
  }, 1000);

  document.addEventListener('scroll', updateScrollDepth, { passive: true, capture: true });
  window.addEventListener('resize', updateScrollDepth, { passive: true });
  window.addEventListener('pageshow', updateScrollDepth, { passive: true });
}

if (!isAnalyticsDisabled() && posthogKey && posthogHost && !window.__hanPostHogInitialized) {
  window.__hanPostHogInitialized = true;
  setupClickEvents();
  captureProjectsEntry();
  setupProjectEngagement();
  void initializePostHog(posthogKey, posthogHost);
}

export {};
