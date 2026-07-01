import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { HierarchicalNSW } = require('hnswlib-node')
import fs from 'fs'
import path from 'path'
import config from '../config/index.js'

class VectorRepository {
  constructor() {
    this.dbPath = config.database.vector.path
    this.index = null
    this.documents = new Map()
    this.embeddingIndexMap = new Map()
    this.dimensions = 384
    this.maxElements = 1000000
    this.saveInterval = null
    this.isBatchMode = false
  }

  async init() {
    try {
      await fs.promises.mkdir(this.dbPath, { recursive: true })
      
      this.index = new HierarchicalNSW('cosine', this.dimensions)
      
      const indexPath = path.join(this.dbPath, 'index.bin')
      if (fs.existsSync(indexPath)) {
        this.index.readIndexSync(indexPath)
      } else {
        this.index.initIndex(this.maxElements, 16, 100)
      }

      const docsPath = path.join(this.dbPath, 'documents.json')
      if (fs.existsSync(docsPath)) {
        const data = await fs.promises.readFile(docsPath, 'utf-8')
        const saved = JSON.parse(data)
        saved.forEach(doc => {
          this.documents.set(doc.id, doc)
          this.embeddingIndexMap.set(doc.embedding_index, doc.id)
        })
      }

      console.log('向量数据库 (hnswlib-node) 初始化成功')
    } catch (e) {
      console.warn('向量数据库初始化失败:', e.message)
      console.warn('将使用内存模式，数据不会持久化')
      this.index = new HierarchicalNSW('cosine', this.dimensions)
      this.index.initIndex(this.maxElements, 16, 100)
    }
  }

  async addDocuments(docId, title, chunks, metadata = {}) {
    if (!this.index) {
      await this.init()
    }

    if (!this.index) {
      return 0
    }

    const startIdx = this.documents.size

    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${docId}_${i}`
      const embedding = this.encodeSync(chunks[i])
      
      this.index.addPoint(embedding, startIdx + i)
      
      const docData = {
        id: chunkId,
        document_id: docId,
        title,
        content: chunks[i],
        chunk_index: i,
        file_path: metadata.filePath || '',
        file_type: metadata.fileType || '',
        embedding_index: startIdx + i,
      }
      this.documents.set(chunkId, docData)
      this.embeddingIndexMap.set(startIdx + i, chunkId)
    }

    if (!this.isBatchMode) {
      this.scheduleSave()
    }
    return chunks.length
  }

  async startBatchMode() {
    this.isBatchMode = true
  }

  async endBatchMode() {
    this.isBatchMode = false
    await this.save()
  }

  async addDocumentsBatch(docId, title, chunks, metadata = {}) {
    if (!this.index) {
      await this.init()
    }

    if (!this.index) {
      return 0
    }

    const startIdx = this.documents.size
    const embeddings = []
    
    for (let i = 0; i < chunks.length; i++) {
      embeddings.push(this.encodeSync(chunks[i]))
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${docId}_${startIdx + i}`
      this.index.addPoint(embeddings[i], startIdx + i)
      
      const docData = {
        id: chunkId,
        document_id: docId,
        title,
        content: chunks[i],
        chunk_index: startIdx + i,
        file_path: metadata.filePath || '',
        file_type: metadata.fileType || '',
        embedding_index: startIdx + i,
      }
      this.documents.set(chunkId, docData)
      this.embeddingIndexMap.set(startIdx + i, chunkId)
    }

    if (!this.isBatchMode) {
      this.scheduleSave()
    }
    return chunks.length
  }

  async similaritySearch(query, topK = 5) {
    if (!this.index) {
      await this.init()
    }

    if (!this.index) {
      return []
    }

    try {
      const queryEmbedding = this.encodeSync(query)
      const result = this.index.searchKnn(queryEmbedding, topK)
      
      let indices, distances
      if (Array.isArray(result)) {
        [indices, distances] = result
      } else if (result && result.indices && result.distances) {
        indices = result.indices
        distances = result.distances
      } else if (result && result.neighbors) {
        indices = result.neighbors
        distances = result.distances || []
      } else {
        console.error('searchKnn 返回格式未知:', typeof result)
        return []
      }

      const results = []
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i]
        const chunkId = this.embeddingIndexMap.get(idx)
        if (chunkId) {
          const doc = this.documents.get(chunkId)
          if (doc) {
            results.push({
              content: doc.content,
              score: 1 - (distances[i] || 0),
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
      }

      return results
    } catch (e) {
      console.error('向量搜索失败:', e)
      return []
    }
  }

  async deleteByDocumentId(docId) {
    if (!this.index) {
      await this.init()
    }

    if (!this.index) {
      return
    }

    const toRemove = []
    for (const [id, doc] of this.documents) {
      if (doc.document_id === docId) {
        toRemove.push(id)
      }
    }

    for (const id of toRemove) {
      const doc = this.documents.get(id)
      if (doc) {
        this.embeddingIndexMap.delete(doc.embedding_index)
      }
      this.documents.delete(id)
    }

    await this.rebuildIndex()
    this.scheduleSave()
  }

  async rebuildIndex() {
    const newIndex = new HierarchicalNSW('cosine', this.dimensions)
    newIndex.initIndex(this.maxElements, 16, 100)

    let idx = 0
    this.embeddingIndexMap.clear()
    
    for (const [id, doc] of this.documents) {
      const embedding = this.encodeSync(doc.content)
      newIndex.addPoint(embedding, idx)
      doc.embedding_index = idx
      this.embeddingIndexMap.set(idx, id)
      idx++
    }

    this.index = newIndex
  }

  scheduleSave() {
    if (this.saveInterval) {
      clearTimeout(this.saveInterval)
    }
    this.saveInterval = setTimeout(() => {
      this.save()
    }, 500)
  }

  async save() {
    try {
      const indexPath = path.join(this.dbPath, 'index.bin')
      this.index.writeIndexSync(indexPath)

      const docsPath = path.join(this.dbPath, 'documents.json')
      const data = JSON.stringify(Array.from(this.documents.values()), null, 2)
      await fs.promises.writeFile(docsPath, data, 'utf-8')
    } catch (e) {
      console.warn('保存向量数据库失败:', e.message)
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
    if (!this.index) {
      await this.init()
    }
    return { count: this.documents.size }
  }

  async getDocumentChunks(docId) {
    if (!this.index) {
      await this.init()
    }
    
    const chunks = []
    for (const [id, doc] of this.documents) {
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
    if (!this.index) {
      await this.init()
    }
    
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