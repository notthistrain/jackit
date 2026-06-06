import type { FlatModel } from '../hooks/useAllModels'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { useAllModels } from '../hooks/useAllModels'
import { modelSelect } from './model-select.variants'

interface ModelSelectProps {
  value: number | null
  onChange: (modelId: number) => void
}

export function ModelSelect({ value, onChange }: ModelSelectProps) {
  const { t } = useT()
  const { models } = useAllModels()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = models.find(m => m.modelId === value)

  const filtered = search
    ? models.filter((m) => {
        const q = search.toLowerCase()
        return (
          m.modelName.toLowerCase().includes(q)
          || m.providerName.toLowerCase().includes(q)
          || m.keyName.toLowerCase().includes(q)
        )
      })
    : models

  // Close on outside click
  useEffect(() => {
    if (!open)
      return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Focus search when opening
  useEffect(() => {
    if (open) {
      setSearch('')
      setHighlightedIndex(-1)
      setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open])

  function handleSelect(model: FlatModel) {
    onChange(model.modelId)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open)
      return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1))
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(i => Math.max(i - 1, 0))
    }
    else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      handleSelect(filtered[highlightedIndex])
    }
    else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const styles = modelSelect()

  return (
    <div className={styles.root()} ref={ref} onKeyDown={handleKeyDown}>
      <button
        onClick={() => setOpen(!open)}
        className={styles.trigger()}
      >
        <span className={selected ? styles.triggerText() : styles.triggerPlaceholder()}>
          {selected?.modelName || t('general.slot.selectModel')}
        </span>
        <ChevronDown size={12} className={styles.triggerIcon()} />
      </button>

      {open && (
        <div className={styles.dropdown()}>
          <div className={styles.searchWrapper()}>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setHighlightedIndex(-1)
              }}
              placeholder={t('general.slot.searchPlaceholder')}
              className={styles.search()}
            />
          </div>
          <div className={styles.list()}>
            {filtered.map((m, i) => (
              <div
                key={m.modelId}
                role="option"
                aria-label={m.modelName}
                className={styles.option({
                  highlighted: highlightedIndex === i,
                  selected: m.modelId === value,
                })}
                onClick={() => handleSelect(m)}
                onMouseEnter={() => setHighlightedIndex(i)}
              >
                <span>{m.modelName}</span>
                <span className={styles.optionMeta()}>
                  {m.providerName}
                  {' '}
                  ·
                  {m.keyName}
                </span>
              </div>
            ))}
            {filtered.length === 0 && <div className={styles.empty()}>{t('general.slot.noMatch')}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
