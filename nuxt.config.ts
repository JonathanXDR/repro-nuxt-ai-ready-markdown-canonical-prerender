export default defineNuxtConfig({
  modules: ['nuxt-ai-ready'],
  site: {
    url: 'https://example.com',
    name: 'AI Ready canonical markdown repro',
    trailingSlash: true,
  },
  compatibilityDate: '2026-03-21',
  // The bug is independent of the database driver. This repo uses 'd1' so the
  // build needs no native 'better-sqlite3', which lets it run in StackBlitz
  // WebContainer. The package.json override also aliases the native 'mdream'
  // markdown engine to its pure JS twin '@mdream/js'. Neither change affects
  // the bug, which is in the markdown content negotiation, not the database or
  // the markdown conversion.
  aiReady: { database: { type: 'd1' } },
  nitro: {
    // Build-time alias of the native 'mdream' engine to its pure JS twin, so the
    // server bundle never loads a native addon. This is resolved by the bundler
    // regardless of the package manager, unlike a package.json override.
    alias: { mdream: '@mdream/js' },
    prerender: {
      crawlLinks: true,
      routes: ['/', '/about/'],
    },
  },
})
