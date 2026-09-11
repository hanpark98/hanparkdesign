type ProjectFrontmatter = {
  title?: string;
  description?: string;
  image?: string;
  category?: string | string[];
  date?: string;
  thumbnailPosition?: string;
};

export type RecommendationProject = {
  slug: string;
  title: string;
  description: string;
  image: string;
  categories: string[];
  date?: string;
  thumbnailPosition?: string;
};

export type ProjectRecommendations = {
  related: RecommendationProject | null;
  discovery: RecommendationProject | null;
};

const stableHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const categoryOverlap = (left: RecommendationProject, right: RecommendationProject) => {
  const rightCategories = new Set(right.categories);
  return left.categories.filter(category => rightCategories.has(category)).length;
};

const normalizeProject = (project: { slug: string; frontmatter: ProjectFrontmatter }): RecommendationProject => ({
  slug: project.slug,
  title: project.frontmatter.title || project.slug,
  description: project.frontmatter.description || '',
  image: project.frontmatter.image || '',
  categories: Array.isArray(project.frontmatter.category)
    ? project.frontmatter.category
    : [project.frontmatter.category].filter((category): category is string => Boolean(category)),
  date: project.frontmatter.date,
  thumbnailPosition: project.frontmatter.thumbnailPosition,
});

const chooseBalanced = (
  current: RecommendationProject,
  candidates: RecommendationProject[],
  usage: Map<string, number>,
  mode: 'related' | 'discovery',
) => {
  if (!candidates.length) return null;

  const overlaps = candidates.map(candidate => ({
    candidate,
    overlap: categoryOverlap(current, candidate),
  }));
  const targetOverlap = mode === 'related'
    ? Math.max(...overlaps.map(item => item.overlap))
    : Math.min(...overlaps.map(item => item.overlap));
  const relevantPool = overlaps
    .filter(item => item.overlap === targetOverlap)
    .map(item => item.candidate)
    .sort((left, right) => left.slug.localeCompare(right.slug));
  const lowestUsage = Math.min(...relevantPool.map(project => usage.get(project.slug) || 0));
  const balancedPool = relevantPool.filter(project => (usage.get(project.slug) || 0) === lowestUsage);
  const offset = stableHash(`${current.slug}:${mode}`) % balancedPool.length;

  return balancedPool[offset];
};

/**
 * Creates two stable recommendations per project while balancing exposure globally.
 * The first maximizes shared categories; the second minimizes shared categories.
 */
export function getBalancedProjectRecommendations(
  projects: Array<{ slug: string; frontmatter: ProjectFrontmatter }>,
) {
  const normalizedProjects = projects
    .map(normalizeProject)
    .sort((left, right) => left.slug.localeCompare(right.slug));
  const usage = new Map(normalizedProjects.map(project => [project.slug, 0]));
  const result = new Map<string, ProjectRecommendations>();

  normalizedProjects.forEach(current => {
    const otherProjects = normalizedProjects.filter(project => project.slug !== current.slug);
    const related = chooseBalanced(current, otherProjects, usage, 'related');
    if (related) usage.set(related.slug, (usage.get(related.slug) || 0) + 1);

    const discoveryPool = otherProjects.filter(project => project.slug !== related?.slug);
    const discovery = chooseBalanced(current, discoveryPool, usage, 'discovery');
    if (discovery) usage.set(discovery.slug, (usage.get(discovery.slug) || 0) + 1);

    result.set(current.slug, { related, discovery });
  });

  return result;
}
