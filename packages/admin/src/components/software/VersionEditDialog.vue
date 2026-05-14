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
      <button v-if="isEdit" class="text-[#67e8f9] text-[11px] px-3 py-[5px] bg-[rgba(6,182,212,0.1)] border border-[rgba(6,182,212,0.25)] rounded-md">
        编辑
      </button>
      <button v-else class="bg-gradient-primary rounded-md px-3 py-1.5 text-white text-xs font-medium">
        + 添加版本
      </button>
    </DialogTrigger>
    <DialogContent
      class="sm:max-w-[500px]"
      style="background: linear-gradient(180deg, #111827, #0f172a);"
    >
      <DialogHeader>
        <DialogTitle class="text-white">{{ isEdit ? '编辑版本' : '添加版本' }}</DialogTitle>
        <DialogDescription class="text-[#94a3b8] text-[13px]">
          {{ isEdit ? '修改版本信息' : '为软件添加新版本' }}
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="flex items-center gap-3">
          <label class="shrink-0 text-[#94a3b8] text-xs min-w-[64px]">版本号</label>
          <input v-model="form.sequence" class="flex-1 dark-input px-3 py-2 text-xs" placeholder="如: 1.0.0" required />
        </div>
        <div class="flex items-center gap-3">
          <label class="shrink-0 text-[#94a3b8] text-xs min-w-[64px]">文件路径</label>
          <input v-model="form.key" class="flex-1 dark-input px-3 py-2 text-xs" placeholder="S3 文件路径" />
        </div>
        <div class="flex items-center gap-3">
          <label class="shrink-0 text-[#94a3b8] text-xs min-w-[64px]">文件大小</label>
          <input v-model.number="form.size" class="flex-1 dark-input px-3 py-2 text-xs" type="number" placeholder="文件大小（字节）" />
        </div>
        <div class="flex items-center gap-3">
          <div class="shrink-0 text-[#94a3b8] text-xs min-w-[64px]">强制更新</div>
          <div class="flex items-center space-x-2">
            <Checkbox id="force" v-model:checked="form.force" />
            <label for="force" class="text-[#e2e8f0] text-xs">开启强制更新</label>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <label class="shrink-0 pt-2 text-[#94a3b8] text-xs min-w-[64px]">更新日志</label>
          <textarea v-model="form.changelog" class="flex-1 dark-input px-3 py-2 text-xs" rows="4" placeholder="版本更新内容" />
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
          :disabled="loading || !form.sequence"
          @click="handleSubmit"
        >
          {{ loading ? '保存中...' : '保存' }}
        </button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
