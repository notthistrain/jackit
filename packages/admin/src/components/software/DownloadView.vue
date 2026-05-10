<script setup lang="ts">
import { Download, Loader2, Moon, Sun } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTheme } from '@/composables/useTheme'

const { toggleTheme, isDark } = useTheme()
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
  <div class="min-h-screen bg-background">
    <div class="fixed top-4 right-4 z-50">
      <Button variant="outline" size="icon" class="rounded-full shadow-lg" @click="toggleTheme()">
        <Sun v-if="isDark" class="w-5 h-5" />
        <Moon v-else class="w-5 h-5" />
      </Button>
    </div>
    <div class="container mx-auto px-4 py-8">
      <div class="flex flex-col items-center justify-center min-h-[60vh]">
        <Card class="w-full max-w-md">
          <CardContent class="pt-6">
            <div class="text-center space-y-6">
              <div class="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Download class="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 class="text-2xl font-semibold mb-2">
                  {{ softwareName === 'toolbox' ? '工具盒' : softwareName }}
                </h1>
                <p class="text-muted-foreground">
                  点击下方按钮下载最新版本
                </p>
              </div>

              <p v-if="error" class="text-sm text-destructive">
                {{ error }}
              </p>

              <Button
                class="w-full"
                size="lg"
                :disabled="downloading"
                @click="handleDownload"
              >
                <Loader2 v-if="downloading" class="w-4 h-4 mr-2 animate-spin" />
                <Download v-else class="w-4 h-4 mr-2" />
                {{ downloading ? '获取下载链接...' : '立即下载' }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
