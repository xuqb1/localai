import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { chatApi } from '../api'

export const useChatStore = defineStore('chat', () => {
  const conversations = ref([])
  const currentConversationId = ref(null)
  const messages = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  let abortController = null // 用于取消正在进行的 SSE 请求

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

  async function sendMessage(message) {
    // 取消之前的请求
    if (abortController) {
      abortController.abort()
    }

    isLoading.value = true
    error.value = null

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    }
    messages.value.push(userMessage)

    abortController = new AbortController()

    try {
      const response = await chatApi.sendMessage({
        message,
        conversationId: currentConversationId.value,
      }, abortController.signal)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8', { stream: true })
      let assistantContent = ''
      let assistantMessage = null
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // 处理残留的 buffer
          processLine(buffer.trim())
          break
        }

        const text = decoder.decode(value, { stream: true })
        buffer += text

        // 按行分割处理 SSE 数据
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后不完整的行
        for (const line of lines) {
          processLine(line.trim())
        }
      }

      function processLine(line) {
        if (!line || !line.startsWith('data: ')) return
        try {
          const data = JSON.parse(line.slice(6))
          if (data.content) {
            assistantContent += data.content
            if (!assistantMessage) {
              assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '',
                sourceType: data.source_type || 'llm',
                sources: data.sources || [],
                createdAt: new Date().toISOString(),
              }
              messages.value.push(assistantMessage)
            }
            assistantMessage.content = assistantContent
            assistantMessage.sourceType = data.source_type || 'llm'
          }
          if (data.error) {
            error.value = data.error
            // 显示错误到聊天中
            if (!assistantMessage) {
              assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '',
                sourceType: 'error',
                createdAt: new Date().toISOString(),
              }
              messages.value.push(assistantMessage)
            }
            assistantMessage.content = assistantContent + `\n\n⚠️ 错误: ${data.error}`
          }
        } catch (e) {
          // 忽略无法解析的 SSE 行
        }
      }

      if (assistantMessage) {
        assistantMessage.sourceType = assistantMessage.sourceType || 'llm'
      } else {
        // 没有收到助手回复，添加错误消息
        messages.value.push({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '未收到有效回复，请重试。',
          createdAt: new Date().toISOString(),
        })
      }

    } catch (e) {
      if (e.name === 'AbortError') {
        // 请求被取消，不需要显示错误
        return
      }
      error.value = e.message
      messages.value.push({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `抱歉，发生错误：${e.message}`,
        createdAt: new Date().toISOString(),
      })
    } finally {
      isLoading.value = false
      abortController = null
    }
  }

  async function deleteConversation(id) {
    try {
      await chatApi.deleteConversation(id)
      conversations.value = conversations.value.filter(c => c.id !== id)
      if (currentConversationId.value === id) {
        if (conversations.value.length > 0) {
          // 选择第一个（最新的）对话
          await selectConversation(conversations.value[0].id)
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
