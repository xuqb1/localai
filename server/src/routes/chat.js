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
    console.log('收到聊天请求:', { message, messageLength: message?.length, conversationId, model })

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

    const historyMessages = messageRepository.findByConversationId(conversationId)
    const recentHistory = historyMessages.slice(-19).map(msg => ({
      role: msg.role,
      content: msg.content,
    }))

    messageRepository.create(conversationId, 'user', message)

    const knowledgeResult = await ragService.retrieveKnowledge(message, 5, 0.5)
    console.log('知识库检索结果:', { hasKnowledge: knowledgeResult.hasKnowledge, sourcesCount: knowledgeResult.sources.length })
    
    let sourceType = 'llm'
    let sources = []
    let prompt = message

    if (knowledgeResult.hasKnowledge) {
      sourceType = 'local'
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

    console.log('调用 LLM 服务(非流式), prompt 长度:', prompt.length, ', 历史条数:', recentHistory.length)

    // 调用 LLM streaming，在服务端收集完整内容后一次性返回 JSON
    const llmResponse = await llmService.generateResponse(prompt, {
      model: targetModel,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      streaming: true,
      settings,
      conversationHistory: recentHistory,
    })

    const decoder = new TextDecoder('utf-8')
    let fullContent = ''
    const chunks = []

    for await (const chunk of llmResponse.data) {
      chunks.push(chunk)
    }

    const rawText = decoder.decode(Buffer.concat(chunks))
    const lines = rawText.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim()
        if (dataStr === '[DONE]') continue
        try {
          const data = JSON.parse(dataStr)
          if (data.choices && data.choices[0]) {
            const delta = data.choices[0].delta || {}
            const content = delta.content || ''
            fullContent += content
          }
        } catch (_) { /* skip */ }
      }
    }

    console.log('LLM 完整响应长度:', fullContent.length, '字符, 共', chunks.length, '个网络块')

    if (!fullContent) {
      return res.status(500).json({ error: '模型返回空内容，请重试' })
    }

    // 保存消息
    messageRepository.create(conversationId, 'assistant', fullContent, sourceType)

    // 返回纯 JSON，无 SSE/streaming
    return res.json({
      content: fullContent,
      source_type: sourceType,
      sources,
    })
  } catch (e) {
    console.error('聊天请求失败:', e)
    console.error('错误堆栈:', e.stack)
    return res.status(500).json({ error: e.message })
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
