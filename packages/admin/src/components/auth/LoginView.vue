<script setup lang="ts">
import { Lock, LogIn, Moon, Package, Sun, User } from 'lucide-vue-next'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'

const { isDark, toggleTheme } = useTheme()
const { login } = useAuth()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const result = await login(username.value, password.value)
    if (result.success) {
      window.location.href = '/'
    } else {
      error.value = result.message || '登录失败，请检查用户名和密码'
    }
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (err) {
    error.value = '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-background flex items-center justify-center p-4">
    <Button variant="ghost" size="icon" class="fixed top-4 right-4" @click="toggleTheme()">
      <Sun v-if="isDark" class="w-5 h-5" />
      <Moon v-else class="w-5 h-5" />
    </Button>

    <Card class="w-full max-w-md">
      <CardHeader class="text-center">
        <div class="flex justify-center mb-4">
          <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Package class="w-6 h-6 text-primary" />
          </div>
        </div>
        <CardTitle class="text-2xl">upgrade-component</CardTitle>
        <CardDescription>软件版本管理系统</CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div class="space-y-2">
            <Label for="username">用户名</Label>
            <div class="relative">
              <User class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="username"
                v-model="username"
                type="text"
                placeholder="请输入用户名"
                class="pl-10"
              />
            </div>
          </div>

          <div class="space-y-2">
            <Label for="password">密码</Label>
            <div class="relative">
              <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                v-model="password"
                type="password"
                placeholder="请输入密码"
                class="pl-10"
              />
            </div>
          </div>

          <p v-if="error" class="text-sm text-destructive">
            {{ error }}
          </p>

          <Button type="submit" class="w-full" :disabled="loading">
            <LogIn class="w-4 h-4 mr-2" />
            {{ loading ? '登录中...' : '登录' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
