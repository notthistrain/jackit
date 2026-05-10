import type { ClassValue } from "clsx"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | Date): string {
  if (!dateStr)
    return '-'
  let date: Date
  if (typeof dateStr === 'string') {
    if (dateStr.includes('T') && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
      date = new Date(`${dateStr}Z`)
    }
    else {
      date = new Date(dateStr)
    }
  }
  else {
    date = dateStr
  }
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
