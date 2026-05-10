<script setup lang="ts">
import type { Software } from '@/types'
import { ArrowLeft, FileUp, Save } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    const result = await api.software.update(props.softwareId, {
      manual: content.value,
    })
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
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="sm" @click="emit('back')">
          <ArrowLeft class="w-4 h-4 mr-1" />
          返回
        </Button>
        <h2 class="text-xl font-semibold">
          编辑操作说明书
          <span v-if="software" class="text-muted-foreground font-normal">
            - {{ software.displayName || software.name }}
          </span>
        </h2>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" :disabled="loading" @click="triggerFileInput">
          <FileUp class="w-4 h-4 mr-1" />
          导入 Markdown
        </Button>
        <Button :disabled="saving" @click="handleSave">
          <Save class="w-4 h-4 mr-1" />
          {{ saving ? '保存中...' : '保存' }}
        </Button>
      </div>
      <input
        ref="fileInputRef"
        type="file"
        accept=".md,.markdown"
        class="hidden"
        @change="handleFileSelect"
      >
    </div>

    <Card>
      <CardHeader>
        <CardTitle>操作说明书</CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="loading" class="text-center py-8 text-muted-foreground">
          加载中...
        </div>
        <TiptapEditor
          v-else
          ref="editorRef"
          v-model="content"
          placeholder="在此编写操作说明书..."
        />
      </CardContent>
    </Card>
  </div>
</template>
