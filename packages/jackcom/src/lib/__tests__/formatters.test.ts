import { describe, it, expect } from 'vitest'
import {
  bytesToHex,
  bytesToAscii,
  hexToBytes,
  formatTimestamp,
  formatBytes,
  formatBaudRate,
} from '../formatters'

describe('bytesToHex', () => {
  it('converts byte array to hex string', () => {
    expect(bytesToHex([0x01, 0x03, 0x00, 0x0a])).toBe('01 03 00 0A')
  })

  it('handles empty array', () => {
    expect(bytesToHex([])).toBe('')
  })

  it('handles single byte', () => {
    expect(bytesToHex([0xff])).toBe('FF')
  })
})

describe('bytesToAscii', () => {
  it('converts printable bytes to ASCII', () => {
    expect(bytesToAscii([0x48, 0x65, 0x6c, 0x6c, 0x6f])).toBe('Hello')
  })

  it('replaces non-printable bytes with dot', () => {
    expect(bytesToAscii([0x01, 0x02, 0x48, 0x69])).toBe('..Hi')
  })

  it('handles empty array', () => {
    expect(bytesToAscii([])).toBe('')
  })
})

describe('hexToBytes', () => {
  it('converts hex string to bytes', () => {
    expect(hexToBytes('01 03 AB')).toEqual([0x01, 0x03, 0xab])
  })

  it('handles continuous hex', () => {
    expect(hexToBytes('0103AB')).toEqual([0x01, 0x03, 0xab])
  })

  it('handles empty string', () => {
    expect(hexToBytes('')).toEqual([])
  })

  it('returns null for odd length', () => {
    expect(hexToBytes('ABC')).toBeNull()
  })

  it('returns null for invalid chars', () => {
    expect(hexToBytes('GG')).toBeNull()
  })

  it('is case insensitive', () => {
    expect(hexToBytes('aabbCC')).toEqual([0xaa, 0xbb, 0xcc])
  })
})

describe('formatTimestamp', () => {
  it('formats ISO string to HH:MM:SS.mmm', () => {
    const iso = '2026-05-11T14:23:01.234Z'
    const result = formatTimestamp(iso)
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/)
  })
})

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(12847)).toBe('12.5KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1500000)).toBe('1.4MB')
  })
})

describe('formatBaudRate', () => {
  it('formats with comma', () => {
    expect(formatBaudRate(115200)).toBe('115,200')
  })

  it('formats small numbers', () => {
    expect(formatBaudRate(9600)).toBe('9,600')
  })
})
