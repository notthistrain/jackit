<script setup lang="ts">
import type { CreateSoftwareDTO, Software } from '@/types'
import { onUnmounted, ref } from 'vue'
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

const emit = defineEmits<{
  created: [Software]
}>()

const api = useApi()
const open = ref(false)
const loading = ref(false)
const form = ref<CreateSoftwareDTO>({
  name: '',
  displayName: '',
  identifier: '',
  description: '',
})

async function handleSubmit() {
  if (!form.value.name.trim()) {
    return
  }
  loading.value = true
  try {
    const result = await api.software.create(form.value)
    emit('created', result)
    open.value = false
    form.value = {
      name: '',
      displayName: '',
      identifier: '',
      description: '',
    }
  }
  catch (error) {
    console.error('Failed to create software:', error)
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
      <button class="bg-gradient-primary rounded-md px-3 py-1.5 text-white text-xs font-medium">
        + 新建软件
      </button>
    </DialogTrigger>
    <DialogContent
      class="sm:max-w-[500px]"
      style="background: linear-gradient(180deg, #111827, #0f172a); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px;"
    >
      <DialogHeader>
        <DialogTitle style="color: white;">
          新建软件
        </DialogTitle>
        <DialogDescription style="color: #94a3b8; font-size: 13px;">
          创建一个新的软件项目
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="flex items-center gap-3">
          <label class="shrink-0" style="color:#94a3b8; font-size:12px; min-width:64px;">名称</label>
          <input v-model="form.name" class="flex-1 dark-input px-3 py-2 text-xs" placeholder="软件名称（唯一标识）" required>
        </div>
        <div class="flex items-center gap-3">
          <label class="shrink-0" style="color:#94a3b8; font-size:12px; min-width:64px;">显示名称</label>
          <input v-model="form.displayName" class="flex-1 dark-input px-3 py-2 text-xs" placeholder="软件显示名称">
        </div>
        <div class="flex items-center gap-3">
          <label class="shrink-0" style="color:#94a3b8; font-size:12px; min-width:64px;">标识符</label>
          <input v-model="form.identifier" class="flex-1 dark-input px-3 py-2 text-xs" placeholder="软件唯一标识符">
        </div>
        <div class="flex items-start gap-3">
          <label class="shrink-0 pt-2" style="color:#94a3b8; font-size:12px; min-width:64px;">描述</label>
          <textarea v-model="form.description" class="flex-1 dark-input px-3 py-2 text-xs" rows="3" placeholder="软件描述" />
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
          :disabled="loading || !form.name.trim()"
          @click="handleSubmit"
        >
          {{ loading ? '创建中...' : '创建' }}
        </button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
