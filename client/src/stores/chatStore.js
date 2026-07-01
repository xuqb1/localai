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

  async function sendMessage(message) {
    isLoading.value = true
    error.value = null

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    }
    messages.value.push(userMessage)

    try {
      const response = await chatApi.sendMessage({
        message,
        conversationId: currentConversationId.value,
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8', { stream: true })
      let assistantContent = ''
      let assistantMessage = null
      let sourceType = 'llm'
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer) {
            processBuffer(buffer)
          }
          break
        }

        const text = decoder.decode(value, { stream: !done })
        buffer += text
        
        if (buffer.includes('\n')) {
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            processLine(line)
          }
        }
      }

      function processLine(line) {
        if (line.startsWith('data: ')) {
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
              sourceType = data.source_type || 'llm'
            }
          } catch (e) {
            console.error('解析流式响应失败:', e)
          }
        }
      }

      function processBuffer(buf) {
        const lines = buf.split('\n')
        for (const line of lines) {
          processLine(line)
        }
      }

      if (assistantMessage) {
        assistantMessage.sourceType = sourceType
      }

    } catch (e) {
      error.value = e.message
      messages.value.push({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `抱歉，发生错误：${e.message}`,
        createdAt: new Date().toISOString(),
      })
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
