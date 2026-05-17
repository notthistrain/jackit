import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LocaleProvider } from '@/i18n'
import '@/styles/globals.css'

export function bootstrap(Component: React.ComponentType) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LocaleProvider>
        <Component />
      </LocaleProvider>
    </StrictMode>,
  )
  // 渲染完成后显示窗口，避免白屏
  getCurrentWindow().show()
}
