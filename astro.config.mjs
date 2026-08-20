import { defineConfig } from 'astro/config'
import { unified } from '@astrojs/markdown-remark'
import sitemap from '@astrojs/sitemap'
import rehypeRaw from 'rehype-raw'
import rehypeVideoPoster from './plugins/rehype-video-poster.mjs'

export default defineConfig({
  site: 'https://hanparkdesign.com',

  integrations: [
    sitemap(),
  ],

  markdown: {
    processor: unified({
      rehypePlugins: [
        rehypeRaw,
        [rehypeVideoPoster, { overwrite: true, log: true }],
      ],
    }),
  },
})