import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEffect } from 'react'
import { useT } from '@/i18n'
import { ToastProvider } from '@/providers/ToastProvider'
import { Layout } from '@/shared/components/layout/Layout'
import { usePreferences } from '@/shared/hooks/usePreferences'
import { useAppStore } from '@/stores/useAppStore'

export default function App() {
  const { theme, setTheme } = useAppStore()
  const { get } = usePreferences()
  const { setLocale } = useT()

  // 启动时加载偏好
  useEffect(() => {
    get('theme').then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setTheme(saved)
      }
    })
    get('locale').then((saved) => {
      if (saved === 'zh' || saved === 'en') {
        setLocale(saved)
      }
    })
  }, [get, setTheme, setLocale])

  // 应用主题到 DOM
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    }
    else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])

  // 渲染完成后显示窗口，避免白屏
  useEffect(() => {
    getCurrentWindow().show()
  }, [])

  return (
    <ToastProvider>
      <Layout />
    </ToastProvider>
  )
}
