import config from '../config/index.js'

/**
 * 语义嵌入服务
 * 优先使用 @xenova/transformers 本地模型，失败时回退到哈希编码
 */
class EmbeddingService {
  constructor() {
    this.dimensions = 384
    this.model = null
    this.modelName = config.embedding?.model || 'Xenova/all-MiniLM-L6-v2'
    this.modelLoaded = false
    this.modelLoading = false
    this.loadPromise = null
    this.useHashFallback = process.env.EMBEDDING_FALLBACK === 'hash'
  }

  async loadModel() {
    if (this.modelLoaded) return true
    if (this.modelLoading && this.loadPromise) return this.loadPromise

    this.modelLoading = true
    this.loadPromise = this._doLoad()
    
    try {
      const result = await this.loadPromise
      return result
    } finally {
      this.modelLoading = false
    }
  }

  async _doLoad() {
    try {
      const { pipeline } = await import('@xenova/transformers')
      console.log(`正在加载嵌入模型: ${this.modelName}...`)
      
      this.model = await pipeline('feature-extraction', this.modelName, {
        quantized: true,
      })
      
      this.modelLoaded = true
      console.log(`嵌入模型加载成功: ${this.modelName}`)
      return true
    } catch (e) {
      console.warn(`嵌入模型加载失败 (${e.message})，回退到哈希编码。可通过 EMBEDDING_FALLBACK=hash 跳过模型加载。`)
      this.useHashFallback = true
      this.modelLoaded = false
      return false
    }
  }

  async encode(text) {
    if (!text || typeof text !== 'string' || text.length === 0) {
      return new Array(this.dimensions).fill(0.5)
    }

    if (this.useHashFallback || !this.modelLoaded) {
      return this._hashEncode(text)
    }

    try {
      const output = await this.model(text, {
        pooling: 'mean',
        normalize: true,
      })
      return Array.from(output.data)
    } catch (e) {
      console.warn(`语义编码失败 (${e.message})，本次使用哈希回退`)
      return this._hashEncode(text)
    }
  }

  encodeBatch(texts) {
    return Promise.all(texts.map(t => this.encode(t)))
  }

  _hashEncode(text) {
    const chars = text.split('')
    const embedding = new Array(this.dimensions).fill(0)

    for (let i = 0; i < chars.length; i++) {
      const charCode = chars[i].charCodeAt(0)
      const dimIndex = i % this.dimensions
      const prime = this._getPrime(dimIndex + 1)
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
      if (isNaN(embedding[i]) || !isFinite(embedding[i])) {
        embedding[i] = 0.5
      }
    }

    return embedding
  }

  _getPrime(n) {
    const primes = [
      2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
      73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151,
      157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233,
      239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317,
      331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419,
      421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503,
      509, 521, 523, 541,
    ]
    return primes[n % primes.length]
  }
}

const embeddingService = new EmbeddingService()
export { EmbeddingService, embeddingService }
export default embeddingService
