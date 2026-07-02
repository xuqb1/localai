import db from '../db/sqlite.js'
import { generateUUID, formatDate, parseJSON } from '../utils/index.js'

export class DocumentRepository {
  create(doc) {
    const id = generateUUID()
    const now = formatDate(new Date())
    db.prepare(`
      INSERT INTO documents (id, title, file_path, file_type, content, chunk_count, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run([
      id,
      doc.title,
      doc.filePath || null,
      doc.fileType || null,
      doc.content || null,
      doc.chunkCount || 0,
      doc.metadata ? JSON.stringify(doc.metadata) : null,
      now,
      now,
    ])
    return { id, ...doc, createdAt: now, updatedAt: now }
  }

  findAll(params) {
    let sql = 'SELECT * FROM documents'
    const values = []

    if (params.search) {
      sql += ' WHERE title LIKE ?'
      values.push(`%${params.search}%`)
    }

    sql += ' ORDER BY created_at DESC'

    const offset = (params.page - 1) * params.pageSize
    sql += ' LIMIT ? OFFSET ?'
    values.push(params.pageSize, offset)

    const documents = db.prepare(sql).all(values)

    let countSql = 'SELECT COUNT(*) as total FROM documents'
    if (params.search) {
      countSql += ' WHERE title LIKE ?'
    }
    const { total } = db.prepare(countSql).get(params.search ? [`%${params.search}%`] : [])

    return { total, documents }
  }

  findById(id) {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id)
    if (doc && doc.metadata) {
      doc.metadata = parseJSON(doc.metadata)
    }
    return doc
  }

  update(id, doc) {
    const now = formatDate(new Date())
    db.prepare(`
      UPDATE documents SET title = ?, content = ?, metadata = ?, updated_at = ? WHERE id = ?
    `).run([
      doc.title,
      doc.content || null,
      doc.metadata ? JSON.stringify(doc.metadata) : null,
      now,
      id,
    ])
  }

  delete(id) {
    db.prepare('DELETE FROM documents WHERE id = ?').run(id)
  }

  findByFilePath(filePath) {
    return db.prepare('SELECT * FROM documents WHERE file_path = ?').get(filePath)
  }

  updateChunkCount(id, count) {
    const now = formatDate(new Date())
    db.prepare('UPDATE documents SET chunk_count = ?, updated_at = ? WHERE id = ?').run([count, now, id])
  }

  updateImportStatus(id, status, progress) {
    const now = formatDate(new Date())
    db.prepare('UPDATE documents SET import_status = ?, import_progress = ?, updated_at = ? WHERE id = ?').run([status, progress, now, id])
  }

  updateTotalLines(id, totalLines) {
    db.prepare('UPDATE documents SET total_lines = ? WHERE id = ?').run([totalLines, id])
  }
}

export class ConversationRepository {
  create(title, id = null) {
    const conversationId = id || generateUUID()
    const now = formatDate(new Date())
    db.prepare(`
      INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run([conversationId, title, now, now])
    return { id: conversationId, title, createdAt: now, updatedAt: now }
  }

  findAll() {
    return db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all()
  }

  findById(id) {
    return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id)
  }

  delete(id) {
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
  }

  updateTitle(id, title) {
    const now = formatDate(new Date())
    db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run([title, now, id])
  }
}

export class MessageRepository {
  create(conversationId, role, content, sourceType) {
    const id = generateUUID()
    const now = formatDate(new Date())
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, source_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run([id, conversationId, role, content, sourceType || null, now])
    return { id, conversationId, role, content, sourceType, createdAt: now }
  }

  findByConversationId(conversationId) {
    return db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId)
  }

  deleteByConversationId(conversationId) {
    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId)
  }
}

export class SettingsRepository {
  get() {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get()
    if (!settings) {
      return {
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
        vectorDbPath: './data/vector_db',
      }
    }
    return {
      agnesApiKey: settings.agnes_api_key || '',
      agnesApiUrl: settings.agnes_api_url || 'https://api.agnes.cn',
      agnesModel: settings.agnes_model || 'agnes-3.5-turbo',
      deepseekApiKey: settings.deepseek_api_key || '',
      deepseekApiUrl: settings.deepseek_api_url || 'https://api.deepseek.com',
      deepseekModel: settings.deepseek_model || 'deepseek-chat',
      customProviders: settings.custom_providers ? JSON.parse(settings.custom_providers) : [],
      defaultModel: settings.default_model || 'deepseek',
      temperature: settings.temperature || 0.7,
      maxTokens: settings.max_tokens || 4096,
      vectorDbPath: settings.vector_db_path || './data/vector_db',
    }
  }

  update(settings) {
    const now = formatDate(new Date())
    db.prepare(`
      UPDATE settings 
      SET agnes_api_key = ?, agnes_api_url = ?, agnes_model = ?,
          deepseek_api_key = ?, deepseek_api_url = ?, deepseek_model = ?,
          custom_providers = ?, default_model = ?, 
          temperature = ?, max_tokens = ?, vector_db_path = ?, updated_at = ?
      WHERE id = 1
    `).run([
      settings.agnesApiKey || '',
      settings.agnesApiUrl || 'https://api.agnes.cn',
      settings.agnesModel || 'agnes-3.5-turbo',
      settings.deepseekApiKey || '',
      settings.deepseekApiUrl || 'https://api.deepseek.com',
      settings.deepseekModel || 'deepseek-chat',
      JSON.stringify(settings.customProviders || []),
      settings.defaultModel || 'deepseek',
      settings.temperature || 0.7,
      settings.maxTokens || 4096,
      settings.vectorDbPath || './data/vector_db',
      now,
    ])
  }
}
