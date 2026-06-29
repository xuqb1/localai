import { Router } from 'express'
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

export default router
