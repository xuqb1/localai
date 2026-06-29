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
