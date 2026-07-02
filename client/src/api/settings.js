import axios from './axios'

export const settingsApi = {
  get() {
    return axios.get('/settings')
  },

  update(data) {
    return axios.put('/settings', data)
  },

  getModels(provider, apiKey, apiUrl) {
    return axios.post('/settings/models', { provider, apiKey, apiUrl })
  },
}