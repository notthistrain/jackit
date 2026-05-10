<script setup lang="ts">
import type { CreateSoftwareDTO, Software } from '@/types'
import { Plus } from 'lucide-vue-next'
import { onUnmounted, ref } from 'vue'
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
      <Button size="sm">
        <Plus class="w-4 h-4 mr-1" />
        新建软件
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>新建软件</DialogTitle>
        <DialogDescription>
          创建一个新的软件项目
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="name">名称 <span class="text-destructive">*</span></Label>
          <Input id="name" v-model="form.name" placeholder="软件名称（唯一标识）" required />
        </div>
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
      </form>
      <DialogFooter>
        <Button variant="outline" @click="open = false">
          取消
        </Button>
        <Button :disabled="loading || !form.name.trim()" @click="handleSubmit">
          {{ loading ? '创建中...' : '创建' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
