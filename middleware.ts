const campaigns = {
  upwork: { source: 'upwork', medium: 'proposal' },
  linkedin: { source: 'linkedin', medium: 'dm' },
  email: { source: 'email', medium: 'application' },
} as const;

const projectSlugs: Record<string, string> = {
  valley: '260901 valley',
  mediheal: '260331 Mediheal',
  kijibae: '260326 Kijibae',
  relics: '260221 Relics',
  'olive-young': '260322 Oliveyoung',
  oliveyoung: '260322 Oliveyoung',
  'vt-cosmetics': '260215 VT cosmetics',
  muguhada: '260816 muguhada',
  bazzaalbox: '260214 bazzaalbox',
  'social-media': '260405 Social media',
};

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const segments = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const campaign = campaigns[segments[1] as keyof typeof campaigns];
  const projectSlug = projectSlugs[(segments[2] || '').toLowerCase()];

  if (segments.length !== 3 || segments[0] !== 'go' || !campaign || !projectSlug) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const analyticsControl = url.searchParams.get('analytics');
  url.pathname = `/posts/${projectSlug}`;
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
