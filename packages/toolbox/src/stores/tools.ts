import type { InstallProgress, SyncResult, Tool } from '@/lib/types'
import { listen } from '@tauri-apps/api/event'
import { createGlobalState } from '@vueuse/core'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { getInstalledTools, getMarketTools, installTool, launchTool, uninstallTool } from '@/composables/use-commands'

export const useToolsStore = createGlobalState(() => {
  const installedTools = ref<Tool[]>([])
  const marketTools = ref<Tool[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const installProgress = ref<Record<number, InstallProgress>>({})

  let unlistenInstall: (() => void) | null = null
  let unlistenSync: (() => void) | null = null
  let isSetup = false

  const marketToolsFiltered = computed(() => marketTools.value)

  const hasUpdate = (tool: Tool): boolean => {
    return !!(tool.version && tool.versions.length > 0 && tool.version !== tool.versions[0].sequence)
  }

  const isInstalling = (toolId: number): boolean => {
    const p = installProgress.value[toolId]
    return !!(p && p.status !== 'completed' && p.status !== 'failed')
  }

  const getProgress = (toolId: number): InstallProgress | undefined => {
    return installProgress.value[toolId]
  }

  const fetchTools = async () => {
    loading.value = true
    error.value = null
    try {
      const [installed, market] = await Promise.all([getInstalledTools(), getMarketTools()])
      installedTools.value = installed || []
      marketTools.value = market || []
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : '获取工具列表失败'
    }
    finally {
      loading.value = false
    }
  }

  const doInstallTool = async (tool: Tool, versionId?: string) => {
    try {
      await installTool(tool.id, versionId)
      toast.success(`"${tool.display_name || tool.name}" 安装成功`)
      await fetchTools()
    }
    catch (err) {
      toast.error(`"${tool.display_name || tool.name}" 安装失败`, {
        description: err instanceof Error ? err.message : '安装失败',
      })
      throw err
    }
  }

  const doUninstallTool = async (tool: Tool) => {
    try {
      await uninstallTool(tool.id)
      toast.success(`"${tool.display_name || tool.name}" 卸载成功`)
      await fetchTools()
    }
    catch (err) {
      toast.error(`"${tool.display_name || tool.name}" 卸载失败`, {
        description: err instanceof Error ? err.message : '卸载失败',
      })
      throw err
    }
  }

  const runTool = async (tool: Tool) => {
    try {
      await launchTool(tool.file_path)
    }
    catch (err) {
      toast.error(`"${tool.display_name || tool.name}" 启动失败`, {
        description: err instanceof Error ? err.message : '启动失败',
      })
      throw err
    }
  }

  const setupEventListeners = async () => {
    if (isSetup)
      return
    isSetup = true

    unlistenInstall = await listen<InstallProgress>('tool:install:progress', (event) => {
      installProgress.value[event.payload.toolId] = event.payload
      if (event.payload.status === 'completed' || event.payload.status === 'failed') {
        setTimeout(() => {
          delete installProgress.value[event.payload.toolId]
        }, 3000)
      }
    })

    unlistenSync = await listen<SyncResult>('tools:sync:completed', (event) => {
      if (event.payload.success) {
        fetchTools()
        toast.success('同步成功', { description: event.payload.message })
      }
      else {
        toast.error('同步失败', { description: event.payload.message })
      }
    })
  }

  const cleanupEventListeners = () => {
    unlistenInstall?.()
    unlistenSync?.()
    isSetup = false
  }

  const initialize = async () => {
    await setupEventListeners()
    await fetchTools()
  }

  return {
    installedTools,
    marketTools,
    loading,
    error,
    installProgress,
    marketToolsFiltered,
    hasUpdate,
    isInstalling,
    getProgress,
    fetchTools,
    installTool: doInstallTool,
    uninstallTool: doUninstallTool,
    runTool,
    initialize,
    cleanupEventListeners,
  }
})
