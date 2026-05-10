<script setup lang="ts">
import { Download, RefreshCw, X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useUpdaterStore } from '@/stores/updater'

const store = useUpdaterStore()

const {
  updateInfo,
  progress,
  isDownloading,
  isCompleted,
  showUpdateDialog,
  updateAndRestart,
  closeDialog,
  initialize,
  cleanupEventListeners,
} = store

function formatSize(bytes: number): string {
  if (bytes === 0)
    return ''
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const statusText = computed(() => {
  if (!progress.value)
    return ''
  switch (progress.value.status) {
    case 'downloading':
      return `下载中 ${progress.value.progress}%`
    case 'installing':
      return '正在安装...'
    case 'ready':
      return '下载完成'
    case 'completed':
      return '更新完成'
    case 'failed':
      return '更新失败'
    default:
      return progress.value.message
  }
})

onMounted(() => {
  initialize()
})

onUnmounted(() => {
  cleanupEventListeners()
})
</script>

<template>
  <div
    v-if="showUpdateDialog"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
  >
    <div
      class="bg-card border rounded-lg shadow-lg w-full max-w-md mx-4 p-6 space-y-4"
    >
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          发现新版本
        </h3>
        <Button
          v-if="!isDownloading && !isCompleted"
          variant="ghost"
          size="sm"
          class="h-8 w-8 p-0"
          @click="closeDialog"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>

      <div v-if="updateInfo" class="space-y-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">新版本</span>
          <span class="font-medium">{{ updateInfo.version }}</span>
        </div>

        <div
          v-if="updateInfo.size > 0"
          class="flex items-center justify-between text-sm"
        >
          <span class="text-muted-foreground">文件大小</span>
          <span>{{ formatSize(updateInfo.size) }}</span>
        </div>

        <div
          v-if="updateInfo.releaseNote"
          class="text-sm text-muted-foreground border-t pt-3"
        >
          <p class="font-medium mb-1">
            更新内容
          </p>
          <p class="whitespace-pre-wrap">
            {{ updateInfo.releaseNote }}
          </p>
        </div>
      </div>

      <div v-if="progress && isDownloading" class="space-y-2">
        <Progress :value="progress.progress" class="h-2" />
        <p class="text-xs text-muted-foreground text-center">
          {{ statusText }}
        </p>
      </div>

      <div v-if="isCompleted" class="text-center text-sm text-muted-foreground">
        <RefreshCw class="h-5 w-5 mx-auto mb-2 animate-spin" />
        <p>更新完成，正在重启...</p>
      </div>

      <div class="flex gap-3 pt-2">
        <Button
          v-if="!isDownloading && !isCompleted"
          variant="outline"
          class="flex-1"
          @click="closeDialog"
        >
          稍后更新
        </Button>
        <Button
          v-if="!isDownloading && !isCompleted"
          class="flex-1 gap-2"
          @click="updateAndRestart"
        >
          <Download class="h-4 w-4" />
          立即更新
        </Button>
      </div>
    </div>
  </div>
</template>
