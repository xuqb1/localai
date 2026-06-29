import { createRouter, createWebHistory } from 'vue-router'
import ChatPage from '../pages/ChatPage.vue'
import KnowledgePage from '../pages/KnowledgePage.vue'
import SettingsPage from '../pages/SettingsPage.vue'

const routes = [
  { path: '/', name: 'Chat', component: ChatPage },
  { path: '/knowledge', name: 'Knowledge', component: KnowledgePage },
  { path: '/settings', name: 'Settings', component: SettingsPage },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
