<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import { onMounted, onUnmounted } from 'vue'
import ToolCard from '@/components/tool-card.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Toaster } from '@/components/ui/sonner'
import { useAsyncButton } from '@/composables/useAsyncButton'
import { useToolsStore } from '@/stores/tools'
import 'vue-sonner/style.css'

const store = useToolsStore()

const {
  installedTools,
  marketToolsFiltered,
  error,
  hasUpdate,
  isInstalling,
  getProgress,
  installTool,
  uninstallTool,
  runTool,
  fetchTools,
  initialize,
  cleanupEventListeners,
} = store

const { loading: refreshing, execute: handleRefresh } = useAsyncButton(fetchTools, {
  loadingMessage: '正在刷新工具列表...',
  successMessage: '刷新成功',
  errorMessage: '刷新失败',
})

async function handleInstall(tool: any, versionId?: string) {
  try {
    await installTool(tool, versionId)
  }
  catch {
    // 错误已在 composable 中处理
  }
}

async function handleUninstall(tool: any) {
  try {
    await uninstallTool(tool)
  }
  catch {
    // 错误已在 composable 中处理
  }
}

async function handleUpdate(tool: any) {
  try {
    await installTool(tool)
  }
  catch {
    // 错误已在 composable 中处理
  }
}

async function handleRun(tool: any) {
  try {
    await runTool(tool)
  }
  catch {
    // 错误已在 composable 中处理
  }
}

onMounted(() => {
  initialize()
})

onUnmounted(() => {
  cleanupEventListeners()
})
</script>

<template>
  <div class="space-y-8">
    <Toaster position="top-right" />

    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold">
          我的工具
        </h2>
        <Button
          variant="outline"
          size="sm"
          :disabled="refreshing"
          @click="handleRefresh"
        >
          <RefreshCw class="size-4 mr-2" :class="{ 'animate-spin': refreshing }" />
          刷新
        </Button>
      </div>

      <Card v-if="error" class="border-destructive/50 bg-destructive/5">
        <CardContent>
          <p class="text-sm text-destructive font-medium mb-2">
            加载失败
          </p>
          <pre class="text-xs text-destructive/80 max-h-32 overflow-auto whitespace-pre-wrap">{{ error }}</pre>
        </CardContent>
      </Card>

      <div
        v-else-if="installedTools.length === 0"
        class="text-center text-muted-foreground py-12"
      >
        暂无已安装的工具
      </div>

      <div
        v-else
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
        <ToolCard
          v-for="tool in installedTools"
          :key="tool.id"
          :tool="tool"
          mode="installed"
          :has-update="!!hasUpdate(tool)"
          @uninstall="handleUninstall"
          @update="handleUpdate"
          @run="handleRun"
        />
      </div>
    </div>

    <div>
      <h2 class="text-2xl font-bold mb-6">
        工具市场
      </h2>

      <div
        v-if="marketToolsFiltered.length === 0"
        class="text-center text-muted-foreground py-12"
      >
        暂无更多工具
      </div>

      <div
        v-else
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
        <ToolCard
          v-for="tool in marketToolsFiltered"
          :key="tool.id"
          :tool="tool"
          mode="market"
          :is-installing="isInstalling(tool.id)"
          :progress="getProgress(tool.id)"
          @install="handleInstall"
        />
      </div>
    </div>
  </div>
</template>
