import { useEffect, useRef, useCallback, useState } from 'react'
import { on, type DisplayFrame, type PortDataPayload } from '@/lib/tauri-events'

interface UseDataFeedOptions {
  portId?: string | null // 只订阅指定端口，null = 全部
  batchSize?: number
  flushInterval?: number
}

interface UseDataFeedReturn {
  frames: DisplayFrame[]
  totalCount: number
  clear: () => void
}

/**
 * 订阅 port:data 事件，100ms 批处理 flush
 *
 * 使用 ref 存储全量数据避免重渲染，
 * 只在 flush 时更新 state（可见范围 + totalCount）。
 */
export function useDataFeed(options: UseDataFeedOptions = {}): UseDataFeedReturn {
  const { portId, flushInterval = 100 } = options

  const allFramesRef = useRef<DisplayFrame[]>([])
  const batchRef = useRef<DisplayFrame[]>([])
  const [frames, setFrames] = useState<DisplayFrame[]>([])
  const [totalCount, setTotalCount] = useState(0)

  const flush = useCallback(() => {
    if (batchRef.current.length === 0) return

    allFramesRef.current = [...allFramesRef.current, ...batchRef.current]
    batchRef.current = []

    // 只更新最近一批用于渲染
    setFrames(allFramesRef.current.slice(-1000))
    setTotalCount(allFramesRef.current.length)
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    let unlisten: (() => void) | null = null

    const setup = async () => {
      unlisten = await on('port:data', (payload: PortDataPayload) => {
        // 过滤端口
        if (portId && payload.port_id !== portId) return

        batchRef.current.push(...payload.frames)
      })

      timer = setInterval(flush, flushInterval)
    }

    setup()

    return () => {
      if (timer) clearInterval(timer)
      if (unlisten) unlisten()
    }
  }, [portId, flushInterval, flush])

  const clear = useCallback(() => {
    allFramesRef.current = []
    batchRef.current = []
    setFrames([])
    setTotalCount(0)
  }, [])

  return { frames, totalCount, clear }
}
