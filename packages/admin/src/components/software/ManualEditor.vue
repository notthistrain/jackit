<script setup lang="ts">
import type { Software } from '@/types'
import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { TiptapEditor } from '@/components/ui/tiptap-editor'
import { useApi } from '@/composables/useApi'

const props = defineProps<{
  softwareId: number
}>()

const emit = defineEmits<{
  saved: [Software]
  back: []
}>()

const api = useApi()
const software = ref<Software | null>(null)
const content = ref('')
const loading = ref(false)
const saving = ref(false)
const editorRef = ref<InstanceType<typeof TiptapEditor> | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

async function fetchData() {
  loading.value = true
  try {
    const result = await api.software.getById(props.softwareId)
    software.value = result
    content.value = result.manual || ''
  }
  catch (error) {
    console.error('Failed to fetch software:', error)
  }
  finally {
    loading.value = false
  }
}

async function handleSave() {
  if (!software.value)
    return
  saving.value = true
  try {
    const result = await api.software.update(props.softwareId, { manual: content.value })
    software.value = result
    emit('saved', result)
  }
  catch (error) {
    console.error('Failed to save manual:', error)
  }
  finally {
    saving.value = false
  }
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
    toast.error('请选择 Markdown 文件 (.md 或 .markdown)')
    return
  }
  const reader = new FileReader()
  reader.onload = (e) => {
    const markdown = e.target?.result as string
    if (markdown && editorRef.value) {
      editorRef.value.importMarkdown(markdown)
    }
  }
  reader.readAsText(file)
  input.value = ''
}

onMounted(fetchData)
</script>

<template>
  <div>
    <!-- 顶栏 -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <button
          style="color:#67e8f9; font-size:12px;"
          class="hover:underline"
          @click="emit('back')"
        >
          ← 返回详情
        </button>
        <span style="color:#64748b; font-size:10px;">/</span>
        <span style="color:#e2e8f0; font-size:13px; font-weight:500;">
          编辑说明书
          <span v-if="software" style="color:#64748b; font-weight:400;"> — {{ software.displayName || software.name }}</span>
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          style="color:#94a3b8; font-size:11px; padding:5px 12px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:6px;"
          :disabled="loading"
          @click="triggerFileInput"
        >
          导入 MD
        </button>
        <button
          class="bg-gradient-primary rounded-md px-4 py-1.5 text-white text-xs font-medium"
          :disabled="saving"
          @click="handleSave"
        >
          {{ saving ? '保存中...' : '保存' }}
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".md,.markdown"
          class="hidden"
          @change="handleFileSelect"
        >
      </div>
    </div>

    <!-- 编辑器 -->
    <div class="glass-card p-4">
      <div v-if="loading" class="text-center py-8" style="color:#64748b;">
        加载中...
      </div>
      <TiptapEditor
        v-else
        ref="editorRef"
        v-model="content"
        placeholder="在此编写操作说明书..."
      />
    </div>
  </div>
</template>
