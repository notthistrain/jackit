import { invoke } from '@tauri-apps/api/core'
import { useCallback } from 'react'
import { useMainStore } from '@/lib/store'

interface PortInfo {
  name: string
  manufacturer: string | null
  product: string | null
  serial_number: string | null
  port_type: string
}

/**
 * 串口连接操作 hook
 *
 * 封装 Tauri invoke 调用：enumerate / open / close / send
 */
export function useSerialPort() {
  const { addConnection, removeConnection } = useMainStore()

  const enumerate = useCallback(async () => {
    return invoke<PortInfo[]>('enumerate_ports')
  }, [])

  const open = useCallback(async (config: {
    port_name: string
    baud_rate: number
    data_bits: string
    stop_bits: string
    parity: string
    flow_control: string
  }) => {
    await invoke('open_port', { request: config })
    addConnection(config.port_name, config.baud_rate)
  }, [addConnection])

  const close = useCallback(async (portName: string) => {
    await invoke('close_port', { request: { port_name: portName } })
    removeConnection(portName)
  }, [removeConnection])

  const send = useCallback(async (portName: string, hexData: string) => {
    await invoke('send_data', { request: { port_name: portName, hex_data: hexData, protocol: 'raw' } })
  }, [])

  const closeAll = useCallback(async () => {
    await invoke('close_all')
  }, [])

  return { enumerate, open, close, send, closeAll }
}
