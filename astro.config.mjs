import { defineConfig } from 'astro/config'
import tailwind from '@astrojs/tailwind'
import sitemap from '@astrojs/sitemap'
import rehypeRaw from 'rehype-raw'
import rehypeVideoPoster from './plugins/rehype-video-poster.mjs'

export default defineConfig({
  site: 'https://hanparkdesign.com',
  integrations: [tailwind(), sitemap()],
  markdown: {
    rehypePlugins: [
      rehypeRaw,
      [rehypeVideoPoster, { overwrite: true, log: true }],
    ],
  },
})
