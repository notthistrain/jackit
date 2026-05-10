<script setup lang="ts">
import type { SoftwareVersion } from '@/types'
import { ref } from 'vue'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
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
  <div class="glass-card p-4">
    <!-- 标题栏 -->
    <div class="flex justify-between items-center mb-4">
      <span style="color: #e2e8f0; font-size: 13px; font-weight: 600;">版本历史</span>
      <VersionEditDialog :software-id="softwareId" @saved="$emit('refresh')" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8" style="color: #64748b;">加载中...</div>

    <!-- Empty -->
    <div v-else-if="versions.length === 0" class="text-center py-8" style="color: #64748b;">暂无版本记录</div>

    <!-- Version list -->
    <div v-else class="space-y-2">
      <div
        v-for="(version, index) in versions"
        :key="version.id"
        class="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors"
        style="border-left: 3px solid;"
        :style="{
          borderLeftColor: index === 0 ? '#06b6d4' : 'rgba(255,255,255,0.08)',
          background: index === 0 ? 'rgba(6,182,212,0.04)' : 'transparent',
        }"
      >
        <!-- 版本信息 -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span style="color: #e2e8f0; font-size: 12px; font-weight: 500;">{{ version.sequence }}</span>
            <span v-if="index === 0" style="color: #22c55e; font-size: 9px; background: rgba(34,197,94,0.12); padding: 1px 6px; border-radius: 3px; font-weight: 500;">最新</span>
            <span v-if="version.force" style="color: #f87171; font-size: 9px; background: rgba(239,68,68,0.12); padding: 1px 6px; border-radius: 3px;">强制</span>
          </div>
          <div class="flex items-center gap-3 mt-1" style="color: #64748b; font-size: 10px;">
            <span>{{ formatSize(version.size) }}</span>
            <span>{{ formatDate(version.createdAt) }}</span>
          </div>
          <div v-if="version.changelog" style="color: #94a3b8; font-size: 11px; margin-top: 4px; line-height: 1.6;">
            {{ version.changelog.length > 100 ? version.changelog.slice(0, 100) + '...' : version.changelog }}
          </div>
        </div>

        <!-- 操作 -->
        <div class="flex items-center gap-1 shrink-0">
          <VersionEditDialog :software-id="softwareId" :version="version" @saved="$emit('refresh')" />
          <ConfirmDialog
            title="删除版本"
            :description="`确定要删除版本 ${version.sequence} 吗？此操作无法撤销。`"
            @confirm="handleDelete(version.id)"
          >
            <button
              :disabled="deletingId === version.id"
              style="color: #f87171; font-size: 11px; padding: 3px 8px; border-radius: 4px; background: rgba(239,68,68,0.08);"
              class="hover:bg-red-500/20"
            >
              删除
            </button>
          </ConfirmDialog>
        </div>
      </div>
    </div>
  </div>
</template>
