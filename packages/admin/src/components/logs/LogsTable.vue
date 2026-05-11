<script setup lang="ts">
import type { OperationLog } from '@/types'
import { onMounted, ref, watch } from 'vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
    <div class="glass-card p-4">
      <table style="width:100%; table-layout:fixed; border-collapse:collapse;">
        <thead>
          <tr style="background: rgba(255,255,255,0.04);">
            <th style="color:#64748b; font-size:11px; text-align:left; padding:10px 12px; width:150px;">时间</th>
            <th style="color:#64748b; font-size:11px; text-align:left; padding:10px 12px;">操作内容</th>
            <th style="color:#64748b; font-size:11px; text-align:left; padding:10px 12px; width:80px;">类型</th>
            <th style="color:#64748b; font-size:11px; text-align:left; padding:10px 12px; width:120px;">操作对象</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="4" style="color:#64748b; text-align:center; padding:32px;">加载中...</td>
          </tr>
          <tr v-else-if="logs.length === 0">
            <td colspan="4" style="color:#64748b; text-align:center; padding:32px;">暂无日志记录</td>
          </tr>
          <tr
            v-for="log in logs"
            :key="log.id"
            style="border-bottom: 1px solid rgba(255,255,255,0.04);"
            class="hover:bg-white/[0.03]"
          >
            <td style="color:#64748b; font-size:11px; white-space:nowrap; padding:10px 12px;">
              {{ formatDate(log.createdAt) }}
            </td>
            <td style="padding:10px 12px; max-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              <span style="color:#94a3b8; font-size:12px;" :title="log.detail">{{ log.detail }}</span>
            </td>
            <td style="padding:10px 12px;">
              <span :class="getActionTagClass(log.action)" style="font-size:10px; padding:2px 8px; border-radius:4px; display:inline-block;">
                {{ getActionLabel(log.action) }}
              </span>
            </td>
            <td style="color:#94a3b8; font-size:11px; white-space:nowrap; padding:10px 12px;">
              {{ log.target }}
            </td>
          </tr>
        </tbody>
      </table>

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
