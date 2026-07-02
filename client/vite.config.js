import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import http from 'http'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // 不用内置 proxy 配置，统一在 configureServer 中用原生 pipe 代理所有 API，
    // 避免 http-proxy-middleware 的缓冲问题以及与自定义中间件的冲突
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        const proxyReq = http.request({
          hostname: 'localhost',
          port: 3001,
          path: req.originalUrl || req.url,
          method: req.method,
          headers: req.headers,
        }, (proxyRes) => {
          proxyRes.on('error', () => {
            if (!res.writableEnded) res.end()
          })
          // 去掉 content-encoding，防止缓冲
          Object.keys(proxyRes.headers).forEach(key => {
            if (key !== 'content-encoding') {
              res.setHeader(key, proxyRes.headers[key])
            }
          })
          res.writeHead(proxyRes.statusCode)
          proxyRes.pipe(res)
        })

        proxyReq.on('error', (err) => {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' })
          }
          res.end('API proxy error: ' + err.message)
        })

        res.on('close', () => proxyReq.destroy())
        req.pipe(proxyReq)
      })
    },
  }
})
