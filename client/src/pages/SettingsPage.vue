<script setup>
import { useSettingsStore } from '../stores/settingsStore'
import { onMounted, ref } from 'vue'
import { Eye, EyeOff, Save } from '@lucide/vue'
import MessageModel from 'E:/codeseq/vue3_components/MessageModel.vue'

const settingsStore = useSettingsStore()
const showAgnesKey = ref(false)
const showDeepseekKey = ref(false)
const localSettings = ref({})
const messageType = ref('success')
const messageContent = ref('')
const showMessage = ref(false)

onMounted(async () => {
  await settingsStore.fetchSettings()
  localSettings.value = { ...settingsStore.settings }
})

function showToast(type, content) {
  messageType.value = type
  messageContent.value = content
  showMessage.value = true
}

async function handleSave() {
  try {
    await settingsStore.updateSettings(localSettings.value)
    showToast('success', '设置保存成功！')
  } catch (e) {
    showToast('error', '保存失败：' + e.message)
  }
}
</script>

<template>
  <div class="h-full p-6 overflow-auto">
    <h1 class="text-2xl font-bold text-white mb-6">系统设置</h1>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-slate-800 rounded-xl p-6">
        <h2 class="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <span class="w-2 h-2 bg-cyan-500 rounded-full"></span>
          API 配置
        </h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-2">Agnes API Key</label>
            <div class="relative">
              <input
                :type="showAgnesKey ? 'text' : 'password'"
                v-model="localSettings.agnesApiKey"
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500 pr-12"
                placeholder="输入 Agnes API Key"
              />
              <button 
                @click="showAgnesKey = !showAgnesKey"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <Eye v-if="showAgnesKey" :size="18" />
                <EyeOff v-else :size="18" />
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm text-slate-400 mb-2">DeepSeek API Key</label>
            <div class="relative">
              <input
                :type="showDeepseekKey ? 'text' : 'password'"
                v-model="localSettings.deepseekApiKey"
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500 pr-12"
                placeholder="输入 DeepSeek API Key"
              />
              <button 
                @click="showDeepseekKey = !showDeepseekKey"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <Eye v-if="showDeepseekKey" :size="18" />
                <EyeOff v-else :size="18" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6">
        <h2 class="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <span class="w-2 h-2 bg-green-500 rounded-full"></span>
          模型配置
        </h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-2">默认模型</label>
            <select 
              v-model="localSettings.defaultModel"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="agnes">Agnes</option>
            </select>
          </div>

          <div>
            <label class="block text-sm text-slate-400 mb-2">
              Temperature: {{ localSettings.temperature }}
            </label>
            <input
              type="range"
              v-model="localSettings.temperature"
              min="0"
              max="2"
              step="0.1"
              class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div class="flex justify-between text-xs text-slate-500 mt-1">
              <span>0 (精确)</span>
              <span>2 (创意)</span>
            </div>
          </div>

          <div>
            <label class="block text-sm text-slate-400 mb-2">Max Tokens</label>
            <input
              type="number"
              v-model="localSettings.maxTokens"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500"
              min="1024"
              max="32768"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 flex justify-end">
      <button 
        @click="handleSave"
        class="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-gray-800 rounded-lg transition-all"
      >
        <Save :size="18" />
        保存设置
      </button>
    </div>

    <MessageModel
      v-if="showMessage"
      :type="messageType"
      :content="messageContent"
      @close="showMessage = false"
    />
  </div>
</template>
