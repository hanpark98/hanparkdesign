type ProjectModule = {
  frontmatter?: Record<string, any>;
};

const projectSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getValidatedProjects<T extends ProjectModule>(postFiles: Record<string, T>) {
  const projects = Object.entries(postFiles)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sourcePath, module]) => {
      const sourceFilename = sourcePath.split('/').pop() || sourcePath;
      const sourceSlug = sourceFilename.replace(/\.md$/, '');
      const slug = module.frontmatter?.slug;

      return { sourcePath, sourceFilename, sourceSlug, slug, module, frontmatter: module.frontmatter || {} };
    });

  const errors: string[] = [];
  const slugSources = new Map<string, string[]>();

  projects.forEach(({ sourceFilename, slug }) => {
    if (typeof slug !== 'string' || !slug) {
      errors.push(`${sourceFilename}: missing frontmatter slug`);
      return;
    }

    if (!projectSlugPattern.test(slug)) {
      errors.push(`${sourceFilename}: invalid slug "${slug}" (use lowercase letters, numbers, and single hyphens)`);
      return;
    }

    slugSources.set(slug, [...(slugSources.get(slug) || []), sourceFilename]);
  });

  slugSources.forEach((sources, slug) => {
    if (sources.length > 1) {
      errors.push(`duplicate slug "${slug}" in ${sources.join(', ')}`);
    }
  });

  if (errors.length) {
    throw new Error(`Invalid project frontmatter slugs:\n- ${errors.join('\n- ')}`);
  }

  return projects as Array<Omit<(typeof projects)[number], 'slug'> & { slug: string }>;
}
