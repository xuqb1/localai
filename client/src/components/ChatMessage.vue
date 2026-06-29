<script setup>
import { 
  Copy, Check, User, Bot, 
  Sparkles, Database, Globe, 
  Layers, Library, Search, 
  AlertCircle, Cpu, Network,
  BookOpen, Zap
} from '@lucide/vue'
import { ref, defineProps, computed } from 'vue'
import { marked } from 'marked'

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
  return marked(props.message.content || '')
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

// 🎯 使用纯 Lucide 图标（不含 Unicode 表情）
const sourceInfo = computed(() => {
  const type = props.message.sourceType || 'llm'
  
  const configs = {
    'local': {
      label: '知识库',  // ✅ 移除 📚
      icon: Database,
      iconColor: 'text-green-400',
      class: 'bg-green-500/20 text-green-400 border-green-500/30'
    },
    'web': {
      label: '网络搜索',  // ✅ 移除 🌐
      icon: Globe,
      iconColor: 'text-blue-400',
      class: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    },
    'llm': {
      label: '大模型',  // ✅ 移除 🤖
      icon: Bot,
      iconColor: 'text-purple-400',
      class: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    },
    'hybrid': {
      label: '混合模式',  // ✅ 移除 📚 + 🤖
      icon: Layers,
      iconColor: 'text-amber-400',
      class: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    },
    'error': {
      label: '错误',
      icon: AlertCircle,
      iconColor: 'text-red-400',
      class: 'bg-red-500/20 text-red-400 border-red-500/30'
    }
  }
  
  return configs[type] || configs['llm']
})

// 🎯 其他辅助图标配置
const iconConfigs = {
  'reference': {
    icon: BookOpen,
    label: '参考来源'
  },
  'sources': {
    icon: Library,
    label: '来源'
  },
  'copy': {
    icon: Copy,
    label: '复制'
  },
  'copied': {
    icon: Check,
    label: '已复制'
  },
  'streaming': {
    icon: Zap,
    label: '生成中'
  }
}

// 🎯 去重 sources
const uniqueSources = computed(() => {
  if (!props.message.sources || props.message.sources.length === 0) return []
  
  const map = new Map()
  props.message.sources.forEach(s => {
    const key = s.id || s.title
    if (!map.has(key) || (s.score || 0) > (map.get(key)?.score || 0)) {
      map.set(key, s)
    }
  })
  return Array.from(map.values())
})

function copyContent() {
  navigator.clipboard.writeText(props.message.content)
  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
  }, 2000)
}
</script>

