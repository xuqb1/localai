import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { chatApi } from '../api'

export const useChatStore = defineStore('chat', () => {
  const conversations = ref([])
  const currentConversationId = ref(null)
  const messages = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  const currentConversation = computed(() => {
    return conversations.value.find(c => c.id === currentConversationId.value) || null
  })

  async function fetchConversations() {
    try {
      const data = await chatApi.getHistory()
      conversations.value = data || []
    } catch (e) {
      console.error('获取对话历史失败:', e)
    }
  }

  async function selectConversation(id) {
    currentConversationId.value = id
    messages.value = []
    if (id) {
      try {
        const data = await chatApi.getConversation(id)
        messages.value = (data.messages || []).map(msg => ({
          ...msg,
          sourceType: msg.source_type || msg.sourceType || 'llm',
        }))
      } catch (e) {
        console.error('获取对话消息失败:', e)
      }
    }
  }

  async function createConversation() {
    const newConversation = {
      id: Date.now().toString(),
      title: '新对话',
      createdAt: new Date().toISOString(),
    }
    conversations.value.unshift(newConversation)
    await selectConversation(newConversation.id)
    return newConversation
  }

  // 🎯 修复：完整的流式处理
  async function sendMessage1(message) {
    isLoading.value = true
    error.value = null

    // 添加用户消息
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    }
    messages.value.push(userMessage)

    // 创建占位的 assistant 消息
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      sourceType: 'llm',
      sources: [],
      createdAt: new Date().toISOString(),
      status: 'streaming',
    }
    messages.value.push(assistantMessage)

    try {
      const response = await chatApi.sendMessage({
        message,
        conversationId: currentConversationId.value,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let assistantContent = ''
      let buffer = ''
      let hasReceivedData = false

      console.log('开始处理流式响应...')

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          console.log('流式响应结束')
          // 处理剩余的 buffer
          if (buffer.trim()) {
            console.log('处理剩余 buffer:', buffer)
            processBuffer(buffer)
          }
          break
        }

        // 解码数据块
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        // 按行分割处理
        let lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留不完整的行
        
        for (const line of lines) {
          if (line.trim()) {
            processLine(line)
          }
        }
      }

      // 🎯 处理单行数据
      function processLine(line) {
        const trimmedLine = line.trim()
        if (!trimmedLine) return

        // 处理 data: 前缀
        let jsonStr = trimmedLine
        if (trimmedLine.startsWith('data: ')) {
          jsonStr = trimmedLine.substring(6)
        }

        // 跳过 [DONE]
        if (jsonStr === '[DONE]') {
          console.log('收到 [DONE] 标记')
          return
        }

        try {
          const data = JSON.parse(jsonStr)
          console.log('收到数据:', data)
          
          hasReceivedData = true

          // 获取当前消息
          const msg = messages.value.find(m => m.id === assistantMessageId)
          if (!msg) {
            console.warn('找不到 assistant 消息')
            return
          }

          // 🎯 关键修复：处理 content（增量累加）
          if (data.content !== undefined && data.content !== null) {
            if (typeof data.content === 'string') {
              // 累加内容
              assistantContent += data.content
              msg.content = assistantContent
              console.log(`当前累积内容 (${assistantContent.length} 字符):`, assistantContent)
            }
          }

          // 处理 sources
          if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) {
            // 合并并去重 sources
            const existingIds = new Set(msg.sources.map(s => s.id || s.title))
            const newSources = data.sources.filter(s => {
              const key = s.id || s.title
              return !existingIds.has(key)
            })
            if (newSources.length > 0) {
              msg.sources = [...msg.sources, ...newSources]
              console.log('更新 sources:', msg.sources.length)
            }
          }

          // 处理 sourceType
          if (data.source_type) {
            msg.sourceType = data.source_type
          }

        } catch (e) {
          console.warn('解析流式数据失败:', jsonStr, e)
          // 🎯 容错：尝试从非标准格式中提取内容
          try {
            const contentMatch = jsonStr.match(/"content":"([^"]*)"/)
            if (contentMatch && contentMatch[1]) {
              const msg = messages.value.find(m => m.id === assistantMessageId)
              if (msg) {
                assistantContent += contentMatch[1]
                msg.content = assistantContent
                console.log('通过正则提取内容:', contentMatch[1])
              }
            }
          } catch (regexError) {
            // 忽略正则错误
          }
        }
      }

      // 🎯 处理 buffer 中的剩余数据
      function processBuffer(buf) {
        const lines = buf.split('\n')
        for (const line of lines) {
          if (line.trim()) {
            processLine(line)
          }
        }
      }

      // 🎯 流式完成后，更新消息状态
      const finalMsg = messages.value.find(m => m.id === assistantMessageId)
      if (finalMsg) {
        finalMsg.status = 'completed'
        
        // 如果没有收到任何数据，设置默认内容
        if (!hasReceivedData || !finalMsg.content) {
          finalMsg.content = '未能生成回复内容。'
        }
        
        console.log('流式处理完成，最终内容长度:', finalMsg.content.length)
        console.log('最终内容:', finalMsg.content)
      }

    } catch (e) {
      console.error('发送消息失败:', e)
      error.value = e.message
      
      // 更新错误消息
      const errorMsg = messages.value.find(m => m.id === assistantMessageId)
      if (errorMsg) {
        errorMsg.content = `抱歉，发生错误：${e.message}`
        errorMsg.status = 'error'
      }
    } finally {
      isLoading.value = false
    }
  }

  // 🎯 极度简化的调试版本
  async function sendMessage(message) {
    isLoading.value = true
    error.value = null

    // 添加用户消息
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    }
    messages.value.push(userMessage)

    // 创建占位消息
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      sourceType: 'llm',
      sources: [],
      createdAt: new Date().toISOString(),
      status: 'streaming',
    }
    messages.value.push(assistantMessage)

    try {
      const response = await chatApi.sendMessage({
        message,
        conversationId: currentConversationId.value,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let fullContent = ''

      // 🎯 最简单的处理：直接读取所有数据
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('=== 流式读取完成 ===')
          break
        }

        // 将数据块转换为文本
        const chunk = decoder.decode(value, { stream: true })
        //console.log('=== 收到原始数据块 ===')
        //console.log(chunk)
        
        // 按行分割
        const lines = chunk.split('\n')
        console.log('行数:', lines.length)
        
        for (const line of lines) {
          //console.log('处理行:', line)
          
          if (!line.trim()) {
            console.log('空行，跳过')
            continue
          }
          
          // 提取 JSON 数据
          let jsonStr = line.trim()
          if (jsonStr.startsWith('data: ')) {
            jsonStr = jsonStr.substring(6)
            //console.log('去除 data: 前缀后:', jsonStr)
          }
          
          if (jsonStr === '[DONE]') {
            //console.log('收到 [DONE]')
            continue
          }
          
          try {
            const data = JSON.parse(jsonStr)
            //console.log('✅ 解析成功:', data)
            
            // 更新消息
            const msg = messages.value.find(m => m.id === assistantMessageId)
            if (msg) {
              if (data.content) {
                fullContent += data.content
                msg.content = fullContent
                //console.log('当前累积内容:', fullContent)
              }
              
              if (data.sources && data.sources.length > 0) {
                msg.sources = data.sources
              }
              
              if (data.source_type) {
                msg.sourceType = data.source_type
              }
            }
          } catch (e) {
            console.error('❌ 解析失败:', jsonStr, e)
          }
        }
      }

      // 完成
      const msg = messages.value.find(m => m.id === assistantMessageId)
      if (msg) {
        msg.status = 'completed'
        if (!msg.content) {
          msg.content = '没有收到回复内容'
        }
        //console.log('最终内容:', msg.content)
      }

    } catch (e) {
      console.error('发送消息失败:', e)
      const msg = messages.value.find(m => m.id === assistantMessageId)
      if (msg) {
        msg.content = `错误: ${e.message}`
        msg.status = 'error'
      }
    } finally {
      isLoading.value = false
    }
  }

  async function deleteConversation(id) {
    try {
      await chatApi.deleteConversation(id)
      conversations.value = conversations.value.filter(c => c.id !== id)
      if (currentConversationId.value === id) {
        if (conversations.value.length > 0) {
          const latestConversation = conversations.value[conversations.value.length - 1]
          await selectConversation(latestConversation.id)
        } else {
          currentConversationId.value = null
          messages.value = []
        }
      }
    } catch (e) {
      console.error('删除对话失败:', e)
    }
  }

  async function updateConversationTitle(id, title) {
    try {
      await chatApi.updateConversation(id, { title })
      const conversation = conversations.value.find(c => c.id === id)
      if (conversation) {
        conversation.title = title
      }
    } catch (e) {
      console.error('更新对话标题失败:', e)
      throw e
    }
  }

  return {
    conversations,
    currentConversationId,
    currentConversation,
    messages,
    isLoading,
    error,
    fetchConversations,
    selectConversation,
    updateConversationTitle,
    createConversation,
    sendMessage,
    deleteConversation,
  }
})