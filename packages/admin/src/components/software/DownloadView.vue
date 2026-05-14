<script setup lang="ts">
import { onMounted, ref } from 'vue'

const downloading = ref(false)
const error = ref<string | null>(null)
const softwareName = ref('toolbox')

onMounted(() => {
  const name = new URLSearchParams(window.location.search).get('name')
  if (name) {
    softwareName.value = name
  }
})

async function handleDownload() {
  downloading.value = true
  error.value = null

  try {
    const response = await fetch(`/api/tools/download-latest/${softwareName.value}`)
    const result = await response.json()

    if (result.success && result.data.url) {
      window.location.href = result.data.url
    }
    else {
      error.value = result.message || '获取下载链接失败'
    }
  }
  catch (err) {
    console.error('Failed to get download url:', err)
    error.value = '获取下载链接失败，请稍后重试'
  }
  finally {
    downloading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen relative">
    <!-- 光晕 -->
    <div class="absolute top-[20%] left-1/2 -translate-x-1/2 w-[400px] h-[200px]" style="background: radial-gradient(ellipse, rgba(6,182,212,0.06) 0%, transparent 70%);" />

    <!-- 下载卡片 -->
    <div class="relative text-center w-[320px] bg-white/[0.04] backdrop-blur-[20px] border border-white/[0.08] rounded-2xl px-8 py-9">
      <!-- 图标 -->
      <div class="mx-auto mb-4 flex items-center justify-center rounded-xl size-14 text-2xl" style="background: linear-gradient(135deg, rgba(6,182,212,0.2), rgba(59,130,246,0.2));">
        📦
      </div>

      <div class="text-[#f1f5f9] text-lg font-semibold mb-1">
        {{ softwareName === 'toolbox' ? 'Toolbox 工具盒' : softwareName }}
      </div>
      <div class="text-[#64748b] text-[11px] mb-5">
        组件升级管理客户端
      </div>

      <!-- 下载按钮 -->
      <button
        class="w-full rounded-lg py-2.5 text-white text-sm font-medium transition-opacity"
        :class="{ 'opacity-60': downloading }"
        :disabled="downloading"
        style="background: linear-gradient(135deg, #06b6d4, #3b82f6);"
        @click="handleDownload"
      >
        {{ downloading ? '获取下载链接...' : '⬇ 立即下载' }}
      </button>

      <div v-if="error" class="mt-3 text-xs text-[#f87171]">{{ error }}</div>

      <div class="mt-3 text-[#475569] text-[9px]">
        适用于 Windows 10/11
      </div>
    </div>
  </div>
</template>