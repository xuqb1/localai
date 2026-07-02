import { Router } from 'express'
import axios from 'axios'
import { SettingsRepository } from '../repositories/index.js'

const router = Router()
const settingsRepository = new SettingsRepository()

router.get('/settings', async (req, res) => {
  try {
    const settings = settingsRepository.get()
    res.json(settings)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/settings', async (req, res) => {
  try {
    const settings = req.body
    settingsRepository.update(settings)
    res.json(settingsRepository.get())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/settings/models', async (req, res) => {
  try {
    const { provider, apiKey, apiUrl } = req.body
    
    let models = []
    
    const buildModelsUrl = (baseUrl) => {
      if (baseUrl.endsWith('/v1')) {
        return `${baseUrl}/models`
      } else if (baseUrl.endsWith('/v1/')) {
        return `${baseUrl}models`
      } else {
        return `${baseUrl}/v1/models`
      }
    }
    
    if (provider === 'deepseek') {
      const url = apiUrl || 'https://api.deepseek.com'
      try {
        const response = await axios.get(buildModelsUrl(url), {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 10000
        })
        models = response.data.data.map(m => ({
          id: m.id,
          name: m.id,
        }))
      } catch (e) {
        console.error('获取DeepSeek模型列表失败:', e.message)
        models = [
          { id: 'deepseek-chat', name: 'deepseek-chat' },
          { id: 'deepseek-chat-v2', name: 'deepseek-chat-v2' },
        ]
      }
    } else if (provider === 'agnes') {
      const url = apiUrl || 'https://api.agnes.cn'
      try {
        const response = await axios.get(buildModelsUrl(url), {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 10000
        })
        models = response.data.data.map(m => ({
          id: m.id,
          name: m.id,
        }))
      } catch (e) {
        console.error('获取Agnes模型列表失败:', e.message)
        models = [
          { id: 'agnes-3.5-turbo', name: 'agnes-3.5-turbo' },
        ]
      }
    } else {
      const url = apiUrl
      try {
        const response = await axios.get(buildModelsUrl(url), {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 10000
        })
        models = response.data.data.map(m => ({
          id: m.id,
          name: m.id,
        }))
      } catch (e) {
        console.error('获取自定义模型列表失败:', e.message)
        res.status(500).json({ error: '获取模型列表失败: ' + e.message })
        return
      }
    }
    
    res.json({ models })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
