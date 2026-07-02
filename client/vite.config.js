import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // SSE 聊天接口：selfHandleResponse + pipe 避免代理缓冲
      '/api/chat': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        selfHandleResponse: true,
        on: {
          proxyRes(proxyRes, req, res) {
            Object.keys(proxyRes.headers).forEach(key => {
              if (key !== 'content-encoding') {
                res.setHeader(key, proxyRes.headers[key])
              }
            })
            res.writeHead(proxyRes.statusCode)
            proxyRes.pipe(res)
          },
        },
      },
      // 其他 API：普通代理
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
