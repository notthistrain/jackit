import { computed, reactive, ref } from 'vue'

interface AuthState {
  accessToken: string | null
  user: {
    userId: number
    username: string
  } | null
}

interface LoginResponse {
  success: boolean
  data?: {
    accessToken: string
    expiresIn: number
    userId: number
    username: string
  }
  message?: string
}

const state = reactive<AuthState>({
  accessToken: null,
  user: null,
})

const isInitialized = ref(false)

const TOKEN_KEY = 'accessToken'

function loadToken() {
  if (typeof window === 'undefined')
    return
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    state.accessToken = token
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      state.user = {
        userId: payload.userId,
        username: payload.username,
      }
    }
    catch {
      state.accessToken = null
      state.user = null
    }
  }
  isInitialized.value = true
}

function saveToken(token: string) {
  if (typeof window === 'undefined')
    return
  localStorage.setItem(TOKEN_KEY, token)
  state.accessToken = token
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    state.user = {
      userId: payload.userId,
      username: payload.username,
    }
  }
  catch {
    state.user = null
  }
}

function clearToken() {
  if (typeof window === 'undefined')
    return
  localStorage.removeItem(TOKEN_KEY)
  state.accessToken = null
  state.user = null
}

if (typeof window !== 'undefined') {
  loadToken()
}

export function useAuth() {
  const isAuthenticated = computed(() => !!state.accessToken)

  async function login(username: string, password: string): Promise<{ success: boolean, message?: string }> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data: LoginResponse = await response.json()

      if (data.success && data.data) {
        saveToken(data.data.accessToken)
        return { success: true }
      }

      return { success: false, message: data.message || '登录失败' }
    }
    catch (error) {
      console.error('Login error:', error)
      return { success: false, message: '网络错误，请稍后重试' }
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      })
    }
    catch {
      // ignore
    }
    clearToken()
  }

  async function refreshToken(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
      })

      const data: LoginResponse = await response.json()

      if (data.success && data.data) {
        saveToken(data.data.accessToken)
        return true
      }

      clearToken()
      return false
    }
    catch {
      clearToken()
      return false
    }
  }

  function getAuthHeaders(): Record<string, string> {
    if (!state.accessToken)
      return {}
    return {
      Authorization: `Bearer ${state.accessToken}`,
    }
  }

  return {
    accessToken: computed(() => state.accessToken),
    user: computed(() => state.user),
    isAuthenticated,
    isInitialized,
    login,
    logout,
    refreshToken,
    getAuthHeaders,
  }
}
