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
      // 服务端返回纯 JSON，不再使用 SSE
      const response = await chatApi.sendMessage({
        message,
        conversationId: currentConversationId.value,
      }, abortController.signal)

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        error.value = data.error
      }

      messages.value.push({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content || '',
        sourceType: data.source_type || 'llm',
        sources: data.sources || [],
        createdAt: new Date().toISOString(),
      })

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
