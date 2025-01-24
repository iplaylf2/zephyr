import express from 'express'
import fs from 'node:fs/promises'
import { generateHydrationScript } from 'solid-js/web'
import process from 'process'

// Constants
const isProduction = process.env['NODE_ENV'] === 'production'
const port = process.env['PORT'] ?? '5173'
const base = process.env['BASE'] ?? '/'

// Cached production assets
const templateHtml = isProduction
  ? await fs.readFile('./dist/client/index.html', 'utf-8')
  : ''

// Create http server
const app = express()

if (isProduction) {
  const compression = (await import('compression')).default
  const sirv = (await import('sirv')).default
  app.use(compression())
  app.use(base, sirv('./dist/client', { extensions: [] }))

  // Serve HTML
  app.use('*all', async (req, res) => {
    try {
      const url = req.originalUrl.replace(base, '')

      const template = templateHtml
      const render = (await import('./dist/server/entry-server.js')).render

      const rendered = await render(url)

      const head = (rendered.head ?? '') + generateHydrationScript()

      const html = template
        .replace(`<!--app-head-->`, head)
        .replace(`<!--app-html-->`, rendered.html ?? '')

      res.status(200).set({ 'Content-Type': 'text/html' }).send(html)
    }
    catch (e) {
      res.status(500).end()
    }
  })
}
else {
  const { createServer } = await import('vite')
  const vite = await createServer({
    appType: 'custom',
    base,
    server: { middlewareMode: true },
  })
  app.use(vite.middlewares)

  // Serve HTML
  app.use('*all', async (req, res) => {
    try {
      const url = req.originalUrl.replace(base, '')

      const template = await vite.transformIndexHtml(url, await fs.readFile('./index.html', 'utf-8'))
      const render = (await vite.ssrLoadModule('/src/entry-server.jsx')).render

      const rendered = await render(url)

      const head = (rendered.head ?? '') + generateHydrationScript()

      const html = template
        .replace(`<!--app-head-->`, head)
        .replace(`<!--app-html-->`, rendered.html ?? '')

      res.status(200).set({ 'Content-Type': 'text/html' }).send(html)
    }
    catch (e) {
      vite.ssrFixStacktrace(e as Error)
      res.status(500).end((e as Error).stack)
    }
  })
}

// Start http server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`)
})
