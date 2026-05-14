import type { PortChangePayload } from '@/lib/tauri-events'
import { useEffect } from 'react'
import { on } from '@/lib/tauri-events'

/**
 * 监听端口热插拔事件
 *
 * 在组件挂载时订阅 port:change，卸载时自动取消。
 */
export function usePortWatcher(onChange: (change: PortChangePayload) => void) {
  useEffect(() => {
    let unlisten: (() => void) | null = null

    const setup = async () => {
      unlisten = await on('port:change', onChange)
    }

    setup()

    return () => {
      if (unlisten)
        unlisten()
    }
  }, [onChange])
}
