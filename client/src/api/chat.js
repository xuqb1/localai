import axios from './axios'

export const chatApi = {
  getHistory() {
    return axios.get('/chat/history')
  },

  getConversation(id) {
    return axios.get(`/chat/history/${id}`)
  },

  sendMessage(data, signal) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/chat')
      xhr.setRequestHeader('Content-Type', 'application/json')

      // 支持 AbortController 取消
      if (signal) {
        signal.addEventListener('abort', () => xhr.abort())
      }

      xhr.onload = () => resolve(xhr)
      xhr.onerror = () => reject(new Error('网络请求失败'))
      xhr.onabort = () => {
        const err = new Error('已取消')
        err.name = 'AbortError'
        reject(err)
      }

      xhr.send(JSON.stringify(data))
    })
  },

  updateConversation(id, data) {
    return axios.put(`/chat/history/${id}`, data)
  },

  deleteConversation(id) {
    return axios.delete(`/chat/history/${id}`)
  },
}