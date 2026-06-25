// Deterministic trigger for the prerender corruption.
//
// nuxt-ai-ready content negotiates HTML versus Markdown on every page route.
// AI crawlers such as GPTBot and ClaudeBot, which the module's own AI_BOTS list
// targets, send a User-Agent that the negotiation classifies as an AI bot, so
// the markdown middleware answers a canonical route with a 307 redirect to the
// `.md` twin.
//
// This plugin replays one such request during prerender. It does not change the
// negotiation logic, it only supplies the User-Agent that real AI crawlers send
// in production. Remove this file and the prerender output stays full HTML,
// which proves the corruption comes from the negotiation and not from the
// plugin.
//
// Set AI_READY_REPRO=document to instead apply the workaround (force an HTML
// document request) and confirm the full HTML page is restored.
export default defineNitroPlugin((nitroApp) => {
  if (!import.meta.prerender) return

  nitroApp.hooks.hook('request', (event) => {
    const path = (event.path || '').split('?')[0] ?? ''
    if (path.endsWith('.md')) return
    const lastSegment = path.split('/').pop() || ''
    if (lastSegment.includes('.')) return

    if (process.env.AI_READY_REPRO === 'document') {
      event.node.req.headers['sec-fetch-dest'] = 'document'
      event.node.req.headers.accept = 'text/html,application/xhtml+xml'
      return
    }

    event.node.req.headers['user-agent']
      = 'Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)'
  })
})
