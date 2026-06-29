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

router.post('/chat1', async (req, res) => {
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
      timeout: 120000, 
      maxRetries: 3, 
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

router.post('/chat2', async (req, res) => {
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
    console.log('知识库检索结果:', { 
      hasKnowledge: knowledgeResult.hasKnowledge, 
      sourcesCount: knowledgeResult.sources.length 
    })
    
    let sourceType = 'llm'
    let sources = []
    let prompt = ''

    // 🎯 改进：智能构建提示词
    if (knowledgeResult.hasKnowledge) {
      sourceType = 'hybrid' // 混合模式
      sources = knowledgeResult.sources
      
      // 判断问题类型
      const isAbilityQuestion = /你能做什么|你有什么能力|你会什么|你的功能|你能帮我什么/.test(message)
      
      if (isAbilityQuestion) {
        // 对于能力类问题，让模型自由发挥
        prompt = `用户想知道你能做什么。请用自然、友好的语言介绍你的能力。

你可以这样回答：
1. 首先基于知识库信息介绍相关能力
2. 然后补充你作为AI模型的通用能力
3. 最后邀请用户提出具体问题

知识库参考信息（供参考，你可以选择性使用）：
${knowledgeResult.context}

用户问题：${message}

请用自然、友好的语言回答，展示你的专业性和广泛能力。`
      } else {
        // 对于具体问题，结合知识库和模型能力
        prompt = `用户的问题是：${message}

参考信息：
${knowledgeResult.context}

请这样回答：
1. 优先使用参考信息中的相关内容
2. 如果参考信息不完整，用你的知识补充
3. 将参考信息和你的知识自然融合
4. 不要提及"根据参考信息"等字眼

回答要全面、准确、友好。`
      }
    } else {
      // 没有知识库结果，完全使用模型能力
      prompt = `用户的问题是：${message}

请根据你的知识直接回答用户的问题。回答要详细、准确、自然、友好。`
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const llmResponse = await llmService.generateResponse(prompt, {
      model: targetModel,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      timeout: 120000, 
      maxRetries: 3, 
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
      sourceType = 'hybrid' // 改为 hybrid
      sources = knowledgeResult.sources
      prompt = `用户的问题是：${message}

参考信息：
${knowledgeResult.context}

请这样回答：
1. 优先使用参考信息中的相关内容
2. 如果参考信息不完整，用你的知识补充
3. 将参考信息和你的知识自然融合
4. 不要提及"根据参考信息"等字眼

回答要全面、准确、友好。`
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const llmResponse = await llmService.generateResponse(prompt, {
      model: targetModel,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      timeout: 120000, 
      maxRetries: 3, 
      streaming: true,
      settings,
    })

    let fullContent = ''
    let buffer = '' // 🎯 添加缓冲区，用于处理不完整的 JSON

    // 🎯 使用更稳健的流式处理
    for await (const chunk of llmResponse.data) {
      const text = chunk.toString('utf-8')
      buffer += text
      
      // 按行分割
      const lines = buffer.split('\n')
      // 保留最后一行（可能不完整）
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine) continue
        
        // 处理 data: 前缀
        let jsonStr = trimmedLine
        if (trimmedLine.startsWith('data: ')) {
          jsonStr = trimmedLine.substring(6)
        }
        
        // 跳过 [DONE]
        if (jsonStr === '[DONE]') {
          continue
        }
        
        // 🎯 尝试解析 JSON，如果失败则尝试修复
        try {
          const data = JSON.parse(jsonStr)
          
          if (data.choices && data.choices[0] && data.choices[0].delta) {
            const content = data.choices[0].delta.content || ''
            if (content) {
              fullContent += content
              
              res.write(`data: ${JSON.stringify({
                content,
                source_type: sourceType,
                sources: sources,
              })}\n\n`)
            }
          }
        } catch (parseError) {
          console.warn('解析流式响应失败:', parseError.message)
          console.warn('问题数据:', jsonStr.substring(0, 200) + '...')
          
          // 🎯 尝试修复常见的 JSON 问题
          try {
            let fixedJson = jsonStr
            
            // 1. 尝试补全不完整的字符串
            if (fixedJson.includes('"content":"') && !fixedJson.endsWith('"}')) {
              // 尝试找到 content 的值
              const contentMatch = fixedJson.match(/"content":"([^"]*)$/)
              if (contentMatch) {
                // 如果 content 被截断，尝试补全
                const partialContent = contentMatch[1]
                // 尝试从原始数据中提取更多内容
                // 这里简化处理，实际可能需要更复杂的逻辑
              }
            }
            
            // 2. 尝试使用正则提取 content
            const contentRegex = /"content":"([^"]*)"/
            const contentMatch = jsonStr.match(contentRegex)
            if (contentMatch && contentMatch[1]) {
              const content = contentMatch[1]
              fullContent += content
              
              res.write(`data: ${JSON.stringify({
                content,
                source_type: sourceType,
                sources: sources,
              })}\n\n`)
              
              console.log('通过正则提取内容成功:', content)
            }
          } catch (fixError) {
            console.error('修复 JSON 失败:', fixError.message)
          }
        }
      }
    }

    // 🎯 处理剩余的 buffer
    if (buffer.trim()) {
      console.log('处理剩余 buffer:', buffer.substring(0, 100) + '...')
      try {
        let jsonStr = buffer.trim()
        if (jsonStr.startsWith('data: ')) {
          jsonStr = jsonStr.substring(6)
        }
        if (jsonStr !== '[DONE]') {
          const data = JSON.parse(jsonStr)
          if (data.choices && data.choices[0] && data.choices[0].delta) {
            const content = data.choices[0].delta.content || ''
            if (content) {
              fullContent += content
              res.write(`data: ${JSON.stringify({
                content,
                source_type: sourceType,
                sources: sources,
              })}\n\n`)
            }
          }
        }
      } catch (e) {
        console.warn('处理剩余 buffer 失败:', e.message)
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
