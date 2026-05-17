import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Layout } from '@/components/Layout'
import { useAppStore } from '@/stores/useAppStore'
import { usePreferences } from '@/hooks/usePreferences'
import { useT } from '@/i18n'

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
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])

  // 渲染完成后显示窗口，避免白屏
  useEffect(() => {
    getCurrentWindow().show()
  }, [])

  return <Layout />
}
