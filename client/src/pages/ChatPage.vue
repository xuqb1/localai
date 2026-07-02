<script setup>
import { useChatStore } from '../stores/chatStore'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import { Plus, Trash2, Pencil, User, Bot } from '@lucide/vue'
import { onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import ModalDialog from '../components/common/ModalDialog.vue'
import MessageModel from '../components/common/MessageModel.vue'

const chatStore = useChatStore()
const messagesContainer = ref(null)
const inputContainer = ref(null)
const isDragging = ref(false)
const inputMinHeight = 200
const inputMaxHeight = 800
const showRenameModal = ref(false)
const renameTitle = ref('')
const showDeleteModal = ref(false)
const deleteTargetId = ref(null)
const messageType = ref('success')
const messageContent = ref('')
const showMessage = ref(false)

function startDrag(e) {
  isDragging.value = true
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.body.style.cursor = 'ns-resize'
}

function onDrag(e) {
  if (!isDragging.value || !inputContainer.value) return
  
  const containerRect = inputContainer.value.parentElement.getBoundingClientRect()
  const newInputHeight = containerRect.bottom - e.clientY
  
  if (newInputHeight >= inputMinHeight && newInputHeight <= inputMaxHeight) {
    inputContainer.value.style.height = newInputHeight + 'px'
  }
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.body.style.cursor = ''
}

onMounted(async () => {
  await chatStore.fetchConversations()
  if (chatStore.conversations.length > 0) {
    await chatStore.selectConversation(chatStore.conversations[0].id)
  }
})

onUnmounted(() => {
  // 清理拖拽事件监听器，防止内存泄漏
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.body.style.cursor = ''
})

watch(() => chatStore.messages.length, async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
})

async function handleNewConversation() {
  await chatStore.createConversation()
}

async function handleSend(message) {
  await chatStore.sendMessage(message)
}

function handleDeleteConversation(id) {
  deleteTargetId.value = id
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (deleteTargetId.value) {
    await chatStore.deleteConversation(deleteTargetId.value)
    showDeleteModal.value = false
    showToast('success', '对话已删除')
  }
}

function cancelDelete() {
  showDeleteModal.value = false
}

function renameConversation() {
  if (!chatStore.currentConversationId) return
  const conversation = chatStore.conversations.find(c => c.id === chatStore.currentConversationId)
  if (conversation) {
    renameTitle.value = conversation.title
    showRenameModal.value = true
  }
}

async function handleRename() {
  if (!renameTitle.value.trim() || !chatStore.currentConversationId) {
    showToast('warning', '标题不能为空')
    return
  }
  try {
    await chatStore.updateConversationTitle(chatStore.currentConversationId, renameTitle.value)
    showRenameModal.value = false
    showToast('success', '重命名成功')
  } catch (e) {
    showToast('error', '重命名失败：' + e.message)
  }
}

function handleSelectChange(e) {
  const conversationId = e.target.value
  if (conversationId) {
    chatStore.selectConversation(conversationId)
  }
}

function showToast(type, content) {
  messageType.value = type
  messageContent.value = content
  showMessage.value = true
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
      <div class="flex items-center gap-4">
        <button 
          @click="handleNewConversation"
          class="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
        >
          <Plus :size="18" />
          新对话
        </button>
        <!-- text-white  -->
        <select 
          v-if="chatStore.conversations.length > 0"
          class="bg-slate-700 text-white rounded-lg py-2 px-3 outline-none min-w-[200px] border border-slate-600"
          @change="handleSelectChange"
        >
          <option 
            v-for="conv in chatStore.conversations" 
            :key="conv.id" 
            :value="conv.id"
            :selected="chatStore.currentConversationId === conv.id"
          >
            {{ conv.title }}
          </option>
        </select>
        <button @click="renameConversation" class="flex items-center gap-2 px-4 py-2 bg-slate-500 hover:bg-cyan-600 text-gray-300 rounded-lg transition-all">
          <Pencil :size="18"></Pencil>
          改名
        </button>
      </div>
      
      <button 
        v-if="chatStore.currentConversationId"
        @click="handleDeleteConversation(chatStore.currentConversationId)"
        class="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
      >
        <Trash2 :size="18" />
        删除对话
      </button>
    </div>

    <div 
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-4 space-y-6"
    >
      <div v-if="chatStore.messages.length === 0" class="flex flex-col items-center justify-center h-full text-slate-500">
        <!-- <div class="text-6xl mb-4">🤖</div> -->
        <Bot class="text-6xl mb-4" :size="20" />
        <h2 class="text-xl font-medium mb-2">欢迎使用 LocalAI</h2>
        <p class="text-center max-w-md">
          您可以向我提问，我会先查询本地知识库，然后搜索网络，最后使用大模型回答。
        </p>
      </div>
      
      <ChatMessage 
        v-for="message in chatStore.messages" 
        :key="message.id" 
        :message="message"
      />
      
      <div v-if="chatStore.isLoading" class="flex justify-center">
        <div class="flex items-center gap-2 text-slate-400">
          <div class="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <span>正在思考...</span>
        </div>
      </div>
    </div>

    <div class="w-full h-1 bg-slate-700 cursor-ns-resize hover:bg-slate-600 transition-colors" @mousedown="startDrag"></div>
    
    <div ref="inputContainer" class="flex-shrink-0">
      <ChatInput 
        :disabled="!chatStore.currentConversationId"
        :is-loading="chatStore.isLoading"
        @send="handleSend"
      />
    </div>

    <div v-if="showRenameModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-white">重命名对话</h2>
        </div>
        <div class="mb-4">
          <label class="block text-sm text-slate-400 mb-2">新名称</label>
          <input
            v-model="renameTitle"
            type="text"
            class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500"
            placeholder="请输入对话名称"
            @keyup.enter="handleRename"
            autofocus
          />
        </div>
        <div class="flex items-center gap-4">
          <button 
            @click="showRenameModal = false"
            class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
          >
            取消
          </button>
          <button 
            @click="handleRename"
            class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
          >
            确定
          </button>
        </div>
      </div>
    </div>

    <div v-if="showDeleteModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-white">确认删除</h2>
        </div>
        <p class="text-slate-300 mb-4">确定要删除当前对话吗？此操作无法撤销。</p>
        <div class="flex items-center gap-4">
          <button 
            @click="cancelDelete"
            class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
          >
            取消
          </button>
          <button 
            @click="confirmDelete"
            class="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
          >
            删除
          </button>
        </div>
      </div>
    </div>

    <MessageModel
      v-if="showMessage"
      :type="messageType"
      :content="messageContent"
      @close="showMessage = false"
    />
  </div>
</template>
