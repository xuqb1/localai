import axios from 'axios'
import config from '../config/index.js'

export class LLMService {
  constructor() {
    this.providers = {
      agnes: {
        apiKey: config.llm.providers.agnes.apiKey,
        baseURL: config.llm.providers.agnes.baseURL,
        model: 'agnes-3.5-turbo',
      },
      deepseek: {
        apiKey: config.llm.providers.deepseek.apiKey,
        baseURL: config.llm.providers.deepseek.baseURL,
        model: 'deepseek-chat',
      },
    }
  }

  getProvider(model, settings = null) {
    let provider = null
    let providerType = model
    
    if (this.providers[model]) {
      provider = { ...this.providers[model] }
    } else if (settings && settings.customProviders) {
      const customProvider = settings.customProviders.find(p => p.name === model)
      if (customProvider) {
        provider = {
          apiKey: customProvider.apiKey,
          baseURL: customProvider.apiUrl,
          model: customProvider.model,
        }
        return provider
      }
    }
    
    if (!provider && settings && settings.defaultModel) {
      providerType = settings.defaultModel
      if (this.providers[providerType]) {
        provider = { ...this.providers[providerType] }
      } else if (settings.customProviders) {
        const customProvider = settings.customProviders.find(p => p.name === providerType)
        if (customProvider) {
          provider = {
            apiKey: customProvider.apiKey,
            baseURL: customProvider.apiUrl,
            model: customProvider.model,
          }
          return provider
        }
      }
    }
    
    if (provider && settings) {
      if (providerType === 'agnes') {
        provider.apiKey = settings.agnesApiKey || provider.apiKey
        provider.baseURL = settings.agnesApiUrl || provider.baseURL
        provider.model = settings.agnesModel || provider.model
      } else if (providerType === 'deepseek') {
        provider.apiKey = settings.deepseekApiKey || provider.apiKey
        provider.baseURL = settings.deepseekApiUrl || provider.baseURL
        provider.model = settings.deepseekModel || provider.model
      }
    }
    
    return provider
  }

