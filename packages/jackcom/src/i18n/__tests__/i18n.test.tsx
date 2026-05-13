import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach, beforeAll } from 'vitest'

import { LocaleProvider, useT, __injectMessages } from '../index'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>
}

// 注入测试用的 messages（因为 import.meta.glob 在 vitest 中可能不可用）
beforeAll(() => {
  __injectMessages({
    zh: { 'app.title': 'JackCom', 'menu.file.label': '文件' },
    en: { 'app.title': 'JackCom', 'menu.file.label': 'File' },
  })
})

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('provides t() function that returns translated string', () => {
    const { result } = renderHook(() => useT(), { wrapper })
    expect(result.current.t('app.title')).toBe('JackCom')
    expect(result.current.t('menu.file.label')).toBe('文件')
  })

  it('returns key when translation is missing', () => {
    const { result } = renderHook(() => useT(), { wrapper })
    expect(result.current.t('nonexistent.key')).toBe('nonexistent.key')
  })

  it('supports parameter substitution', () => {
    const { result } = renderHook(() => useT(), { wrapper })
    expect(result.current.t('app.title', { name: 'test' })).toBe('JackCom')
  })

  it('switches locale', async () => {
    const { result } = renderHook(() => useT(), { wrapper })
    expect(result.current.locale).toBe('zh')
    act(() => {
      result.current.setLocale('en')
    })
    await waitFor(() => {
      expect(result.current.locale).toBe('en')
    })
    expect(result.current.t('menu.file.label')).toBe('File')
  })

  it('persists locale to localStorage', () => {
    const { result } = renderHook(() => useT(), { wrapper })
    act(() => {
      result.current.setLocale('en')
    })
    expect(localStorage.getItem('jackcom:locale')).toBe('en')
  })

  it('reads locale from localStorage on init', () => {
    localStorage.setItem('jackcom:locale', 'en')
    const { result } = renderHook(() => useT(), { wrapper })
    expect(result.current.locale).toBe('en')
  })
})
