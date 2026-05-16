import { useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { useAppStore } from '@/stores/useAppStore'
import { usePreferences } from '@/hooks/usePreferences'

export default function App() {
  const { theme, setTheme } = useAppStore()
  const { get } = usePreferences()

  // 启动时加载主题偏好
  useEffect(() => {
    get('theme').then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setTheme(saved)
      }
    })
  }, [get, setTheme])

  // 应用主题到 DOM
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])

  return <Layout />
}
