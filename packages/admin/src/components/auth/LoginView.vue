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
    <div class="absolute -top-[60px] -right-[40px] size-[300px] rounded-full" style="background: radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%);" />
    <div class="absolute -bottom-[80px] -left-[60px] size-[250px] rounded-full" style="background: radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%);" />

    <!-- 登录卡片 -->
    <div
      class="relative w-[420px] bg-white/[0.04] backdrop-blur-[20px] border border-white/[0.08] rounded-2xl px-9 py-10"
    >
      <!-- 品牌 -->
      <div class="flex items-center gap-2.5 mb-7">
        <div class="flex items-center justify-center rounded-xl bg-gradient-primary size-9 text-base">
          📦
        </div>
        <div>
          <div class="text-[#f1f5f9] font-semibold text-[15px]">Upgrade</div>
          <div class="text-[#64748b] text-[10px]">组件升级管理平台</div>
        </div>
      </div>

      <!-- 表单 -->
      <form @submit.prevent="handleLogin" class="space-y-3.5">
        <div class="flex items-center gap-3">
          <label class="text-[#94a3b8] text-xs min-w-[48px] whitespace-nowrap">用户名</label>
          <input
            v-model="username"
            type="text"
            placeholder="请输入用户名"
            class="flex-1 dark-input px-3 py-2.5 text-xs"
          />
        </div>
        <div class="flex items-center gap-3">
          <label class="text-[#94a3b8] text-xs min-w-[48px] whitespace-nowrap">密码</label>
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
      >
        {{ loading ? '登录中...' : '登 录' }}
      </button>

      <!-- 底部 -->
      <div class="text-center mt-4 text-[#475569] text-[10px]">
        🔒 安全连接 · Upgrade Admin
      </div>
    </div>
  </div>
</template>