import type { DisplayFrame, PortDataPayload } from '@/lib/tauri-events'
import { useCallback, useEffect, useRef, useState } from 'react'
import { on } from '@/lib/tauri-events'

const MAX_FRAMES = 10000
const RENDER_WINDOW = 1000

interface UseDataFeedOptions {
  portId?: string | null // 只订阅指定端口，null = 全部
  batchSize?: number
  flushInterval?: number
  clearSequence?: number // 外部清屏信号，变化时自动 clear
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
  const { portId, flushInterval = 100, clearSequence } = options

  const allFramesRef = useRef<DisplayFrame[]>([])
  const batchRef = useRef<DisplayFrame[]>([])
  const [frames, setFrames] = useState<DisplayFrame[]>([])
  const [totalCount, setTotalCount] = useState(0)

  const flush = useCallback(() => {
    if (batchRef.current.length === 0)
      return

    allFramesRef.current = [...allFramesRef.current, ...batchRef.current]
    // 限制内存：超过上限时丢弃旧数据
    if (allFramesRef.current.length > MAX_FRAMES) {
      allFramesRef.current = allFramesRef.current.slice(-MAX_FRAMES)
    }
    batchRef.current = []

    // 只更新最近一批用于渲染
    setFrames(allFramesRef.current.slice(-RENDER_WINDOW))
    setTotalCount(allFramesRef.current.length)
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    let unlisten: (() => void) | null = null
    let cancelled = false

    const setup = async () => {
      const unsub = await on('port:data', (payload: PortDataPayload) => {
        // 已取消则忽略
        if (cancelled)
          return
        // 过滤端口
        if (portId && payload.port_id !== portId)
          return

        batchRef.current.push(...payload.frames)
      })

      // 诊断日志：确认订阅已建立
      console.log(`[useDataFeed] subscribed port:data (portId=${portId ?? 'all'})`)

      // 如果在 await 期间已经 unmount，立即取消订阅
      if (cancelled) {
        unsub()
        return
      }

      unlisten = unsub
      timer = setInterval(flush, flushInterval)
    }

    setup()

    return () => {
      cancelled = true
      if (timer)
        clearInterval(timer)
      if (unlisten)
        unlisten()
    }
  }, [portId, flushInterval, flush])

  const clear = useCallback(() => {
    allFramesRef.current = []
    batchRef.current = []
    setFrames([])
    setTotalCount(0)
  }, [])

  // 外部清屏信号：clearSequence 变化时自动 clear
  useEffect(() => {
    if (clearSequence && clearSequence > 0) {
      clear()
    }
  }, [clearSequence, clear])

  return { frames, totalCount, clear }
}
