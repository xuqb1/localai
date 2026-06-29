import axios from './axios'

export const chatApi = {
  getHistory() {
    return axios.get('/chat/history')
  },

  getConversation(id) {
    return axios.get(`/chat/history/${id}`)
  },

  async sendMessage(data) {
    // return fetch('/api/chat', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(data),
    // })
    console.log('发送消息请求:', data)
    return fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }).then(response => {
      console.log('响应状态:', response.status, response.statusText)
      console.log('响应头:', response.headers)
      return response
    })
  },

  updateConversation(id, data) {
    return axios.put(`/chat/history/${id}`, data)
  },

  deleteConversation(id) {
    return axios.delete(`/chat/history/${id}`)
  },
}