import { listen, type UnlistenFn } from '@tauri-apps/api/event'

// === Payload 类型 ===
// 与 Rust PortEvent serde 输出一一对应

export interface SerialConfig {
  port_name: string
  baud_rate: number
  data_bits: 'five' | 'six' | 'seven' | 'eight'
  stop_bits: 'one' | 'two'
  parity: 'none' | 'odd' | 'even'
  flow_control: 'none' | 'hardware' | 'software'
}

export interface DisplayFrame {
  id: number
  timestamp: string
  direction: 'rx' | 'tx'
  raw_hex: string
  formatted: string
  protocol: string
  summary: string
}

export interface PortDataPayload {
  port_id: string
  frames: DisplayFrame[]
}

export interface PortOpenedPayload {
  port_id: string
  config: SerialConfig
}

export interface PortClosedPayload {
  port_id: string
  reason: 'disconnected' | 'error' | 'removed'
}

export interface PortErrorPayload {
  port_id: string
  error: string
}

export interface PortChangePayload {
  arrived: string[]
  removed: string[]
}

export interface PortStatsPayload {
  port_id: string
  rx: number
  tx: number
  fps: number
}

// === Event Map ===

export type EventMap = {
  'port:data': PortDataPayload
  'port:opened': PortOpenedPayload
  'port:closed': PortClosedPayload
  'port:error': PortErrorPayload
  'port:change': PortChangePayload
  'port:stats': PortStatsPayload
}

// === 类型安全 listen 封装 ===

export function on<K extends keyof EventMap>(
  event: K,
  handler: (payload: EventMap[K]) => void,
): Promise<UnlistenFn> {
  return listen<EventMap[K]>(event, (e) => handler(e.payload))
}
