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

    messageRepository.create(conversationId, 'user', message)

    const knowledgeResult = await ragService.retrieveKnowledge(message)
    console.log('知识库检索结果:', { hasKnowledge: knowledgeResult.hasKnowledge, sourcesCount: knowledgeResult.sources.length })
    
    let sourceType = 'llm'
    let sources = []
    let prompt = message

    if (knowledgeResult.hasKnowledge) {
      sourceType = 'local'
      sources = knowledgeResult.sources
      prompt = `请根据以下参考信息回答用户的问题。如果参考信息中有相关内容，请基于这些内容进行回答；如果没有相关内容，请直接回答问题。

参考信息：
${knowledgeResult.context}

问题：${message}

请用自然、友好的语言回答，不要提及"根据参考信息"等字眼。`
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const llmResponse = await llmService.generateResponse(prompt, {
      model: targetModel,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      streaming: true,
      settings,
    })

    let fullContent = ''
    const decoder = new TextDecoder('utf-8')

    for await (const chunk of llmResponse.data) {
      const text = decoder.decode(chunk)
      const lines = text.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim()
          if (dataStr === '[DONE]') {
            continue
          }
          try {
            const data = JSON.parse(dataStr)
            if (data.choices && data.choices[0] && data.choices[0].delta) {
              const content = data.choices[0].delta.content || ''
              fullContent += content

              res.write(`data: ${JSON.stringify({
                content,
                source_type: sourceType,
                sources,
              })}\n\n`)
            }
          } catch (e) {
            console.error('解析流式响应失败:', e)
          }
        }
      }
    }

    messageRepository.create(conversationId, 'assistant', fullContent, sourceType)
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
