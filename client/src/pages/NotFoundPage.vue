<template>
  <div class="h-full flex flex-col items-center justify-center text-center px-4">
    <div class="text-cyan-500 text-8xl font-bold mb-4">404</div>
    <h1 class="text-2xl font-bold text-white mb-2">页面未找到</h1>
    <p class="text-slate-400 mb-8 max-w-md">
      您访问的页面不存在，可能已被移动或删除。
    </p>
    <router-link
      to="/"
      class="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all font-medium"
    >
      返回首页
    </router-link>
  </div>
</template>
