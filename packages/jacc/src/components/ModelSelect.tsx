import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAllModels, type FlatModel } from '@/hooks/useAllModels'
import { useT } from '@/i18n'

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

  const selected = models.find((m) => m.modelId === value)

  const filtered = search
    ? models.filter((m) => {
        const q = search.toLowerCase()
        return (
          m.modelName.toLowerCase().includes(q) ||
          m.providerName.toLowerCase().includes(q) ||
          m.keyName.toLowerCase().includes(q)
        )
      })
    : models

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      handleSelect(filtered[highlightedIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={ref} onKeyDown={handleKeyDown}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 border border-border rounded-[2px] text-xs bg-sidebar text-foreground hover:bg-sidebar/80"
      >
        <span className={selected ? '' : 'text-muted'}>
          {selected?.modelName || t('general.slot.selectModel')}
        </span>
        <ChevronDown size={12} className="text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-20 min-w-[280px]">
          <div className="p-1.5 border-b border-border">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setHighlightedIndex(-1) }}
              placeholder={t('general.slot.searchPlaceholder')}
              className="w-full px-2 py-1 text-xs bg-sidebar border border-border rounded-[2px] text-foreground placeholder:text-muted outline-none"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {filtered.map((m, i) => (
              <div
                key={m.modelId}
                role="option"
                aria-label={m.modelName}
                className={`flex items-center justify-between px-2.5 py-1.5 text-xs cursor-pointer ${
                  highlightedIndex === i ? 'bg-sidebar' : ''
                } ${m.modelId === value ? 'text-primary font-medium' : 'text-foreground'}`}
                onClick={() => handleSelect(m)}
                onMouseEnter={() => setHighlightedIndex(i)}
              >
                <span>{m.modelName}</span>
                <span className="text-[10px] text-muted shrink-0 ml-2">
                  {m.providerName} · {m.keyName}
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-2.5 py-2 text-xs text-muted text-center">无匹配结果</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
