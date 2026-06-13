import type { Locale } from '@/i18n'
import { useEffect, useState } from 'react'
import { SelectRow, SlotRow, ToggleRow } from '@/features/general'
import { useT } from '@/i18n'
import { SourceBadge } from '@/shared/components/ui/SourceBadge'
import { useConfig } from '@/shared/hooks/useConfig'
import { usePreferences } from '@/shared/hooks/usePreferences'
import { useSlotBindings } from '@/shared/hooks/useSlotBindings'

type Slot = 'opus' | 'sonnet' | 'haiku'

const SLOTS: Slot[] = ['opus', 'sonnet', 'haiku']
const SLOT_LABELS: Record<Slot, string> = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' }
const CONTEXT_OPTIONS = ['', '1m']
const EFFORT_OPTIONS = ['low', 'medium', 'high', 'max', 'auto'].map(v => ({ value: v, label: v }))
const LOCALE_OPTIONS = [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }]

export function General() {
  const { t, locale, setLocale } = useT()
  const { config, refresh: refreshConfig, writeConfig } = useConfig()
  const { bindings, bind, setCurrentModel } = useSlotBindings()
  const { set: setPreference } = usePreferences()
  const [currentSlot, setCurrentSlot] = useState<Slot>('opus')
  const [slotContexts, setSlotContexts] = useState<Record<Slot, string>>({ opus: '', sonnet: '', haiku: '' })

  useEffect(() => {
    if (!config)
      return
    const modelItem = config.items.find(i => i.key === 'model')
    const match = modelItem?.value ? String(modelItem.value).match(/^(\w+)(?:\[(.+)\])?$/) : null
    if (match) {
      setCurrentSlot(match[1] as Slot)
      setSlotContexts(prev => ({ ...prev, [match[1] as Slot]: match[2] || '' }))
    }
  }, [config])

  if (!config)
    return <div className="p-6 text-xs text-muted">{t('common.loading')}</div>

  const effortLevel = config.items.find(i => i.key === 'effortLevel')
  const skipDangerous = config.items.find(i => i.key === 'skipDangerousModePermissionPrompt')

  async function handleApply(slot: Slot, ctx?: string) {
    try {
      await setCurrentModel(slot, (ctx ?? slotContexts[slot]) || null)
      await refreshConfig()
    }
    catch { /* error handled by toast in hook */ }
  }

  function buildSlotProps(slot: Slot) {
    const binding = bindings.find(b => b.intent.slot === slot)
    const isCurrent = slot === currentSlot
    const driftItems = binding
      ? [!binding.matches.model_name && t('general.slot.driftModel'), !binding.matches.base_url && t('general.slot.driftUrl'), !binding.matches.api_key && t('general.slot.driftKey')].filter(Boolean)
      : []
    const ctx = slotContexts[slot]
    return {
      slot,
      label: SLOT_LABELS[slot],
      isCurrent,
      isBound: !!binding,
      isDrifted: driftItems.length > 0,
      driftTip: `${t('general.slot.driftTip')}：${driftItems.join('、')}`,
      modelValue: binding?.intent.model_id ?? null,
      contextValue: ctx,
      contextOptions: CONTEXT_OPTIONS,
      modelString: `→ model = "${slot}${ctx ? `[${ctx}]` : ''}"`,
      onModelChange: (modelId: number) => { bind(slot, modelId).catch(() => {}) },
      onContextChange: (newCtx: string) => {
        setSlotContexts(prev => ({ ...prev, [slot]: newCtx }))
        if (isCurrent)
          handleApply(slot, newCtx)
      },
      onApply: () => handleApply(slot),
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-5">{t('general.title')}</h2>
      <div className="flex flex-col gap-2.5">
        <div className="p-3 bg-card border border-border-light rounded-[4px]">
          <div className="text-[13px] font-medium text-foreground mb-2.5">{t('general.slots')}</div>
          <div className="flex flex-col gap-2">
            {SLOTS.map(slot => <SlotRow key={slot} {...buildSlotProps(slot)} />)}
          </div>
        </div>
        <SelectRow
          label={t('general.effortLevel')}
          description={t('general.effortLevel.desc')}
          value={(effortLevel?.value as string) || 'high'}
          options={EFFORT_OPTIONS}
          onChange={v => writeConfig(effortLevel?.scope || 'global', 'effortLevel', v)}
          badge={effortLevel && <SourceBadge scope={effortLevel.scope} />}
        />
        <ToggleRow
          label={t('general.skipDangerous')}
          description={t('general.skipDangerous.desc')}
          checked={!!skipDangerous?.value}
          onToggle={() => writeConfig(skipDangerous?.scope || 'global', 'skipDangerousModePermissionPrompt', !(skipDangerous?.value as boolean))}
          badge={skipDangerous && <SourceBadge scope={skipDangerous.scope} />}
        />
        <SelectRow
          label={t('general.language')}
          description={t('general.language.desc')}
          value={locale}
          options={LOCALE_OPTIONS}
          onChange={(v) => {
            setLocale(v as Locale)
            setPreference('locale', v as Locale)
          }}
        />
      </div>
    </div>
  )
}
