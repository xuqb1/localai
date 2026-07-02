<script setup>
import { useSettingsStore } from '../stores/settingsStore'
import { onMounted, ref, computed } from 'vue'
import { Eye, EyeOff, Save, RefreshCw, Plus, Trash2, Edit2 } from '@lucide/vue'
import MessageModel from '../components/common/MessageModel.vue'

const settingsStore = useSettingsStore()
const showAgnesKey = ref(false)
const showDeepseekKey = ref(false)
const showCustomKey = ref(false)
const localSettings = ref({})
const messageType = ref('success')
const messageContent = ref('')
const showMessage = ref(false)

const agnesModels = ref([])
const deepseekModels = ref([])
const isFetchingAgnesModels = ref(false)
const isFetchingDeepseekModels = ref(false)

const customProviderForm = ref({
  name: '',
  apiKey: '',
  apiUrl: '',
  model: '',
})
const customProviderModels = ref([])
const isFetchingCustomModels = ref(false)
const showCustomProviderModal = ref(false)
const editingProviderIndex = ref(-1)

const modelOptions = computed(() => {
  const options = [
    { value: 'deepseek', label: `DeepSeek (${localSettings.value.deepseekModel || 'deepseek-chat'})` },
    { value: 'agnes', label: `Agnes (${localSettings.value.agnesModel || 'agnes-3.5-turbo'})` },
  ]
  if (localSettings.value.customProviders) {
    localSettings.value.customProviders.forEach(p => {
      options.push({ value: p.name, label: `${p.name} (${p.model})` })
    })
  }
  return options
})

onMounted(async () => {
  await settingsStore.fetchSettings()
  localSettings.value = { ...settingsStore.settings }
  // 从已保存的设置中恢复模型列表
  deepseekModels.value = localSettings.value.deepseekModels || []
  agnesModels.value = localSettings.value.agnesModels || []
})

function showToast(type, content) {
  messageType.value = type
  messageContent.value = content
  showMessage.value = true
}

async function fetchAgnesModels() {
  if (!localSettings.value.agnesApiKey) {
    showToast('warning', '请先输入 Agnes API Key')
    return
  }
  isFetchingAgnesModels.value = true
  try {
    const result = await fetch('/api/settings/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'agnes',
        apiKey: localSettings.value.agnesApiKey,
        apiUrl: localSettings.value.agnesApiUrl,
      }),
    })
    const data = await result.json()
    agnesModels.value = data.models || []
    localSettings.value.agnesModels = data.models || []
    showToast('success', '模型列表获取成功')
  } catch (e) {
    showToast('error', '获取模型列表失败：' + e.message)
  } finally {
    isFetchingAgnesModels.value = false
  }
}

async function fetchDeepseekModels() {
  if (!localSettings.value.deepseekApiKey) {
    showToast('warning', '请先输入 DeepSeek API Key')
    return
  }
  isFetchingDeepseekModels.value = true
  try {
    const result = await fetch('/api/settings/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'deepseek',
        apiKey: localSettings.value.deepseekApiKey,
        apiUrl: localSettings.value.deepseekApiUrl,
      }),
    })
    const data = await result.json()
    deepseekModels.value = data.models || []
    localSettings.value.deepseekModels = data.models || []
    showToast('success', '模型列表获取成功')
  } catch (e) {
    showToast('error', '获取模型列表失败：' + e.message)
  } finally {
    isFetchingDeepseekModels.value = false
  }
}

async function fetchCustomProviderModels() {
  if (!customProviderForm.value.apiKey || !customProviderForm.value.apiUrl) {
    showToast('warning', '请填写 API Key 和 API URL')
    return
  }
  isFetchingCustomModels.value = true
  try {
    const result = await fetch('/api/settings/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'custom',
        apiKey: customProviderForm.value.apiKey,
        apiUrl: customProviderForm.value.apiUrl,
      }),
    })
    const data = await result.json()
    customProviderModels.value = data.models || []
    showToast('success', '模型列表获取成功')
  } catch (e) {
    showToast('error', '获取模型列表失败：' + e.message)
  } finally {
    isFetchingCustomModels.value = false
  }
}

