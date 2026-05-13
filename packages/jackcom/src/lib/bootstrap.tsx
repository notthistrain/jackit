import '@/styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

export function bootstrap(Component: React.ComponentType) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Component />
    </StrictMode>
  )
}
