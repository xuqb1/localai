<script setup>
import { Send, Loader2 } from '@lucide/vue'
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['send'])

const inputValue = ref('')
const textareaRef = ref(null)

function handleSend() {
  if (inputValue.value.trim() && !props.disabled) {
    emit('send', inputValue.value.trim())
    inputValue.value = ''
    nextTick(() => {
      if (textareaRef.value) {
        textareaRef.value.style.height = 'auto'
      }
    })
  }
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function adjustHeight() {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 400) + 'px'
  }
}

watch(inputValue, adjustHeight)
</script>

<template>
  <div class="px-4 py-4 border-t border-slate-700 bg-slate-900 h-full flex flex-col">
    <div class="bg-slate-800 rounded-2xl p-4 flex-1 flex flex-col">
      <textarea
        ref="textareaRef"
        v-model="inputValue"
        @keydown="handleKeydown"
        @input="adjustHeight"
        :disabled="disabled || isLoading"
        placeholder="输入您的问题..."
        class="w-full bg-transparent text-slate-200 placeholder-slate-500 resize-none outline-none min-h-[60px] flex-1"
        rows="3"
        style="height: auto; min-height: 60px;"
      />
      
      <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
        <span class="text-xs text-slate-500">按 Enter 发送，Shift+Enter 换行</span>
        
        <button
          @click="handleSend"
          :disabled="!inputValue.trim() || disabled || isLoading"
          class="flex items-center gap-2 px-6 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-all"
        >
          <Loader2 v-if="isLoading" :size="18" class="animate-spin" />
          <Send v-else :size="18" />
          <span>{{ isLoading ? '发送中...' : '发送' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
