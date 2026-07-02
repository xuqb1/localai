<script setup>
import { Copy, Check, User, Bot } from '@lucide/vue'
import { ref, computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps({
  message: {
    type: Object,
    required: true,
  },
})

const isCopied = ref(false)

const renderedContent = computed(() => {
  if (props.message.role === 'user') {
    return props.message.content
  }
  const rawHtml = marked.parse(props.message.content || '', { breaks: true, gfm: true })
  return DOMPurify.sanitize(rawHtml, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img'], ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'] })
})

const formattedTime = computed(() => {
  const dateStr = props.message.createdAt || props.message.created_at
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleTimeString()
  } catch {
    return ''
  }
})

async function copyContent() {
  const text = props.message.content || ''
  if (!text) return

  try {
    await navigator.clipboard.writeText(text)
    isCopied.value = true
    setTimeout(() => { isCopied.value = false }, 2000)
    return
  } catch (e) {
    console.warn('Clipboard API 失败，尝试 fallback:', e)
  }

  // Fallback: 使用 execCommand（兼容 HTTP/非安全上下文）
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    isCopied.value = true
    setTimeout(() => { isCopied.value = false }, 2000)
  } catch {
    // 都失败了
  }
}
</script>

<template>
  <div 
    class="flex gap-3 max-w-4xl mx-auto"
    :class="message.role === 'user' ? 'flex-row-reverse' : ''"
  >
    <div 
      class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
      :class="message.role === 'user' ? 'bg-cyan-500 text-gray-800' : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white'"
    >
      <User v-if="message.role === 'user'" :size="20" />
      <Bot v-else :size="20" />
    </div>
    
    <div class="flex-1 max-w-[80%]">
      <div 
        class="rounded-2xl p-4 shadow-lg"
        :class="[
          message.role === 'user' 
            ? 'bg-slate-600 text-slate-200 rounded-bl-md' 
            : 'bg-slate-800 text-slate-200 rounded-bl-md'
        ]"
      ><!-- bg-cyan-500 text-gray-800 rounded-br-md -->
        <p v-if="message.role === 'user'" class="whitespace-pre-wrap break-words">{{ message.content }}</p>
        <div v-else v-html="renderedContent" class="prose prose-sm prose-invert max-w-none"></div>
        
        <div v-if="message.sourceType && message.role === 'assistant'" class="mt-3 flex items-center gap-2">
          <span 
            class="text-xs px-2 py-1 rounded-full"
            :class="[
              message.sourceType === 'local' ? 'bg-green-500/20 text-green-400' :
              message.sourceType === 'web' ? 'bg-blue-500/20 text-blue-400' :
              'bg-purple-500/20 text-purple-400'
            ]"
          >
            {{ message.sourceType === 'local' ? '本地知识库' : 
               message.sourceType === 'web' ? '网络搜索' : '大模型' }}
          </span>
        </div>
        
        <div v-if="message.sources && message.sources.length > 0" class="mt-2 text-xs text-slate-400">
          <p class="font-medium mb-1">参考来源:</p>
          <ul class="space-y-1">
            <li v-for="source in message.sources.slice(0, 3)" :key="source.id">
              {{ source.title }}
            </li>
          </ul>
        </div>
      </div>
      
      <div class="flex items-center gap-2 mt-2" :class="message.role === 'user' ? 'justify-end' : ''">
        <button 
          @click="copyContent"
          class="p-1 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
        >
          <Check v-if="isCopied" :size="14" />
          <Copy v-else :size="14" />
        </button>
        <span class="text-xs text-slate-500">
          {{ formattedTime }}
        </span>
      </div>
    </div>
  </div>
</template>
