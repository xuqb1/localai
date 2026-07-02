<script setup>import { useDocumentStore } from '../stores/documentStore';
import { documentsApi } from '../api';
import { Search, Plus, Edit, Trash2, FolderOpen, Eye, Loader2, X, Save, FileText, RefreshCw, Upload } from '@lucide/vue';
import { onMounted, onUnmounted, ref, computed, nextTick } from 'vue';
import ConfirmDialog from '../components/common/ConfirmDialog.vue';
import MessageModel from '../components/common/MessageModel.vue';
const documentStore = useDocumentStore();
const searchQuery = ref('');
const showImportModal = ref(false);
const importPath = ref('');
const isImporting = ref(false);
const showViewModal = ref(false);
const showEditModal = ref(false);
const currentDoc = ref(null);
const editTitle = ref('');
const editContent = ref('');
const viewTab = ref('content');
const deleteConfirmVisible = ref(false);
const deleteTargetId = ref(null);
const messageType = ref('success');
const messageContent = ref('');
const showMessage = ref(false);
const isRefreshing = ref(false);
const showImportFileModal = ref(false);
const importFolderPath = ref('');
const importFileName = ref('');
let autoRefreshTimer = null
let activePollInterval = null
onMounted(() => {
 documentStore.fetchDocuments().then(() => {
  startAutoRefreshIfNeeded()
 });
});

