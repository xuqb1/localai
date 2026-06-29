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
    },
  },
  embedding: {
    model: process.env.EMBEDDING_MODEL || 'all-MiniLM-L6-v2',
  },
  llm: {
    providers: {
      agnes: {
        apiKey: process.env.AGNES_API_KEY,
        baseURL: process.env.AGNES_BASE_URL || 'https://api.agnes.cn/v1',
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
