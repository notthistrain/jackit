<script setup lang="ts">
import type { SoftwareVersion } from '@/types'
import { AlertCircle, File, Trash2 } from 'lucide-vue-next'
import { ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useApi } from '@/composables/useApi'
import { formatDate } from '@/lib/utils'
import VersionEditDialog from './VersionEditDialog.vue'

const _props = withDefaults(defineProps<{
  versions: SoftwareVersion[]
  softwareId: number
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  refresh: []
}>()

const api = useApi()
const deletingId = ref<number | null>(null)

function formatSize(bytes: number | null) {
  if (!bytes)
    return '-'
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatBytes(bytes: number | null) {
  if (!bytes)
    return '-'
  return `${bytes.toLocaleString('zh-CN')} 字节`
}

async function handleDelete(id: number) {
  deletingId.value = id
  try {
    await api.version.delete(id)
    emit('refresh')
  }
  catch (error) {
    console.error('Failed to delete version:', error)
  }
  finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="border rounded-lg">
    <div class="p-4 border-b flex justify-between items-center">
      <h3 class="font-medium">
        版本列表
      </h3>
      <VersionEditDialog :software-id="softwareId" @saved="$emit('refresh')" />
    </div>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>版本号</TableHead>
          <TableHead>文件大小</TableHead>
          <TableHead>强制更新</TableHead>
          <TableHead>更新日志</TableHead>
          <TableHead>创建时间</TableHead>
          <TableHead class="w-[100px]">
            操作
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="loading">
          <TableCell colspan="6" class="text-center py-8 text-muted-foreground">
            加载中...
          </TableCell>
        </TableRow>
        <TableRow v-else-if="versions.length === 0">
          <TableCell colspan="6" class="text-center py-8 text-muted-foreground">
            暂无版本记录
          </TableCell>
        </TableRow>
        <TableRow v-for="version in versions" :key="version.id">
          <TableCell class="font-medium">
            <div class="flex items-center gap-2">
              <File class="w-4 h-4 text-muted-foreground" />
              {{ version.sequence }}
            </div>
          </TableCell>
          <TableCell>
            <TooltipProvider v-if="version.size">
              <Tooltip>
                <TooltipTrigger as-child>
                  <span class="cursor-default">{{ formatSize(version.size) }}</span>
                </TooltipTrigger>
                <TooltipContent>
                  {{ formatBytes(version.size) }}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span v-else class="text-muted-foreground">-</span>
          </TableCell>
          <TableCell>
            <Badge v-if="version.force" variant="destructive">
              <AlertCircle class="w-3 h-3 mr-1" />
              强制
            </Badge>
            <span v-else class="text-muted-foreground">否</span>
          </TableCell>
          <TableCell>
            <span v-if="version.changelog" class="text-sm">
              {{ version.changelog.slice(0, 50) }}{{ version.changelog.length > 50 ? '...' : '' }}
            </span>
            <span v-else class="text-muted-foreground">-</span>
          </TableCell>
          <TableCell>{{ formatDate(version.createdAt) }}</TableCell>
          <TableCell>
            <div class="flex items-center gap-1">
              <VersionEditDialog :software-id="softwareId" :version="version" @saved="$emit('refresh')" />
              <ConfirmDialog
                title="删除版本"
                :description="`确定要删除版本 ${version.sequence} 吗？此操作无法撤销。`"
                @confirm="handleDelete(version.id)"
              >
                <Button variant="ghost" size="sm" :disabled="deletingId === version.id">
                  <Trash2 class="w-4 h-4 text-destructive" />
                </Button>
              </ConfirmDialog>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
