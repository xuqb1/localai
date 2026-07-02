import axios from './axios'

export const chatApi = {
  getHistory() {
    return axios.get('/chat/history')
  },

  getConversation(id) {
    return axios.get(`/chat/history/${id}`)
  },

  sendMessage(data, signal) {
    // 走 Vite 代理，同源无 CORS 问题
    return fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    })
  },

  updateConversation(id, data) {
    return axios.put(`/chat/history/${id}`, data)
  },

  deleteConversation(id) {
    return axios.delete(`/chat/history/${id}`)
  },
}