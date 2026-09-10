import type posthog from 'posthog-js';
import type { BeforeSend } from '@vercel/analytics';

const posthogKey = import.meta.env.PUBLIC_POSTHOG_KEY?.trim();
const posthogHost = import.meta.env.PUBLIC_POSTHOG_HOST?.trim().replace(/\/$/, '');
const analyticsDisabledStorageKey = 'hanparkdesign:posthog-disabled';
const sessionAttributionStorageKey = 'hanparkdesign:session-attribution';
const projectExplorationStorageKey = 'hanparkdesign:project-exploration';

declare global {
  interface Window {
    __hanPostHogInitialized?: boolean;
    webAnalyticsBeforeSend?: BeforeSend;
  }
}

type PostHogClient = typeof posthog;
type QueuedEvent = {
  event: string;
  properties: Record<string, string | number>;
};
type EntrySource = 'internal' | 'external' | 'direct';
type ProjectContext = {
  project: string;
  slug: string;
};
type SessionAttribution = {
  entry_source: EntrySource;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  original_referrer_host: string;
  original_entry_project: string;
  original_entry_project_slug: string;
};
type ProjectExploration = {
  entry_project: string;
  entry_project_name: string;
  explored_projects: string[];
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

function sanitizeCampaignValue(value: string | null) {
  const normalized = value?.trim() || '';
  return /^[a-zA-Z0-9][a-zA-Z0-9._~-]{0,99}$/.test(normalized) ? normalized : '';
}

function getCurrentCampaign() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: sanitizeCampaignValue(params.get('utm_source')),
    utm_medium: sanitizeCampaignValue(params.get('utm_medium')),
    utm_campaign: sanitizeCampaignValue(params.get('utm_campaign')),
    utm_content: sanitizeCampaignValue(params.get('utm_content')),
  };
}

function hasCampaign(attribution: Pick<SessionAttribution, 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content'>) {
  return Boolean(
    attribution.utm_source
    || attribution.utm_medium
    || attribution.utm_campaign
    || attribution.utm_content,
  );
}

function getReferrerInfo() {
  try {
    const referrer = new URL(document.referrer);
    const host = referrer.hostname.toLowerCase().replace(/^www\./, '');
    const currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    return {
      host,
      isInternal: referrer.origin === window.location.origin
        || (host === 'hanparkdesign.com' && currentHost === 'hanparkdesign.com'),
    };
  } catch {
    return { host: '', isInternal: false };
  }
}

function getProjectContext() {
  const projectPage = document.querySelector<HTMLElement>('[data-analytics-project-page]');
  if (!projectPage) return { projectPage: null, project: '', slug: '' };

  return {
    projectPage,
    project: projectPage.dataset.project || 'unknown',
    slug: projectPage.dataset.slug || 'unknown',
  };
}

function readSessionAttribution() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(sessionAttributionStorageKey) || 'null');
    if (!stored || !['internal', 'external', 'direct'].includes(stored.entry_source)) return null;

    return {
      entry_source: stored.entry_source as EntrySource,
      utm_source: sanitizeCampaignValue(stored.utm_source),
      utm_medium: sanitizeCampaignValue(stored.utm_medium),
      utm_campaign: sanitizeCampaignValue(stored.utm_campaign),
      utm_content: sanitizeCampaignValue(stored.utm_content),
      original_referrer_host: typeof stored.original_referrer_host === 'string'
        ? stored.original_referrer_host.slice(0, 160)
        : '',
      original_entry_project: typeof stored.original_entry_project === 'string'
        ? stored.original_entry_project.slice(0, 160)
        : '',
      original_entry_project_slug: typeof stored.original_entry_project_slug === 'string'
        ? stored.original_entry_project_slug.slice(0, 160)
        : '',
    } satisfies SessionAttribution;
  } catch {
    return null;
  }
}

function getSessionAttribution(project: ProjectContext) {
  const campaign = getCurrentCampaign();
  const referrer = getReferrerInfo();
  let attribution = readSessionAttribution();

  if (!attribution) {
    const entrySource: EntrySource = hasCampaign({ ...campaign })
      ? 'external'
      : referrer.isInternal
        ? 'internal'
        : referrer.host
          ? 'external'
          : 'direct';

    attribution = {
      entry_source: entrySource,
      ...campaign,
      original_referrer_host: referrer.host,
      original_entry_project: project.project,
      original_entry_project_slug: project.slug,
    };
  } else if (hasCampaign({ ...campaign }) && !hasCampaign(attribution)) {
    attribution = {
      ...attribution,
      ...campaign,
      entry_source: 'external',
      original_referrer_host: attribution.original_referrer_host || referrer.host,
      original_entry_project: attribution.original_entry_project || project.project,
      original_entry_project_slug: attribution.original_entry_project_slug || project.slug,
    };
  }

  try {
    window.sessionStorage.setItem(sessionAttributionStorageKey, JSON.stringify(attribution));
  } catch {
    // Session attribution is optional when storage is unavailable.
  }

  return attribution;
}

