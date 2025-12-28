import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
  preset: 'cloudflare-pages',

  // Cloudflare Pages configuration
  cloudflare: {
    pages: {
      routes: {
        exclude: ['/assets/*', '/_build/*'],
      },
    },
  },

  // Output directory for Cloudflare Pages
  output: {
    dir: '.output',
    publicDir: '.output/public',
  },

  // Compatibility settings
  compatibilityDate: '2024-12-01',
})
