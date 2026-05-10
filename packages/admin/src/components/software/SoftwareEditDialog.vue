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
      <button style="color:#67e8f9; font-size:11px; padding:5px 12px; background:rgba(6,182,212,0.1); border:1px solid rgba(6,182,212,0.25); border-radius:6px;">
        编辑
      </button>
    </DialogTrigger>
    <DialogContent
      class="sm:max-w-[500px]"
      style="background: linear-gradient(180deg, #111827, #0f172a); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px;"
    >
      <DialogHeader>
        <DialogTitle style="color: white;">编辑软件信息</DialogTitle>
        <DialogDescription style="color: #94a3b8; font-size: 13px;">
          修改 {{ software.name }} 的基本信息
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="flex items-center gap-3">
          <label class="shrink-0" style="color:#94a3b8; font-size:12px; min-width:64px;">显示名称</label>
          <input v-model="form.displayName" class="flex-1 dark-input px-3 py-2 text-xs" placeholder="软件显示名称" />
        </div>
        <div class="flex items-center gap-3">
          <label class="shrink-0" style="color:#94a3b8; font-size:12px; min-width:64px;">标识符</label>
          <input v-model="form.identifier" class="flex-1 dark-input px-3 py-2 text-xs" placeholder="软件唯一标识符" />
        </div>
        <div class="flex items-start gap-3">
          <label class="shrink-0 pt-2" style="color:#94a3b8; font-size:12px; min-width:64px;">描述</label>
          <textarea v-model="form.description" class="flex-1 dark-input px-3 py-2 text-xs" rows="3" placeholder="软件描述" />
        </div>
        <div class="flex items-start gap-3">
          <label class="shrink-0 pt-2" style="color:#94a3b8; font-size:12px; min-width:64px;">操作手册</label>
          <textarea v-model="form.manual" class="flex-1 dark-input px-3 py-2 text-xs" rows="5" placeholder="操作手册内容（支持 Markdown）" />
        </div>
      </form>
      <DialogFooter>
        <button
          style="color:#94a3b8; font-size:12px; padding:7px 16px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:6px;"
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
