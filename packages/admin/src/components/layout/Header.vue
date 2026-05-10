<script setup lang="ts">
import { FileText, Home, LogOut, Moon, Package, Sun, User } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'

const { toggleTheme, isDark } = useTheme()
const { user, logout, isInitialized } = useAuth()

async function handleLogout() {
  await logout()
  window.location.href = '/login'
}
</script>

<template>
  <header class="border-b bg-background">
    <div class="container mx-auto px-4 h-14 flex items-center justify-between">
      <div class="flex items-center gap-6">
        <a href="/" class="flex items-center gap-2 font-semibold text-lg">
          <Package class="w-5 h-5" />
          upgrade-component
        </a>
        <nav class="flex items-center gap-4">
          <a
            href="/"
            class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home class="w-4 h-4" />
            软件管理
          </a>
          <a
            href="/logs"
            class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText class="w-4 h-4" />
            操作日志
          </a>
        </nav>
      </div>
      <div class="flex items-center gap-2">
        <div v-if="isInitialized && user" class="flex items-center gap-1.5 text-sm text-muted-foreground">
          <User class="w-4 h-4" />
          {{ user.username }}
        </div>
        <Button variant="ghost" size="icon" @click="toggleTheme()">
          <Sun v-if="isDark" class="w-5 h-5" />
          <Moon v-else class="w-5 h-5" />
        </Button>
        <ConfirmDialog
          v-if="isInitialized && user"
          title="确认退出"
          description="确定要退出登录吗？"
          @confirm="handleLogout"
        >
          <Button variant="ghost" size="icon">
            <LogOut class="w-5 h-5" />
          </Button>
        </ConfirmDialog>
      </div>
    </div>
  </header>
</template>
