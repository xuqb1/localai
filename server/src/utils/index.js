import { v4 as uuidv4 } from 'uuid'

export function generateUUID() {
  return uuidv4()
}

export function formatDate(date) {
  return new Date(date).toISOString()
}

export function parseJSON(str, defaultValue = {}) {
  try {
    return JSON.parse(str)
  } catch {
    return defaultValue
  }
}
