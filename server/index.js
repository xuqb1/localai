import express from 'express'
import cors from 'cors'
import config from './src/config/index.js'
import chatRouter from './src/routes/chat.js'
import documentsRouter from './src/routes/documents.js'
import settingsRouter from './src/routes/settings.js'
import { errorHandler } from './src/middleware/errorHandler.js'
import vectorDb from './src/repositories/vectorDb.js'

const app = express()
const PORT = config.server.port

app.use(cors({
  origin: config.server.cors.origin,
  credentials: true,
}))

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  next()
})

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }))

app.use('/api', chatRouter)
app.use('/api', documentsRouter)
app.use('/api', settingsRouter)

app.use(errorHandler)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

async function startServer() {
  try {
    await vectorDb.init()
    console.log('向量数据库初始化完成')
  } catch (e) {
    console.warn('向量数据库初始化失败:', e.message)
  }

  app.listen(PORT, () => {
    console.log(`LocalAI 后端服务已启动，监听端口: ${PORT}`)
    console.log(`API 地址: http://localhost:${PORT}`)
  })
}

startServer()
