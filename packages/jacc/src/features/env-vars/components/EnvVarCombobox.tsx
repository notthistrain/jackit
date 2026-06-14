import { useMemo, useState } from 'react'
import { useT } from '@/i18n'
import type { EnvGroup, EnvVarMeta } from '../api/env-catalog'
import { searchCatalog } from '../api/env-catalog'
import { envVarCombobox } from './env-var-combobox.variants'

export interface EnvVarComboboxProps {
  value: string
  onSelect: (meta: EnvVarMeta) => void
  className?: string
}

const GROUP_ORDER: EnvGroup[] = ['auth', 'endpoint', 'model', 'cache', 'bedrock', 'vertex',
  'foundry', 'feature', 'context', 'effort', 'timeout', 'proxy', 'tls', 'telemetry', 'ui', 'session', 'debug']

export function EnvVarCombobox({ value, onSelect }: EnvVarComboboxProps) {
  const { t } = useT()
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const { root, input, dropdown, groupTitle, optionName, optionHint, custom } = envVarCombobox()

  const results = useMemo(() => searchCatalog(query), [query])
  const exact = results.some(m => m.name === query.trim())
  const grouped = useMemo(() => {
    const map = new Map<EnvGroup, EnvVarMeta[]>()
    for (const m of results) {
      const arr = map.get(m.group) ?? []
      arr.push(m)
      map.set(m.group, arr)
    }
    return GROUP_ORDER.filter(g => map.has(g)).map(g => [g, map.get(g)!] as const)
  }, [results])

  function pick(meta: EnvVarMeta) {
    if (meta.slotManaged)
      return
    onSelect(meta)
    setOpen(false)
  }

  return (
    <div className={root()}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={t('envvars.add.searchPlaceholder')}
        className={input()}
      />
      {open && (
        <div className={dropdown()}>
          {grouped.map(([group, metas]) => (
            <div key={group}>
              <div className={groupTitle()}>{t(`envgroup.${group}`)}</div>
              {metas.map(meta => (
                <div
                  key={meta.name}
                  data-disabled={!!meta.slotManaged}
                  title={meta.description + (meta.sensitive ? ' · 含密钥将写入 settings.local.json' : '')}
                  onClick={() => pick(meta)}
                  className={envVarCombobox({ disabled: !!meta.slotManaged }).option()}
                >
                  <span className={optionName()}>{meta.name}</span>
                  <span className={optionHint()}>
                    {meta.slotManaged ? t('envvars.add.slotManaged') : meta.sensitive ? '🔒' : ''}
                  </span>
                </div>
              ))}
            </div>
          ))}
          {query.trim() && !exact && (
            <div
              className={custom()}
              onClick={() => {
                onSelect({ name: query.trim(), group: 'feature', type: 'string', sensitive: false, description: '' })
                setOpen(false)
              }}
            >
              {t('envvars.add.useCustom', { name: query.trim() })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
