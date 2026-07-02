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
      case '.doc':
        return await this.parseDoc(filePath)
      case '.html':
        return await this.parseHtml(filePath)
      case '.csv':
        return await this.parseCsv(filePath)
      case '.md':
        return await this.parseTextFile(filePath, 'md')
      case '.css':
        return await this.parseTextFile(filePath, 'css')
      case '.js':
        return await this.parseTextFile(filePath, 'js')
      case '.svg':
        return await this.parseTextFile(filePath, 'svg')
      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.gif':
      case '.webp':
      case '.bmp':
        return await this.parseImageFile(filePath)
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

  async parseDoc(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath })
      return {
        content: result.value,
        title: path.basename(filePath, '.doc'),
        fileType: 'doc',
      }
    } catch (e) {
      const content = await this.readFileWithEncoding(filePath)
      return {
        content: content.substring(0, 50000),
        title: path.basename(filePath, '.doc'),
        fileType: 'doc',
      }
    }
  }

  async parseTextFile(filePath, fileType) {
    const content = await this.readFileWithEncoding(filePath)
    const ext = path.extname(filePath).toLowerCase()
    return {
      content,
      title: path.basename(filePath, ext),
      fileType,
    }
  }

  async parseImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    const fileName = path.basename(filePath, ext)
    const fileDir = path.dirname(filePath)
    
    let imageInfo = []
    
    try {
      const fs = await import('fs')
      const stat = await fs.promises.stat(filePath)
      const fileSize = this.formatFileSize(stat.size)
      
      imageInfo.push(`图片文件: ${fileName}${ext}`)
      imageInfo.push(`文件大小: ${fileSize}`)
      imageInfo.push(`文件位置: ${filePath}`)
      imageInfo.push(`所在目录: ${fileDir}`)
      
      const formatMap = {
        '.jpg': 'JPEG 格式',
        '.jpeg': 'JPEG 格式',
        '.png': 'PNG 格式（支持透明背景）',
        '.gif': 'GIF 格式（支持动画）',
        '.webp': 'WebP 格式（现代图片格式，体积小）',
        '.bmp': 'BMP 格式（无损位图）',
      }
      imageInfo.push(`图片格式: ${formatMap[ext] || '未知格式'}`)
      
      try {
        const sizeOf = await import('image-size')
        const dimensions = await sizeOf.default(filePath)
        if (dimensions.width && dimensions.height) {
          imageInfo.push(`图片尺寸: ${dimensions.width} x ${dimensions.height} 像素`)
        }
      } catch (e) {
        imageInfo.push('图片尺寸: 无法获取')
      }
      
      imageInfo.push('描述: 图片文件，用于展示视觉内容')
      imageInfo.push('用途: 网页展示、文档插图、界面图标等')
      
      if (fileName.toLowerCase().includes('icon')) {
        imageInfo.push('推测用途: 图标、Logo')
      } else if (fileName.toLowerCase().includes('banner')) {
        imageInfo.push('推测用途: 横幅、广告图')
      } else if (fileName.toLowerCase().includes('cover')) {
        imageInfo.push('推测用途: 封面图')
      } else if (fileName.toLowerCase().includes('avatar')) {
        imageInfo.push('推测用途: 用户头像')
      } else if (fileName.toLowerCase().includes('bg') || fileName.toLowerCase().includes('background')) {
        imageInfo.push('推测用途: 背景图')
      }
      
    } catch (e) {
      imageInfo.push(`图片文件: ${fileName}${ext}`)
      imageInfo.push(`文件位置: ${filePath}`)
      imageInfo.push(`描述: 图片文件`)
      imageInfo.push('注意: 无法读取文件详细信息')
    }
    
    return {
      content: imageInfo.join('\n'),
      title: fileName,
      fileType: 'image',
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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