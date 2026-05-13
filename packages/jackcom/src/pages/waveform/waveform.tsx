import '@/styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WaveformApp from '@/apps/WaveformApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WaveformApp />
  </StrictMode>
)