onUnmounted(() => {
  // 清理所有定时器，防止内存泄漏
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
  if (activePollInterval) {
    clearInterval(activePollInterval)
    activePollInterval = null
  }
});
function startAutoRefreshIfNeeded() {
 const hasImporting = documentStore.documents.some(d => d.import_status === 'importing')
 if (hasImporting && !autoRefreshTimer) {
  autoRefreshTimer = setInterval(async () => {
   await documentStore.fetchDocuments()
   const stillImporting = documentStore.documents.some(d => d.import_status === 'importing')
   if (!stillImporting) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
   }
  }, 3000)
 }
}
function handleSearch() {
 documentStore.setSearch(searchQuery.value);
}
function handlePageChange(page) {
 documentStore.setPage(page);
}
function handleDelete(id) {
 deleteTargetId.value = id;
 deleteConfirmVisible.value = true;
}
async function confirmDelete() {
 if (deleteTargetId.value) {
 await documentStore.deleteDocument(deleteTargetId.value);
 deleteConfirmVisible.value = false;
 }
}
function cancelDelete() {
 deleteConfirmVisible.value = false;
}
function showToast(type, content) {
 messageType.value = type;
 messageContent.value = content;
 showMessage.value = true;
}
async function handleImport() {
 if (importPath.value && !isImporting.value) {
 isImporting.value = true;
 try {
 const result = await documentStore.importDirectory(importPath.value);
 showImportModal.value = false;
 importPath.value = '';
 showToast('success', `导入完成！成功导入 ${result.importedCount} 个文件，跳过 ${result.skippedCount} 个文件。`);
 }
 catch (e) {
 showToast('error', '导入失败：' + e.message);
 }
 finally {
 isImporting.value = false;
 }
 }
}
async function handleRefresh() {
 isRefreshing.value = true;
 try {
 await documentStore.fetchDocuments();
 showToast('success', '刷新成功');
 } catch (e) {
 showToast('error', '刷新失败：' + e.message);
 } finally {
 isRefreshing.value = false;
 }
}
async function handleImportFile() {
 if (!importFolderPath.value || !importFileName.value || isImporting.value) {
 return;
 }
 isImporting.value = true;
 try {
 const result = await documentsApi.importFile({
 folderPath: importFolderPath.value,
 fileName: importFileName.value,
 });
 showImportFileModal.value = false;
 importFolderPath.value = '';
 importFileName.value = '';
 showToast('success', result.message || '导入任务已提交');
 
 if (result.taskId) {
 await pollTaskStatus(result.taskId);
 }
 } catch (e) {
 showToast('error', '文件导入失败：' + e.message);
 } finally {
 isImporting.value = false;
 }
}
async function pollTaskStatus(taskId) {
 // 清理之前的轮询
 if (activePollInterval) {
   clearInterval(activePollInterval)
   activePollInterval = null
 }
 let pollCount = 0
 const maxPolls = 300 // 最多轮询 300 次（15 分钟）

 activePollInterval = setInterval(async () => {
   pollCount++
   if (pollCount > maxPolls) {
     clearInterval(activePollInterval)
     activePollInterval = null
     showToast('warning', '导入任务超时，请手动刷新查看状态')
     return
   }
   try {
     const task = await documentsApi.getImportTask(taskId);
     if (!task || task.error === '任务不存在') {
       clearInterval(activePollInterval)
       activePollInterval = null
       console.log('任务不存在，停止轮询');
       return;
     }
     if (task.status === 'completed') {
       clearInterval(activePollInterval)
       activePollInterval = null
       showToast('success', task.message || '导入完成');
       await documentStore.fetchDocuments();
     } else if (task.status === 'failed') {
       clearInterval(activePollInterval)
       activePollInterval = null
       showToast('error', task.message || '导入失败');
     } else if (task.status === 'running') {
       console.log(`导入进度: ${task.progress}% - ${task.message}`);
       await documentStore.fetchDocuments();
     }
   } catch (e) {
     if (e.response && e.response.status === 404) {
       clearInterval(activePollInterval)
       activePollInterval = null
       return;
     }
     console.error('查询任务状态失败:', e);
   }
 }, 3000);
}
async function handleView(doc) {
 currentDoc.value = doc;
 viewTab.value = 'content';
 showViewModal.value = true;
 await nextTick();
}
function handleEdit(doc) {
 currentDoc.value = doc;
 editTitle.value = doc.title;
 editContent.value = doc.content || '';
 showEditModal.value = true;
}
async function handleSaveEdit() {
 if (!currentDoc.value || !editTitle.value.trim()) {
 showToast('warning', '标题不能为空');
 return;
 }
 try {
 await documentStore.updateDocument(currentDoc.value.id, {
 title: editTitle.value,
 content: editContent.value,
 });
 showEditModal.value = false;
 showToast('success', '更新成功！向量数据库已同步更新。');
 }
 catch (e) {
 showToast('error', '更新失败：' + e.message);
 }
}
function formatNumber(num) {
  if (!num && num !== 0) return '-'
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T'
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'G'
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K'
  return String(num)
}
function formatPercent(chunkCount, totalLines) {
  if (!totalLines || totalLines === 0) return '0.00%'
  return ((chunkCount / totalLines) * 100).toFixed(2) + '%'
}
function formatDate(dateStr) {
  if (!dateStr)
    return '-';
  try {
    return new Date(dateStr).toLocaleString('zh-CN');
  }
  catch {
    return dateStr;
  }
}
function truncateContent(content) {
 if (!content)
 return '';
 if (content.length <= 2000)
 return content;
 return content.substring(0, 2000) + '...';
}
const totalPages = computed(() => Math.ceil(documentStore.total / documentStore.pageSize));
</script>

