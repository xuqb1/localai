import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import mammoth from 'mammoth'
import { parseDocument } from 'htmlparser2'
import iconv from 'iconv-lite'

export class DocumentParser {
  async parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    
    switch (ext) {
      case '.txt':
        return await this.parseTxt(filePath)
      case '.docx':
        return await this.parseDocx(filePath)
      case '.html':
        return await this.parseHtml(filePath)
      case '.csv':
        return await this.parseCsv(filePath)
      default:
        throw new Error(`不支持的文件类型: ${ext}`)
    }
  }

  async readFileWithEncoding(filePath) {
    const raw = await fs.promises.readFile(filePath)
    
    if (iconv.decode(raw, 'utf-8').includes('\uFFFD')) {
      if (iconv.decode(raw, 'gbk').includes('\uFFFD')) {
        return iconv.decode(raw, 'gb2312')
      }
      return iconv.decode(raw, 'gbk')
    }
    return iconv.decode(raw, 'utf-8')
  }

  async parseTxt(filePath) {
    const content = await this.readFileWithEncoding(filePath)
    return {
      content,
      title: path.basename(filePath, '.txt'),
      fileType: 'txt',
    }
  }

  async parseDocx(filePath) {
    const result = await mammoth.extractRawText({ path: filePath })
    return {
      content: result.value,
      title: path.basename(filePath, '.docx'),
      fileType: 'docx',
    }
  }

  async parseHtml(filePath) {
    const html = await this.readFileWithEncoding(filePath)
    let textContent = ''
    
    parseDocument(html, {
      ontext(text) {
        textContent += text + ' '
      },
    })
    
    return {
      content: textContent.trim(),
      title: path.basename(filePath, '.html'),
      fileType: 'html',
    }
  }

  async parseCsv(filePath) {
    const readline = await import('readline')
    const fs = await import('fs')
    
    const records = []
    let headers = []
    let textContent = ''
    let lineCount = 0
    
    const rl = readline.createInterface({
      input: fs.default.createReadStream(filePath),
      crlfDelay: Infinity,
    })
    
    for await (const line of rl) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue
      
      const parts = this.parseCsvLine(trimmedLine)
      
      if (lineCount === 0) {
        headers = parts
      } else {
        const record = {}
        parts.forEach((value, idx) => {
          record[headers[idx] || `column_${idx}`] = value
        })
        records.push(record)
        
        const lineText = parts.join(' ')
        textContent += lineText + '\n\n'
      }
      lineCount++
    }
    
    return {
      content: textContent.trim(),
      title: path.basename(filePath, '.csv'),
      fileType: 'csv',
      rawData: records,
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

  splitText(content, chunkSize = 500, chunkOverlap = 50) {
    if (!content || typeof content !== 'string') {
      return []
    }
    
    const chunks = []
    let start = 0
    const length = content.length
    
    if (length === 0) {
      return []
    }
    
    while (start < length) {
      let end = Math.min(start + chunkSize, length)
      
      if (end < length) {
        const lastPeriod = content.lastIndexOf('.', end)
        const lastNewline = content.lastIndexOf('\n', end)
        const splitPoint = Math.max(lastPeriod, lastNewline)
        
        if (splitPoint > start + chunkOverlap) {
          end = splitPoint + 1
        }
      }
      
      const chunk = content.slice(start, end).trim()
      if (chunk.length > 0) {
        chunks.push(chunk)
      }
      
      const nextStart = end - chunkOverlap
      if (nextStart <= start) {
        start++
      } else {
        start = nextStart
      }
    }
    
    return chunks.filter(chunk => chunk.length > 10)
  }
}