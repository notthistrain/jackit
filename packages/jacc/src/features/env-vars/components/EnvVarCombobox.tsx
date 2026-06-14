import type { EnvGroup, EnvVarMeta } from '../api/env-catalog'
import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/i18n'
import { searchCatalog } from '../api/env-catalog'
import { envVarCombobox } from './env-var-combobox.variants'

export interface EnvVarComboboxProps {
  value: string
  onSelect: (meta: EnvVarMeta) => void
  /** 已设置的变量名，下拉项中去重（不重复展示/添加） */
  existingKeys?: string[]
  className?: string
}

const GROUP_ORDER: EnvGroup[] = ['auth', 'endpoint', 'model', 'cache', 'bedrock', 'vertex', 'foundry', 'feature', 'context', 'effort', 'timeout', 'proxy', 'tls', 'telemetry', 'ui', 'session', 'debug']

export function EnvVarCombobox({ value, onSelect, existingKeys }: EnvVarComboboxProps) {
  const { t } = useT()
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  // 选中后父组件会把选中名作为 value 回填，需把 query 同步过去，
  // 否则输入框停留在旧的搜索文本/空值，看起来像没选中。
  useEffect(() => {
    setQuery(value)
  }, [value])
  const { root, input, dropdown, groupTitle, optionName, optionHint, custom } = envVarCombobox()

  // 去重：已设置的变量不出现在下拉项
  const existingSet = useMemo(() => new Set(existingKeys ?? []), [existingKeys])
  const results = useMemo(
    () => searchCatalog(query).filter(m => !existingSet.has(m.name)),
    [query, existingSet],
  )
  const trimmed = query.trim()
  const exact = results.some(m => m.name === trimmed)
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
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
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
                  title={meta.description + (meta.sensitive ? t('envvars.add.sensitiveHint') : '')}
                  // onMouseDown + preventDefault：点击选项时不让 input 失焦，
                  // 否则 onBlur 会先于 onClick 关闭下拉，导致选不上。
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(meta)
                  }}
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
          {trimmed && !exact && !existingSet.has(trimmed) && (
            <div
              className={custom()}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect({ name: trimmed, group: 'feature', type: 'string', sensitive: false, description: '' })
                setOpen(false)
              }}
            >
              {t('envvars.add.useCustom', { name: trimmed })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
