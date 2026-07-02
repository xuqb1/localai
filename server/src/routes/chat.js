import { Router } from 'express'
import { RAGService } from '../services/ragService.js'
import { LLMService } from '../services/llmService.js'
import { DocumentRepository, ConversationRepository, MessageRepository, SettingsRepository } from '../repositories/index.js'

const router = Router()
const ragService = new RAGService()
const llmService = new LLMService()
const conversationRepository = new ConversationRepository()
const messageRepository = new MessageRepository()
const settingsRepository = new SettingsRepository()

router.post('/chat', async (req, res) => {
  try {
    const { message, conversationId, model } = req.body
    console.log('收到聊天请求:', { message, conversationId, model })

    // 输入验证
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: '消息内容不能为空' })
    }
    if (message.length > 10000) {
      return res.status(400).json({ error: '消息内容过长，最多10000字符' })
    }
    
    const settings = settingsRepository.get()
    const targetModel = model || settings.defaultModel
    console.log('目标模型:', targetModel)

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId 不能为空' })
    }

    let conversation = conversationRepository.findById(conversationId)
    if (!conversation) {
      conversation = conversationRepository.create('新对话', conversationId)
    }

    // 先获取对话历史（不包含当前消息），再存储当前消息
    const historyMessages = messageRepository.findByConversationId(conversationId)
    const recentHistory = historyMessages.slice(-19).map(msg => ({
      role: msg.role,
      content: msg.content,
    }))

    messageRepository.create(conversationId, 'user', message)

    const knowledgeResult = await ragService.retrieveKnowledge(message)
    console.log('知识库检索结果:', { hasKnowledge: knowledgeResult.hasKnowledge, sourcesCount: knowledgeResult.sources.length })
    
    let sourceType = 'llm'
    let sources = []
    let prompt = message

    if (knowledgeResult.hasKnowledge) {
      sourceType = 'local'
      // 按文档 id 去重
      const seenIds = new Set()
      sources = knowledgeResult.sources.filter(s => {
        if (seenIds.has(s.id)) return false
        seenIds.add(s.id)
        return true
      })
      prompt = `请根据以下参考信息回答用户的问题。如果参考信息中有相关内容，请基于这些内容进行回答；如果没有相关内容，请直接回答问题。

参考信息：
${knowledgeResult.context}

问题：${message}

请用自然、友好的语言回答，不要提及"根据参考信息"等字眼。`
    }

    // 客户端断开连接时，尝试保存已获取的内容
    let fullContent = ''
    let isSaved = false // 防止 res.end() 触发 close 事件导致重复保存
    const handleClientClose = () => {
      if (fullContent && !isSaved) {
        isSaved = true
        try {
          messageRepository.create(conversationId, 'assistant', fullContent, sourceType)
        } catch (e) {
          console.error('保存中断的消息失败:', e)
        }
      }
    }
    res.on('close', handleClientClose)

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')  // 禁用 nginx 缓冲
    res.flushHeaders()  // 立即发送响应头，确保浏览器开始接收

    // 禁用 Nagle 算法，防止 TCP 层缓冲小数据块
    if (res.socket) {
      res.socket.setNoDelay(true)
    }

    // 增加 TCP 心跳，用 comment 行保持连接
    const keepAliveInterval = setInterval(() => {
      if (res.writable) {
        res.write(': keepalive\n\n')
      }
    }, 15000)

    console.log('调用 LLM 服务, prompt 长度:', prompt.length, ', 历史条数:', recentHistory.length)
    const llmResponse = await llmService.generateResponse(prompt, {
      model: targetModel,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      streaming: true,
      settings,
      conversationHistory: recentHistory,
    })
    console.log('LLM 响应状态:', llmResponse.status, ', 流式:', typeof llmResponse.data?.pipe === 'function' || typeof llmResponse.data?.on === 'function')

    // 监听上游流错误
    let upstreamError = null
    llmResponse.data.on('error', (err) => {
      upstreamError = err
      console.error('LLM 上游流错误:', err.message)
    })

    const decoder = new TextDecoder('utf-8', { stream: true })
    let buffer = ''

    let chunkCount = 0
    try {
      for await (const chunk of llmResponse.data) {
        chunkCount++
        const text = decoder.decode(chunk, { stream: true })
        console.log(`[流式] 块 #${chunkCount}, 大小=${chunk.length}B, 文本长=${text.length}`)
        buffer += text

        // 按行分割，保留不完整的行在 buffer 中
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim()
            if (dataStr === '[DONE]') {
              console.log('LLM 流式响应完成 [DONE], 已接收', chunkCount, '个数据块, 内容:', fullContent.length, '字符')
              continue
            }
            try {
              const data = JSON.parse(dataStr)
              // 检查 LLM 返回的错误
              if (data.error) {
                console.error('LLM API 返回错误:', JSON.stringify(data.error))
                if (res.writable) {
                  res.write(`data: ${JSON.stringify({
                    content: '',
                    error: data.error.message || '模型服务返回错误',
                    source_type: 'error',
                  })}\n\n`)
                }
                break
              }
              if (data.choices && data.choices[0]) {
                const delta = data.choices[0].delta || {}
                const content = delta.content || ''
                if (content) {
                  fullContent += content
                  console.log('[流式] 内容增量:', JSON.stringify(content))
                  if (res.writable) {
                    res.write(`data: ${JSON.stringify({
                      content,
                      source_type: sourceType,
                      sources,
                    })}\n\n`)
                  }
                } else {
                  // delta 可能包含 role 信息（某些 API 首块）
                  if (delta.role) console.log('[流式] role delta:', delta.role)
                }
              }
              // 记录异常的 finish_reason
              const finishReason = data.choices?.[0]?.finish_reason
              if (finishReason) {
                console.log('[流式] finish_reason:', finishReason)
              }
            } catch (e) {
              console.error('解析流式响应失败:', e, '原始数据:', dataStr.substring(0, 200))
            }
          }
        }
      }
      console.log('[流式] 循环结束, 共接收', chunkCount, '个数据块')
    } catch (streamErr) {
      console.error('[流式] 读取异常:', streamErr.message, streamErr.stack)
      if (res.writable) {
        res.write(`data: ${JSON.stringify({
          content: '',
          error: `流式传输中断: ${streamErr.message}`,
          source_type: 'error',
        })}\n\n`)
      }
    }

    // 处理 buffer 中剩余的数据
    if (buffer.trim()) {
      const line = buffer.trim()
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim()
        if (dataStr !== '[DONE]') {
          try {
            const data = JSON.parse(dataStr)
            // 再次检查错误
            if (data.error) {
              console.error('LLM API 返回错误(残留):', JSON.stringify(data.error))
            } else if (data.choices && data.choices[0] && data.choices[0].delta) {
              const content = data.choices[0].delta.content || ''
              fullContent += content
              if (res.writable) {
                res.write(`data: ${JSON.stringify({
                  content,
                  source_type: sourceType,
                  sources,
                })}\n\n`)
              }
            }
          } catch (e) {
            console.error('解析最终流式响应失败:', e)
          }
        }
      }
    }

    clearInterval(keepAliveInterval)
    console.log('流式响应总长度:', fullContent.length, '字符')

    if (!fullContent) {
      console.warn('警告: 流式响应内容为空! upstreamError:', upstreamError?.message)
    }

    if (!isSaved) {
      isSaved = true
      messageRepository.create(conversationId, 'assistant', fullContent, sourceType)
    }
    res.end()
  } catch (e) {
    console.error('聊天请求失败:', e)
    console.error('错误堆栈:', e.stack)
    try {
      res.write(`data: ${JSON.stringify({
        content: `抱歉，发生错误：${e.message}`,
        source_type: 'error',
      })}\n\n`)
      res.end()
    } catch (writeErr) {
      console.error('写入响应失败:', writeErr)
    }
  }
})

router.get('/chat/history', async (req, res) => {
  try {
    const conversations = conversationRepository.findAll()
    res.json(conversations)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/chat/history/:id', async (req, res) => {
  try {
    const { id } = req.params
    const messages = messageRepository.findByConversationId(id)
    res.json({ messages })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/chat/history/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { title } = req.body
    if (!title) {
      return res.status(400).json({ error: '标题不能为空' })
    }
    conversationRepository.updateTitle(id, title)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/chat/history/:id', async (req, res) => {
  try {
    const { id } = req.params
    messageRepository.deleteByConversationId(id)
    conversationRepository.delete(id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
