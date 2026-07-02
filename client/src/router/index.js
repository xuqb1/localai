import { createRouter, createWebHistory } from 'vue-router'
import ChatPage from '../pages/ChatPage.vue'
import KnowledgePage from '../pages/KnowledgePage.vue'
import SettingsPage from '../pages/SettingsPage.vue'
import NotFoundPage from '../pages/NotFoundPage.vue'

const routes = [
  { path: '/', name: 'Chat', component: ChatPage, meta: { title: 'LocalAI - 对话' } },
  { path: '/knowledge', name: 'Knowledge', component: KnowledgePage, meta: { title: 'LocalAI - 知识库' } },
  { path: '/settings', name: 'Settings', component: SettingsPage, meta: { title: 'LocalAI - 设置' } },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFoundPage, meta: { title: 'LocalAI - 404' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 页面标题守卫
router.beforeEach((to) => {
  document.title = to.meta.title || 'LocalAI'
})

export default router
