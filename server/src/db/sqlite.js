import Database from 'better-sqlite3'
import config from '../config/index.js'

const db = new Database(config.database.sqlite.path)

db.pragma('foreign_keys = ON')

const createTables = `
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    file_path TEXT,
    file_type TEXT,
    content TEXT,
    chunk_count INTEGER DEFAULT 0,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    source_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    agnes_api_key TEXT,
    deepseek_api_key TEXT,
    default_model TEXT DEFAULT 'deepseek',
    temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4096,
    vector_db_path TEXT DEFAULT './data/vector_db',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
CREATE INDEX IF NOT EXISTS idx_documents_file_path ON documents(file_path);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
`

db.exec(createTables)

try {
  db.exec('ALTER TABLE documents ADD COLUMN import_status TEXT DEFAULT "completed"')
} catch (e) {}

try {
  db.exec('ALTER TABLE documents ADD COLUMN import_progress INTEGER DEFAULT 0')
} catch (e) {}

try {
  db.exec('ALTER TABLE documents ADD COLUMN total_lines INTEGER DEFAULT 0')
} catch (e) {}

// 修复历史数据：NULL 的 import_status 改为 'completed'（旧文档在迁移前已存在）
db.prepare("UPDATE documents SET import_status = 'completed' WHERE import_status IS NULL").run()

// 服务重启后，所有 'importing' / 'failed' 状态的文档标记为 'interrupted'（TaskManager 是纯内存的，重启后任务已丢失）
const importingCount = db.prepare("UPDATE documents SET import_status = 'interrupted' WHERE import_status = 'importing'").run()
const failedCount = db.prepare("UPDATE documents SET import_status = 'interrupted' WHERE import_status = 'failed'").run()
const totalChanged = importingCount.changes + failedCount.changes
if (totalChanged > 0) {
  console.log(`[DB] 检测到 ${totalChanged} 个导入中断/失败的文档，已标记为 interrupted`)
}

try {
  db.exec('ALTER TABLE settings ADD COLUMN agnes_api_url TEXT DEFAULT "https://api.agnes.cn"')
} catch (e) {}

try {
  db.exec('ALTER TABLE settings ADD COLUMN agnes_model TEXT DEFAULT "agnes-3.5-turbo"')
} catch (e) {}

try {
  db.exec('ALTER TABLE settings ADD COLUMN deepseek_api_url TEXT DEFAULT "https://api.deepseek.com"')
} catch (e) {}

try {
  db.exec('ALTER TABLE settings ADD COLUMN deepseek_model TEXT DEFAULT "deepseek-chat"')
} catch (e) {}

try {
  db.exec('ALTER TABLE settings ADD COLUMN custom_providers TEXT DEFAULT "[]"')
} catch (e) {}

const checkSettings = db.prepare('SELECT COUNT(*) as count FROM settings')
const result = checkSettings.get()
if (result.count === 0) {
  const insertSettings = db.prepare(`
    INSERT INTO settings (id, agnes_api_key, deepseek_api_key, default_model, temperature, max_tokens, vector_db_path)
    VALUES (1, '', '', 'deepseek', 0.7, 4096, './data/vector_db')
  `)
  insertSettings.run()
}

export default db
