<template>
	<teleport to="body">
		<transition name="slide" @after-leave="handleAfterLeave">
			<div v-if="visible" class="message-model" :class="`message-${type}`">
				<div class="message-icon">
					<svg v-if="type === 'success'" viewBox="64 64 896 896" width="1em" height="1em">
						<path fill="currentColor" d="M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474a32 32 0 00-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.9c4.1-5.1.4-12.8-6.3-12.8z"/>
					</svg>
					<svg v-else-if="type === 'error'" viewBox="64 64 896 896" width="1em" height="1em">
						<path fill="currentColor" d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm165.4 618.2l-66-.3L512 563.4l-99.3 118.4-66.1.3c-4.4 0-8-3.5-8-8 0-1.9.7-3.7 1.9-5.2l130.1-155L340.5 359a8.32 8.32 0 01-1.9-5.2c0-4.4 3.6-8 8-8l66.1.3L512 464.6l99.3-118.4 66-.3c4.4 0 8 3.5 8 8 0 1.9-.7 3.7-1.9 5.2L553.5 514l130.1 155c1.2 1.5 1.9 3.3 1.9 5.2 0 4.4-3.6 8-8 8z"/>
					</svg>
					<svg v-else-if="type === 'warning'" viewBox="64 64 896 896" width="1em" height="1em">
						<path fill="currentColor" d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm-32 232c0-4.4 3.6-8 8-8h48c4.4 0 8 3.6 8 8v272c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8V296zm32 440a48.01 48.01 0 010-96 48.01 48.01 0 010 96z"/>
					</svg>
					<svg v-else viewBox="64 64 896 896" width="1em" height="1em">
						<path fill="currentColor" d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm32 664c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8V456c0-4.4 3.6-8 8-8h48c4.4 0 8 3.6 8 8v272zm-32-656a48.01 48.01 0 010 96 48.01 48.01 0 010-96z"/>
					</svg>
				</div>
				<div v-if="htmlContent" v-html="htmlContent"></div>
				<span v-else class="message-content">{{ content }}</span>
			</div>
		</transition>
	</teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
	type: { type: String, default: 'info' },
	content: { type: String, required: true },
	htmlContent: { type: String },
	duration: { type: Number, default: 3000 },
})

const emit = defineEmits(['close'])

const visible = ref(false)

onMounted(() => {
	visible.value = true
	if (props.duration > 0) {
		setTimeout(() => { visible.value = false }, props.duration)
	}
})

const handleAfterLeave = () => { emit('close') }
</script>

<style scoped>
.message-model {
	position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
	display: flex; align-items: center; gap: 8px; padding: 12px 24px;
	border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
	z-index: 10100; font-size: 14px; animation: slideDown 0.3s;
}
.message-success { background: #0f172a; border: 1px solid #10b981; color: #10b981; }
.message-error { background: #0f172a; border: 1px solid #ef4444; color: #ef4444; }
.message-warning { background: #0f172a; border: 1px solid #f59e0b; color: #f59e0b; }
.message-info { background: #0f172a; border: 1px solid #3b82f6; color: #3b82f6; }
.message-icon { display: flex; align-items: center; font-size: 16px; }
.message-content { color: #e2e8f0; line-height: 1.5; }
@keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
.slide-enter-active, .slide-leave-active { transition: all 0.3s; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
</style>
