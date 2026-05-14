<script setup lang="ts">
import type { OperationLog } from '@/types'
import { onMounted, ref, watch } from 'vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useApi } from '@/composables/useApi'
import { formatDate } from '@/lib/utils'

const api = useApi()

const logs = ref<OperationLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const action = ref<string>('all')
const loading = ref(false)

const actionOptions = [
  { value: 'all', label: '全部操作' },
  { value: 'upload', label: '上传' },
  { value: 'edit', label: '编辑' },
]

async function fetchData() {
  loading.value = true
  try {
    const actionFilter = action.value && action.value !== 'all' ? action.value : ''
    const result = await api.logs.getList(page.value, pageSize.value, keyword.value, actionFilter)
    logs.value = result.data
    total.value = result.total
  }
  catch (error) {
    console.error('Failed to fetch logs:', error)
  }
  finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  fetchData()
}

function getActionLabel(actionValue: string) {
  return actionOptions.find(opt => opt.value === actionValue)?.label || actionValue
}

function getActionTagClass(actionValue: string): string {
  if (actionValue.includes('publish') || actionValue.includes('upload'))
    return 'tag-publish'
  if (actionValue.includes('edit') || actionValue.includes('update'))
    return 'tag-edit'
  if (actionValue.includes('delete') || actionValue.includes('remove'))
    return 'tag-delete'
  if (actionValue.includes('create') || actionValue.includes('add'))
    return 'tag-create'
  if (actionValue.includes('login') || actionValue.includes('auth'))
    return 'tag-auth'
  return 'tag-publish'
}

watch([page], fetchData)

onMounted(fetchData)
</script>

<template>
  <div>
    <!-- 筛选栏 -->
    <div class="flex items-center gap-2 mb-4">
      <Select v-model="action" @update:model-value="handleSearch">
        <SelectTrigger class="dark-input w-[120px] text-xs h-8">
          <SelectValue placeholder="操作类型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in actionOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <input
        v-model="keyword"
        class="dark-input px-2.5 py-1.5 text-xs w-[180px]"
        placeholder="🔍 搜索..."
        @keyup.enter="handleSearch"
      />
      <button class="bg-gradient-primary rounded-md px-3 py-1.5 text-white text-xs" @click="fetchData">↻</button>
    </div>

    <!-- 表格卡片 -->
    <div class="glass-card p-4 overflow-hidden">
      <Table class="table-fixed w-full">
        <colgroup>
          <col class="w-[140px]">
          <col>
          <col class="w-[80px]">
          <col class="w-[120px]">
        </colgroup>
        <TableHeader>
          <TableRow class="bg-white/[0.04]">
            <TableHead class="text-[#64748b] text-[11px]">时间</TableHead>
            <TableHead class="text-[#64748b] text-[11px]">操作内容</TableHead>
            <TableHead class="text-[#64748b] text-[11px]">类型</TableHead>
            <TableHead class="text-[#64748b] text-[11px]">操作对象</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading">
            <TableCell colspan="4" class="text-[#64748b] text-center p-8">加载中...</TableCell>
          </TableRow>
          <TableRow v-else-if="logs.length === 0">
            <TableCell colspan="4" class="text-[#64748b] text-center p-8">暂无日志记录</TableCell>
          </TableRow>
          <TableRow
            v-for="log in logs"
            :key="log.id"
            class="border-b border-white/[0.04] hover:bg-white/[0.03]"
          >
            <TableCell class="text-[#64748b] text-[11px] whitespace-nowrap overflow-hidden text-ellipsis">
              {{ formatDate(log.createdAt) }}
            </TableCell>
            <TableCell class="max-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span class="text-[#94a3b8] text-xs block overflow-hidden text-ellipsis whitespace-nowrap">{{ log.detail }}</span>
                  </TooltipTrigger>
                  <TooltipContent class="max-w-[400px] max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all">
                    {{ log.detail }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>
            <TableCell>
              <span :class="getActionTagClass(log.action)" class="text-[10px] px-2 py-[2px] rounded inline-block">
                {{ getActionLabel(log.action) }}
              </span>
            </TableCell>
            <TableCell class="text-[#94a3b8] text-[11px] whitespace-nowrap overflow-hidden text-ellipsis">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span class="block overflow-hidden text-ellipsis whitespace-nowrap">{{ log.target }}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ log.target }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
        <span class="text-[#64748b] text-[11px]">共 {{ total }} 条</span>
        <div class="flex items-center gap-2">
          <button :disabled="page === 1" class="text-[#94a3b8] text-[11px] px-[10px] py-1 dark-input" @click="page--">上一页</button>
          <span class="text-[#67e8f9] text-xs font-medium">{{ page }}</span>
          <button :disabled="page * pageSize >= total" class="text-[#94a3b8] text-[11px] px-[10px] py-1 dark-input" @click="page++">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>
