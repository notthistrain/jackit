/// <reference types="vite/client" />
import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

const localeModules = import.meta.glob<Record<string, string>>(
  './locales/*.json',
  { eager: true },
)

const messages: Record<string, Record<string, string>> = {}
for (const [path, mod] of Object.entries(localeModules)) {
  const locale = path.match(/\/([^/]+)\.json$/)?.[1] ?? ''
  if (locale) messages[locale] = (mod as any).default ?? mod
}

export type Locale = 'zh' | 'en'

const STORAGE_KEY = 'jacc:locale'
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
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'zh' || saved === 'en') return saved
      return DEFAULT_LOCALE
    } catch {
      return DEFAULT_LOCALE
    }
  })

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
    } catch {
      // localStorage unavailable
    }
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      let text = messages[locale]?.[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replaceAll(`{${k}}`, v)
        }
      }
      return text
    },
    [locale],
  )

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
