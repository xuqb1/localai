import axios from './axios'

export const documentsApi = {
  list(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    return axios.get(`/documents?${queryString}`)
  },

  create(data) {
    return axios.post('/documents', data)
  },

  update(id, data) {
    return axios.put(`/documents/${id}`, data)
  },

  delete(id) {
    return axios.delete(`/documents/${id}`)
  },

  get(id) {
    return axios.get(`/documents/${id}`)
  },

  getChunks(id) {
    return axios.get(`/documents/${id}/chunks`)
  },

  getVectorGraph(id) {
    return axios.get(`/documents/${id}/vector-graph`)
  },

  importDirectory(data) {
    return axios.post('/documents/import-directory', data)
  },

  importFile(data) {
    return axios.post('/documents/import-file', data)
  },

  getImportTask(taskId) {
    return axios.get(`/documents/import-task/${taskId}`)
  },
}