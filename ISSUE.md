<!--
Title: Canonical routes are content negotiated to Markdown, which CDNs cache and serve to every visitor
Template: .github/ISSUE_TEMPLATE/02-bug-report.yml, label: bug
-->

## 🐛 The bug

nuxt-ai-ready content negotiates a Markdown representation on every canonical
page route, not only on the explicit `.md` URLs. When a request is classified as
Markdown preferring (an AI bot User-Agent, or `Accept: text/plain` or
`text/markdown`), the middleware answers the canonical route with a 307 redirect
to its `.md` twin and sets `Vary: Accept, Sec-Fetch-Dest`.

This breaks the canonical URL for ordinary visitors in two ways.

**1. At runtime, behind a CDN (the production impact).** Vercel's CDN, like most,
does not cache key on `Vary`. The first AI crawler to hit `/<route>/` causes the
negotiated Markdown to be cached under the canonical URL. Every following human
visitor is then served raw Markdown, which the browser renders as unstyled text
in Quirks Mode with no CSS or JS. One crawler request poisons the page for
everyone until the cache is purged.

**2. At build time, during prerender.** If a prerender request is classified as
Markdown preferring, Nitro writes the 307 meta refresh stub as the canonical
`index.html`:

```html
<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/index.md"></head></html>
```

Both effects share one root cause: Markdown is negotiated onto canonical URLs
instead of being served only at the explicit `.md` URLs the module already emits.

## 🛠️ To reproduce

https://stackblitz.com/github/JonathanXDR/repro-nuxt-ai-ready-markdown-canonical-prerender

## 🌈 Expected behavior

A canonical page route always resolves to the full HTML document, for every
client, and Markdown is reachable only at the explicit `.md` URLs. Those URLs,
the `<link rel="alternate">` tag, and llms.txt already give AI clients a stable,
cache safe way to find the Markdown, so the canonical route never needs to be
negotiated.

## ℹ️ Additional context

Root cause in 1.5.0:

- `negotiateRepresentation()` resolves to `"markdown"` for an AI bot User-Agent
  or a Markdown preferring `Accept` (`dist/runtime/server/utils.js`).
- The middleware then 307 redirects non `.md` routes to their `.md` twin
  (`dist/runtime/server/middleware/markdown.js:73-74`).
- At runtime that redirect is cached under the canonical URL by any CDN that
  ignores `Vary`. During prerender its body is `h3.sendRedirect`'s meta refresh
  page, which Nitro writes straight to `index.html` (`nitropack@2.13.4`).

There is no option to disable canonical route negotiation, only `enabled`.

Suggested fix: serve Markdown only at the explicit `.md` URLs and stop
negotiating it onto canonical routes, or add a `ModuleOptions` flag to disable
canonical negotiation. Content negotiation on a canonical URL cannot be made safe
behind a CDN that ignores `Vary`, so a separate URL is the robust contract.
Skipping negotiation for prerender requests alone (via `x-nitro-prerender`) fixes
only effect 2 and leaves the runtime cache poisoning in place.

To run in StackBlitz WebContainer (no native addons), the repo removes all native
dependencies. It sets `aiReady.database.type` to `d1` to avoid native
`better-sqlite3`, and a Nitro build alias maps the native `mdream` engine to its
pure JS twin `@mdream/js`. Neither touches the bug, which is in the Markdown
negotiation. The default `sqlite` driver and native `mdream` reproduce the
identical behavior.

<details><summary><code>nuxi info</code> (reproduction)</summary>

|                      |                                                            |
| -------------------- | ---------------------------------------------------------- |
| **Operating system** | `macOS 25.5.0`                                             |
| **CPU**              | `Apple M4 Pro (14 cores)`                                  |
| **Node.js version**  | `v24.18.0`                                                 |
| **nuxt/cli version** | `3.36.0`                                                   |
| **Package manager**  | `npm@11.17.0`                                              |
| **Nuxt version**     | `4.4.8`                                                    |
| **Nitro version**    | `2.13.4`                                                   |
| **Builder**          | `vite@7.3.6`                                               |
| **Config**           | `aiReady`, `compatibilityDate`, `modules`, `nitro`, `site` |
| **Modules**          | `nuxt-ai-ready@1.5.0`                                       |

</details>
