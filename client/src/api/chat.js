import axios from './axios'

export const chatApi = {
  getHistory() {
    return axios.get('/chat/history')
  },

  getConversation(id) {
    return axios.get(`/chat/history/${id}`)
  },

  sendMessage(data, signal) {
    // 聊天请求直连后端，绕过 Vite 代理避免 SSE 缓冲
    const baseUrl = import.meta.env.DEV ? 'http://localhost:3001' : ''
    return fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal, // 支持 AbortController 取消请求
    })
  },

  updateConversation(id, data) {
    return axios.put(`/chat/history/${id}`, data)
  },

  deleteConversation(id) {
    return axios.delete(`/chat/history/${id}`)
  },
}