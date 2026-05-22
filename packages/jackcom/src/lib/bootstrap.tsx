import { getCurrentWindow } from '@tauri-apps/api/window'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LocaleProvider } from '@/i18n'
import { ErrorBoundary } from '@/lib/ErrorBoundary'
import '@/styles/globals.css'

export function bootstrap(Component: React.ComponentType) {
  const el = document.getElementById('root')
  if (!el)
    throw new Error('Root element not found')

  createRoot(el).render(
    <StrictMode>
      <ErrorBoundary>
        <LocaleProvider>
          <Component />
        </LocaleProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
  // 渲染完成后显示窗口，避免白屏
  getCurrentWindow().show()
}
