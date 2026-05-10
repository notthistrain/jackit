<script setup lang="ts">
import type { OperationLog } from '@/types'
import { RefreshCw, Search } from 'lucide-vue-next'
import { onMounted, ref, watch } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

function getActionVariant(actionValue: string): 'default' | 'secondary' | 'destructive' {
  if (actionValue.includes('delete'))
    return 'destructive'
  if (actionValue.includes('update') || actionValue.includes('edit'))
    return 'secondary'
  return 'default'
}

watch([page], fetchData)

onMounted(fetchData)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-4">
      <div class="relative flex-1 max-w-sm">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input v-model="keyword" placeholder="搜索..." class="pl-9" @keyup.enter="handleSearch" />
      </div>
      <Select v-model="action" @update:model-value="handleSearch">
        <SelectTrigger class="w-[150px]">
          <SelectValue placeholder="操作类型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in actionOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Button @click="handleSearch">
        搜索
      </Button>
      <Button variant="outline" size="icon" @click="fetchData">
        <RefreshCw class="w-4 h-4" />
      </Button>
    </div>

    <div class="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>操作类型</TableHead>
            <TableHead>操作对象</TableHead>
            <TableHead>操作内容</TableHead>
            <TableHead>操作时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading">
            <TableCell colspan="4" class="text-center py-8 text-muted-foreground">
              加载中...
            </TableCell>
          </TableRow>
          <TableRow v-else-if="logs.length === 0">
            <TableCell colspan="4" class="text-center py-8 text-muted-foreground">
              暂无日志记录
            </TableCell>
          </TableRow>
          <TableRow v-for="log in logs" :key="log.id">
            <TableCell class="whitespace-nowrap">
              <Badge :variant="getActionVariant(log.action)">
                {{ getActionLabel(log.action) }}
              </Badge>
            </TableCell>
            <TableCell class="whitespace-nowrap">
              {{ log.target }}
            </TableCell>
            <TableCell class="w-full max-w-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span class="text-sm text-muted-foreground cursor-default block truncate">
                      {{ log.detail }}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent class="max-w-md whitespace-pre-wrap break-all">
                    {{ log.detail }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>
            <TableCell class="whitespace-nowrap">
              {{ formatDate(log.createdAt) }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">
        共 {{ total }} 条记录
      </p>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="page === 1" @click="page--">
          上一页
        </Button>
        <span class="text-sm">第 {{ page }} 页</span>
        <Button variant="outline" size="sm" :disabled="page * pageSize >= total" @click="page++">
          下一页
        </Button>
      </div>
    </div>
  </div>
</template>
