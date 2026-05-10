<script setup lang="ts">
import type { CreateVersionDTO, SoftwareVersion, UpdateVersionDTO } from '@/types'
import { Pencil, Plus } from 'lucide-vue-next'
import { onUnmounted, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
      <Button v-if="isEdit" variant="ghost" size="sm">
        <Pencil class="w-4 h-4" />
      </Button>
      <Button v-else variant="outline" size="sm">
        <Plus class="w-4 h-4 mr-1" />
        添加版本
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑版本' : '添加版本' }}</DialogTitle>
        <DialogDescription>
          {{ isEdit ? '修改版本信息' : '为软件添加新版本' }}
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="sequence">版本号 *</Label>
          <Input id="sequence" v-model="form.sequence" placeholder="如: 1.0.0" required />
        </div>
        <div class="space-y-2">
          <Label for="key">文件路径</Label>
          <Input id="key" v-model="form.key" placeholder="S3 文件路径" />
        </div>
        <div class="space-y-2">
          <Label for="size">文件大小 (字节)</Label>
          <Input id="size" v-model.number="form.size" type="number" placeholder="文件大小" />
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="force" v-model:checked="form.force" />
          <Label for="force">强制更新</Label>
        </div>
        <div class="space-y-2">
          <Label for="changelog">更新日志</Label>
          <Textarea id="changelog" v-model="form.changelog" placeholder="版本更新内容" rows="4" />
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="open = false">
          取消
        </Button>
        <Button :disabled="loading || !form.sequence" @click="handleSubmit">
          {{ loading ? '保存中...' : '保存' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
