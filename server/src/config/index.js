import dotenv from 'dotenv'

dotenv.config()

export default {
  server: {
    port: process.env.PORT || 3001,
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    },
  },
  database: {
    sqlite: {
      path: process.env.SQLITE_PATH || './data/sqlite.db',
    },
    vector: {
      path: process.env.VECTOR_DB_PATH || './data/vector_db',
      type: process.env.VECTOR_DB_TYPE || 'qdrant',
    },
    qdrant: {
      host: process.env.QDRANT_HOST || 'localhost',
      port: parseInt(process.env.QDRANT_PORT) || 6333,
      apiKey: process.env.QDRANT_API_KEY || null,
      collectionName: process.env.QDRANT_COLLECTION || 'localai_documents',
    },
  },
  embedding: {
    model: process.env.EMBEDDING_MODEL || 'all-MiniLM-L6-v2',
  },
  llm: {
    providers: {
      agnes: {
        apiKey: process.env.AGNES_API_KEY,
        baseURL: process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1',
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      },
    },
  },
  search: {
    enabled: process.env.SEARCH_ENABLED === 'true',
    provider: process.env.SEARCH_PROVIDER || 'duckduckgo',
  },
}
