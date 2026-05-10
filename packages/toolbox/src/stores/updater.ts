import type { UpdateInfo, UpdateProgress } from '@/lib/types'
import { listen } from '@tauri-apps/api/event'
import { createGlobalState } from '@vueuse/core'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { applyUpdate, checkUpdate, downloadUpdate } from '@/composables/use-commands'

export const useUpdaterStore = createGlobalState(() => {
  const currentVersion = ref('')
  const updateInfo = ref<UpdateInfo | null>(null)
  const progress = ref<UpdateProgress | null>(null)
  const isChecking = ref(false)
  const showUpdateDialog = ref(false)

  let unlistenProgress: (() => void) | null = null
  let unlistenAvailable: (() => void) | null = null
  let isSetup = false

  const hasUpdate = computed(() => updateInfo.value !== null)
  const isDownloading = computed(() => progress.value?.status === 'downloading' || progress.value?.status === 'installing')
  const isReady = computed(() => progress.value?.status === 'ready')
  const isCompleted = computed(() => progress.value?.status === 'completed')

  const doCheckUpdate = async () => {
    isChecking.value = true
    try {
      const info = await checkUpdate()
      if (info) {
        updateInfo.value = info
        showUpdateDialog.value = true
      }
      return info
    }
    finally {
      isChecking.value = false
    }
  }

  const doDownloadUpdate = async () => {
    if (!updateInfo.value)
      return
    try {
      await downloadUpdate(updateInfo.value.version_id, updateInfo.value.size)
    }
    catch (err) {
      toast.error('下载更新失败', { description: err instanceof Error ? err.message : '下载失败' })
      throw err
    }
  }

  const updateAndRestart = async () => {
    try {
      await doDownloadUpdate()
      await applyUpdate()
    }
    catch (err) {
      console.error('Update and restart failed:', err)
    }
  }

  const setupEventListeners = async () => {
    if (isSetup)
      return
    isSetup = true

    unlistenProgress = await listen<UpdateProgress>('app:update:progress', (event) => {
      progress.value = event.payload
      if (event.payload.status === 'completed')
        toast.success('更新完成')
      else if (event.payload.status === 'failed')
        toast.error('更新失败', { description: event.payload.message })
    })

    unlistenAvailable = await listen<UpdateInfo>('app:update:available', (event) => {
      updateInfo.value = event.payload
      showUpdateDialog.value = true
    })
  }

  const cleanupEventListeners = () => {
    unlistenProgress?.()
    unlistenAvailable?.()
    isSetup = false
  }

  const initialize = async () => {
    await setupEventListeners()
  }

  const closeDialog = () => {
    if (!progress.value || progress.value.status === 'failed') {
      showUpdateDialog.value = false
    }
  }

  return {
    currentVersion,
    updateInfo,
    progress,
    isChecking,
    showUpdateDialog,
    hasUpdate,
    isDownloading,
    isReady,
    isCompleted,
    checkUpdate: doCheckUpdate,
    downloadUpdate: doDownloadUpdate,
    applyUpdate,
    updateAndRestart,
    initialize,
    cleanupEventListeners,
    closeDialog,
  }
})
