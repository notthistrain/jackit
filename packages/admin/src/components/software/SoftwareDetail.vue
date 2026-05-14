<script setup lang="ts">
import type { Software, SoftwareVersion } from '@/types'
import { onMounted, ref } from 'vue'
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
  <div>
    <!-- 返回链接 -->
    <a href="/" style="color: #67e8f9; font-size: 12px;" class="inline-flex items-center gap-1 hover:underline mb-4">
      ← 返回列表
    </a>

    <div v-if="loading" class="text-center py-20" style="color: #64748b;">
      加载中...
    </div>
    <div v-else-if="error" class="text-center py-20" style="color: #f87171;">
      {{ error }}
    </div>

    <template v-else-if="software">
      <!-- 编辑说明书模式 -->
      <ManualEditor
        v-if="editingManual"
        :software-id="softwareId"
        @saved="handleManualSaved"
        @back="editingManual = false"
      />

      <template v-else>
        <!-- 信息卡片 -->
        <div class="glass-card p-5 mb-4">
          <!-- 头部 -->
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="shrink-0 flex items-center justify-center rounded-xl bg-gradient-primary" style="width:40px; height:40px; font-size:16px;">
                📦
              </div>
              <div>
                <div style="color: #e2e8f0; font-size: 16px; font-weight: 600;">
                  {{ software.displayName || software.name }}
                </div>
                <div v-if="software.identifier" style="color: #67e8f9; font-size: 11px;">
                  {{ software.identifier }}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <a
                v-if="software.manual"
                :href="`/manual?id=${software.id}`"
                target="_blank"
                style="color: #67e8f9; font-size: 11px; padding: 5px 12px; background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.25); border-radius: 6px;"
              >
                📄 说明书
              </a>
              <button
                style="color: #94a3b8; font-size: 11px; padding: 5px 12px; background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.25); border-radius: 6px;"
                @click="editingManual = true"
              >
                编辑说明书
              </button>
              <SoftwareEditDialog :software="software" @updated="handleUpdated" />
            </div>
          </div>

          <!-- 描述 -->
          <div v-if="software.description" style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px 14px; color: #94a3b8; font-size: 12px; line-height: 1.7; margin-bottom: 16px;">
            {{ software.description }}
          </div>

          <!-- 元数据网格 -->
          <div class="grid grid-cols-3 gap-4">
            <div>
              <div style="color: #64748b; font-size: 10px; margin-bottom: 2px;">
                最新版本
              </div>
              <div style="color: #67e8f9; font-size: 13px; font-weight: 500;">
                {{ versions.length > 0 ? versions[0].sequence : '-' }}
              </div>
            </div>
            <div>
              <div style="color: #64748b; font-size: 10px; margin-bottom: 2px;">
                版本数量
              </div>
              <div style="color: #e2e8f0; font-size: 13px; font-weight: 500;">
                {{ versions.length }}
              </div>
            </div>
            <div>
              <div style="color: #64748b; font-size: 10px; margin-bottom: 2px;">
                创建时间
              </div>
              <div style="color: #94a3b8; font-size: 13px; font-weight: 500;">
                {{ formatDate(software.createdAt) }}
              </div>
            </div>
          </div>
        </div>

        <!-- 版本历史 -->
        <VersionTable :versions="versions" :software-id="softwareId" @refresh="fetchData" />
      </template>
    </template>

    <div v-else class="text-center py-20" style="color: #64748b;">
      软件不存在或已被删除
    </div>
  </div>
</template>