function getProjectEntrySource(attribution: SessionAttribution): EntrySource {
  const campaign = getCurrentCampaign();
  const referrer = getReferrerInfo();
  if (hasCampaign({ ...campaign })) return 'external';
  if (referrer.isInternal) return 'internal';
  if (referrer.host) return 'external';
  if (hasCampaign(attribution)) return 'external';
  return 'direct';
}

function readProjectExploration() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(projectExplorationStorageKey) || 'null');
    if (!stored || typeof stored.entry_project !== 'string' || !stored.entry_project) return null;

    return {
      entry_project: stored.entry_project.slice(0, 160),
      entry_project_name: typeof stored.entry_project_name === 'string'
        ? stored.entry_project_name.slice(0, 160)
        : '',
      explored_projects: Array.isArray(stored.explored_projects)
        ? stored.explored_projects.filter((slug: unknown) => typeof slug === 'string').slice(0, 100)
        : [],
    } satisfies ProjectExploration;
  } catch {
    return null;
  }
}

function writeProjectExploration(exploration: ProjectExploration) {
  try {
    window.sessionStorage.setItem(projectExplorationStorageKey, JSON.stringify(exploration));
    return true;
  } catch {
    return false;
  }
}

function captureProjectExploration(project: ProjectContext, attribution: SessionAttribution) {
  if (!project.slug || project.slug === 'unknown') return;

  const exploration = readProjectExploration();
  if (!exploration) {
    writeProjectExploration({
      entry_project: project.slug,
      entry_project_name: project.project,
      explored_projects: [],
    });
    return;
  }

  if (
    project.slug === exploration.entry_project
    || exploration.explored_projects.includes(project.slug)
  ) return;

  if (!writeProjectExploration({
    ...exploration,
    explored_projects: [...exploration.explored_projects, project.slug],
  })) return;

  capture('explore_another_project', {
    entry_project: exploration.entry_project,
    entry_project_name: exploration.entry_project_name,
    project: project.project,
    slug: project.slug,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    entry_source: attribution.entry_source,
  });
}

function getSourcePage() {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  if (pathname === '/') return 'home';
  if (pathname === '/posts') return 'projects';
  if (pathname.startsWith('/posts/')) return 'project';
  return 'profile';
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

function setupClickEvents(attribution: SessionAttribution) {
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
      const contactType = contactLink.dataset.analyticsContact || 'unknown';
      const project = getProjectContext();
      capture('contact_click', {
        contact_type: contactType,
        type: contactType,
        source: getSourcePage(),
        source_page: getSourcePage(),
        project: project.project || attribution.original_entry_project,
        slug: project.slug || attribution.original_entry_project_slug,
        utm_source: attribution.utm_source,
        utm_medium: attribution.utm_medium,
        utm_campaign: attribution.utm_campaign,
        entry_source: attribution.entry_source,
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

function captureProjectView(
  project: ReturnType<typeof getProjectContext>,
  attribution: SessionAttribution,
  entrySource: EntrySource,
) {
  if (!project.projectPage || project.projectPage.dataset.analyticsProjectViewCaptured === 'true') return;
  project.projectPage.dataset.analyticsProjectViewCaptured = 'true';

  const referrer = getReferrerInfo();
  capture('project_view', {
    project: project.project,
    slug: project.slug,
    entry_source: entrySource,
    referrer_host: referrer.host || attribution.original_referrer_host,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_content: attribution.utm_content,
  });
  captureProjectExploration(project, attribution);
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

function setupProjectEngagement(attribution: SessionAttribution, entrySource: EntrySource) {
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
      entry_source: entrySource,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
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

const analyticsDisabled = isAnalyticsDisabled();

window.webAnalyticsBeforeSend = (event) => (analyticsDisabled ? null : event);

if (!analyticsDisabled && posthogKey && posthogHost && !window.__hanPostHogInitialized) {
  window.__hanPostHogInitialized = true;
  const project = getProjectContext();
  const attribution = getSessionAttribution(project);
  const projectEntrySource = getProjectEntrySource(attribution);
  setupClickEvents(attribution);
  captureProjectsEntry();
  captureProjectView(project, attribution, projectEntrySource);
  setupProjectEngagement(attribution, projectEntrySource);
  void initializePostHog(posthogKey, posthogHost);
}

export {};
