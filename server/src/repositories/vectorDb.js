import config from '../config/index.js'
import fs from 'fs/promises'
import path from 'path'

class VectorRepository {
  constructor() {
    this.dimensions = 384
    this.dbType = config.database.vector.type || 'hnswlib'
    this.dbPath = config.database.vector.path
    this.maxElements = parseInt(process.env.VECTOR_DB_MAX_ELEMENTS) || 5000000
    this.collectionName = config.database.qdrant?.collectionName || 'localai_documents'
    
    this.index = null
    this.documents = new Map()
    this.embeddingIndexMap = new Map()
    this.client = null
    
    this.isBatchMode = false
    this.batchPoints = []
    
    this.lastSaveTime = 0
    this.saveInterval = 5000
    
    this.pointIdCounter = 0
    
    this.batchSize = 500
    this.batchDelay = 100
  }

  async init() {
    try {
      await fs.mkdir(this.dbPath, { recursive: true })
      
      if (this.dbType === 'qdrant') {
        await this.initQdrant()
      } else {
        await this.initHnswlib()
      }
    } catch (e) {
      console.warn(`向量数据库初始化失败 (${this.dbType}):`, e.message)
      console.warn('将回退到 hnswlib-node')
      this.dbType = 'hnswlib'
      await this.initHnswlib()
    }
  }