<template>
  <div 
    class="flex gap-3 max-w-4xl mx-auto animate-fadeIn"
    :class="message.role === 'user' ? 'flex-row-reverse' : ''"
  >
    <!-- 头像 bg-cyan-500 text-gray-800-->
    <div 
      class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
      :class="message.role === 'user' ? 'bg-gradient-to-br from-slate-400 to-slate-800 text-slate-200' : 'bg-gradient-to-br from-slate-500 to-slate-800 text-gray-200'"
    >
      <User v-if="message.role === 'user'" :size="20" />
      <Bot v-else :size="20" />
    </div>
    
    <!-- 消息内容 -->
    <div class="flex-1 max-w-[80%]">
      <div 
        class="rounded-2xl p-4 shadow-lg"
        :class="[
          message.role === 'user' 
            ? 'bg-slate-600 text-slate-200 rounded-bl-md' 
            : 'bg-slate-800 text-slate-200 rounded-bl-md'
        ]"
      >
        <!-- 用户消息 bg-cyan-500 text-gray-800 rounded-br-md-->
        <p v-if="message.role === 'user'" class="whitespace-pre-wrap break-words">{{ message.content }}</p>
        
        <!-- AI 消息 -->
        <div v-else>
          <div v-html="renderedContent" class="prose prose-sm prose-invert max-w-none"></div>
          
          <!-- 🎯 来源标签（纯图标） -->
          <div v-if="message.role === 'assistant'" class="mt-3 flex flex-wrap items-center gap-2">
            <!-- 主来源标签 -->
            <span 
              class="text-xs px-2 py-1 rounded-full border inline-flex items-center gap-1.5"
              :class="sourceInfo.class"
            >
              <component 
                :is="sourceInfo.icon" 
                v-if="sourceInfo.icon" 
                :size="12" 
                :class="sourceInfo.iconColor"
              />
              {{ sourceInfo.label }}
            </span>
            
            <!-- 参考来源数量标签 -->
            <span 
              v-if="message.sources && message.sources.length > 0"
              class="text-xs px-2 py-1 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600 inline-flex items-center gap-1.5"
            >
              <BookOpen :size="12" class="text-slate-400" />
              {{ uniqueSources.length }} 个来源
            </span>
            
            <!-- 流式状态指示器 -->
            <span 
              v-if="message.status === 'streaming'"
              class="text-xs px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 inline-flex items-center gap-1.5 animate-pulse"
            >
              <Zap :size="12" class="text-cyan-400" />
              生成中...
            </span>
          </div>
        </div>
      </div>
      
      <!-- 🎯 参考来源详情（折叠显示） -->
      <div v-if="message.role === 'assistant' && uniqueSources.length > 0" class="mt-2">
        <details class="text-xs text-slate-400">
          <summary class="cursor-pointer hover:text-slate-300 transition-colors inline-flex items-center gap-1.5">
            <Library :size="14" class="text-slate-400" />
            查看参考来源 ({{ uniqueSources.length }})
          </summary>
          <div class="mt-2 space-y-1 bg-slate-800/50 rounded-lg p-2">
            <div 
              v-for="source in uniqueSources.slice(0, 5)" 
              :key="source.id || source.title"
              class="flex items-center justify-between text-slate-300 hover:bg-slate-700/50 rounded px-2 py-1"
            >
              <span class="flex-1 truncate mr-2 inline-flex items-center gap-1.5">
                <BookOpen :size="10" class="text-slate-500 flex-shrink-0" />
                {{ source.title || source.id || '未知来源' }}
              </span>
              <span v-if="source.score" class="text-slate-500 text-xs flex-shrink-0">
                相关度: {{ (source.score * 100).toFixed(0) }}%
              </span>
            </div>
            <div v-if="uniqueSources.length > 5" class="text-center text-slate-500 text-xs">
              还有 {{ uniqueSources.length - 5 }} 个来源
            </div>
          </div>
        </details>
      </div>
      
      <!-- 操作按钮和时间 -->
      <div class="flex items-center gap-2 mt-2" :class="message.role === 'user' ? 'justify-end' : ''">
        <button 
          @click="copyContent"
          class="p-1 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
          :title="isCopied ? '已复制' : '复制'"
        >
          <Check v-if="isCopied" :size="14" class="text-green-400" />
          <Copy v-else :size="14" />
        </button>
        <span class="text-xs text-slate-500">
          {{ formattedTime }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}

/* Markdown 样式 */
.prose {
  max-width: 100%;
}

.prose :deep(p) {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.prose :deep(ul), 
.prose :deep(ol) {
  padding-left: 1.5em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.prose :deep(li) {
  margin-top: 0.2em;
  margin-bottom: 0.2em;
}

.prose :deep(code) {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 0.2em 0.4em;
  border-radius: 0.25em;
  font-size: 0.9em;
}

.prose :deep(pre) {
  background-color: rgba(0, 0, 0, 0.3);
  padding: 1em;
  border-radius: 0.5em;
  overflow-x: auto;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.prose :deep(pre code) {
  background-color: transparent;
  padding: 0;
  font-size: 0.9em;
}

.prose :deep(blockquote) {
  border-left: 3px solid rgba(6, 182, 212, 0.5);
  padding-left: 1em;
  margin-left: 0;
  color: #94a3b8;
}

.prose :deep(a) {
  color: #22d3ee;
  text-decoration: none;
}

.prose :deep(a:hover) {
  text-decoration: underline;
}

.prose :deep(strong) {
  color: #e2e8f0;
}

.prose :deep(h1), 
.prose :deep(h2), 
.prose :deep(h3), 
.prose :deep(h4) {
  color: #e2e8f0;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.prose :deep(h1) { font-size: 1.5em; }
.prose :deep(h2) { font-size: 1.3em; }
.prose :deep(h3) { font-size: 1.1em; }
.prose :deep(h4) { font-size: 1em; }

.prose :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.prose :deep(th),
.prose :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.5em;
  text-align: left;
}

.prose :deep(th) {
  background-color: rgba(255, 255, 255, 0.05);
}

/* 滚动条美化 */
.prose :deep(pre::-webkit-scrollbar) {
  height: 6px;
}

.prose :deep(pre::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.prose :deep(pre::-webkit-scrollbar-thumb) {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.prose :deep(pre::-webkit-scrollbar-thumb:hover) {
  background: rgba(255, 255, 255, 0.3);
}
</style>