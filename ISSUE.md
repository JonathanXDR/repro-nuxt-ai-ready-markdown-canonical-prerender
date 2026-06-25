# fix: markdown is baked into the canonical prerendered HTML, breaking the page

## 🐛 The bug

Reported against nuxt-ai-ready 1.5.0. The installed 1.4.0 is byte identical in
every code path involved (see Additional context).

On a prerendered Nuxt site, canonical page routes can have their prerendered
`<route>/index.html` overwritten at build time with a tiny meta refresh stub
that points at the `.md` twin. Browsers receive `Content-Type: text/html` for a
body that has no `<!DOCTYPE>`, so the page renders as unstyled text in Quirks
Mode and issues zero JS or CSS subresource requests.

The cause is that the markdown content negotiation middleware runs on every page
route and there is no module option to disable HTML route negotiation (only
`enabled`). During prerender the negotiation resolves to markdown for the
crawler request, and the resulting 307 redirect body is persisted as the
canonical `index.html`.

This was first seen on a Vercel deployment where `/<locale>/` served raw
markdown to browsers. The attached reproduction shows the defect needs neither
i18n nor Vercel.

Reproduction repo: https://github.com/JonathanXDR/repro-nuxt-ai-ready-markdown-canonical-prerender

## 🛠️ To reproduce

The exact request header that triggers markdown negotiation during the real
Vercel build was not captured, so the reproduction uses a deterministic stand in
for it. A prerender only server plugin stamps an AI bot User-Agent (the same
kind nuxt-ai-ready targets in its `AI_BOTS` list) on non `.md` page requests.

Minimal config, two plain pages, no i18n:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-ai-ready'],
  site: { url: 'https://example.com', trailingSlash: true },
  compatibilityDate: '2026-03-21',
  nitro: { prerender: { crawlLinks: true, routes: ['/', '/about/'] } },
})
```

```ts
// server/plugins/simulate-ai-crawler.ts
export default defineNitroPlugin((nitroApp) => {
  if (!import.meta.prerender) return
  nitroApp.hooks.hook('request', (event) => {
    const path = (event.path || '').split('?')[0] ?? ''
    if (path.endsWith('.md')) return
    event.node.req.headers['user-agent'] = 'GPTBot'
  })
})
```

Steps:

1. `bun install`
2. `bun run generate`
3. `cat .output/public/index.html`

Observed, a 95 byte stub instead of the full page:

```html
<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/index.md"></head></html>
```

`about/index.html` is the same stub pointing at `/about/index.md`. The redirect
target is not emitted by `nuxt generate`, so the canonical URL also 404s after
the refresh.

Counter check that isolates the negotiation gate. Re run with
`AI_READY_REPRO=document`, which forces `sec-fetch-dest: document` and
`accept: text/html` on the same requests, and `index.html` is restored to the
full HTML document.

## 🌈 Expected behavior

Prerendering a canonical page route must always write the full HTML document to
`<route>/index.html`. The Nitro prerender crawler request carries only
`x-nitro-prerender` and no `Sec-Fetch-Dest: document`, no `Accept`, and no real
User-Agent, so it should never be negotiated to markdown, and the canonical
static HTML artifact should never be replaced by a redirect stub or a markdown
body. A module option to opt out of HTML route negotiation would also help,
since today only `enabled` exists.

## ℹ️ Additional context

### Mechanism with exact citations (paths under the 1.5.0 package)

1. `negotiateRepresentation()` returns `"markdown"` before it checks
   `sec-fetch-dest`. `dist/runtime/server/utils.js` lines 49-60:

   ```js
   export function negotiateRepresentation(event) {
     const accept = getHeader(event, "accept");
     const secFetchDest = getHeader(event, "sec-fetch-dest");
     if (negotiateContent(accept) === "markdown")
       return "markdown";
     if (secFetchDest === "document")
       return "html";
     const botInfo = getBotInfo(getHeaders(event));
     if (botInfo?.category === "ai")
       return "markdown";
     return negotiateContent(accept, secFetchDest);
   }
   ```

   A request with no `Sec-Fetch-Dest: document` plus either an AI bot
   User-Agent (`getBotInfo` category `'ai'`, from `@nuxtjs/robots/util`) or a
   markdown preferring `Accept` (`negotiateContent` from `@mdream/js/negotiate`
   treats `text/plain` and `text/markdown` as markdown) resolves to markdown.

2. For a non explicit path the middleware issues a 307 redirect to the `.md`
   twin. `dist/runtime/server/middleware/markdown.js` lines 70-76:

   ```js
   if (negotiation === "html") {
     setNegotiationHeaders(event, path, config, resolveUrl);
     return;
   }
   if (!isExplicit) {
     return sendRedirect(event, toMarkdownPath(path), 307);
   }
   ```

3. The `h3.sendRedirect` body is the meta refresh stub.
   `h3/dist/index.mjs` line 783 emits exactly
   `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/index.md"></head></html>`
   with `Content-Type: text/html`, matching the observed artifact byte for byte.

4. The Nitro prerender crawler persists that 307 body as `index.html`.
   `nitropack/dist/core/index.mjs` (nitropack 2.13.4) passes only
   `headers: { "x-nitro-prerender": encodedRoute }` (no `redirect: "manual"`, no
   UA, Accept, or Sec-Fetch-Dest), whitelists the 307 as non error, detects the
   body as implicit HTML, and writes it to `<route>/index.html`. The in process
   `localFetch` via node-mock-http does not loop on `Location`, it receives the
   307 directly and stores its HTML body.

5. There is no option to disable HTML route negotiation.
   `dist/runtime/types.d.ts` `interface ModuleOptions` exposes only
   `enabled?: boolean`.

### Runtime aggravator (Vercel)

At runtime Vercel's CDN does not include `Vary: Accept, Sec-Fetch-Dest` in its
cache key, so a single AI crawler hit can cache the markdown variant under the
canonical URL and then serve it to browsers.

### Version equivalence (1.5.0 vs 1.4.0)

`server/utils.js`, `app/plugins/md-hints.prerender.js`, and
`server/middleware/markdown.prerender.js` are byte identical between the two
releases. `server/middleware/markdown.js` differs only by a cosmetic
`resolveUrl` wrapper. The `negotiation === "html"` gate and the
`sendRedirect(event, toMarkdownPath(path), 307)` line are unchanged.

### Suggested fix

Skip markdown negotiation for Nitro prerender crawler requests. Detecting the
`x-nitro-prerender` header in `negotiateRepresentation()` (or before the
`sendRedirect` in `markdown.js`) and returning `"html"` keeps the canonical
file intact. Defaulting a request with no `Sec-Fetch-Dest` and no explicit
markdown `Accept` to HTML for page routes, plus a `ModuleOptions` opt out, would
make the behavior robust on CDNs that do not vary on these headers.

### Workaround

A prerender only Nitro request hook that forces `sec-fetch-dest: document` and
`accept: text/html` on non `.md` page requests restores the full HTML output.

### Related, not duplicates

- #22 is the inverse, markdown not served on root URLs.
- #14 is a `.md` twin 404, a missing artifact rather than a corrupted
  `index.html`.
- harlan-zw/mdream#40 critiques the same negotiation heuristics for runtime SSR
  traffic only, with no prerender corruption.
