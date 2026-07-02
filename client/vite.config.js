import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import http from 'http'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 普通 API 走标准代理
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    },
    // SSE 流式聊天：用原生 HTTP pipe 转发，避开 http-proxy-middleware 缓冲
    configureServer(server) {
      server.middlewares.use('/api/chat', (req, res) => {
        const proxyReq = http.request({
          hostname: 'localhost',
          port: 3001,
          path: '/api/chat',
          method: req.method,
          headers: req.headers,
        }, (proxyRes) => {
          // 防止上游错误导致 pipe 断裂
          proxyRes.on('error', () => {
            if (!res.writableEnded) res.end()
          })
          // 复制后端响应头，去掉压缩避免缓冲
          Object.keys(proxyRes.headers).forEach(key => {
            if (key !== 'content-encoding') {
              res.setHeader(key, proxyRes.headers[key])
            }
          })
          res.writeHead(proxyRes.statusCode)
          // 直接 pipe — 零缓冲，实时流式传数据
          proxyRes.pipe(res)
        })

        proxyReq.on('error', (err) => {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' })
          }
          res.end('SSE proxy error: ' + err.message)
        })

        // 客户端断开时取消上游请求
        res.on('close', () => proxyReq.destroy())

        // 直接 pipe 请求体到后端（无缓冲）
        req.pipe(proxyReq)
      })
    },
  }
})
