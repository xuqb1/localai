import { Router } from 'express'
import { RAGService } from '../services/ragService.js'
import { DocumentRepository } from '../repositories/index.js'
import vectorDb from '../repositories/vectorDb.js'
import fs from 'fs'
import path from 'path'

const router = Router()
const ragService = new RAGService()
const documentRepository = new DocumentRepository()

router.get('/documents', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, search } = req.query
    const result = documentRepository.findAll({
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      search,
    })
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/documents', async (req, res) => {
  try {
    const { title, content } = req.body
    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容不能为空' })
    }

    const doc = await ragService.addTextDocument(title, content)
    res.status(201).json(doc)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params
    const doc = documentRepository.findById(id)
    if (!doc) {
      return res.status(404).json({ error: '文档不存在' })
    }
    res.json(doc)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { title, content } = req.body
    const doc = await ragService.updateDocument(id, { title, content })
    res.json(doc)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params
    await ragService.deleteDocument(id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

function getAllFiles(dir, supportedExts) {
  const results = []
  const files = fs.readdirSync(dir)

  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      results.push(...getAllFiles(filePath, supportedExts))
    } else {
      const ext = path.extname(file).toLowerCase()
      if (supportedExts.includes(ext)) {
        results.push(filePath)
      }
    }
  }

  return results
}

router.post('/documents/import-file1', async (req, res) => {
  try {
    const { folderPath, fileName } = req.body

    if (!folderPath || !fileName) {
      return res.status(400).json({ error: '文件夹路径和文件名不能为空' })
    }

    const filePath = path.join(folderPath, fileName)
    const ext = path.extname(fileName).toLowerCase()

    let result
    if (ext === '.csv') {
      result = await ragService.addCsvDocumentByLines(filePath)
    } else {
      result = await ragService.addDocument(filePath)
    }
    
    res.json({
      success: true,
      id: result.id,
      title: result.title,
      message: ext === '.csv' 
        ? `CSV文件 "${fileName}" 导入成功，共 ${result.chunkCount} 行` 
        : `文件 "${fileName}" 导入成功`,
    })
  } catch (e) {
    console.error('导入文件错误:', e)
    res.status(500).json({ error: e.message || '导入过程中发生错误' })
  }
})

router.post('/documents/import-file', async (req, res) => {
  try {
    const { folderPath, fileName } = req.body

    if (!folderPath || !fileName) {
      return res.status(400).json({ error: '文件夹路径和文件名不能为空' })
    }

    const filePath = path.join(folderPath, fileName)
    const ext = path.extname(fileName).toLowerCase()

    // 获取文件大小
    const stats = fs.statSync(filePath)
    const fileSizeMB = stats.size / (1024 * 1024)
    const isLargeFile = fileSizeMB > 100

    // 如果是大文件，先返回处理中状态
    if (isLargeFile) {
      // 立即返回响应
      res.json({
        success: true,
        message: `文件 "${fileName}" 正在后台处理，请稍后查询结果`,
        fileSize: `${fileSizeMB.toFixed(2)} MB`,
        status: 'processing'
      })

      // 异步处理文件（不阻塞响应）
      setImmediate(async () => {
        try {
          let result
          if (ext === '.csv') {
            result = await ragService.addCsvDocumentByLines(filePath)
          } else {
            result = await ragService.addDocument(filePath)
          }
          
          console.log(`大文件处理完成: ${fileName}`, {
            id: result.id,
            chunkCount: result.chunkCount
          })
          
          // 这里可以添加通知机制，比如：
          // - 将结果保存到数据库，供后续查询
          // - 发送WebSocket通知
          // - 发送邮件通知
          // - 更新任务状态表
          
        } catch (error) {
          console.error(`大文件处理失败: ${fileName}`, error)
          // 记录错误，方便后续排查
        }
      })

      return // 提前返回，不执行后续代码
    }

    // 小文件正常同步处理
    let result
    if (ext === '.csv') {
      result = await ragService.addCsvDocumentByLines(filePath)
    } else {
      result = await ragService.addDocument(filePath)
    }
    
    res.json({
      success: true,
      id: result.id,
      title: result.title,
      message: ext === '.csv' 
        ? `CSV文件 "${fileName}" 导入成功，共 ${result.chunkCount} 行` 
        : `文件 "${fileName}" 导入成功`,
    })
  } catch (e) {
    console.error('导入文件错误:', e)
    res.status(500).json({ error: e.message || '导入过程中发生错误' })
  }
})

router.post('/documents/import-directory', async (req, res) => {
  try {
    const { directoryPath } = req.body
    if (!directoryPath || typeof directoryPath !== 'string') {
      return res.status(400).json({ error: '目录路径不能为空' })
    }

    if (!fs.existsSync(directoryPath)) {
      return res.status(400).json({ error: '目录路径不存在' })
    }

    const stat = fs.statSync(directoryPath)
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: '指定的路径不是目录' })
    }

    const supportedExts = ['.txt', '.docx', '.html', '.csv']
    const allFiles = getAllFiles(directoryPath, supportedExts)
    
    if (allFiles.length === 0) {
      return res.json({
        importedCount: 0,
        imported: [],
        skippedCount: 0,
        skipped: [],
        message: '未找到支持的文件类型',
      })
    }
    
    const imported = []
    const skipped = []
    const batchSize = 10

    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize)
      
      for (const filePath of batch) {
        const fileName = path.relative(directoryPath, filePath)

        try {
          const doc = await ragService.addDocument(filePath)
          imported.push({ name: fileName, id: doc.id })
        } catch (e) {
          skipped.push(`${fileName} (${e.message})`)
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    res.json({
      importedCount: imported.length,
      imported,
      skippedCount: skipped.length,
      skipped,
      totalFiles: allFiles.length,
    })
  } catch (e) {
    console.error('导入目录错误:', e)
    res.status(500).json({ error: e.message || '导入过程中发生错误' })
  }
})

router.get('/documents/:id/chunks', async (req, res) => {
  try {
    const { id } = req.params
    const chunks = await vectorDb.getDocumentChunks(id)
    res.json({ chunks })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/documents/:id/vector-graph', async (req, res) => {
  try {
    const { id } = req.params
    const graph = await vectorDb.getChunkSimilarityGraph(id)
    res.json(graph)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/vector-stats', async (req, res) => {
  try {
    const stats = await vectorDb.getStats()
    res.json(stats)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
