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

## Reproduce on StackBlitz

https://stackblitz.com/github/JonathanXDR/repro-nuxt-ai-ready-markdown-canonical-prerender

It installs, runs `nuxt generate`, and prints `.output/public/index.html` in the
terminal. That file is a 95 byte meta refresh stub instead of the page. You can
also open it from the file tree.

## Reproduce locally

```sh
npm install
npm run generate
cat .output/public/index.html
```

Observed, a 95 byte stub:

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
AI_READY_REPRO=document npm run generate
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
- To run in StackBlitz WebContainer, which cannot load native addons, the repo
  removes all native dependencies. `aiReady.database.type` is `d1` so the build
  needs no native `better-sqlite3`, and a Nitro build alias maps the
  native `mdream` markdown engine to its pure JS twin `@mdream/js`. Neither
  change touches the bug, which lives in the markdown content negotiation. The
  default `sqlite` driver and the native `mdream` reproduce the identical stub.

## Environment

See the `nuxi info` block in [ISSUE.md](./ISSUE.md).
