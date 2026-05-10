<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Square, X } from 'lucide-vue-next'

let _appWindow: ReturnType<typeof getCurrentWindow> | null = null
function getAppWindow() {
  if (!_appWindow)
    _appWindow = getCurrentWindow()
  return _appWindow
}

async function minimize() {
  await getAppWindow().minimize()
}

async function toggleMaximize() {
  await getAppWindow().toggleMaximize()
}

async function close() {
  await getAppWindow().close()
}
</script>

<template>
  <div
    data-tauri-drag-region
    class="flex items-center h-10 bg-card border-b px-4 select-none"
  >
    <div data-tauri-drag-region class="flex-1 text-sm font-medium">
      工具箱
    </div>
    <div class="flex items-center gap-1">
      <button
        class="p-1.5 rounded hover:bg-muted transition-colors"
        @click="minimize"
      >
        <Minus class="size-4" />
      </button>
      <button
        class="p-1.5 rounded hover:bg-muted transition-colors"
        @click="toggleMaximize"
      >
        <Square class="size-3.5" />
      </button>
      <button
        class="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
        @click="close"
      >
        <X class="size-4" />
      </button>
    </div>
  </div>
</template>
