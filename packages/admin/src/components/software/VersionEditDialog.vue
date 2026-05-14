<script setup lang="ts">
import type { CreateVersionDTO, SoftwareVersion, UpdateVersionDTO } from '@/types'
import { onUnmounted, ref, watch } from 'vue'
import { Checkbox } from '@/components/ui/checkbox'
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
  softwareId: number
  version?: SoftwareVersion
}>()

const emit = defineEmits<{
  saved: [SoftwareVersion]
}>()

const api = useApi()
const open = ref(false)
const loading = ref(false)
const isEdit = ref(false)
const form = ref<CreateVersionDTO>({
  sequence: '',
  key: '',
  size: undefined,
  force: false,
  changelog: '',
})

watch(() => props.version, (newVal) => {
  isEdit.value = !!newVal
  if (newVal) {
    form.value = {
      sequence: newVal.sequence,
      key: newVal.key || '',
      size: newVal.size || undefined,
      force: newVal.force,
      changelog: newVal.changelog || '',
    }
  }
  else {
    form.value = {
      sequence: '',
      key: '',
      size: undefined,
      force: false,
      changelog: '',
    }
  }
}, { immediate: true })

async function handleSubmit() {
  loading.value = true
  try {
    let result: SoftwareVersion
    if (isEdit.value && props.version) {
      result = await api.version.update(props.version.id, form.value as UpdateVersionDTO)
    }
    else {
      result = await api.software.createVersion(props.softwareId, form.value)
    }
    emit('saved', result)
    open.value = false
  }
  catch (error) {
    console.error('Failed to save version:', error)
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
      <button v-if="isEdit" style="color:#67e8f9; font-size:11px; padding:5px 12px; background:rgba(6,182,212,0.1); border:1px solid rgba(6,182,212,0.25); border-radius:6px;">
        编辑
      </button>
      <button v-else class="bg-gradient-primary rounded-md px-3 py-1.5 text-white text-xs font-medium">
        + 添加版本
      </button>
    </DialogTrigger>
    <DialogContent
      class="sm:max-w-[500px]"
      style="background: linear-gradient(180deg, #111827, #0f172a); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px;"
    >
      <DialogHeader>
        <DialogTitle style="color: white;">
          {{ isEdit ? '编辑版本' : '添加版本' }}
        </DialogTitle>
        <DialogDescription style="color: #94a3b8; font-size: 13px;">
          {{ isEdit ? '修改版本信息' : '为软件添加新版本' }}
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="flex items-center gap-3">
          <label class="shrink-0" style="color:#94a3b8; font-size:12px; min-width:64px;">版本号</label>
          <input v-model="form.sequence" class="flex-1 dark-input px-3 py-2 text-xs" placeholder="如: 1.0.0" required>
        </div>
        <div class="flex items-center gap-3">
          <label class="shrink-0" style="color:#94a3b8; font-size:12px; min-width:64px;">文件路径</label>
          <input v-model="form.key" class="flex-1 dark-input px-3 py-2 text-xs" placeholder="S3 文件路径">
        </div>
        <div class="flex items-center gap-3">
          <label class="shrink-0" style="color:#94a3b8; font-size:12px; min-width:64px;">文件大小</label>
          <input v-model.number="form.size" class="flex-1 dark-input px-3 py-2 text-xs" type="number" placeholder="文件大小（字节）">
        </div>
        <div class="flex items-center gap-3">
          <div class="shrink-0" style="color:#94a3b8; font-size:12px; min-width:64px;">
            强制更新
          </div>
          <div class="flex items-center space-x-2">
            <Checkbox id="force" v-model:checked="form.force" />
            <label for="force" style="color:#e2e8f0; font-size:12px;">开启强制更新</label>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <label class="shrink-0 pt-2" style="color:#94a3b8; font-size:12px; min-width:64px;">更新日志</label>
          <textarea v-model="form.changelog" class="flex-1 dark-input px-3 py-2 text-xs" rows="4" placeholder="版本更新内容" />
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
          :disabled="loading || !form.sequence"
          @click="handleSubmit"
        >
          {{ loading ? '保存中...' : '保存' }}
        </button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
