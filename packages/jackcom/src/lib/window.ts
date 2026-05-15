import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

interface CreateChildWindowOptions {
  label: string
  url: string
  title: string
  width?: number
  height?: number
}

/**
 * 创建或聚焦子窗口
 *
 * 如果同 label 的窗口已存在，聚焦它；否则创建新窗口。
 */
export async function createOrFocusChildWindow(opts: CreateChildWindowOptions): Promise<WebviewWindow> {
  // 检查窗口是否已存在
  const existing = await WebviewWindow.getByLabel(opts.label)
  if (existing != null) {
    await (existing as any).setFocus()
    return existing
  }

  const winOpts: Record<string, unknown> = {
    url: opts.url,
    title: opts.title,
    width: opts.width ?? 800,
    height: opts.height ?? 600,
    center: true,
    decorations: true,
    backgroundColor: '#1E1E1E',
  }

  const win = new WebviewWindow(opts.label, winOpts)

  // 监听窗口错误
  win.once('tauri://error', (e) => {
    console.error('Window creation error:', e)
  })

  return win
}

/**
 * 创建波形监控窗口
 * label: "waveform-{portName}"
 */
export async function openWaveformWindow(portName: string): Promise<WebviewWindow> {
  return createOrFocusChildWindow({
    label: `waveform-${portName}`,
    url: `/waveform/?port=${encodeURIComponent(portName)}`,
    title: `Waveform — ${portName}`,
    width: 900,
    height: 500,
  })
}

/**
 * 创建协议解码窗口
 * label: "decoder-{portName}"
 */
export async function openDecoderWindow(portName: string): Promise<WebviewWindow> {
  return createOrFocusChildWindow({
    label: `decoder-${portName}`,
    url: `/decoder/?port=${encodeURIComponent(portName)}`,
    title: `Protocol Decoder — ${portName}`,
    width: 700,
    height: 500,
  })
}

/**
 * 创建历史窗口（全局唯一）
 */
export async function openHistoryWindow(): Promise<WebviewWindow> {
  return createOrFocusChildWindow({
    label: 'history',
    url: '/history/',
    title: 'JackCom — History',
    width: 1000,
    height: 600,
  })
}

/**
 * 从 URL query 参数获取 port 名
 */
export function getPortFromUrl(): string | null {
  if (typeof window === 'undefined')
    return null
  const params = new URLSearchParams(window.location.search)
  return params.get('port')
}
