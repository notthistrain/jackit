<script setup lang="ts">
import type { Software, UpdateSoftwareDTO } from '@/types'
import { Pencil } from 'lucide-vue-next'
import { onUnmounted, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
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
      <Button variant="outline" size="sm">
        <Pencil class="w-4 h-4 mr-1" />
        编辑
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>编辑软件信息</DialogTitle>
        <DialogDescription>
          修改 {{ software.name }} 的基本信息
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="displayName">显示名称</Label>
          <Input id="displayName" v-model="form.displayName" placeholder="软件显示名称" />
        </div>
        <div class="space-y-2">
          <Label for="identifier">标识符</Label>
          <Input id="identifier" v-model="form.identifier" placeholder="软件唯一标识符" />
        </div>
        <div class="space-y-2">
          <Label for="description">描述</Label>
          <Textarea id="description" v-model="form.description" placeholder="软件描述" rows="3" />
        </div>
        <div class="space-y-2">
          <Label for="manual">操作手册</Label>
          <Textarea id="manual" v-model="form.manual" placeholder="操作手册内容（支持 Markdown）" rows="5" />
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="open = false">
          取消
        </Button>
        <Button :disabled="loading" @click="handleSubmit">
          {{ loading ? '保存中...' : '保存' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
