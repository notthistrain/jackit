import { useState, useCallback } from 'react'

export interface SerialConfig {
  portName: string
  baudRate: number
  dataBits: number
  stopBits: number
  parity: string
  flowControl: string
}

const STORAGE_KEY = 'jackcom:serial-config'
const RECENT_KEY = 'jackcom:recent-connections'
const MAX_RECENT = 5

const defaultConfig: SerialConfig = {
  portName: '',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
}

function loadConfig(): SerialConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...defaultConfig, ...JSON.parse(saved) }
  } catch { /* ignore */ }
  return { ...defaultConfig }
}

function loadRecent(): SerialConfig[] {
  try {
    const saved = localStorage.getItem(RECENT_KEY)
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }
  return []
}

export function useSerialConfig() {
  const [config, setConfigState] = useState<SerialConfig>(loadConfig)
  const [recentConfigs, setRecentConfigs] = useState<SerialConfig[]>(loadRecent)

  const setConfig = useCallback((partial: Partial<SerialConfig>) => {
    setConfigState(prev => {
      const next = { ...prev, ...partial }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const saveAsRecent = useCallback(() => {
    setRecentConfigs(prev => {
      const filtered = prev.filter(
        c => !(c.portName === config.portName && c.baudRate === config.baudRate)
      )
      const next = [config, ...filtered].slice(0, MAX_RECENT)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [config])

  return { config, setConfig, recentConfigs, saveAsRecent }
}
