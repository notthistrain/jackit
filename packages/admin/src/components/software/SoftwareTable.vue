<script setup lang="ts">
import type { Software } from '@/types'
import { Eye, RefreshCw, Search, Trash2 } from 'lucide-vue-next'
import { onMounted, ref, watch } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
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
  <div class="space-y-4">
    <div class="flex items-center gap-4">
      <div class="relative flex-1 max-w-sm">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          v-model="keyword"
          placeholder="搜索软件名称..."
          class="pl-9"
          @keyup.enter="handleSearch"
        />
      </div>
      <Button @click="handleSearch">
        搜索
      </Button>
      <Button variant="outline" size="icon" @click="fetchData">
        <RefreshCw class="w-4 h-4" />
      </Button>
      <SoftwareCreateDialog @created="handleCreated" />
    </div>

    <div class="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>显示名</TableHead>
            <TableHead>标识符</TableHead>
            <TableHead>版本数</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead class="text-right">
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
          <TableRow v-else-if="softwareList.length === 0">
            <TableCell colspan="6" class="text-center py-8 text-muted-foreground">
              暂无数据
            </TableCell>
          </TableRow>
          <TableRow v-for="software in softwareList" :key="software.id">
            <TableCell class="font-medium">
              {{ software.name }}
            </TableCell>
            <TableCell>{{ software.displayName || '-' }}</TableCell>
            <TableCell>
              <Badge v-if="software.identifier" variant="secondary">
                {{ software.identifier }}
              </Badge>
              <span v-else class="text-muted-foreground">-</span>
            </TableCell>
            <TableCell>{{ software.versions?.length || 0 }}</TableCell>
            <TableCell>{{ formatDate(software.createdAt) }}</TableCell>
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1">
                <Button variant="ghost" size="sm" as-child>
                  <a :href="`/software?id=${software.id}`">
                    <Eye class="w-4 h-4 mr-1" />
                    详情
                  </a>
                </Button>
                <ConfirmDialog
                  title="删除软件"
                  :description="`确定要删除软件「${software.name}」吗？此操作将同时删除该软件的所有版本，且无法撤销。`"
                  @confirm="handleDelete(software.id)"
                >
                  <Button variant="ghost" size="sm" :disabled="deletingId === software.id">
                    <Trash2 class="w-4 h-4 text-destructive" />
                  </Button>
                </ConfirmDialog>
              </div>
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
        <Button
          variant="outline"
          size="sm"
          :disabled="page === 1"
          @click="page--"
        >
          上一页
        </Button>
        <span class="text-sm">第 {{ page }} 页</span>
        <Button
          variant="outline"
          size="sm"
          :disabled="page * pageSize >= total"
          @click="page++"
        >
          下一页
        </Button>
      </div>
    </div>
  </div>
</template>
