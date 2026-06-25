export default defineNuxtConfig({
  modules: ['nuxt-ai-ready'],
  site: {
    url: 'https://example.com',
    name: 'AI Ready canonical markdown repro',
    trailingSlash: true,
  },
  compatibilityDate: '2026-03-21',
  // The bug is independent of the database driver. This repo uses 'd1' only so
  // it runs in StackBlitz WebContainer, which cannot load the native
  // 'better-sqlite3' that the default 'sqlite' driver requires. The default
  // driver reproduces the exact same stub.
  aiReady: { database: { type: 'd1' } },
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/about/'],
    },
  },
})
