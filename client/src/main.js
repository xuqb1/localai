import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import pinia from './stores'

const app = createApp(App)

// 全局错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('全局错误:', { err, instance, info })
  // 在生产环境中可以上报到错误追踪服务
}

// 全局警告处理
app.config.warnHandler = (msg, instance, trace) => {
  console.warn('Vue 警告:', msg, trace)
}

app.use(router)
app.use(pinia)
app.mount('#app')
