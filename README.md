# nuxt-ai-ready reproduction: markdown baked into canonical prerendered HTML

Minimal reproduction for a nuxt-ai-ready bug present in 1.5.0 and 1.4.0.

During prerender, nuxt-ai-ready content negotiates HTML versus Markdown on every
page route. When the prerender request is classified as markdown preferring (an
AI bot User-Agent or a markdown preferring Accept), the markdown middleware
answers the canonical route with a 307 redirect to the `.md` twin. Nitro
persists that redirect body as the canonical `index.html`, so the prerendered
HTML file becomes a tiny meta refresh stub instead of the real page. Browsers
then render unstyled text in Quirks Mode with no JS or CSS.

The bug needs neither i18n nor Vercel. This repo reproduces it with two plain
prerendered pages.

See [ISSUE.md](./ISSUE.md) for the full report with code citations.

## Steps

```sh
bun install
bun run generate
```

Then inspect the prerendered canonical HTML:

```sh
cat .output/public/index.html
```

Observed (the bug), a 95 byte stub:

```html
<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/index.md"></head></html>
```

`about/index.html` is the same stub pointing at `/about/index.md`. The redirect
target is not emitted by `nuxt generate`, so on a static host the canonical URL
also 404s after the refresh. On the original Vercel SSR deployment the `.md`
twin is served by the function, so visitors saw raw markdown rather than a 404.

## Control

The trigger is the content negotiation gate. Re run with the workaround flag,
which forces an HTML document request on those same prerender requests:

```sh
AI_READY_REPRO=document bun run generate
cat .output/public/index.html   # full HTML document is restored
```

## Notes

- `server/plugins/simulate-ai-crawler.ts` supplies the AI bot User-Agent that
  real crawlers send in production. It does not change the negotiation logic.
  Remove the file and the prerender output stays HTML, which proves the
  corruption comes from the negotiation.
- The exact request header that triggers markdown negotiation during the real
  Vercel build was not captured. The simulated User-Agent is a faithful stand in
  for the production trigger, and the resulting stub matches the artifact seen on
  Vercel byte for byte.

## Environment

- nuxt 4.4.8, nitropack 2.13.4, h3 1.15.11
- nuxt-ai-ready 1.5.0
- @nuxtjs/robots 6.1.1, @nuxtjs/sitemap 8.2.1
- better-sqlite3 12.10.0
