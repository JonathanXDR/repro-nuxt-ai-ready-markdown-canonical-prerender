<!--
Title (the form prepends "fix: "): prerender bakes the markdown representation into the canonical HTML
Template: .github/ISSUE_TEMPLATE/02-bug-report.yml, label: bug
-->

## 🐛 The bug

On a prerendered Nuxt site, nuxt-ai-ready can overwrite a page's prerendered
`<route>/index.html` with a meta refresh stub that points at the `.md` twin. The
canonical file is no longer the page, so browsers receive `text/html` with no
`<!DOCTYPE>` and render unstyled text in Quirks Mode with no JS or CSS.

The markdown content negotiation runs on every page route. During prerender the
crawler request is negotiated to markdown, the middleware 307 redirects the
route to its `.md` twin, and Nitro stores that redirect body as `index.html`.

Reported against 1.5.0 (1.4.0 is identical in the affected paths). It was first
seen on a Vercel deployment serving raw markdown at `/de/`. The reproduction
needs neither i18n nor Vercel.

## 🛠️ To reproduce

StackBlitz (one click, runs in the browser): https://stackblitz.com/github/JonathanXDR/repro-nuxt-ai-ready-markdown-canonical-prerender

Or locally:

```sh
npm install
npm run generate
cat .output/public/index.html
```

A 95 byte stub is produced instead of the page:

```html
<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/index.md"></head></html>
```

The repo stamps an AI bot User-Agent on the prerender request to trigger the
negotiation deterministically. Removing that plugin, or running
`AI_READY_REPRO=document npm run generate`, restores the full HTML page, which
confirms the negotiation gate is the cause.

## 🌈 Expected behavior

Prerendering a page route always writes the full HTML document. The Nitro
prerender request carries only `x-nitro-prerender` and no `Accept`,
`Sec-Fetch-Dest`, or User-Agent, so it should resolve to HTML and never replace
the canonical artifact with a redirect stub or markdown.

## ℹ️ Additional context

Root cause in 1.5.0:

- `negotiateRepresentation()` returns `"markdown"` before it checks
  `sec-fetch-dest`, so an AI bot UA or a markdown preferring Accept wins
  (`dist/runtime/server/utils.js:49-60`).
- The middleware then 307 redirects non `.md` routes to the `.md` twin
  (`dist/runtime/server/middleware/markdown.js:74-75`).
- That 307 body is `h3.sendRedirect`'s meta refresh page (`h3/dist/index.mjs:783`),
  which Nitro's prerender writes straight to `index.html` without following it
  (`nitropack@2.13.4`).

There is no option to disable HTML route negotiation, only `enabled`.

Suggested fix: skip negotiation for prerender requests by detecting the
`x-nitro-prerender` header and returning `"html"`, and add a `ModuleOptions` opt
out. A runtime aggravator: Vercel's CDN does not cache key on
`Vary: Accept, Sec-Fetch-Dest`, so one AI crawler hit can cache the markdown
variant under the canonical URL.

To run in StackBlitz WebContainer (no native addons), the repo removes all
native dependencies. It sets `aiReady.database.type` to `d1` to avoid native
`better-sqlite3`, and a Nitro build alias maps the native `mdream` engine
to its pure JS twin `@mdream/js`. Neither touches the bug, which is in the
markdown negotiation. The default `sqlite` driver and native `mdream` reproduce
the identical stub.

Not duplicates: #22 (inverse, markdown not served), #14 (`.md` 404), and
harlan-zw/mdream#40 (runtime negotiation only).

<details><summary><code>nuxi info</code> (reproduction)</summary>

|                      |                                                   |
| -------------------- | ------------------------------------------------- |
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
