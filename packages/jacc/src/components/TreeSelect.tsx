import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useProviders } from '@/hooks/useProviders'
import { useApiKeys } from '@/hooks/useApiKeys'
import { useModels } from '@/hooks/useModels'

interface TreeSelectProps {
  value: number | null  // 选中的 model_id
  onChange: (modelId: number) => void
  placeholder?: string
}

export function TreeSelect({ value, onChange, placeholder = 'Select model...' }: TreeSelectProps) {
  const [open, setOpen] = useState(false)
  const [expandedProviders, setExpandedProviders] = useState<Set<number>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  const { providers } = useProviders()

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const [selectedLabel, setSelectedLabel] = useState<string>('')

  function toggleProvider(id: number) {
    setExpandedProviders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 bg-sidebar border border-border text-foreground px-2 py-1.5 rounded-[2px] text-xs min-w-[200px]"
      >
        <span className="flex-1 text-left truncate">
          {selectedLabel || placeholder}
        </span>
        <ChevronDown size={12} className="text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-20 min-w-[300px] max-h-[300px] overflow-y-auto">
          {providers.map((provider) => (
            <ProviderTreeItem
              key={provider.id}
              provider={provider}
              expanded={expandedProviders.has(provider.id)}
              onToggle={() => toggleProvider(provider.id)}
              selectedModelId={value}
              onSelect={(modelId, label) => {
                onChange(modelId)
                setSelectedLabel(label)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProviderTreeItem({ provider, expanded, onToggle, selectedModelId, onSelect }: {
  provider: { id: number; name: string }
  expanded: boolean
  onToggle: () => void
  selectedModelId: number | null
  onSelect: (modelId: number, label: string) => void
}) {
  const { apiKeys } = useApiKeys(provider.id)

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1.5 hover:bg-sidebar cursor-pointer text-xs font-medium"
        onClick={onToggle}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>{provider.name}</span>
      </div>
      {expanded && apiKeys.map((ak) => (
        <ApiKeyTreeItem
          key={ak.id}
          apiKey={ak}
          providerName={provider.name}
          selectedModelId={selectedModelId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function ApiKeyTreeItem({ apiKey, providerName, selectedModelId, onSelect }: {
  apiKey: { id: number; name: string }
  providerName: string
  selectedModelId: number | null
  onSelect: (modelId: number, label: string) => void
}) {
  const { models } = useModels(apiKey.id)

  return (
    <div>
      <div className="px-6 py-1 text-[11px] text-muted">{apiKey.name}</div>
      {models.map((m) => (
        <div
          key={m.id}
          className={`px-8 py-1.5 text-xs cursor-pointer hover:bg-sidebar ${
            selectedModelId === m.id ? 'text-primary font-medium' : 'text-foreground'
          }`}
          onClick={() => onSelect(m.id, `${providerName} / ${apiKey.name} / ${m.model_name}`)}
        >
          {m.model_name}{m.context_size ? ` (${m.context_size})` : ''}
        </div>
      ))}
    </div>
  )
}
