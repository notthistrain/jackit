<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface NavItem {
  icon: string
  label: string
  href: string
  match: string[]
}

const navItems: NavItem[] = [
  { icon: '📦', label: '软件管理', href: '/', match: ['/', '/software'] },
  { icon: '📋', label: '操作日志', href: '/logs', match: ['/logs'] },
]

const collapsed = ref(false)
const mobileOpen = ref(false)

const currentPath = ref('')

onMounted(() => {
  const stored = localStorage.getItem('sidebar-collapsed')
  if (stored !== null) {
    collapsed.value = stored === 'true'
  }

  currentPath.value = window.location.pathname

  // 响应式：768px 以下默认隐藏
  const mq = window.matchMedia('(max-width: 768px)')
  if (mq.matches) {
    collapsed.value = true
  }
  mq.addEventListener('change', (e) => {
    if (e.matches) {
      collapsed.value = true
      mobileOpen.value = false
    }
  })
})

function toggleCollapse() {
  collapsed.value = !collapsed.value
  localStorage.setItem('sidebar-collapsed', String(collapsed.value))
}

function toggleMobile() {
  mobileOpen.value = !mobileOpen.value
}

function isActive(item: NavItem): boolean {
  return item.match.some(m => {
    if (m === '/') return currentPath.value === '/'
    return currentPath.value.startsWith(m)
  })
}

const sidebarWidth = computed(() => collapsed.value ? '56px' : '200px')
</script>

<template>
  <!-- Mobile hamburger -->
  <button
    class="fixed top-2 left-2 z-50 p-2 rounded-lg md:hidden"
    style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);"
    @click="toggleMobile"
  >
    <span style="color: #94a3b8; font-size: 16px;">☰</span>
  </button>

  <!-- Mobile overlay -->
  <div
    v-if="mobileOpen"
    class="fixed inset-0 z-40 md:hidden"
    style="background: rgba(0,0,0,0.5);"
    @click="mobileOpen = false"
  />

  <!-- Sidebar -->
  <aside
    class="flex flex-col h-full shrink-0 transition-all duration-300"
    :class="{ 'fixed z-50 md:relative': mobileOpen, 'hidden md:flex': !mobileOpen }"
    :style="{
      width: sidebarWidth,
      background: 'linear-gradient(180deg, #0a1628, #111d35)',
      borderRight: '1px solid rgba(6,182,212,0.12)',
    }"
  >
    <!-- Logo -->
    <div
      class="flex items-center gap-2 px-3"
      :class="collapsed ? 'justify-center py-3' : 'py-3'"
      style="border-bottom: 1px solid rgba(255,255,255,0.06);"
    >
      <div
        class="shrink-0 flex items-center justify-center rounded-lg bg-gradient-primary"
        style="width:28px; height:28px; font-size:12px;"
      >
        📦
      </div>
      <span
        v-if="!collapsed"
        class="font-semibold whitespace-nowrap"
        style="color: #e2e8f0; font-size: 12px;"
      >
        Upgrade
      </span>
    </div>

    <!-- Nav items -->
    <nav class="flex-1 px-1.5 py-2 space-y-0.5">
      <a
        v-for="item in navItems"
        :key="item.href"
        :href="item.href"
        class="flex items-center gap-2 rounded-md transition-colors"
        :class="collapsed ? 'justify-center px-0 py-1.5' : 'px-2 py-1.5'"
        :style="isActive(item)
          ? 'background: rgba(6,182,212,0.12); border: 1px solid rgba(6,182,212,0.2);'
          : 'border: 1px solid transparent;'"
      >
        <span class="shrink-0" :style="{ fontSize: '13px', opacity: isActive(item) ? '1' : '0.5' }">
          {{ item.icon }}
        </span>
        <span
          v-if="!collapsed"
          class="whitespace-nowrap text-xs font-medium"
          :style="{ color: isActive(item) ? '#67e8f9' : '#94a3b8' }"
        >
          {{ item.label }}
        </span>
      </a>
    </nav>

    <!-- Collapse toggle -->
    <div class="px-1.5 py-2" style="border-top: 1px solid rgba(255,255,255,0.06);">
      <button
        class="flex items-center gap-2 w-full rounded-md px-2 py-1.5 transition-colors"
        :class="collapsed ? 'justify-center' : ''"
        style="color: #94a3b8; font-size: 11px;"
        @click="toggleCollapse"
      >
        <span class="shrink-0">{{ collapsed ? '▶' : '◀' }}</span>
        <span v-if="!collapsed" class="whitespace-nowrap">收起</span>
      </button>
    </div>
  </aside>
</template>