  async initQdrant() {
    try {
      const { QdrantClient } = await import('@qdrant/qdrant-js')
      
      this.client = new QdrantClient({
        host: config.database.qdrant?.host || 'localhost',
        port: parseInt(config.database.qdrant?.port) || 6333,
        apiKey: config.database.qdrant?.apiKey || undefined,
        checkCompatibility: false,
      })

      const collections = await this.client.getCollections()
      const exists = collections.collections.some(c => c.name === this.collectionName)

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.dimensions,
            distance: 'Cosine',
          },
          hnsw_config: {
            m: 8,
            ef_construct: 64,
            full_scan_threshold: 10000,
          },
          payload_schema: {
            document_id: { type: 'keyword' },
            title: { type: 'keyword' },
            content: { type: 'text' },
            chunk_index: { type: 'integer' },
            file_path: { type: 'keyword' },
            file_type: { type: 'keyword' },
          },
        })
        console.log(`Qdrant 集合 ${this.collectionName} 创建成功`)
      }

      console.log('向量数据库 (Qdrant) 初始化成功')
    } catch (e) {
      throw new Error(`Qdrant 初始化失败: ${e.message}`)
    }
  }

  async initHnswlib() {
    try {
      const hnswlib = (await import('hnswlib-node')).default
      const { HierarchicalNSW } = hnswlib
      
      this.index = new HierarchicalNSW('cosine', this.dimensions)
      
      const indexPath = path.join(this.dbPath, 'index.bin')
      const docsPath = path.join(this.dbPath, 'documents.json')
      
      if (await this.fileExists(indexPath) && await this.fileExists(docsPath)) {
        try {
          this.index.readIndexSync(indexPath)
          
          const data = await fs.readFile(docsPath, 'utf-8')
          const saved = JSON.parse(data)
          saved.forEach(doc => {
            this.documents.set(doc.id, doc)
            this.embeddingIndexMap.set(doc.embedding_index, doc.id)
          })
        } catch (e) {
          console.warn('读取现有索引失败，将重建:', e.message)
          this.index.initIndex(this.maxElements, 16, 100)
        }
      } else {
        this.index.initIndex(this.maxElements, 16, 100)
      }

      console.log('向量数据库 (hnswlib-node) 初始化成功')
    } catch (e) {
      throw new Error(`hnswlib-node 初始化失败: ${e.message}`)
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  async addDocuments(docId, title, chunks, metadata = {}) {
    if (!this.client && !this.index) {
      await this.init()
    }

    if (this.dbType === 'qdrant' && this.client) {
      return this.addDocumentsQdrant(docId, title, chunks, metadata)
    } else {
      return this.addDocumentsHnswlib(docId, title, chunks, metadata)
    }
  }

  async addDocumentsQdrant(docId, title, chunks, metadata) {
    const points = chunks.map((chunk) => ({
      id: this.pointIdCounter++,
      vector: this.encodeSync(chunk),
      payload: {
        document_id: docId,
        title,
        content: chunk,
        chunk_index: this.pointIdCounter - 1,
        file_path: metadata.filePath || '',
        file_type: metadata.fileType || '',
      },
    }))

    if (this.isBatchMode) {
      this.batchPoints.push(...points)
      if (this.batchPoints.length >= this.batchSize) {
        await this.flushBatchPoints()
        await new Promise(resolve => setTimeout(resolve, this.batchDelay))
      }
    } else {
      await this.upsertPointsHttp(this.batchPoints)
    }

    return chunks.length
  }

  async upsertPointsHttp(points) {
    const http = await import('http')
    const options = {
      hostname: config.database.qdrant?.host || 'localhost',
      port: parseInt(config.database.qdrant?.port) || 6333,
      path: `/collections/${this.collectionName}/points`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify({ wait: true, points })),
      },
    }

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data))
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`))
          }
        })
      })

      req.on('error', reject)
      req.write(JSON.stringify({ wait: true, points }))
      req.end()
    })
  }

  async flushBatchPoints() {
    if (this.batchPoints.length === 0) return

    try {
      await this.upsertPointsHttp(this.batchPoints)
      console.log(`Qdrant upsert: ${this.batchPoints.length} points`)
    } catch (e) {
      console.error(`Qdrant upsert failed:`, e.message)
      
      if (this.batchPoints.length <= 1) {
        throw e
      }

      const half = Math.floor(this.batchPoints.length / 2)
      const firstHalf = this.batchPoints.slice(0, half)
      const secondHalf = this.batchPoints.slice(half)
      
      console.log(`Retrying with smaller batches: ${firstHalf.length} + ${secondHalf.length}`)
      
      await this.upsertPointsHttp(firstHalf)
      console.log(`Qdrant upsert (first half): ${firstHalf.length} points`)
      
      await this.upsertPointsHttp(secondHalf)
      console.log(`Qdrant upsert (second half): ${secondHalf.length} points`)
    }
    
    this.batchPoints = []
  }

  async addDocumentsHnswlib(docId, title, chunks, metadata) {
    const embeddings = chunks.map(chunk => this.encodeSync(chunk))
    
    let count = 0
    for (let i = 0; i < embeddings.length; i++) {
      const embeddingIndex = this.index.addPoint(embeddings[i])
      const doc = {
        id: `${docId}_${i}`,
        document_id: docId,
        title,
        content: chunks[i],
        embedding_index: embeddingIndex,
        chunk_index: i,
        file_path: metadata.filePath || '',
        file_type: metadata.fileType || '',
      }
      this.documents.set(doc.id, doc)
      this.embeddingIndexMap.set(embeddingIndex, doc.id)
      count++
    }
    
    this.scheduleSave()
    return count
  }

  async startBatchMode() {
    this.isBatchMode = true
    this.batchPoints = []
  }

  async endBatchMode() {
    this.isBatchMode = false
    
    if (this.dbType === 'qdrant' && this.client && this.batchPoints.length > 0) {
      await this.flushBatchPoints()
    } else if (this.index) {
      await this.save()
    }
  }

  async addDocumentsBatch(docId, title, chunks, metadata = {}) {
    return this.addDocuments(docId, title, chunks, metadata)
  }

  async similaritySearch(query, topK = 5) {
    if (!this.client && !this.index) {
      await this.init()
    }

    if (this.dbType === 'qdrant' && this.client) {
      return this.similaritySearchQdrant(query, topK)
    } else {
      return this.similaritySearchHnswlib(query, topK)
    }
  }

  async similaritySearchQdrant(query, topK) {
    try {
      const queryVector = this.encodeSync(query)
      const result = await this.client.search(this.collectionName, {
        vector: queryVector,
        limit: topK,
        with_payload: true,
        with_vector: false,
      })

      return result.map(item => ({
        content: item.payload?.content || '',
        score: 1 - (item.score || 0),
        metadata: {
          document_id: item.payload?.document_id || '',
          title: item.payload?.title || '',
          chunk_index: item.payload?.chunk_index || 0,
          file_path: item.payload?.file_path || '',
          file_type: item.payload?.file_type || '',
        },
      }))
    } catch (e) {
      console.error('Qdrant 向量搜索失败:', e)
      return []
    }
  }

  async similaritySearchHnswlib(query, topK) {
    const queryVector = this.encodeSync(query)
    const results = this.index.searchKnn(queryVector, topK)
    
    const docs = []
    for (let i = 0; i < results.neighbors.length; i++) {
      const embeddingIndex = results.neighbors[i]
      const docId = this.embeddingIndexMap.get(embeddingIndex)
      const doc = this.documents.get(docId)
      if (doc) {
        docs.push({
          content: doc.content,
          score: 1 - results.distances[i],
          metadata: {
            document_id: doc.document_id,
            title: doc.title,
            chunk_index: doc.chunk_index,
            file_path: doc.file_path,
            file_type: doc.file_type,
          },
        })
      }
    }
    
    return docs
  }

  async deleteByDocumentId(docId) {
    if (!this.client && !this.index) {
      await this.init()
    }

    if (this.dbType === 'qdrant' && this.client) {
      await this.deleteByDocumentIdQdrant(docId)
    } else {
      await this.deleteByDocumentIdHnswlib(docId)
    }
  }

  async deleteByDocumentIdQdrant(docId) {
    try {
      await this.client.delete(this.collectionName, {
        filter: {
          must: [
            {
              key: 'document_id',
              match: {
                value: docId,
              },
            },
          ],
        },
      })
    } catch (e) {
      console.error('Qdrant 删除文档失败:', e)
    }
  }

  async deleteByDocumentIdHnswlib(docId) {
    const docIdsToDelete = []
    for (const [key, doc] of this.documents) {
      if (doc.document_id === docId) {
        docIdsToDelete.push(key)
      }
    }
    
    for (const key of docIdsToDelete) {
      const doc = this.documents.get(key)
      this.documents.delete(key)
      this.embeddingIndexMap.delete(doc.embedding_index)
    }
    
    await this.save()
  }

  async rebuildIndex() {
    if (this.dbType === 'qdrant') {
      return
    }
    
    const hnswlib = (await import('hnswlib-node')).default
    const HierarchicalNSW = hnswlib.HierarchicalNSW
    const newIndex = new HierarchicalNSW('cosine', this.dimensions)
    newIndex.initIndex(this.maxElements, 16, 100)
    
    const embeddings = []
    const docs = []
    
    for (const doc of this.documents.values()) {
      const content = doc.content || ''
      const embedding = this.encodeSync(content)
      embeddings.push(embedding)
      docs.push(doc)
    }
    
    for (let i = 0; i < embeddings.length; i++) {
      const embeddingIndex = newIndex.addPoint(embeddings[i])
      docs[i].embedding_index = embeddingIndex
      this.embeddingIndexMap.set(embeddingIndex, docs[i].id)
    }
    
    this.index = newIndex
    await this.save()
  }

  async save() {
    if (this.dbType === 'qdrant') {
      return
    }
    
    const now = Date.now()
    if (now - this.lastSaveTime < 1000) {
      return
    }
    
    try {
      const indexPath = path.join(this.dbPath, 'index.bin')
      const docsPath = path.join(this.dbPath, 'documents.json')
      
      this.index.writeIndexSync(indexPath)
      await fs.writeFile(docsPath, JSON.stringify(Array.from(this.documents.values())), 'utf-8')
      this.lastSaveTime = now
    } catch (e) {
      console.error('保存向量数据库失败:', e)
    }
  }

  scheduleSave() {
    if (this.dbType === 'qdrant') {
      return
    }
    
    const now = Date.now()
    if (now - this.lastSaveTime >= this.saveInterval) {
      this.save()
    }
  }

  encodeSync(text) {
    if (!text || typeof text !== 'string' || text.length === 0) {
      return new Array(this.dimensions).fill(0.5)
    }

    const chars = text.split('')
    const embedding = new Array(this.dimensions).fill(0)

    for (let i = 0; i < chars.length; i++) {
      const charCode = chars[i].charCodeAt(0)
      const dimIndex = i % this.dimensions
      const prime = this.getPrime(dimIndex + 1)
      embedding[dimIndex] += (charCode * prime) % 1
    }

    const sum = embedding.reduce((a, b) => a + b, 0)
    if (sum > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        embedding[i] = embedding[i] / sum
      }
    } else {
      for (let i = 0; i < this.dimensions; i++) {
        embedding[i] = 1 / this.dimensions
      }
    }

    for (let i = 0; i < this.dimensions; i++) {
      embedding[i] = isNaN(embedding[i]) || !isFinite(embedding[i]) ? 0.5 : embedding[i]
    }

    return embedding
  }

  getPrime(n) {
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541]
    return primes[n % primes.length]
  }

  async getStats() {
    if (!this.client && !this.index) {
      await this.init()
    }
    
    if (this.dbType === 'qdrant' && this.client) {
      try {
        const info = await this.client.getCollection(this.collectionName)
        return { count: info.points_count || 0 }
      } catch (e) {
        return { count: 0 }
      }
    } else {
      return { count: this.documents.size }
    }
  }

  async getDocumentChunks(docId) {
    if (!this.client && !this.index) {
      await this.init()
    }
    
    if (this.dbType === 'qdrant' && this.client) {
      return this.getDocumentChunksQdrant(docId)
    } else {
      return this.getDocumentChunksHnswlib(docId)
    }
  }

  async getDocumentChunksQdrant(docId) {
    try {
      const result = await this.client.scroll(this.collectionName, {
        scroll_filter: {
          must: [
            {
              key: 'document_id',
              match: {
                value: docId,
              },
            },
          ],
        },
        limit: 10000,
        with_payload: true,
        with_vector: false,
      })

      const chunks = result.points.map(point => ({
        id: point.id.toString(),
        chunkIndex: point.payload?.chunk_index || 0,
        content: point.payload?.content || '',
        embeddingIndex: 0,
      }))

      chunks.sort((a, b) => a.chunkIndex - b.chunkIndex)
      return chunks
    } catch (e) {
      console.error('Qdrant 获取文档分块失败:', e)
      return []
    }
  }

  async getDocumentChunksHnswlib(docId) {
    const chunks = []
    for (const doc of this.documents.values()) {
      if (doc.document_id === docId) {
        chunks.push({
          id: doc.id,
          chunkIndex: doc.chunk_index,
          content: doc.content,
          embeddingIndex: doc.embedding_index,
        })
      }
    }
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex)
    return chunks
  }

  async calculateSimilarity(embedding1, embedding2) {
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      const v1 = embedding1[i] || 0
      const v2 = embedding2[i] || 0
      dotProduct += v1 * v2
      norm1 += v1 * v1
      norm2 += v2 * v2
    }

    norm1 = Math.sqrt(norm1)
    norm2 = Math.sqrt(norm2)

    if (norm1 === 0 || norm2 === 0 || isNaN(norm1) || isNaN(norm2)) {
      return 0
    }

    const result = dotProduct / (norm1 * norm2)
    return isNaN(result) || !isFinite(result) ? 0 : result
  }

  async getChunkSimilarityGraph(docId) {
    const chunks = await this.getDocumentChunks(docId)
    if (chunks.length === 0) {
      return { nodes: [], edges: [] }
    }

    const embeddings = chunks.map(chunk => {
      return this.encodeSync(chunk.content)
    })

    const nodes = chunks.map((chunk, idx) => ({
      id: idx,
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex || 0,
      content: chunk.content.substring(0, 50) + (chunk.content.length > 50 ? '...' : ''),
      fullContent: chunk.content,
    }))

    const edges = []
    const similarityThreshold = 0.5

    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        const similarity = await this.calculateSimilarity(embeddings[i], embeddings[j])
        if (similarity >= similarityThreshold) {
          edges.push({
            source: i,
            target: j,
            similarity: Math.round(similarity * 100) / 100,
          })
        }
      }
    }

    return { nodes, edges }
  }
}

export default new VectorRepository()