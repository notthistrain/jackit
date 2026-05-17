import { useState } from 'react'
import { useConfig } from '@/hooks/useConfig'
import { useModels } from '@/hooks/useModels'
import { useSlotBindings } from '@/hooks/useModels'
import { usePreferences } from '@/hooks/usePreferences'
import { SourceBadge } from '@/components/SourceBadge'
import { useT, type Locale } from '@/i18n'

type Slot = 'opus' | 'sonnet' | 'haiku'

const SLOTS: Slot[] = ['opus', 'sonnet', 'haiku']

const SLOT_LABELS: Record<Slot, string> = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' }

const CONTEXT_OPTIONS = ['', '1m']

export function General() {
  const { t, locale, setLocale } = useT()
  const { config, loading, writeConfig } = useConfig()
  const { models } = useModels()
  const { bindings, bind, unbind, setCurrentModel } = useSlotBindings()
  const { set: setPreference } = usePreferences()

  // 当前模型状态
  const [currentSlot, setCurrentSlot] = useState<Slot>('opus')
  const [currentCtx, setCurrentCtx] = useState('')
  const [slotError, setSlotError] = useState<string | null>(null)

  if (loading || !config) {
    return <div className="p-6 text-xs text-muted">{t('common.loading')}</div>
  }

  const getItem = (key: string) => config.items.find((i) => i.key === key)
  const effortLevel = getItem('effortLevel')
  const skipDangerous = getItem('skipDangerousModePermissionPrompt')

  function getBinding(slot: Slot) {
    return bindings.find((b) => b.slot === slot)
  }

  async function handleSlotModelChange(slot: Slot, modelIdStr: string) {
    setSlotError(null)
    try {
      if (modelIdStr === '') {
        await unbind(slot)
      } else {
        await bind(slot, Number(modelIdStr))
      }
    } catch (e) {
      setSlotError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleApplyCurrentModel() {
    setSlotError(null)
    try {
      await setCurrentModel(currentSlot, currentCtx || null)
    } catch (e) {
      setSlotError(e instanceof Error ? e.message : String(e))
    }
  }

  function handleLocaleChange(newLocale: Locale) {
    setLocale(newLocale)
    setPreference('locale', newLocale)
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-5">{t('general.title')}</h2>

      <div className="flex flex-col gap-2.5">
        {/* 模型槽位 */}
        <div className="p-3 bg-card border border-border-light rounded-[4px]">
          <div className="text-[13px] font-medium text-foreground mb-2.5">{t('general.slots')}</div>
          <div className="flex flex-col gap-2">
            {slotError && (
              <div className="text-[11px] text-red-500 bg-red-500/10 px-2 py-1 rounded-[2px]">
                {slotError}
              </div>
            )}
            {SLOTS.map((slot) => {
              const binding = getBinding(slot)
              return (
                <div key={slot} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted w-[52px]">{SLOT_LABELS[slot]}</span>
                  <select
                    value={binding?.model_id ?? ''}
                    onChange={(e) => handleSlotModelChange(slot, e.target.value)}
                    className="flex-1 bg-sidebar border border-border text-foreground px-2 py-1.5 rounded-[2px] text-xs"
                  >
                    <option value="">{t('general.slot.unbound')}</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.alias} ({m.model_name})</option>
                    ))}
                  </select>
                  <span className={`text-[10px] w-[40px] text-center ${binding ? 'text-success' : 'text-muted'}`}>
                    {binding ? t('general.slot.bound') : t('general.slot.unboundLabel')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 当前模型 */}
        <div className="p-3 bg-card border border-border-light rounded-[4px]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-foreground">{t('general.currentModel')}</div>
              <div className="text-[11px] text-muted">{t('general.currentModel.desc')}</div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={currentSlot}
                onChange={(e) => setCurrentSlot(e.target.value as Slot)}
                className="bg-sidebar border border-border text-foreground px-2 py-1 rounded-[2px] text-xs"
              >
                {SLOTS.map((s) => (
                  <option key={s} value={s}>{SLOT_LABELS[s]}</option>
                ))}
              </select>
              <select
                value={currentCtx}
                onChange={(e) => setCurrentCtx(e.target.value)}
                className="bg-sidebar border border-border text-foreground px-2 py-1 rounded-[2px] text-xs"
              >
                <option value="">{t('general.ctxDefault')}</option>
                {CONTEXT_OPTIONS.filter(c => c).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={handleApplyCurrentModel}
                className="px-3 py-1 bg-primary text-white text-xs rounded-[2px]"
              >
                {t('general.apply')}
              </button>
            </div>
          </div>
          <div className="text-[10px] text-muted mt-1.5 font-mono">
            → model = "{currentSlot}{currentCtx ? `[${currentCtx}]` : ''}"
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
