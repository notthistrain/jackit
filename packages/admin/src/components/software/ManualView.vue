<script setup lang="ts">
import type { Software } from '@/types'
import { BookOpen, Moon, Sun } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useApi } from '@/composables/useApi'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'

const api = useApi()
const auth = useAuth()
const software = ref<Software | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const { toggleTheme, isDark } = useTheme()

async function ensureAuthenticated() {
  if (!auth.isAuthenticated.value) {
    const result = await auth.login('guest', '')
    if (!result.success) {
      error.value = '自动登录失败，请刷新页面重试'
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
    error.value = '加载失败，请稍后重试'
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
  <div class="min-h-screen bg-background">
    <div class="fixed top-4 right-4 z-50">
      <Button variant="outline" size="icon" class="rounded-full shadow-lg" @click="toggleTheme()">
        <Sun v-if="isDark" class="w-5 h-5" />
        <Moon v-else class="w-5 h-5" />
      </Button>
    </div>
    <div class="container mx-auto px-4 py-8">
      <div class="space-y-6 max-w-4xl mx-auto">
        <div v-if="loading" class="text-center py-12 text-muted-foreground">
          加载中...
        </div>

        <div v-else-if="error" class="text-center py-12 text-muted-foreground">
          {{ error }}
        </div>

        <template v-else-if="software">
          <div class="flex items-center gap-3">
            <BookOpen class="w-6 h-6 text-primary" />
            <div>
              <h1 class="text-2xl font-semibold">
                {{ software.displayName || software.name }}
              </h1>
              <p class="text-muted-foreground text-sm">
                操作说明书
              </p>
            </div>
          </div>

          <Card>
            <CardContent>
              <div
                v-if="software.manual"
                class="rich-text prose max-w-none"
                v-html="software.manual"
              />
              <div v-else class="text-center py-12 text-muted-foreground">
                暂无操作说明书
              </div>
            </CardContent>
          </Card>
        </template>

        <div v-else class="text-center py-12 text-muted-foreground">
          软件不存在或已被删除
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.prose h1 {
  margin-top: 1.5rem;
}

.prose h2 {
  margin-top: 1.25rem;
}

.prose h3 {
  margin-top: 1rem;
}

.prose p {
  margin: 0.75rem 0;
}

.prose li {
  margin: 0.25rem 0;
}

.prose blockquote {
  margin: 0.75rem 0;
}

.prose code {
  padding: 0.125rem 0.375rem;
}

.prose pre {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin: 0.75rem 0;
}

.prose strong {
  font-weight: 600;
}

.prose em {
  font-style: italic;
}

.prose del {
  text-decoration: line-through;
  color: var(--muted-foreground);
}

.prose table {
  margin: 0.75rem 0;
}

.prose table td,
.prose table th {
  padding: 0.5rem 0.75rem;
}

.prose table tr:nth-child(even) {
  background-color: color-mix(in srgb, var(--muted) 30%, transparent);
}
</style>