  async generateResponse(prompt, options = {}) {
    const { 
      model = 'deepseek', 
      temperature = 0.7, 
      maxTokens = 4096, 
      streaming = true, 
      settings = null,
      timeout = 120000, // 默认120秒，可配置
      maxRetries = 3, // 增加重试次数
      conversationHistory = [], // 对话历史上下文
    } = options
    
    const provider = this.getProvider(model, settings)

    if (!provider || !provider.apiKey) {
      throw new Error(`模型 ${model} 的 API Key 未配置`)
    }

    // 构建消息列表：系统提示 + 历史对话 + 当前问题
    const messages = [
      { role: 'system', content: `你是 LocalAI，一个专业的AI助手，基于 ${provider.model} 模型运行。
你拥有广泛的知识和强大的推理能力。你的回答应该：
1. 优先使用提供的参考信息（如果相关）
2. 结合你自身的知识来补充和扩展
3. 如果参考信息不完整或没有相关信息，请自由使用你的知识来回答
4. 回答要自然、友好、详细，每次尽量提供丰富有用的内容
5. 不要提及"根据参考信息"、"根据提供的内容"等字眼
6. 将知识库信息和你的知识自然融合，让用户感觉是一个完整的回答
7. 当用户询问你的身份或模型时，诚实地告诉用户你是基于 ${provider.model} 模型的AI助手`   
      },
      ...conversationHistory,
      { role: 'user', content: prompt },
    ]

    // 优化：构建更精简的请求体
    const requestBody = {
      model: provider.model,
      messages,
      temperature,
      stream: streaming,
    }
    
    // 优化：限制max_tokens，避免生成过长内容
    if (maxTokens && maxTokens > 0) {
      const maxAllowedTokens = model === 'deepseek' ? 65536 : 4096
      // 对于deepseek，默认使用较小的值，加快响应速度
      const defaultMaxTokens = model === 'deepseek' ? 2048 : 4096
      requestBody.max_tokens = Math.min(maxTokens || defaultMaxTokens, maxAllowedTokens)
    }

    let lastError = null
    
    // 优化：使用指数退避重试策略
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 每次重试增加超时时间
        const currentTimeout = timeout + (attempt * 30000) // 120s, 150s, 180s, 210s
        
        const axiosConfig = {
          headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: streaming ? 'stream' : 'json',
          timeout: streaming ? 0 : currentTimeout,  // 流式请求不限时，避免长文本被掐断
          // 优化：增加这些配置提高稳定性
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }

        const response = await axios.post(
          `${provider.baseURL}/chat/completions`,
          requestBody,
          axiosConfig
        )
        return response
        
      } catch (e) {
        lastError = e
        
        // 详细的错误日志
        const errorInfo = {
          attempt: attempt + 1,
          totalAttempts: maxRetries + 1,
          message: e.message,
          code: e.code,
          status: e.response?.status
        }
        console.error(`LLM请求失败 (尝试 ${errorInfo.attempt}/${errorInfo.totalAttempts}):`, errorInfo)
        
        if (e.response) {
          console.error('状态码:', e.response.status)
          try {
            if (typeof e.response.data === 'string') {
              console.error('错误响应:', e.response.data)
            } else if (Buffer.isBuffer(e.response.data)) {
              console.error('错误响应:', e.response.data.toString('utf-8'))
            } else {
              console.error('错误响应:', JSON.stringify(e.response.data))
            }
          } catch (jsonErr) {
            console.error('错误响应解析失败')
          }
        } else if (e.code) {
          console.error('错误码:', e.code)
        }
        
        // 判断是否应该重试
        if (attempt < maxRetries) {
          // 对于超时错误，等待更长时间再重试
          const isTimeout = e.code === 'ECONNABORTED' || e.message.includes('timeout')
          const waitTime = isTimeout ? 5000 * (attempt + 1) : 2000 * (attempt + 1)
          
          console.log(`等待 ${waitTime}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          
          // 如果是非流式请求，不需要重试流式相关的错误
          if (!streaming && e.response?.status === 429) {
            console.log('遇到速率限制，等待更长时间...')
            await new Promise(resolve => setTimeout(resolve, 10000 * (attempt + 1)))
          }
        }
      }
    }

    // 所有重试都失败后的错误处理
    if (lastError) {
      console.error('所有重试均失败，最终错误:', lastError.message)
      
      // 针对不同的错误类型提供更友好的错误信息
      if (lastError.code === 'ECONNABORTED') {
        throw new Error(`请求超时（${timeout}ms），模型响应时间过长。请尝试简化问题或稍后再试。`)
      } else if (lastError.code === 'ECONNRESET') {
        throw new Error('网络连接被重置，请检查网络连接或尝试切换模型')
      } else if (lastError.code === 'ENOTFOUND') {
        throw new Error('无法连接到API服务器，请检查网络设置')
      } else if (lastError.response?.status === 401) {
        throw new Error('API密钥无效或已过期，请检查配置')
      } else if (lastError.response?.status === 429) {
        throw new Error('API请求频率过高，请稍后再试')
      } else if (lastError.response?.status === 500) {
        throw new Error('服务器内部错误，请稍后再试')
      }
      
      throw lastError
    }
    
    throw new Error('未知错误：所有请求尝试都失败了')
  }

  // 新增：非流式文本生成（更稳定）
  async generateText(prompt, options = {}) {
    const { 
      model = 'deepseek', 
      temperature = 0.7, 
      maxTokens = 4096,
      timeout = 120000, // 2分钟超时
      settings = null
    } = options
    
    const provider = this.getProvider(model, settings)

    if (!provider || !provider.apiKey) {
      throw new Error(`模型 ${model} 的 API Key 未配置`)
    }

    const messages = [
      { role: 'system', content: `你是 LocalAI，一个专业的AI助手，基于 ${provider.model} 模型运行。
你拥有广泛的知识和强大的推理能力。你的回答应该：
1. 优先使用提供的参考信息（如果相关）
2. 结合你自身的知识来补充和扩展
3. 如果参考信息不完整或没有相关信息，请自由使用你的知识来回答
4. 回答要自然、友好、详细
5. 不要提及"根据参考信息"、"根据提供的内容"等字眼
6. 将知识库信息和你的知识自然融合，让用户感觉是一个完整的回答
7. 当用户询问你的身份或模型时，诚实地告诉用户你是基于 ${provider.model} 模型的AI助手`  
      },
      { role: 'user', content: prompt },
    ]

    try {
      const response = await axios.post(
        `${provider.baseURL}/chat/completions`,
        {
          model: provider.model,
          messages,
          temperature,
          max_tokens: Math.min(maxTokens, 4096), // 限制最大token数
          stream: false,
        },
        {
          headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: timeout,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      )

      if (!response.data || !response.data.choices || !response.data.choices[0]) {
        throw new Error('API响应格式错误')
      }

      return response.data.choices[0].message.content
    } catch (error) {
      console.error('生成文本失败:', error.message)
      if (error.code === 'ECONNABORTED') {
        throw new Error(`请求超时（${timeout}ms），请尝试简化问题或稍后再试`)
      }
      throw error
    }
  }

  // 新增：智能选择生成方式（自动降级）
  async generateWithFallback(prompt, options = {}) {
    const { streaming = true, ...restOptions } = options
    
    try {
      // 如果prompt太长，自动使用非流式
      const promptLength = prompt.length
      if (promptLength > 5000) {
        console.log(`Prompt过长（${promptLength}字符），使用非流式模式`)
        return await this.generateText(prompt, { ...restOptions, streaming: false })
      }
      
      // 尝试流式响应
      return await this.generateResponse(prompt, { ...restOptions, streaming })
    } catch (error) {
      // 如果流式失败，尝试非流式
      if (streaming && error.message.includes('timeout')) {
        console.log('流式响应超时，尝试使用非流式模式...')
        try {
          return await this.generateText(prompt, restOptions)
        } catch (fallbackError) {
          console.error('非流式模式也失败:', fallbackError.message)
          throw fallbackError
        }
      }
      throw error
    }
  }
}