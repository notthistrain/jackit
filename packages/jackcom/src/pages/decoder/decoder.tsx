import '@/styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import DecoderApp from '@/apps/DecoderApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DecoderApp />
  </StrictMode>
)
