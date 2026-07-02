import express from 'express'
import cors from 'cors'
import config from './src/config/index.js'
import chatRouter from './src/routes/chat.js'
import documentsRouter from './src/routes/documents.js'
import settingsRouter from './src/routes/settings.js'
import { errorHandler } from './src/middleware/errorHandler.js'
import vectorDb from './src/repositories/vectorDb.js'
import { RAGService } from './src/services/ragService.js'

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

  // 自动恢复中断的导入任务
  await resumeImportingDocuments()
}

async function resumeImportingDocuments() {
  try {
    const ragService = new RAGService()
    const importingDocs = ragService.documentRepository.findImportingDocuments()
    
    if (importingDocs.length === 0) return
    
    console.log(`检测到 ${importingDocs.length} 个未完成的导入任务，自动恢复中...`)
    
    for (const doc of importingDocs) {
      if (!doc.file_path) {
        ragService.documentRepository.updateImportStatus(doc.id, 'completed', 100)
        console.log(`文档 ${doc.title} 无文件路径，标记为已完成`)
        continue
      }
      
      console.log(`恢复导入: ${doc.title}, 从第 ${doc.chunk_count || 0} 行继续...`)
      
      ragService.addCsvDocumentByLines(doc.file_path).then(() => {
        console.log(`✅ 导入完成: ${doc.title}`)
      }).catch(err => {
        console.error(`❌ 导入失败: ${doc.title}`, err.message)
        ragService.documentRepository.updateImportStatus(doc.id, 'failed', 0)
      })
    }
  } catch (e) {
    console.warn('恢复导入任务出错:', e.message)
  }
}

startServer()
