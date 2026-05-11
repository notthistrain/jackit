<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'

const { login } = useAuth()
const toast = useToast()

const username = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) {
    toast.error('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    await login(username.value, password.value)
    window.location.href = '/'
  }
  catch (err) {
    toast.error('登录失败，请检查用户名和密码')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen relative overflow-hidden">
    <!-- 光晕装饰 -->
    <div class="absolute" style="top:-60px; right:-40px; width:300px; height:300px; background: radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%); border-radius:50%;" />
    <div class="absolute" style="bottom:-80px; left:-60px; width:250px; height:250px; background: radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%); border-radius:50%;" />

    <!-- 登录卡片 -->
    <div
      class="relative"
      style="width: 420px; background: rgba(255,255,255,0.04); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 40px 36px;"
    >
      <!-- 品牌 -->
      <div class="flex items-center gap-2.5 mb-7">
        <div class="flex items-center justify-center rounded-xl bg-gradient-primary" style="width:36px; height:36px; font-size:16px;">
          📦
        </div>
        <div>
          <div style="color: #f1f5f9; font-weight: 600; font-size: 15px;">Upgrade</div>
          <div style="color: #64748b; font-size: 10px;">组件升级管理平台</div>
        </div>
      </div>

      <!-- 表单 -->
      <form @submit.prevent="handleLogin" class="space-y-3.5">
        <div class="flex items-center gap-3">
          <label style="color: #94a3b8; font-size: 12px; min-width: 48px; white-space: nowrap;">用户名</label>
          <input
            v-model="username"
            type="text"
            placeholder="请输入用户名"
            class="flex-1 dark-input px-3 py-2.5 text-xs"
          />
        </div>
        <div class="flex items-center gap-3">
          <label style="color: #94a3b8; font-size: 12px; min-width: 48px; white-space: nowrap;">密码</label>
          <input
            v-model="password"
            type="password"
            placeholder="请输入密码"
            class="flex-1 dark-input px-3 py-2.5 text-xs"
            @keyup.enter="handleLogin"
          />
        </div>
      </form>

      <!-- 登录按钮 -->
      <button
        class="w-full mt-5 rounded-lg py-2.5 text-sm font-medium text-white transition-opacity"
        :class="{ 'opacity-60 cursor-not-allowed': loading }"
        :disabled="loading"
        style="background: linear-gradient(135deg, #06b6d4, #3b82f6);"
        @click="handleLogin"
      >
        {{ loading ? '登录中...' : '登 录' }}
      </button>

      <!-- 底部 -->
      <div class="text-center mt-4" style="color: #475569; font-size: 10px;">
        🔒 安全连接 · Upgrade Admin
      </div>
    </div>
  </div>
</template>