import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // 禁用 SSE 代理缓冲 —— 关键修复！
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            if (req.url === '/api/chat') {
              // 1. 去掉 content-encoding，防止 http-proxy 缓冲压缩流
              delete proxyRes.headers['content-encoding']
              // 2. 立即 flush headers，不等待数据
              res.flushHeaders?.()
            }
          })
        },
      }
    }
  }
})