function addCustomProvider() {
  if (!customProviderForm.value.name || !customProviderForm.value.apiKey || !customProviderForm.value.apiUrl || !customProviderForm.value.model) {
    showToast('warning', '请填写所有字段')
    return
  }
  
  if (!localSettings.value.customProviders) {
    localSettings.value.customProviders = []
  }
  
  if (editingProviderIndex.value >= 0) {
    const provider = localSettings.value.customProviders[editingProviderIndex.value]
    const nameChanged = provider.name !== customProviderForm.value.name
    if (nameChanged) {
      const exists = localSettings.value.customProviders.some((p, i) => p.name === customProviderForm.value.name && i !== editingProviderIndex.value)
      if (exists) {
        showToast('warning', '供应商名称已存在')
        return
      }
    }
    
    localSettings.value.customProviders[editingProviderIndex.value] = {
      name: customProviderForm.value.name,
      apiKey: customProviderForm.value.apiKey,
      apiUrl: customProviderForm.value.apiUrl,
      model: customProviderForm.value.model,
    }
    
    showToast('success', '自定义供应商修改成功')
  } else {
    const exists = localSettings.value.customProviders.some(p => p.name === customProviderForm.value.name)
    if (exists) {
      showToast('warning', '供应商名称已存在')
      return
    }
    
    localSettings.value.customProviders.push({
      name: customProviderForm.value.name,
      apiKey: customProviderForm.value.apiKey,
      apiUrl: customProviderForm.value.apiUrl,
      model: customProviderForm.value.model,
    })
    
    showToast('success', '自定义供应商添加成功')
  }
  
  customProviderForm.value = { name: '', apiKey: '', apiUrl: '', model: '' }
  customProviderModels.value = []
  showCustomProviderModal.value = false
  editingProviderIndex.value = -1
}

function editCustomProvider(index) {
  const provider = localSettings.value.customProviders[index]
  customProviderForm.value = { ...provider }
  customProviderModels.value = [{ id: provider.model, name: provider.model }]
  editingProviderIndex.value = index
  showCustomProviderModal.value = true
}

