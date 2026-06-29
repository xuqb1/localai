import axios from './axios'

export const settingsApi = {
  get() {
    return axios.get('/settings')
  },

  update(data) {
    return axios.put('/settings', data)
  },
}