<template>
  <div class="h-full p-6 overflow-hidden flex flex-col">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-white">知识库管理</h1>
      <div class="flex items-center gap-3">
        <button 
          @click="showImportModal = true"
          :disabled="isImporting"
          class="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-700 text-gray-800 rounded-lg transition-all"
        >
          <FolderOpen :size="18" />
          导入目录
        </button>
        <button 
          @click="showImportFileModal = true"
          :disabled="isImporting"
          class="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-700 text-white rounded-lg transition-all"
        >
          <Upload :size="18" />
          导入文件
        </button>
        <button 
          @click="handleRefresh"
          :disabled="isRefreshing"
          class="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white rounded-lg transition-all"
        >
          <RefreshCw v-if="isRefreshing" :size="18" class="animate-spin" />
          <RefreshCw v-else :size="18" />
          刷新
        </button>
      </div>
    </div>

    <div class="flex items-center gap-4 mb-6">
      <div class="flex-1 relative">
        <Search :size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="searchQuery"
          @keyup.enter="handleSearch"
          type="text"
          placeholder="搜索文档..."
          class="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition-colors"
        />
      </div>
      <button 
        @click="handleSearch"
        class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
      >
        搜索
      </button>
    </div>

    <div class="flex-1 overflow-auto bg-slate-800 rounded-xl">
      <table class="w-full">
        <thead>
          <tr class="bg-slate-700">
            <th class="px-6 py-3 text-left text-sm font-medium text-slate-300">标题</th>
            <th class="px-6 py-3 text-left text-sm font-medium text-slate-300">类型</th>
            <th class="px-6 py-3 text-left text-sm font-medium text-slate-300">分块数</th>
            <th class="px-6 py-3 text-left text-sm font-medium text-slate-300">状态</th>
            <th class="px-6 py-3 text-left text-sm font-medium text-slate-300">进度</th>
            <th class="px-6 py-3 text-left text-sm font-medium text-slate-300">创建时间</th>
            <th class="px-6 py-3 text-left text-sm font-medium text-slate-300">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="doc in documentStore.documents" :key="doc.id" class="border-t border-slate-700 hover:bg-slate-750">
            <td class="px-6 py-4 text-slate-200">{{ doc.title }}</td>
            <td class="px-6 py-4 text-slate-400">{{ doc.file_type || '-' }}</td>
            <td class="px-6 py-4 text-slate-400">{{ doc.chunk_count || 0 }}</td>
            <td class="px-6 py-4">
              <span 
                :class="[
                  'px-2 py-1 rounded text-xs font-medium',
                  doc.import_status === 'importing' ? 'bg-yellow-500/20 text-yellow-400' : '',
                  doc.import_status === 'completed' ? 'bg-green-500/20 text-green-400' : '',
                  (!doc.import_status || doc.import_status === 'unknown') ? 'bg-red-500/20 text-red-400' : ''
                ]"
              >
                {{ doc.import_status === 'importing' ? '导入中' : (doc.import_status === 'completed' ? '已导入' : '未知') }}
              </span>
            </td>
            <td class="px-6 py-4">
              <div v-if="doc.import_status === 'importing'" class="flex flex-col gap-1">
                <span class="text-slate-300 text-sm">{{ formatNumber(doc.chunk_count) }} / {{ formatNumber(doc.total_lines) }} ({{ formatPercent(doc.chunk_count, doc.total_lines) }})</span>
                <div class="w-full bg-slate-700 rounded-full h-1.5">
                  <div 
                    class="bg-yellow-500 h-1.5 rounded-full transition-all duration-300"
                    :style="{ width: `${doc.import_progress || 0}%` }"
                  ></div>
                </div>
              </div>
              <span v-else class="text-slate-400 text-sm">
                {{ formatNumber(doc.chunk_count) }} 行
              </span>
            </td>
            <td class="px-6 py-4 text-slate-400 text-sm">{{ formatDate(doc.created_at) }}</td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-2">
                <button 
                  @click="handleView(doc)"
                  class="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                  title="查看"
                >
                  <Eye :size="16" />
                </button>
                <button 
                  @click="handleEdit(doc)"
                  class="p-2 text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-colors"
                  title="编辑"
                >
                  <Edit :size="16" />
                </button>
                <button 
                  @click="handleDelete(doc.id)"
                  class="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  title="删除"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="documentStore.documents.length === 0">
            <td colspan="7" class="px-6 py-12 text-center text-slate-500">
              暂无文档，请导入或创建文档
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 mt-4">
      <button 
        @click="handlePageChange(documentStore.page - 1)"
        :disabled="documentStore.page === 1"
        class="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded transition-all"
      >
        上一页
      </button>
      <span class="text-slate-400">
        第 {{ documentStore.page }} / {{ totalPages }} 页
      </span>
      <button 
        @click="handlePageChange(documentStore.page + 1)"
        :disabled="documentStore.page === totalPages"
        class="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded transition-all"
      >
        下一页
      </button>
    </div>

    <div v-if="showImportModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-slate-800 rounded-xl p-6 w-full max-w-md">
        <h2 class="text-xl font-bold text-white mb-4">导入目录</h2>
        <input
          v-model="importPath"
          type="text"
          placeholder="输入目录路径，如 E:\codeseq"
          class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 outline-none focus:border-cyan-500"
        />
        <div class="flex items-center gap-4 mt-4">
          <button 
            @click="showImportModal = false"
            class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
          >
            取消
          </button>
          <button 
            @click="handleImport"
            :disabled="isImporting"
            class="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-700 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Loader2 v-if="isImporting" :size="16" class="animate-spin" />
            {{ isImporting ? '导入中...' : '导入' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showImportFileModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-slate-800 rounded-xl p-6 w-full max-w-md">
        <h2 class="text-xl font-bold text-white mb-4">导入文件</h2>
        <div class="mb-4">
          <label class="block text-sm text-slate-400 mb-2">文件夹路径</label>
          <input
            v-model="importFolderPath"
            type="text"
            placeholder="输入文件夹路径，如 F:\project\ai"
            class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 outline-none focus:border-cyan-500"
          />
        </div>
        <div class="mb-4">
          <label class="block text-sm text-slate-400 mb-2">文件名</label>
          <input
            v-model="importFileName"
            type="text"
            placeholder="输入文件名，如 ownthink_v2.csv"
            class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 outline-none focus:border-cyan-500"
          />
        </div>
        <div class="flex items-center gap-4">
          <button 
            @click="showImportFileModal = false"
            class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
          >
            取消
          </button>
          <button 
            @click="handleImportFile"
            :disabled="isImporting || !importFolderPath || !importFileName"
            class="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-700 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Loader2 v-if="isImporting" :size="16" class="animate-spin" />
            {{ isImporting ? '导入中...' : '导入' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showViewModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-slate-800 rounded-xl p-6 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-white">查看文档</h2>
          <button 
            @click="showViewModal = false"
            class="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X :size="20" class="text-slate-400" />
          </button>
        </div>
        <div class="mb-4">
          <div class="text-sm text-slate-400 mb-2">标题</div>
          <div class="text-white font-medium">{{ currentDoc?.title }}</div>
        </div>
        <div class="mb-4 flex gap-4">
          <div>
            <div class="text-sm text-slate-400 mb-1">类型</div>
            <div class="text-slate-300">{{ currentDoc?.file_type || '-' }}</div>
          </div>
          <div>
            <div class="text-sm text-slate-400 mb-1">分块数</div>
            <div class="text-slate-300">{{ currentDoc?.chunk_count || 0 }}</div>
          </div>
          <div>
            <div class="text-sm text-slate-400 mb-1">创建时间</div>
            <div class="text-slate-300">{{ formatDate(currentDoc?.created_at) }}</div>
          </div>
        </div>

        <div class="flex-1 overflow-auto">
          <div class="text-sm text-slate-400 mb-2">内容</div>
          <pre class="whitespace-pre-wrap text-slate-300 bg-slate-900 p-4 rounded-lg">{{ currentDoc?.content ? truncateContent(currentDoc.content) : '无内容' }}</pre>
          <div v-if="currentDoc?.content && currentDoc.content.length > 2000" class="text-xs text-slate-500 mt-2">
            只显示前2000字符，完整内容请编辑查看
          </div>
        </div>
      </div>
    </div>

    <div v-if="showEditModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-slate-800 rounded-xl p-6 w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-white">编辑文档</h2>
          <button 
            @click="showEditModal = false"
            class="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X :size="20" class="text-slate-400" />
          </button>
        </div>
        <div class="mb-4">
          <label class="block text-sm text-slate-400 mb-2">标题</label>
          <input
            v-model="editTitle"
            type="text"
            class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500"
          />
        </div>
        <div class="flex-1 overflow-auto mb-4">
          <label class="block text-sm text-slate-400 mb-2">内容</label>
          <textarea
            v-model="editContent"
            rows="10"
            class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white outline-none focus:border-cyan-500 resize-none"
          ></textarea>
        </div>
        <div class="flex items-center gap-4">
          <button 
            @click="showEditModal = false"
            class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <X :size="16" />
            取消
          </button>
          <button 
            @click="handleSaveEdit"
            class="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Save :size="16" />
            保存
          </button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :visible="deleteConfirmVisible"
      title="确认删除"
      content="确定要删除这个文档吗？"
      confirm-text="删除"
      cancel-text="取消"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <MessageModel
      v-if="showMessage"
      :type="messageType"
      :content="messageContent"
      @close="showMessage = false"
    />
  </div>
</template>

<style scoped>
.bg-slate-750 {
  background-color: rgb(62 74 93);
}
</style>