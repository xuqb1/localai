import vectorDb from '../repositories/vectorDb.js'
import { DocumentParser } from './documentParser.js'
import { DocumentRepository } from '../repositories/index.js'
import path from 'path'

export class RAGService {
  constructor() {
    this.documentParser = new DocumentParser()
    this.documentRepository = new DocumentRepository()
  }

  async retrieveKnowledge(query, topK = 5) {
    const results = await vectorDb.similaritySearch(query, topK)
    
    if (results.length === 0) {
      return { hasKnowledge: false, sources: [], context: '' }
    }

    const sources = results.map(result => ({
      id: result.metadata.document_id,
      title: result.metadata.title,
      score: result.score,
    }))

    const context = results.map(result => result.content).join('\n\n---\n\n')

    return {
      hasKnowledge: true,
      sources,
      context,
    }
  }

  async addDocument(filePath) {
    const existingDoc = this.documentRepository.findByFilePath(filePath)
    if (existingDoc) {
      await vectorDb.deleteByDocumentId(existingDoc.id)
    }

    const parsed = await this.documentParser.parseFile(filePath)
    const chunks = this.documentParser.splitText(parsed.content)

    let doc
    if (existingDoc) {
      doc = existingDoc
      this.documentRepository.update(doc.id, {
        title: parsed.title,
        content: parsed.content,
        metadata: { filePath, fileType: parsed.fileType },
      })
    } else {
      doc = this.documentRepository.create({
        title: parsed.title,
        filePath,
        fileType: parsed.fileType,
        content: parsed.content,
        chunkCount: chunks.length,
        metadata: { filePath, fileType: parsed.fileType },
      })
    }

    const count = await vectorDb.addDocuments(
      doc.id,
      parsed.title,
      chunks,
      { filePath, fileType: parsed.fileType }
    )

    this.documentRepository.updateChunkCount(doc.id, count)

    return {
      ...doc,
      chunkCount: count,
    }
  }

  async addCsvDocumentByLines(filePath) {
    const existingDoc = this.documentRepository.findByFilePath(filePath)
    if (existingDoc) {
      await vectorDb.deleteByDocumentId(existingDoc.id)
    }

    const ext = path.extname(filePath).toLowerCase()
    const title = path.basename(filePath, ext)

    let doc
    if (existingDoc) {
      doc = existingDoc
      this.documentRepository.update(doc.id, {
        title,
        content: `CSV文件: ${title}`,
        metadata: { filePath, fileType: 'csv' },
      })
    } else {
      doc = this.documentRepository.create({
        title,
        filePath,
        fileType: 'csv',
        content: `CSV文件: ${title}`,
        chunkCount: 0,
        metadata: { filePath, fileType: 'csv' },
      })
    }

    const readline = await import('readline')
    const fs = await import('fs')
    
    let count = 0
    let lineNum = 0
    let headers = []
    
    const rl = readline.createInterface({
      input: fs.default.createReadStream(filePath),
      crlfDelay: Infinity,
    })
    
    for await (const line of rl) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue
      
      const parts = this.parseCsvLine(trimmedLine)
      
      if (lineNum === 0) {
        headers = parts
      } else {
        const lineText = parts.join(' ')
        if (lineText && lineText.trim().length > 0) {
          await vectorDb.addDocuments(
            doc.id,
            title,
            [lineText],
            { filePath, fileType: 'csv', lineIndex: lineNum }
          )
          count++
        }
      }
      lineNum++
    }

    this.documentRepository.updateChunkCount(doc.id, count)

    return {
      ...doc,
      chunkCount: count,
    }
  }

  parseCsvLine(line) {
    const result = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    result.push(current)
    
    return result
  }

  async addTextDocument(title, content) {
    const doc = this.documentRepository.create({
      title,
      content,
      chunkCount: 0,
      metadata: {},
    })

    const chunks = this.documentParser.splitText(content)
    const count = await vectorDb.addDocuments(doc.id, title, chunks, {})
    this.documentRepository.updateChunkCount(doc.id, count)

    return { ...doc, chunkCount: count }
  }

  async deleteDocument(docId) {
    await vectorDb.deleteByDocumentId(docId)
    await this.documentRepository.delete(docId)
  }

  async updateDocument(docId, updates) {
    const doc = this.documentRepository.findById(docId)
    if (!doc) {
      throw new Error('文档不存在')
    }

    const newContent = updates.content || doc.content
    const chunks = this.documentParser.splitText(newContent)

    await vectorDb.deleteByDocumentId(docId)
    const count = await vectorDb.addDocuments(docId, updates.title || doc.title, chunks, {})

    this.documentRepository.update(docId, {
      title: updates.title || doc.title,
      content: newContent,
      metadata: doc.metadata,
    })
    this.documentRepository.updateChunkCount(docId, count)

    return { ...doc, title: updates.title || doc.title, content: newContent, chunkCount: count }
  }
}
