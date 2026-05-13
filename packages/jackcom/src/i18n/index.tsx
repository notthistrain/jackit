/// <reference types="vite/client" />
import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

// Vite glob 自动发现所有语言包
const localeModules = import.meta.glob<Record<string, string>>(
  './locales/*.json',
  { eager: true },
)

// 从文件名提取 locale key: './locales/zh.json' → 'zh'
const messages: Record<string, Record<string, string>> = {}
for (const [path, mod] of Object.entries(localeModules)) {
  const locale = path.match(/\/([^/]+)\.json$/)?.[1] ?? ''
  if (locale) messages[locale] = (mod as any).default ?? mod
}

export type Locale = string

const STORAGE_KEY = 'jackcom:locale'
const DEFAULT_LOCALE: Locale = 'zh'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_LOCALE
    }
    catch {
      return DEFAULT_LOCALE
    }
  })

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
    }
    catch {
      // localStorage unavailable
    }
  }, [])

  const t = useCallback((key: string, params?: Record<string, string>): string => {
    let text = messages[locale]?.[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v)
      }
    }
    return text
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used within LocaleProvider')
  return ctx
}

// 测试用：注入 messages（import.meta.glob 在 vitest 中可能不可用）
export function __injectMessages(msgs: Record<string, Record<string, string>>) {
  Object.assign(messages, msgs)
}
