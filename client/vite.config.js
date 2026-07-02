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
        // selfHandleResponse 让 http-proxy-middleware 不处理响应，我们手动 pipe
        // 从而彻底消除 SSE 缓冲区问题
        selfHandleResponse: true,
        on: {
          proxyRes(proxyRes, req, res) {
            // 去掉 content-encoding，防止 Node.js 解压缓冲
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
    },
  },
})
