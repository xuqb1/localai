import { defineStore } from 'pinia'
import { ref } from 'vue'
import { documentsApi } from '../api'

export const useDocumentStore = defineStore('document', () => {
  const documents = ref([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const searchQuery = ref('')
  const isLoading = ref(false)

  async function fetchDocuments() {
    isLoading.value = true
    try {
      const params = {
        page: page.value,
        pageSize: pageSize.value,
      }
      if (searchQuery.value) {
        params.search = searchQuery.value
      }
      const data = await documentsApi.list(params)
      documents.value = data.documents || []
      total.value = data.total || 0
    } catch (e) {
      console.error('获取文档列表失败:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function createDocument(doc) {
    try {
      const data = await documentsApi.create(doc)
      await fetchDocuments()
      return data
    } catch (e) {
      console.error('创建文档失败:', e)
      throw e
    }
  }

  async function updateDocument(id, doc) {
    try {
      await documentsApi.update(id, doc)
      await fetchDocuments()
    } catch (e) {
      console.error('更新文档失败:', e)
      throw e
    }
  }

  async function deleteDocument(id) {
    try {
      await documentsApi.delete(id)
      await fetchDocuments()
    } catch (e) {
      console.error('删除文档失败:', e)
      throw e
    }
  }

  async function importDirectory(path) {
    try {
      const data = await documentsApi.importDirectory({ directoryPath: path })
      await fetchDocuments()
      return data
    } catch (e) {
      console.error('导入目录失败:', e)
      throw e
    }
  }

  function setSearch(query) {
    searchQuery.value = query
    page.value = 1
    fetchDocuments()
  }

  function setPage(newPage) {
    page.value = newPage
    fetchDocuments()
  }

  return {
    documents,
    total,
    page,
    pageSize,
    searchQuery,
    isLoading,
    fetchDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    importDirectory,
    setSearch,
    setPage,
  }
})
