<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const { user, logout } = useAuth()
const showMenu = ref(false)

const username = computed(() => user.value?.username || 'Admin')

onMounted(() => {
  document.addEventListener('click', () => {
    showMenu.value = false
  })
})

function handleLogout() {
  logout()
  window.location.href = '/login'
}
</script>

<template>
  <header
    class="flex items-center justify-between px-4 md:px-6 h-11 border-b border-white/[0.06]"
  >
    <!-- 面包屑 -->
    <div class="flex items-center gap-1 text-xs text-[#94a3b8]">
      <slot name="breadcrumb">
        <span>首页</span>
      </slot>
    </div>

    <!-- 右侧 -->
    <div class="flex items-center gap-3">
      <!-- 用户 -->
      <div class="relative">
        <button
          class="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors text-xs"
          @click.stop="showMenu = !showMenu"
        >
          <div
            class="flex items-center justify-center rounded-full size-[22px] bg-[rgba(6,182,212,0.2)] text-[10px]"
          >
            👤
          </div>
          <span class="text-[#cbd5e1]">{{ username }}</span>
        </button>
        <div
          v-if="showMenu"
          class="absolute right-0 top-full mt-1 rounded-lg py-1 z-50 bg-[#1e293b] border border-white/[0.1] min-w-[120px]"
        >
          <button
            class="w-full text-left px-3 py-1.5 text-xs transition-colors text-[#94a3b8]"
            @click="handleLogout"
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  </header>
</template>