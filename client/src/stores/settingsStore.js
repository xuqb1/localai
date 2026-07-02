import { defineStore } from 'pinia'
import { ref } from 'vue'
import { settingsApi } from '../api'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref({
    agnesApiKey: '',
    agnesApiUrl: 'https://api.agnes.cn',
    agnesModel: 'agnes-3.5-turbo',
    deepseekApiKey: '',
    deepseekApiUrl: 'https://api.deepseek.com',
    deepseekModel: 'deepseek-chat',
    customProviders: [],
    defaultModel: 'deepseek',
    temperature: 0.7,
    maxTokens: 4096,
  })
  const isLoading = ref(false)

  async function fetchSettings() {
    isLoading.value = true
    try {
      const data = await settingsApi.get()
      settings.value = { ...settings.value, ...data }
    } catch (e) {
      console.error('获取设置失败:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function updateSettings(newSettings) {
    try {
      const data = await settingsApi.update(newSettings)
      settings.value = { ...settings.value, ...data }
      return data
    } catch (e) {
      console.error('更新设置失败:', e)
      throw e
    }
  }

  return {
    settings,
    isLoading,
    fetchSettings,
    updateSettings,
  }
})
