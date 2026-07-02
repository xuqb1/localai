<script setup>
import { MessageCircle, Database, Settings, Plus, ChevronLeft, ChevronRight } from '@lucide/vue'
import { useRouter, useRoute } from 'vue-router'
import { ref } from 'vue'
import { ArrowBigLeft, ArrowLeft, ArrowRight } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()

const isCollapsed = ref(false)

const navItems = [
  { name: '对话', path: '/', icon: MessageCircle },
  { name: '知识库管理', path: '/knowledge', icon: Database },
  { name: '设置', path: '/settings', icon: Settings },
]

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <div class="flex h-screen bg-slate-900">
    <aside 
      class="bg-slate-800 border-r border-slate-700 flex flex-col transition-all duration-300"
      :class="isCollapsed ? 'w-18' : 'w-64'"
    >
      <div class="p-4 border-b border-slate-700">
        <h1 class="text-xl font-bold text-cyan-500 flex items-center gap-2" :class="isCollapsed?'justify-center':'px-2'">
          <MessageCircle :size="24" />
          <span v-if="!isCollapsed">LocalAI</span>
        </h1>
      </div>
      
      <nav class="flex-1 p-3">
        <ul class="space-y-1">
          <li v-for="item in navItems" :key="item.path">
            <button
              @click="router.push(item.path)"
              class="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all"
              :class="[
                route.path === item.path
                  ? 'bg-cyan-500 text-gray-800'
                  : 'text-slate-300 hover:bg-slate-700'
              ]"
            >
              <component :is="item.icon" :size="20" />
              <span v-if="!isCollapsed">{{ item.name }}</span>
            </button>
          </li>
        </ul>
      </nav>

      <div class="p-3">
        <button 
          @click="toggleCollapse"
          class="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all"
        >
          <ArrowLeft v-if="!isCollapsed" :size="18" />
          <ArrowRight v-else :size="18" />
        </button>
      </div>
    </aside>

    <main class="flex-1 overflow-hidden">
      <router-view />
    </main>
  </div>
</template>
