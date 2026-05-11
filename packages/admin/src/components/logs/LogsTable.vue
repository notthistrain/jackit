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
        <SelectTrigger class="dark-input" style="width:120px; font-size:12px; height:32px;">
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
        class="dark-input px-2.5 py-1.5 text-xs"
        style="width:180px;"
        placeholder="🔍 搜索..."
        @keyup.enter="handleSearch"
      />
      <button class="bg-gradient-primary rounded-md px-3 py-1.5 text-white text-xs" @click="fetchData">↻</button>
    </div>

    <!-- 表格卡片 -->
    <div class="glass-card p-4 overflow-hidden">
      <Table style="table-layout: fixed; width: 100%;">
        <colgroup>
          <col style="width:140px;">
          <col>
          <col style="width:80px;">
          <col style="width:120px;">
        </colgroup>
        <TableHeader>
          <TableRow style="background: rgba(255,255,255,0.04);">
            <TableHead style="color:#64748b; font-size:11px;">时间</TableHead>
            <TableHead style="color:#64748b; font-size:11px;">操作内容</TableHead>
            <TableHead style="color:#64748b; font-size:11px;">类型</TableHead>
            <TableHead style="color:#64748b; font-size:11px;">操作对象</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading">
            <TableCell colspan="4" style="color:#64748b; text-align:center; padding:32px;">加载中...</TableCell>
          </TableRow>
          <TableRow v-else-if="logs.length === 0">
            <TableCell colspan="4" style="color:#64748b; text-align:center; padding:32px;">暂无日志记录</TableCell>
          </TableRow>
          <TableRow
            v-for="log in logs"
            :key="log.id"
            style="border-bottom: 1px solid rgba(255,255,255,0.04);"
            class="hover:bg-white/[0.03]"
          >
            <TableCell style="color:#64748b; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              {{ formatDate(log.createdAt) }}
            </TableCell>
            <TableCell style="max-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span style="color:#94a3b8; font-size:12px; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ log.detail }}</span>
                  </TooltipTrigger>
                  <TooltipContent style="max-width:400px; max-height:200px; overflow-y:auto; white-space:pre-wrap; word-break:break-all;">
                    {{ log.detail }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>
            <TableCell>
              <span :class="getActionTagClass(log.action)" style="font-size:10px; padding:2px 8px; border-radius:4px; display:inline-block;">
                {{ getActionLabel(log.action) }}
              </span>
            </TableCell>
            <TableCell style="color:#94a3b8; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ log.target }}</span>
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
      <div v-if="total > pageSize" class="flex items-center justify-between mt-3 pt-3" style="border-top: 1px solid rgba(255,255,255,0.04);">
        <span style="color:#64748b; font-size:11px;">共 {{ total }} 条</span>
        <div class="flex items-center gap-2">
          <button :disabled="page === 1" style="color:#94a3b8; font-size:11px; padding:4px 10px;" class="dark-input" @click="page--">上一页</button>
          <span style="color:#67e8f9; font-size:12px; font-weight:500;">{{ page }}</span>
          <button :disabled="page * pageSize >= total" style="color:#94a3b8; font-size:11px; padding:4px 10px;" class="dark-input" @click="page++">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>
