<script setup lang="ts">
import type { Software } from '@/types'
import { onMounted, ref, watch } from 'vue'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useApi } from '@/composables/useApi'
import { formatDate } from '@/lib/utils'
import SoftwareCreateDialog from './SoftwareCreateDialog.vue'

const api = useApi()

const softwareList = ref<Software[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const loading = ref(false)
const deletingId = ref<number | null>(null)

async function fetchData() {
  loading.value = true
  try {
    const result = await api.software.getList(page.value, pageSize.value, keyword.value)
    softwareList.value = result.data
    total.value = result.total
  }
  catch (error) {
    console.error('Failed to fetch software list:', error)
  }
  finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  fetchData()
}

function handleCreated() {
  fetchData()
}

async function handleDelete(id: number) {
  deletingId.value = id
  try {
    await api.software.delete(id)
    fetchData()
  }
  catch (error) {
    console.error('Failed to delete software:', error)
  }
  finally {
    deletingId.value = null
  }
}

watch([page], fetchData)

onMounted(fetchData)
</script>

<template>
  <div>
    <!-- 统计卡片行 -->
    <div class="flex gap-4 mb-4">
      <div class="flex-1 stat-card-1 rounded-xl p-4">
        <div class="text-[#67e8f9] text-xl font-bold">{{ total }}</div>
        <div class="text-[#94a3b8] text-[11px]">总软件数</div>
      </div>
      <div class="flex-1 stat-card-2 rounded-xl p-4">
        <div class="text-[#93c5fd] text-xl font-bold">—</div>
        <div class="text-[#94a3b8] text-[11px]">本周更新</div>
      </div>
      <div class="flex-1 stat-card-3 rounded-xl p-4">
        <div class="text-[#6ee7b7] text-xl font-bold">—</div>
        <div class="text-[#94a3b8] text-[11px]">总下载</div>
      </div>
    </div>

    <!-- 表格卡片 -->
    <div class="glass-card p-4">
      <!-- 标题栏 -->
      <div class="flex justify-between items-center mb-3">
        <span class="text-[#e2e8f0] text-[13px] font-semibold">软件列表</span>
        <div class="flex gap-2">
          <input
            v-model="keyword"
            class="dark-input px-2.5 py-1.5 text-xs w-[180px]"
            placeholder="🔍 搜索..."
            @keyup.enter="handleSearch"
          />
          <button
            class="bg-gradient-primary rounded-md px-3 py-1.5 text-white text-xs font-medium"
            @click="fetchData"
          >
            ↻
          </button>
          <SoftwareCreateDialog @created="handleCreated" />
        </div>
      </div>
      <!-- Shadcn Table -->
      <Table>
        <TableHeader>
          <TableRow class="bg-white/[0.04]">
            <TableHead class="text-[#64748b] text-[11px]">名称</TableHead>
            <TableHead class="text-[#64748b] text-[11px]">标识</TableHead>
            <TableHead class="text-[#64748b] text-[11px]">版本数</TableHead>
            <TableHead class="text-[#64748b] text-[11px]">创建时间</TableHead>
            <TableHead class="text-[#64748b] text-[11px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <!-- loading / empty / data rows -->
          <TableRow v-if="loading">
            <TableCell colspan="5" class="text-[#64748b] text-center p-8">加载中...</TableCell>
          </TableRow>
          <TableRow v-else-if="softwareList.length === 0">
            <TableCell colspan="5" class="text-[#64748b] text-center p-8">暂无数据</TableCell>
          </TableRow>
          <TableRow
            v-for="software in softwareList"
            :key="software.id"
            class="border-b border-white/[0.04] hover:bg-white/[0.03]"
          >
            <TableCell>
              <div class="flex items-center gap-2">
                <div class="shrink-0 flex items-center justify-center rounded-md bg-gradient-primary size-7 text-[11px]">📦</div>
                <div>
                  <div class="text-[#e2e8f0] text-xs font-medium">{{ software.name }}</div>
                  <div v-if="software.displayName" class="text-[#64748b] text-[10px]">{{ software.displayName }}</div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <span v-if="software.identifier" class="text-[#67e8f9] text-[11px] bg-[rgba(6,182,212,0.1)] px-1.5 py-[1px] rounded-[3px]">{{ software.identifier }}</span>
              <span v-else class="text-[#475569]">-</span>
            </TableCell>
            <TableCell class="text-[#94a3b8] text-xs">{{ software.versions?.length || 0 }}</TableCell>
            <TableCell class="text-[#64748b] text-[11px]">{{ formatDate(software.createdAt) }}</TableCell>
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1">
                <a :href="`/software?id=${software.id}`" class="text-[#67e8f9] text-[11px] hover:underline">详情</a>
                <ConfirmDialog
                  title="删除软件"
                  :description="`确定要删除软件「${software.name}」吗？此操作将同时删除该软件的所有版本，且无法撤销。`"
                  @confirm="handleDelete(software.id)"
                >
                  <button
                    :disabled="deletingId === software.id"
                    class="text-[#f87171] text-[11px] px-1.5 py-[2px] hover:underline"
                  >
                    删除
                  </button>
                </ConfirmDialog>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
        <span class="text-[#64748b] text-[11px]">共 {{ total }} 条</span>
        <div class="flex items-center gap-2">
          <button
            :disabled="page === 1"
            class="text-[#94a3b8] text-[11px] px-[10px] py-1 dark-input"
            @click="page--"
          >
            上一页
          </button>
          <span class="text-[#67e8f9] text-xs font-medium">{{ page }}</span>
          <button
            :disabled="page * pageSize >= total"
            class="text-[#94a3b8] text-[11px] px-[10px] py-1 dark-input"
            @click="page++"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
