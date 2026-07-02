<template>
	<transition name="modal-fade">
		<div v-if="modelValue" class="modal-wrapper" :style="{ zIndex }">
			<div class="modal-overlay" @click.self="handleOverlayClick">
				<div class="modal-container" :style="containerStyle">
					<!-- 头部 -->
					<div class="modal-header">
						<div class="modal-title">
							<slot name="title">{{ title }}</slot>
						</div>
						<button v-if="showClose" class="modal-close" @click="handleClose">
							×
						</button>
					</div>

					<!-- 内容区（可滚动） -->
					<div
						class="modal-body"
						:class="{ 'has-footer': showDefaultFooter || $slots.footer }"
					>
						<slot>
							<div class="modal-empty">暂无内容</div>
						</slot>
					</div>

					<!-- 固定底部 -->
					<div v-if="showDefaultFooter || $slots.footer" class="modal-footer">
						<slot name="footer">
							<button
								v-if="showCancel"
								class="btn btn-secondary"
								:class="btnSizeClass"
								:disabled="loading"
								@click="handleCancel"
							>
								{{ cancelText }}
							</button>
							<button
								v-if="showConfirm"
								class="btn btn-primary"
								:class="btnSizeClass"
								:disabled="confirmDisabled || loading"
								@click="handleConfirm"
							>
								<span v-if="loading" class="btn-loading"></span>
								{{ confirmText }}
							</button>
						</slot>
					</div>
				</div>
			</div>
		</div>
	</transition>
</template>

<script setup>
import { computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
	modelValue: { type: Boolean, default: false },
	title: { type: String, default: '提示' },
	width: { type: String, default: '520px' },
	maxWidth: { type: String, default: '90vw' },
	minHeight: { type: String, default: '300px' },
	maxHeight: { type: String, default: '85vh' },
	zIndex: { type: Number, default: 1000 },
	showClose: { type: Boolean, default: true },
	showDefaultFooter: { type: Boolean, default: true },
	showCancel: { type: Boolean, default: true },
	showConfirm: { type: Boolean, default: true },
	cancelText: { type: String, default: '取消' },
	confirmText: { type: String, default: '确定' },
	confirmDisabled: { type: Boolean, default: false },
	loading: { type: Boolean, default: false },
	btnSize: { type: String, default: 'default' },
	closeOnClickOverlay: { type: Boolean, default: true },
	closeOnPressEscape: { type: Boolean, default: true },
	lockScroll: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel', 'close', 'open'])

const containerStyle = computed(() => ({
	width: props.width,
	maxWidth: props.maxWidth,
	maxHeight: props.maxHeight,
	minHeight: props.minHeight,
}))

const btnSizeClass = computed(() => {
	const map = { small: 'btn-small', default: '', large: 'btn-large' }
	return map[props.btnSize] || ''
})

let scrollTop = 0

const handleLockScroll = (lock) => {
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

watch(() => props.modelValue, (val) => {
	if (val) { emit('open'); handleLockScroll(true) }
	else { handleLockScroll(false) }
}, { immediate: true })

const close = () => { emit('update:modelValue', false); emit('close') }

const handleOverlayClick = () => { if (props.closeOnClickOverlay) close() }
const handleClose = () => close()
const handleCancel = () => { emit('cancel'); close() }
const handleConfirm = () => emit('confirm')

const handleKeydown = (e) => {
	if (e.key === 'Escape' && props.modelValue && props.closeOnPressEscape) close()
}

onMounted(() => { window.addEventListener('keydown', handleKeydown) })
onUnmounted(() => { window.removeEventListener('keydown', handleKeydown); handleLockScroll(false) })
</script>

<style scoped>
.modal-wrapper { position: fixed; top: 0; left: 0; right: 0; bottom: 0; }
.modal-overlay {
	position: fixed; top: 0; left: 0; right: 0; bottom: 0;
	background: rgba(0, 0, 0, 0.5);
	display: flex; align-items: center; justify-content: center;
	padding: 20px; backdrop-filter: blur(2px); overscroll-behavior: contain;
}
.modal-container {
	background: #fff; border-radius: 8px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
	display: flex; flex-direction: column; will-change: transform, opacity;
	max-height: 85vh; max-height: calc(var(--vh, 1vh) * 85);
}
.modal-header {
	display: flex; justify-content: space-between; align-items: center;
	padding: 8px 10px 8px 24px; border-bottom: 1px solid #e5e5e5;
	flex-shrink: 0; background-color: #f5f5f5; border-radius: 8px 8px 0 0;
}
.modal-title { font-size: 18px; font-weight: 600; color: #262626; line-height: 1.4; }
.modal-close {
	width: 32px; height: 32px; border: none; background: #f5f5f5;
	border-radius: 6px; cursor: pointer; font-size: 20px; line-height: 1;
	color: #666; display: flex; align-items: center; justify-content: center; transition: all 0.2s;
}
.modal-close:hover { font-weight: 600; color: #ff3333; scale: 1.2; }
.modal-body {
	flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px;
	scroll-behavior: smooth; overscroll-behavior: contain;
}
.modal-body.has-footer { padding-bottom: 16px; }
.modal-body::-webkit-scrollbar { width: 6px; }
.modal-body::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
.modal-body::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
.modal-body::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
.modal-empty { text-align: center; padding: 40px; color: #999; font-size: 14px; }
.modal-footer {
	flex-shrink: 0; padding: 16px 24px; border-top: 1px solid #e5e5e5;
	background-color: #f5f5f5; border-radius: 0 0 8px 8px;
	display: flex; justify-content: flex-end; align-items: center; gap: 12px;
	box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}
.btn {
	padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer;
	transition: all 0.2s; border: 1px solid transparent; outline: none;
	display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.btn:hover { transform: translateY(-1px); }
.btn:active { transform: translateY(0); }
.btn-primary { background: #1890ff; color: #fff; border-color: #1890ff; }
.btn-primary:hover:not(:disabled) { background: #40a9ff; border-color: #40a9ff; box-shadow: 0 4px 12px rgba(24, 144, 255, 0.4); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: #fff; color: #595959; border-color: #d9d9d9; }
.btn-secondary:hover { color: #40a9ff; border-color: #40a9ff; background: #f0f5ff; }
.btn-small { padding: 4px 12px; font-size: 13px; }
.btn-large { padding: 10px 24px; font-size: 15px; }
.btn-loading {
	width: 14px; height: 14px; border: 2px solid rgba(255, 255, 255, 0.3);
	border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.3s ease; }
.modal-fade-enter-active .modal-overlay, .modal-fade-leave-active .modal-overlay { transition: transform 0.3s ease, opacity 0.3s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-overlay, .modal-fade-leave-to .modal-overlay { opacity: 0; transform: scale(0.95) translateY(-10px); }
@media (max-width: 768px) {
	.modal-overlay { padding: 0; align-items: flex-end; }
	.modal-container { width: 100% !important; max-width: 100% !important; border-radius: 12px 12px 0 0; max-height: 90vh; }
	.modal-fade-enter-from .modal-overlay, .modal-fade-leave-to .modal-overlay { transform: translateY(100%); }
	.modal-footer { padding-bottom: calc(16px + env(safe-area-inset-bottom)); }
}
</style>
