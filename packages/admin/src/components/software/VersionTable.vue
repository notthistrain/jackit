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
      <span class="text-[#e2e8f0] text-[13px] font-semibold">版本历史</span>
      <VersionEditDialog :software-id="softwareId" @saved="$emit('refresh')" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8 text-[#64748b]">加载中...</div>

    <!-- Empty -->
    <div v-else-if="versions.length === 0" class="text-center py-8 text-[#64748b]">暂无版本记录</div>

    <!-- Version list -->
    <div v-else class="space-y-2">
      <div
        v-for="(version, index) in versions"
        :key="version.id"
        class="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors border-l-[3px]"
        :class="index === 0 ? 'border-l-[#06b6d4] bg-[rgba(6,182,212,0.04)]' : 'border-l-white/[0.08]'"
      >
        <!-- 版本信息 -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-[#e2e8f0] text-xs font-medium">{{ version.sequence }}</span>
            <span v-if="index === 0" class="text-[#22c55e] text-[9px] bg-[rgba(34,197,94,0.12)] px-1.5 py-[1px] rounded-[3px] font-medium">最新</span>
            <span v-if="version.force" class="text-[#f87171] text-[9px] bg-[rgba(239,68,68,0.12)] px-1.5 py-[1px] rounded-[3px]">强制</span>
          </div>
          <div class="flex items-center gap-3 mt-1 text-[#64748b] text-[10px]">
            <span>{{ formatSize(version.size) }}</span>
            <span>{{ formatDate(version.createdAt) }}</span>
          </div>
          <div v-if="version.changelog" class="text-[#94a3b8] text-[11px] mt-1 leading-[1.6]">
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
              class="text-[#f87171] text-[11px] px-2 py-[3px] rounded bg-[rgba(239,68,68,0.08)] hover:bg-red-500/20"
            >
              删除
            </button>
          </ConfirmDialog>
        </div>
      </div>
    </div>
  </div>
</template>
