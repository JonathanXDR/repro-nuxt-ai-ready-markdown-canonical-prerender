export default defineNuxtConfig({
  modules: ['nuxt-ai-ready'],
  site: {
    url: 'https://example.com',
    name: 'AI Ready canonical markdown repro',
    trailingSlash: true,
  },
  compatibilityDate: '2026-03-21',
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/about/'],
    },
  },
})
