<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="visible" class="model-overlay" @click.self="handleOverlayClick">
        <div class="model-dialog">
          <div class="model-header" :class="{ 'mobile-header': mobileStyle }">
            <span class="model-title">{{ title }}</span>
            <button v-if="!mobileStyle" class="model-close" @click="handleCancel">×</button>
          </div>
          <div class="model-body">
            <slot>
              <p v-if="htmlContent" class="model-content" v-html="htmlContent"></p>
              <p v-else class="model-content" :class="{ 'mobile-content': mobileStyle }">{{ content }}</p>
            </slot>
          </div>
          <div v-if="mobileStyle" class="mobile-alert-buttons danger">
            <div class="mobile-alert-btn" @click="handleCancel">{{ cancelText }}</div>
            <div class="mobile-alert-btn" :disabled="loading" @click="handleConfirm">{{ confirmText }}</div>
          </div>
          <div v-else class="model-footer">
            <button class="btn btn-cancel" @click="handleCancel">{{ cancelText }}</button>
            <button class="btn btn-confirm" :disabled="loading" @click="handleConfirm">
              <span v-if="loading" class="loading-spinner"></span>
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  visible: Boolean,
  title: String,
  content: String,
  htmlContent: String,
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  closeOnClickOverlay: { type: Boolean, default: true },
  lockScroll: { type: Boolean, default: true },
  mobileStyle: { type: Boolean, default: false }
})

const emit = defineEmits(['confirm', 'cancel', 'update:visible'])
const loading = ref(false)

let scrollTop = 0

const handleLockScroll = lock => {
  if (!props.lockScroll) return
  if (lock) {
    scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollTop}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
    document.body.style.width = '100%'
  } else {
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.overflow = ''
    document.body.style.width = ''
    window.scrollTo(0, scrollTop)
  }
}

const handleConfirm = () => {
  emit('confirm', {
    close: () => emit('update:visible', false),
    setLoading: val => { loading.value = val }
  })
}

const handleCancel = () => {
  handleLockScroll(false)
  emit('cancel')
  emit('update:visible', false)
}

const handleOverlayClick = () => {
  if (props.closeOnClickOverlay) handleCancel()
}

watch(() => props.visible, val => {
  if (val) handleLockScroll(true)
  else handleLockScroll(false)
}, { immediate: true })

onUnmounted(() => { handleLockScroll(false) })
</script>

<style scoped>
.model-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 10000; animation: fadeIn 0.2s;
}
.model-dialog {
  background: #1e293b; border-radius: 12px; max-width: 90vw;
  margin: 0 20px; overflow: hidden; border: 1px solid #334155; animation: slideUp 0.3s;
}
.model-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 24px; border-bottom: 1px solid #334155;
  font-size: 16px; font-weight: 500; color: #f1f5f9;
}
.model-close {
  background: none; border: none; font-size: 18px; color: #94a3b8;
  cursor: pointer; width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px; transition: all 0.2s;
}
.model-close:hover { background: #334155; color: #f1f5f9; }
.model-body {
  padding: 0 20px 20px; font-size: 14px; color: #cbd5e1;
  text-align: center; line-height: 1.5;
}
.model-content { margin: 0; font-size: 14px; color: #e2e8f0; line-height: 1.6; }
.model-footer {
  display: flex; justify-content: flex-end; gap: 12px;
  padding: 16px 24px; border-top: 1px solid #334155;
}
.btn {
  padding: 8px 16px; border-radius: 6px; font-size: 14px;
  cursor: pointer; border: 1px solid transparent;
  transition: all 0.2s; display: flex; align-items: center; gap: 6px;
}
.btn-cancel { background: #334155; border-color: #475569; color: #cbd5e1; }
.btn-cancel:hover { background: #475569; color: #f1f5f9; }
.btn-confirm { background: #0891b2; border-color: #0891b2; color: #fff; }
.btn-confirm:hover:not(:disabled) { background: #06b6d4; border-color: #06b6d4; }
.btn-confirm:disabled { opacity: 0.7; cursor: not-allowed; }
.loading-spinner {
  width: 14px; height: 14px; border: 2px solid #fff;
  border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.mobile-header { justify-content: center !important; padding: 20px 20px 12px; text-align: center; font-size: 17px; font-weight: 600; color: #f1f5f9; border-bottom: 0; }
.mobile-content { padding: 0 20px 20px; font-size: 14px; color: #cbd5e1; text-align: center; line-height: 1.5; }
.mobile-alert-buttons { display: flex; border-top: 1px solid #334155; }
.mobile-alert-btn { flex: 1; height: 48px; line-height: 48px; text-align: center; font-size: 16px; cursor: pointer; }
.mobile-alert-btn:first-child { border-right: 1px solid #334155; color: #cbd5e1; }
.mobile-alert-btn:last-child { color: #0891b2; }
</style>
