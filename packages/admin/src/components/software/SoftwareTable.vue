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
        <div style="color:#67e8f9; font-size:20px; font-weight:700;">
          {{ total }}
        </div>
        <div style="color:#94a3b8; font-size:11px;">
          总软件数
        </div>
      </div>
      <div class="flex-1 stat-card-2 rounded-xl p-4">
        <div style="color:#93c5fd; font-size:20px; font-weight:700;">
          —
        </div>
        <div style="color:#94a3b8; font-size:11px;">
          本周更新
        </div>
      </div>
      <div class="flex-1 stat-card-3 rounded-xl p-4">
        <div style="color:#6ee7b7; font-size:20px; font-weight:700;">
          —
        </div>
        <div style="color:#94a3b8; font-size:11px;">
          总下载
        </div>
      </div>
    </div>

    <!-- 表格卡片 -->
    <div class="glass-card p-4">
      <!-- 标题栏 -->
      <div class="flex justify-between items-center mb-3">
        <span style="color:#e2e8f0; font-size:13px; font-weight:600;">软件列表</span>
        <div class="flex gap-2">
          <input
            v-model="keyword"
            class="dark-input px-2.5 py-1.5 text-xs"
            style="width:180px;"
            placeholder="🔍 搜索..."
            @keyup.enter="handleSearch"
          >
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
          <TableRow style="background: rgba(255,255,255,0.04);">
            <TableHead style="color:#64748b; font-size:11px;">
              名称
            </TableHead>
            <TableHead style="color:#64748b; font-size:11px;">
              标识
            </TableHead>
            <TableHead style="color:#64748b; font-size:11px;">
              版本数
            </TableHead>
            <TableHead style="color:#64748b; font-size:11px;">
              创建时间
            </TableHead>
            <TableHead style="color:#64748b; font-size:11px; text-align:right;">
              操作
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <!-- loading / empty / data rows -->
          <TableRow v-if="loading">
            <TableCell colspan="5" style="color:#64748b; text-align:center; padding:32px;">
              加载中...
            </TableCell>
          </TableRow>
          <TableRow v-else-if="softwareList.length === 0">
            <TableCell colspan="5" style="color:#64748b; text-align:center; padding:32px;">
              暂无数据
            </TableCell>
          </TableRow>
          <TableRow
            v-for="software in softwareList"
            :key="software.id"
            style="border-bottom: 1px solid rgba(255,255,255,0.04);"
            class="hover:bg-white/[0.03]"
          >
            <TableCell>
              <div class="flex items-center gap-2">
                <div class="shrink-0 flex items-center justify-center rounded-md bg-gradient-primary" style="width:28px; height:28px; font-size:11px;">
                  📦
                </div>
                <div>
                  <div style="color:#e2e8f0; font-size:12px; font-weight:500;">
                    {{ software.name }}
                  </div>
                  <div v-if="software.displayName" style="color:#64748b; font-size:10px;">
                    {{ software.displayName }}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <span v-if="software.identifier" style="color:#67e8f9; font-size:11px; background: rgba(6,182,212,0.1); padding:1px 6px; border-radius:3px;">{{ software.identifier }}</span>
              <span v-else style="color:#475569;">-</span>
            </TableCell>
            <TableCell style="color:#94a3b8; font-size:12px;">
              {{ software.versions?.length || 0 }}
            </TableCell>
            <TableCell style="color:#64748b; font-size:11px;">
              {{ formatDate(software.createdAt) }}
            </TableCell>
            <TableCell style="text-align:right;">
              <div class="flex items-center justify-end gap-1">
                <a :href="`/software?id=${software.id}`" style="color:#67e8f9; font-size:11px;" class="hover:underline">详情</a>
                <ConfirmDialog
                  title="删除软件"
                  :description="`确定要删除软件「${software.name}」吗？此操作将同时删除该软件的所有版本，且无法撤销。`"
                  @confirm="handleDelete(software.id)"
                >
                  <button
                    :disabled="deletingId === software.id"
                    style="color:#f87171; font-size:11px; padding:2px 6px;"
                    class="hover:underline"
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
      <div v-if="total > pageSize" class="flex items-center justify-between mt-3 pt-3" style="border-top: 1px solid rgba(255,255,255,0.04);">
        <span style="color:#64748b; font-size:11px;">共 {{ total }} 条</span>
        <div class="flex items-center gap-2">
          <button
            :disabled="page === 1"
            style="color:#94a3b8; font-size:11px; padding:4px 10px;"
            class="dark-input"
            @click="page--"
          >
            上一页
          </button>
          <span style="color:#67e8f9; font-size:12px; font-weight:500;">{{ page }}</span>
          <button
            :disabled="page * pageSize >= total"
            style="color:#94a3b8; font-size:11px; padding:4px 10px;"
            class="dark-input"
            @click="page++"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
