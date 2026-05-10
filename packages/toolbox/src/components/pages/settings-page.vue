<script setup lang="ts">
// Need to import invoke for fetchAppInfo
import { invoke } from '@tauri-apps/api/core'
import { Download, Info, RefreshCw, Server } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Toaster } from '@/components/ui/sonner'
import { syncNow } from '@/composables/use-commands'
import { useAsyncButton } from '@/composables/useAsyncButton'
import { useUpdaterStore } from '@/stores/updater'

import 'vue-sonner/style.css'

interface AppInfo {
  name: string
  version: string
  environment: string
}

const appInfo = ref<AppInfo>({
  name: 'Toolbox',
  version: '0.1.0',
  environment: 'development',
})

const loading = ref(false)

const updaterStore = useUpdaterStore()
const { currentVersion, checkUpdate } = updaterStore

const { loading: syncLoading, execute: handleSync } = useAsyncButton(syncNow, {
  loadingMessage: '正在同步工具列表...',
  successMessage: '同步成功',
  errorMessage: '同步失败',
})

const { loading: checkingUpdate, execute: executeCheckUpdate } = useAsyncButton(checkUpdate, {
  loadingMessage: '正在检查更新...',
  onSuccess: (info) => {
    if (!info) {
      toast.success('已是最新版本')
    }
  },
})

async function fetchAppInfo() {
  loading.value = true
  try {
    // In Tauri version, use config_get for app info
    const appConfig = await invoke('config_get', { key: 'app' })
    if (appConfig) {
      appInfo.value = {
        name: appConfig.name || 'Toolbox',
        version: '0.1.0', // from CARGO_PKG_VERSION
        environment: appConfig.environment || 'development',
      }
    }
  }
  catch (err) {
    console.error('Failed to fetch app info:', err)
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAppInfo()
})
</script>

<template>
  <div class="space-y-6">
    <Toaster position="top-right" />
    <h2 class="text-2xl font-bold">
      设置
    </h2>

    <div class="grid gap-6">
      <Card>
        <CardHeader class="flex flex-row items-center gap-4">
          <Info class="size-5 text-muted-foreground" />
          <div>
            <CardTitle class="text-lg">
              应用信息
            </CardTitle>
            <CardDescription>当前应用程序的基本信息</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-muted-foreground">名称：</span>
              <span class="font-medium">{{ appInfo.name }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">版本：</span>
              <span class="font-medium">{{ appInfo.version }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">环境：</span>
              <span
                class="px-2 py-0.5 rounded text-xs"
                :class="
                  appInfo.environment === 'production'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                "
              >
                {{ appInfo.environment }}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center gap-4">
          <Download class="size-5 text-muted-foreground" />
          <div>
            <CardTitle class="text-lg">
              软件更新
            </CardTitle>
            <CardDescription>检查并安装应用程序更新</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div class="flex items-center gap-4">
            <Button
              :disabled="checkingUpdate"
              variant="outline"
              @click="executeCheckUpdate"
            >
              <RefreshCw
                class="size-4 mr-2"
                :class="{ 'animate-spin': checkingUpdate }"
              />
              检查更新
            </Button>
            <p class="text-sm text-muted-foreground">
              当前版本：{{ currentVersion || "未知" }}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center gap-4">
          <Server class="size-5 text-muted-foreground" />
          <div>
            <CardTitle class="text-lg">
              同步设置
            </CardTitle>
            <CardDescription>管理工具列表同步</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div class="flex items-center gap-4">
            <Button
              :disabled="syncLoading"
              variant="outline"
              @click="handleSync"
            >
              <RefreshCw
                class="size-4 mr-2"
                :class="{ 'animate-spin': syncLoading }"
              />
              立即同步
            </Button>
            <p class="text-sm text-muted-foreground">
              每 5 小时自动同步一次
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
