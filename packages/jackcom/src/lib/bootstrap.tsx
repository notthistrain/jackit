import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
}