function removeCustomProvider(index) {
  localSettings.value.customProviders.splice(index, 1)
  showToast('success', '供应商已删除')
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
          DeepSeek API 配置
        </h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-2">API Key</label>
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

          <div>
            <label class="block text-sm text-slate-400 mb-2">API URL</label>
            <input
              v-model="localSettings.deepseekApiUrl"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500"
              placeholder="https://api.deepseek.com"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm text-slate-400">模型</label>
              <button
                @click="fetchDeepseekModels"
                :disabled="isFetchingDeepseekModels"
                class="flex items-center gap-1 px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all disabled:opacity-50"
              >
                <RefreshCw :size="14" :class="{ 'animate-spin': isFetchingDeepseekModels }" />
                获取模型列表
              </button>
            </div>
            <select 
              v-model="localSettings.deepseekModel"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500"
            >
              <option v-for="model in deepseekModels" :key="model.id" :value="model.id">
                {{ model.name }}
              </option>
              <option v-if="deepseekModels.length === 0" value="deepseek-chat">
                deepseek-chat
              </option>
            </select>
          </div>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6">
        <h2 class="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <span class="w-2 h-2 bg-green-500 rounded-full"></span>
          Agnes API 配置
        </h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-2">API Key</label>
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
            <label class="block text-sm text-slate-400 mb-2">API URL</label>
            <input
              v-model="localSettings.agnesApiUrl"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500"
              placeholder="https://api.agnes.cn"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm text-slate-400">模型</label>
              <button
                @click="fetchAgnesModels"
                :disabled="isFetchingAgnesModels"
                class="flex items-center gap-1 px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all disabled:opacity-50"
              >
                <RefreshCw :size="14" :class="{ 'animate-spin': isFetchingAgnesModels }" />
                获取模型列表
              </button>
            </div>
            <select 
              v-model="localSettings.agnesModel"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500"
            >
              <option v-for="model in agnesModels" :key="model.id" :value="model.id">
                {{ model.name }}
              </option>
              <option v-if="agnesModels.length === 0" value="agnes-3.5-turbo">
                agnes-3.5-turbo
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 bg-slate-800 rounded-xl p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-medium text-white flex items-center gap-2">
          <span class="w-2 h-2 bg-purple-500 rounded-full"></span>
          自定义模型供应商
        </h2>
        <button
          @click="showCustomProviderModal = true"
          class="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
        >
          <Plus :size="18" />
          添加供应商
        </button>
      </div>

      <div v-if="localSettings.customProviders && localSettings.customProviders.length > 0" class="space-y-3">
        <div
          v-for="(provider, index) in localSettings.customProviders"
          :key="provider.name"
          class="flex items-center justify-between p-4 bg-slate-700 rounded-lg"
        >
          <div>
            <div class="text-white font-medium">{{ provider.name }}</div>
            <div class="text-slate-400 text-sm">{{ provider.model }} - {{ provider.apiUrl }}</div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="editCustomProvider(index)"
              class="p-2 text-slate-400 hover:text-cyan-500 hover:bg-cyan-500/10 rounded-lg transition-all"
            >
              <Edit2 :size="18" />
            </button>
            <button
              @click="removeCustomProvider(index)"
              class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
            >
              <Trash2 :size="18" />
            </button>
          </div>
        </div>
      </div>
      <div v-else class="text-center text-slate-500 py-8">
        暂无自定义供应商，点击上方按钮添加
      </div>
    </div>

    <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-slate-800 rounded-xl p-6">
        <h2 class="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <span class="w-2 h-2 bg-yellow-500 rounded-full"></span>
          默认模型
        </h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-2">默认使用的模型</label>
            <select 
              v-model="localSettings.defaultModel"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500"
            >
              <option v-for="option in modelOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
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
        class="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
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

    <div v-if="showCustomProviderModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-medium text-white mb-4">{{ editingProviderIndex >= 0 ? '编辑自定义供应商' : '添加自定义供应商' }}</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-2">供应商名称</label>
            <input
              v-model="customProviderForm.name"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500"
              placeholder="如：MyProvider"
            />
          </div>

          <div>
            <label class="block text-sm text-slate-400 mb-2">API Key</label>
            <div class="relative">
              <input
                :type="showCustomKey ? 'text' : 'password'"
                v-model="customProviderForm.apiKey"
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500 pr-12"
                placeholder="输入 API Key"
              />
              <button 
                @click="showCustomKey = !showCustomKey"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <Eye v-if="showCustomKey" :size="18" />
                <EyeOff v-else :size="18" />
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm text-slate-400 mb-2">API URL</label>
            <input
              v-model="customProviderForm.apiUrl"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500"
              placeholder="https://api.example.com"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm text-slate-400">模型</label>
              <button
                @click="fetchCustomProviderModels"
                :disabled="isFetchingCustomModels"
                class="flex items-center gap-1 px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all disabled:opacity-50"
              >
                <RefreshCw :size="14" :class="{ 'animate-spin': isFetchingCustomModels }" />
                获取模型列表
              </button>
            </div>
            <select 
              v-model="customProviderForm.model"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500"
            >
              <option value="" disabled>请选择模型</option>
              <option v-for="model in customProviderModels" :key="model.id" :value="model.id">
                {{ model.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showCustomProviderModal = false"
            class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
          >
            取消
          </button>
          <button
            @click="addCustomProvider"
            class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
          >
            {{ editingProviderIndex >= 0 ? '保存' : '添加' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
