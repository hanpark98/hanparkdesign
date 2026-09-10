const campaigns = {
  upwork: { source: 'upwork', medium: 'proposal' },
  linkedin: { source: 'linkedin', medium: 'dm' },
  email: { source: 'email', medium: 'application' },
  behance: { source: 'behance', medium: 'portfolio' },
} as const;

const projectSlugs = new Set([
  'bazzaalbox',
  'vt-cosmetics',
  'relics',
  'oliveyoung',
  'kijibae',
  'mediheal',
  'social-media',
  'muguhada',
  'valley',
]);

const legacyProjectSlugs: Record<string, string> = {
  '260214 bazzaalbox': 'bazzaalbox',
  '260215 vt cosmetics': 'vt-cosmetics',
  '260221 relics': 'relics',
  '260322 oliveyoung': 'oliveyoung',
  '260326 kijibae': 'kijibae',
  '260331 mediheal': 'mediheal',
  '260405 social media': 'social-media',
  '260816 muguhada': 'muguhada',
  '260901 valley': 'valley',
  'olive-young': 'oliveyoung',
};

function decodeSegment(segment: string | undefined) {
  if (!segment) return '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return '';
  }
}

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const segments = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const source = decodeSegment(segments[1]).toLowerCase() as keyof typeof campaigns;
  const campaign = campaigns[source];

  if ((segments.length !== 2 && segments.length !== 3) || segments[0] !== 'go' || !campaign) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const requestedProjectSlug = decodeSegment(segments[2]).toLowerCase();
  const projectSlug = projectSlugs.has(requestedProjectSlug)
    ? requestedProjectSlug
    : legacyProjectSlugs[requestedProjectSlug];

  if (segments.length === 3 && !projectSlug) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const analyticsControl = url.searchParams.get('analytics');
  url.pathname = projectSlug ? `/posts/${projectSlug}` : '/';
  url.search = '';
  url.hash = '';
  url.searchParams.set('utm_source', campaign.source);
  url.searchParams.set('utm_medium', campaign.medium);
  if (analyticsControl === 'off' || analyticsControl === 'on') {
    url.searchParams.set('analytics', analyticsControl);
  }

  return Response.redirect(url, 302);
}

export const config = {
  matcher: '/go/:path*',
  runtime: 'nodejs',
};
