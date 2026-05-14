/**
 * 字节数组 → HEX 字符串
 * [0x01, 0x03, 0x00] → "01 03 00"
 */
export function bytesToHex(data: number[] | Uint8Array): string {
  return Array.from(data)
    .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')
}

/**
 * 字节数组 → ASCII（不可见字符替换为 '.'）
 */
export function bytesToAscii(data: number[] | Uint8Array): string {
  return Array.from(data)
    .map(b => (b >= 0x20 && b < 0x7F ? String.fromCharCode(b) : '.'))
    .join('')
}

/**
 * HEX 字符串 → 字节数组
 * "01 03 AB" → [0x01, 0x03, 0xAB]
 * 支持空格分隔或连续输入
 */
export function hexToBytes(hex: string): number[] | null {
  const cleaned = hex.replace(/\s+/g, '')
  if (cleaned.length === 0)
    return []
  if (cleaned.length % 2 !== 0)
    return null
  if (!/^[0-9A-F]*$/i.test(cleaned))
    return null

  const bytes: number[] = []
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes.push(Number.parseInt(cleaned.substring(i, i + 2), 16))
  }
  return bytes
}

/**
 * 格式化时间戳（ISO → HH:MM:SS.mmm）
 */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const s = d.getSeconds().toString().padStart(2, '0')
  const ms = d.getMilliseconds().toString().padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

/**
 * 格式化字节数（人性化）
 * 12847 → "12.5KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024)
    return `${bytes}B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/**
 * 波特率格式化
 */
export function formatBaudRate(rate: number): string {
  return rate.toLocaleString()
}
