import { useEffect, useState } from 'react'
import { useConfig } from '@/hooks/useConfig'
import { useSlotBindings } from '@/hooks/useSlotBindings'
import { usePreferences } from '@/hooks/usePreferences'
import { SourceBadge } from '@/components/SourceBadge'
import { ModelSelect } from '@/components/ModelSelect'
import { useT, type Locale } from '@/i18n'

type Slot = 'opus' | 'sonnet' | 'haiku'

const SLOTS: Slot[] = ['opus', 'sonnet', 'haiku']

const SLOT_LABELS: Record<Slot, string> = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' }

const CONTEXT_OPTIONS = ['', '1m']

export function General() {
  const { t, locale, setLocale } = useT()
  const { config, refresh: refreshConfig, writeConfig } = useConfig()
  const { bindings, bind, setCurrentModel } = useSlotBindings()
  const { set: setPreference } = usePreferences()

  // 当前激活的 slot 和每个 slot 的 context size
  const [currentSlot, setCurrentSlot] = useState<Slot>('opus')
  const [slotContexts, setSlotContexts] = useState<Record<Slot, string>>({
    opus: '',
    sonnet: '',
    haiku: '',
  })

  // 从 config 的 model 字段回显当前模型设置
  useEffect(() => {
    if (!config) return
    const modelItem = config.items.find(i => i.key === 'model')
    if (modelItem?.value) {
      const val = String(modelItem.value)
      const match = val.match(/^(\w+)(?:\[(.+)\])?$/)
      if (match) {
        const slot = match[1] as Slot
        const ctx = match[2] || ''
        setCurrentSlot(slot)
        setSlotContexts(prev => ({ ...prev, [slot]: ctx }))
      }
    }
  }, [config])

  if (!config) {
    return <div className="p-6 text-xs text-muted">{t('common.loading')}</div>
  }

  const getItem = (key: string) => config.items.find((i) => i.key === key)
  const effortLevel = getItem('effortLevel')
  const skipDangerous = getItem('skipDangerousModePermissionPrompt')

  function getBinding(slot: Slot) {
    return bindings.find((b) => b.slot === slot)
  }

  async function handleSlotModelChange(slot: Slot, modelId: number) {
    try {
      await bind(slot, modelId)
    } catch {
      // error handled by toast in hook
    }
  }

  async function handleApply(slot: Slot, ctx?: string) {
    try {
      await setCurrentModel(slot, (ctx ?? slotContexts[slot]) || null)
      await refreshConfig()
    } catch {
      // error handled by toast in hook
    }
  }

  function handleLocaleChange(newLocale: Locale) {
    setLocale(newLocale)
    setPreference('locale', newLocale)
  }

  function getModelString() {
    const ctx = slotContexts[currentSlot]
    return `→ model = "${currentSlot}${ctx ? `[${ctx}]` : ''}"`
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-5">{t('general.title')}</h2>

      <div className="flex flex-col gap-2.5">
        {/* 模型槽位 */}
        <div className="p-3 bg-card border border-border-light rounded-[4px]">
          <div className="text-[13px] font-medium text-foreground mb-2.5">{t('general.slots')}</div>
          <div className="flex flex-col gap-2">
            {SLOTS.map((slot) => {
              const binding = getBinding(slot)
              const isCurrent = slot === currentSlot
              const isBound = !!binding
              return (
                <div
                  key={slot}
                  className={`group flex items-center gap-2.5 px-3 py-2 rounded-[4px] transition-colors ${
                    isCurrent
                      ? 'border-2 border-primary bg-primary/5'
                      : 'border border-border-light bg-card hover:bg-sidebar/30'
                  }`}
                >
                  {/* Slot name + badge */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[12px] font-medium text-foreground">{SLOT_LABELS[slot]}</span>
                    {isCurrent && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-[2px] bg-primary text-white leading-none">
                        {t('general.slot.current')}
                      </span>
                    )}
                  </div>

                  {/* Model select */}
                  <ModelSelect
                    value={binding?.model_id ?? null}
                    onChange={(modelId) => handleSlotModelChange(slot, modelId)}
                  />

                  {/* Context size */}
                  <select
                    value={slotContexts[slot]}
                    onChange={(e) => {
                      const newCtx = e.target.value
                      setSlotContexts(prev => ({ ...prev, [slot]: newCtx }))
                      if (isCurrent) handleApply(slot, newCtx)
                    }}
                    disabled={!isBound}
                    className={`text-[11px] px-1.5 py-1 rounded-[2px] border border-border bg-sidebar text-foreground w-[55px] ${
                      !isBound ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="">{t('general.ctxDefault')}</option>
                    {CONTEXT_OPTIONS.filter(c => c).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  {/* Apply button — hover only, hidden for current slot */}
                  {isBound && !isCurrent && (
                    <button
                      onClick={() => handleApply(slot)}
                      className="text-[11px] px-2.5 py-1 rounded-[2px] bg-primary text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      {t('general.apply')}
                    </button>
                  )}

                  {/* Model string — current slot only */}
                  {isCurrent && (
                    <span className="text-[10px] font-mono text-muted shrink-0">
                      {getModelString()}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Effort Level */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">{t('general.effortLevel')}</div>
            <div className="text-[11px] text-muted">{t('general.effortLevel.desc')}</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={(effortLevel?.value as string) || 'high'}
              onChange={(e) =>
                writeConfig(effortLevel?.scope || 'global', 'effortLevel', e.target.value)
              }
              className="bg-sidebar border border-border text-foreground px-2.5 py-1 rounded-[2px] text-xs"
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="max">max</option>
              <option value="auto">auto</option>
            </select>
            {effortLevel && <SourceBadge scope={effortLevel.scope} />}
          </div>
        </div>

        {/* 跳过危险模式确认 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">{t('general.skipDangerous')}</div>
            <div className="text-[11px] text-muted">{t('general.skipDangerous.desc')}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                writeConfig(
                  skipDangerous?.scope || 'global',
                  'skipDangerousModePermissionPrompt',
                  !(skipDangerous?.value as boolean),
                )
              }
              className={`w-9 h-5 rounded-full relative transition-colors ${
                skipDangerous?.value ? 'bg-primary' : 'bg-border'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                  skipDangerous?.value ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
            {skipDangerous && <SourceBadge scope={skipDangerous.scope} />}
          </div>
        </div>

        {/* 语言 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">{t('general.language')}</div>
            <div className="text-[11px] text-muted">{t('general.language.desc')}</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={locale}
              onChange={(e) => handleLocaleChange(e.target.value as Locale)}
              className="bg-sidebar border border-border text-foreground px-2.5 py-1 rounded-[2px] text-xs"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
