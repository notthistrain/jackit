<script setup lang="ts">
import type { Software, SoftwareVersion } from '@/types'
import { ArrowLeft, BookOpen, Calendar, ExternalLink, FileCode, Hash, Package } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApi } from '@/composables/useApi'
import { formatDate } from '@/lib/utils'
import ManualEditor from './ManualEditor.vue'
import SoftwareEditDialog from './SoftwareEditDialog.vue'
import VersionTable from './VersionTable.vue'

const api = useApi()
const software = ref<Software | null>(null)
const versions = ref<SoftwareVersion[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const editingManual = ref(false)
const softwareId = ref<number>(0)

async function fetchData() {
  if (!softwareId.value || Number.isNaN(softwareId.value)) {
    loading.value = false
    error.value = '无效的软件ID'
    return
  }

  loading.value = true
  error.value = null

  try {
    const [softwareData, versionsData] = await Promise.all([
      api.software.getById(softwareId.value),
      api.software.getVersions(softwareId.value),
    ])
    software.value = softwareData
    versions.value = versionsData
  }
  catch (err) {
    console.error('Failed to fetch software detail:', err)
    error.value = '加载失败，请稍后重试'
  }
  finally {
    loading.value = false
  }
}

function handleUpdated(updated: Software) {
  software.value = updated
}

function handleManualSaved(updated: Software) {
  software.value = updated
  editingManual.value = false
}

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const id = params.get('id')
  softwareId.value = id ? Number(id) : 0
  fetchData()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="sm" as-child>
        <a href="/">
          <ArrowLeft class="w-4 h-4 mr-1" />
          返回列表
        </a>
      </Button>
    </div>

    <div v-if="loading" class="text-center py-12 text-muted-foreground">
      加载中...
    </div>

    <div v-else-if="error" class="text-center py-12 text-muted-foreground">
      {{ error }}
    </div>

    <template v-else-if="software">
      <ManualEditor
        v-if="editingManual"
        :software-id="softwareId"
        @saved="handleManualSaved"
        @back="editingManual = false"
      />

      <template v-else>
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-2xl font-semibold">
              {{ software.displayName || software.name }}
            </h1>
            <p class="text-muted-foreground mt-1">
              {{ software.description || '暂无描述' }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Button v-if="software.manual" variant="outline" size="sm" as-child>
              <a :href="`/manual?id=${software.id}`" target="_blank">
                <ExternalLink class="w-4 h-4 mr-1" />
                查看说明书
              </a>
            </Button>
            <Button variant="outline" size="sm" @click="editingManual = true">
              <BookOpen class="w-4 h-4 mr-1" />
              编辑说明书
            </Button>
            <SoftwareEditDialog :software="software" @updated="handleUpdated" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle class="text-lg">
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div class="space-y-1">
                <div class="flex items-center gap-2 text-muted-foreground text-sm">
                  <Package class="w-4 h-4" />
                  软件名称
                </div>
                <p class="font-medium">
                  {{ software.name }}
                </p>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-2 text-muted-foreground text-sm">
                  <Hash class="w-4 h-4" />
                  标识符
                </div>
                <p class="font-medium">
                  <Badge v-if="software.identifier" variant="secondary">
                    {{ software.identifier }}
                  </Badge>
                  <span v-else class="text-muted-foreground">-</span>
                </p>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-2 text-muted-foreground text-sm">
                  <FileCode class="w-4 h-4" />
                  文件扩展名
                </div>
                <p class="font-medium">
                  {{ software.ext || '-' }}
                </p>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-2 text-muted-foreground text-sm">
                  <Calendar class="w-4 h-4" />
                  创建时间
                </div>
                <p class="font-medium">
                  {{ formatDate(software.createdAt) }}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <VersionTable :versions="versions" :software-id="softwareId" @refresh="fetchData" />
          </CardContent>
        </Card>
      </template>
    </template>

    <div v-else class="text-center py-12 text-muted-foreground">
      软件不存在或已被删除
    </div>
  </div>
</template>
