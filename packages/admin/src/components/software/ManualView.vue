<script setup lang="ts">
import type { Software } from '@/types'
import { onMounted, ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuth } from '@/composables/useAuth'

const api = useApi()
const auth = useAuth()
const software = ref<Software | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function ensureAuthenticated() {
  if (!auth.isAuthenticated.value) {
    const result = await auth.login('guest', '')
    if (!result.success) {
      error.value = '自动登录失败,请刷新页面重试'
      loading.value = false
      return false
    }
  }
  return true
}

async function fetchData() {
  const params = new URLSearchParams(window.location.search)
  const id = params.get('id')
  const identifier = params.get('identifier')

  if (!id && !identifier) {
    loading.value = false
    error.value = '缺少软件ID或标识符'
    return
  }

  loading.value = true
  error.value = null

  try {
    if (id) {
      software.value = await api.software.getById(Number(id))
    }
    else if (identifier) {
      const list = await api.software.getList(1, 1, identifier)
      const found = list.data.find(s => s.identifier === identifier)
      if (found) {
        software.value = await api.software.getById(found.id)
      }
      else {
        error.value = '未找到对应的软件'
      }
    }
  }
  catch (err) {
    console.error('Failed to fetch software:', err)
    error.value = '加载失败,请稍后重试'
  }
  finally {
    loading.value = false
  }
}

onMounted(async () => {
  const authenticated = await ensureAuthenticated()
  if (authenticated) {
    await fetchData()
  }
})
</script>

<template>
  <div class="min-h-screen" style="background: #0c1222;">
    <div class="mx-auto px-5 py-10" style="max-width: 720px;">
      <div v-if="loading" class="text-center py-20" style="color: #64748b;">
        加载中...
      </div>
      <div v-else-if="error" class="text-center py-20" style="color: #f87171;">
        {{ error }}
      </div>
      <template v-else-if="software">
        <!-- eslint-disable-next-line vue/no-v-html -- 内容由管理后台 Tiptap 编辑器生成，可信来源 -->
        <div v-if="software.manual" class="manual-content" v-html="software.manual" />
        <div v-else class="text-center py-20" style="color: #64748b;">
          暂无操作说明书
        </div>
      </template>
      <div v-else class="text-center py-20" style="color: #64748b;">
        软件不存在或已被删除
      </div>

      <div class="mt-6 text-center" style="color: #334155; font-size: 10px;">
        Powered by Upgrade
      </div>
    </div>
  </div>
</template>
