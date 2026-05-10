<script setup lang="ts">
import type { Tool } from '@/lib/types'
import type { InstallProgress } from '@/stores/tools'
import {
  BookOpen,
  Download,
  FileText,
  MoreHorizontal,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getManualURL } from '@/composables/use-commands'

interface Props {
  tool: Tool
  mode: 'installed' | 'market'
  hasUpdate?: boolean
  isInstalling?: boolean
  progress?: InstallProgress | undefined
}

const props = defineProps<Props>()

const emit = defineEmits<{
  install: [tool: Tool, versionId?: string]
  uninstall: [tool: Tool]
  update: [tool: Tool]
  run: [tool: Tool]
}>()

const showChangelogDialog = ref(false)

function handleInstall(versionId?: string) {
  emit('install', props.tool, versionId)
}

function handleUninstall() {
  emit('uninstall', props.tool)
}

function handleUpdate() {
  emit('update', props.tool)
}

function handleRun() {
  emit('run', props.tool)
}

function formatSize(bytes: number): string {
  if (bytes === 0)
    return ''
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const latestVersion = computed(() => {
  return props.tool.versions?.[0]
})

const hasChangelog = computed(() => {
  return latestVersion.value?.changelog && latestVersion.value.changelog.trim() !== ''
})

function openChangelog() {
  showChangelogDialog.value = true
}

function openManual() {
  const url = getManualURL('http://127.0.0.1:7001', '/manual', props.tool.id)
  window.open(url, '_blank')
}
</script>

<template>
  <Card class="hover:shadow-lg transition-shadow flex flex-col">
    <CardHeader class="flex flex-row items-start gap-4 pb-2">
      <div class="text-4xl shrink-0">
        {{ tool.icon || "🔧" }}
      </div>
      <div class="flex-1 min-w-0 space-y-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <CardTitle class="text-lg truncate text-left">
                {{ tool.display_name || tool.name }}
              </CardTitle>
            </TooltipTrigger>
            <TooltipContent>
              {{ tool.display_name || tool.name }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <CardDescription class="line-clamp-2 text-left text-xs">
                {{ tool.description }}
              </CardDescription>
            </TooltipTrigger>
            <TooltipContent>
              <p class="max-w-xs">
                {{ tool.description }}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </CardHeader>

    <CardContent class="flex-1 flex flex-col">
      <!-- 已安装工具模式 -->
      <template v-if="mode === 'installed'">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">v{{ tool.version || "-" }}</span>
            <span
              v-if="hasUpdate"
              class="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
            >
              有更新
            </span>
          </div>
          <span
            v-if="latestVersion?.force"
            class="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full"
          >
            强制更新
          </span>
        </div>

        <div v-if="hasUpdate && hasChangelog" class="mb-3">
          <Button
            variant="ghost"
            size="sm"
            class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            @click="openChangelog"
          >
            <FileText class="size-3 mr-1" />
            查看更新内容
          </Button>
        </div>

        <div class="mt-auto flex items-center justify-between gap-2">
          <Button size="sm" class="flex-1 gap-1" @click="handleRun">
            <Play class="size-3" />
            运行
          </Button>
          <Popover>
            <PopoverTrigger as-child>
              <Button size="sm" variant="ghost" class="px-2">
                <MoreHorizontal class="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-32 p-2" align="end">
              <Button
                variant="ghost"
                size="sm"
                class="w-full justify-start gap-2"
                @click="openManual"
              >
                <BookOpen class="size-3" />
                说明书
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="w-full justify-start gap-2 text-destructive hover:text-destructive"
                @click="handleUninstall"
              >
                <Trash2 class="size-3" />
                卸载
              </Button>
              <Button
                v-if="hasUpdate"
                variant="ghost"
                size="sm"
                class="w-full justify-start gap-2"
                @click="handleUpdate"
              >
                <RefreshCw class="size-3" />
                更新
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </template>

      <!-- 工具市场模式 -->
      <template v-else>
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">
              v{{ latestVersion?.sequence || "-" }}
            </span>
            <span
              v-if="latestVersion?.force"
              class="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full"
            >
              强制更新
            </span>
          </div>
          <span
            v-if="latestVersion?.size > 0"
            class="text-xs text-muted-foreground"
          >
            {{ formatSize(latestVersion.size) }}
          </span>
        </div>

        <div v-if="hasChangelog" class="mb-3">
          <Button
            variant="ghost"
            size="sm"
            class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            @click="openChangelog"
          >
            <FileText class="size-3 mr-1" />
            查看更新日志
          </Button>
        </div>

        <!-- 安装进度条 -->
        <div v-if="isInstalling" class="space-y-2 mt-auto">
          <Progress :value="progress?.progress || 0" class="h-2" />
          <p class="text-xs text-muted-foreground text-center">
            {{ progress?.message || "安装中..." }}
          </p>
        </div>

        <!-- 安装按钮 -->
        <div v-else class="mt-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button size="sm" class="flex-1 gap-1">
                <Download class="size-3" />
                安装
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-40">
              <DropdownMenuItem class="gap-2" @click="handleInstall()">
                <Download class="size-3" />
                最新版本
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                v-for="version in tool.versions"
                :key="version.sequence"
                class="gap-2"
                @click="handleInstall(version.sequence)"
              >
                <Download class="size-3" />
                v{{ version.sequence }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="outline"
            class="gap-1"
            @click="openManual"
          >
            <BookOpen class="size-3" />
            说明书
          </Button>
        </div>
      </template>
    </CardContent>
  </Card>

  <!-- 更新日志弹框 -->
  <Dialog v-model:open="showChangelogDialog">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>更新日志</DialogTitle>
        <DialogDescription>
          {{ tool.display_name || tool.name }} - v{{ latestVersion?.sequence }}
        </DialogDescription>
      </DialogHeader>
      <div class="text-sm text-muted-foreground whitespace-pre-wrap max-h-80 overflow-auto">
        {{ latestVersion?.changelog }}
      </div>
    </DialogContent>
  </Dialog>
</template>
