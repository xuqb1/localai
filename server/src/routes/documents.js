import { Router } from 'express'
import { RAGService } from '../services/ragService.js'
import { DocumentRepository } from '../repositories/index.js'
import vectorDb from '../repositories/vectorDb.js'
import fs from 'fs'
import path from 'path'
import { taskManager } from '../utils/taskManager.js'

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
  const visited = new Set() // 防止符号链接循环
  const maxFiles = 10000 // 最大文件数限制

  if (!fs.existsSync(dir)) return results

  try {
    const realPath = fs.realpathSync(dir)
    if (visited.has(realPath)) return results
    visited.add(realPath)

    const files = fs.readdirSync(dir)

    for (const file of files) {
      if (results.length >= maxFiles) break

      const filePath = path.join(dir, file)
      let stat
      try {
        stat = fs.statSync(filePath)
      } catch {
        continue // 跳过无法访问的文件
      }

      if (stat.isDirectory()) {
        results.push(...getAllFiles(filePath, supportedExts))
      } else {
        const ext = path.extname(file).toLowerCase()
        if (supportedExts.includes(ext)) {
          results.push(filePath)
        }
      }
    }
  } catch {
    // 目录无法读取，跳过
  }

  return results
}

router.get('/documents/import-task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params
    const task = taskManager.getTask(taskId)
    
    if (!task) {
      return res.status(404).json({ error: '任务不存在' })
    }
    
    res.json(task)
  } catch (e) {
    console.error('查询任务状态错误:', e)
    res.status(500).json({ error: e.message || '查询任务状态失败' })
  }
})

router.post('/documents/import-file', async (req, res) => {
  try {
    const { folderPath, fileName } = req.body

    if (!folderPath || !fileName) {
      return res.status(400).json({ error: '文件夹路径和文件名不能为空' })
    }

    // 路径遍历防护：验证拼接后的路径仍在 folderPath 下
    const resolvedBase = path.resolve(folderPath)
    const filePath = path.resolve(path.join(folderPath, fileName))
    if (!filePath.startsWith(resolvedBase + path.sep) && filePath !== resolvedBase) {
      return res.status(403).json({ error: '非法的文件路径访问' })
    }

    const ext = path.extname(fileName).toLowerCase()

    const task = taskManager.createTask('import_file', {
      folderPath,
      fileName,
      filePath,
      fileType: ext,
    })

    taskManager.executeTask(task.id, async (taskId, updateProgress) => {
      updateProgress(0, `开始导入文件: ${fileName}`)
      
      let result
      if (ext === '.csv') {
        result = await ragService.addCsvDocumentByLines(filePath, (progress, msg) => {
          updateProgress(progress, msg)
        })
      } else {
        result = await ragService.addDocument(filePath)
      }
      
      taskManager.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        message: ext === '.csv' 
          ? `CSV文件 "${fileName}" 导入成功，共 ${result.chunkCount} 行` 
          : `文件 "${fileName}" 导入成功`,
        result,
      })
    })
    
    res.json({
      success: true,
      taskId: task.id,
      message: '导入任务已提交，请稍后查询任务状态',
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

    const supportedExts = ['.txt', '.docx', '.doc', '.xlsx', '.xls', '.html', '.csv', '.css', '.js', '.svg', '.md', '.c', '.cpp', '.h', '.hpp', '.bas', '.inc', '.rc', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    const allFiles = getAllFiles(directoryPath, supportedExts)
    
    if (allFiles.length === 0) {
      return res.json({
        success: true,
        importedCount: 0,
        message: '未找到支持的文件类型',
      })
    }

    const task = taskManager.createTask('import_directory', {
      directoryPath,
      totalFiles: allFiles.length,
    })

    taskManager.executeTask(task.id, async (taskId, updateProgress) => {
      updateProgress(0, `开始导入目录: ${directoryPath}，共 ${allFiles.length} 个文件`)
      
      const imported = []
      const skipped = []

      for (let i = 0; i < allFiles.length; i++) {
        const filePath = allFiles[i]
        const fileName = path.relative(directoryPath, filePath)
        const ext = path.extname(filePath).toLowerCase()

        try {
          let result
          if (ext === '.csv') {
            result = await ragService.addCsvDocumentByLines(filePath, (progress, msg) => {
              const fileProgress = Math.round((i / allFiles.length) * 100)
              updateProgress(fileProgress, `${fileName}: ${msg}`)
            })
          } else {
            result = await ragService.addDocument(filePath)
          }
          imported.push({ name: fileName, id: result.id })
        } catch (e) {
          skipped.push(`${fileName} (${e.message})`)
        }
        
        const progress = Math.round(((i + 1) / allFiles.length) * 100)
        updateProgress(progress, `已导入 ${imported.length} / ${allFiles.length} 个文件，跳过 ${skipped.length} 个`)
      }

      taskManager.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        message: `目录导入完成，成功 ${imported.length} 个，跳过 ${skipped.length} 个`,
        result: {
          importedCount: imported.length,
          skippedCount: skipped.length,
          totalFiles: allFiles.length,
          imported,
          skipped,
        },
      })
    })

    res.json({
      success: true,
      taskId: task.id,
      message: `导入任务已提交，共 ${allFiles.length} 个文件，请稍后查询任务状态`,
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
