import '@/styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import HistoryApp from '@/apps/HistoryApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HistoryApp />
  </StrictMode>
)
