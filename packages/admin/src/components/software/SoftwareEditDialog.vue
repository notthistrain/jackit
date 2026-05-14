<script setup lang="ts">
import type { Software, UpdateSoftwareDTO } from '@/types'
import { onUnmounted, ref, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useApi } from '@/composables/useApi'

const props = defineProps<{
  software: Software
}>()

const emit = defineEmits<{
  updated: [Software]
}>()

const api = useApi()
const open = ref(false)
const loading = ref(false)
const form = ref<UpdateSoftwareDTO>({
  displayName: '',
  description: '',
  identifier: '',
  manual: '',
})

watch(() => props.software, (newVal) => {
  if (newVal) {
    form.value = {
      displayName: newVal.displayName || '',
      description: newVal.description || '',
      identifier: newVal.identifier || '',
      manual: newVal.manual || '',
    }
  }
}, { immediate: true })

async function handleSubmit() {
  loading.value = true
  try {
    const result = await api.software.update(props.software.id, form.value)
    emit('updated', result)
    open.value = false
  }
  catch (error) {
    console.error('Failed to update software:', error)
  }
  finally {
    loading.value = false
  }
}

onUnmounted(() => {
  open.value = false
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <button class="text-[#67e8f9] text-[11px] px-3 py-[5px] bg-[rgba(6,182,212,0.1)] border border-[rgba(6,182,212,0.25)] rounded-md">
        编辑
      </button>
    </DialogTrigger>
    <DialogContent
      class="sm:max-w-[500px]"
      style="background: linear-gradient(180deg, #111827, #0f172a);"
    >
      <DialogHeader>
        <DialogTitle class="text-white">编辑软件信息</DialogTitle>
        <DialogDescription class="text-[#94a3b8] text-[13px]">
          修改 {{ software.name }} 的基本信息
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="flex items-center gap-3">
          <label class="shrink-0 text-[#94a3b8] text-xs min-w-[64px]">显示名称</label>
          <input v-model="form.displayName" class="flex-1 dark-input px-3 py-2 text-xs" placeholder="软件显示名称" />
        </div>
        <div class="flex items-center gap-3">
          <label class="shrink-0 text-[#94a3b8] text-xs min-w-[64px]">标识符</label>
          <input v-model="form.identifier" class="flex-1 dark-input px-3 py-2 text-xs" placeholder="软件唯一标识符" />
        </div>
        <div class="flex items-start gap-3">
          <label class="shrink-0 pt-2 text-[#94a3b8] text-xs min-w-[64px]">描述</label>
          <textarea v-model="form.description" class="flex-1 dark-input px-3 py-2 text-xs" rows="3" placeholder="软件描述" />
        </div>
        <div class="flex items-start gap-3">
          <label class="shrink-0 pt-2 text-[#94a3b8] text-xs min-w-[64px]">操作手册</label>
          <textarea v-model="form.manual" class="flex-1 dark-input px-3 py-2 text-xs" rows="5" placeholder="操作手册内容（支持 Markdown）" />
        </div>
      </form>
      <DialogFooter>
        <button
          class="text-[#94a3b8] text-xs px-4 py-[7px] bg-white/[0.06] border border-white/[0.1] rounded-md"
          @click="open = false"
        >
          取消
        </button>
        <button
          class="bg-gradient-primary rounded-md px-4 py-1.5 text-white text-xs font-medium"
          :disabled="loading"
          @click="handleSubmit"
        >
          {{ loading ? '保存中...' : '保存' }}
        </button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
