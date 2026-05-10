<script setup lang="ts">
import { Box, Settings, Wrench } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

defineProps<{
  currentPage?: 'tools' | 'settings'
}>()
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <aside class="group w-14 hover:w-48 transition-all duration-300 ease-in-out border-r bg-card text-card-foreground flex flex-col overflow-hidden">
      <div class="p-3 border-b flex items-center">
        <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Box class="size-4 text-primary" />
        </div>
        <span class="ml-3 font-bold text-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          工具箱
        </span>
      </div>
      <nav class="flex-1 p-2 space-y-1">
        <a href="/index.html" class="block">
          <Button :variant="currentPage === 'tools' ? 'secondary' : 'ghost'" class="w-full justify-start gap-3 px-2">
            <Wrench class="size-5 shrink-0" />
            <span class="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">工具</span>
          </Button>
        </a>
        <a href="/settings/index.html" class="block">
          <Button :variant="currentPage === 'settings' ? 'secondary' : 'ghost'" class="w-full justify-start gap-3 px-2">
            <Settings class="size-5 shrink-0" />
            <span class="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">设置</span>
          </Button>
        </a>
      </nav>
    </aside>
    <main class="flex-1 overflow-auto p-6">
      <slot />
    </main>
  </div>
</template>
