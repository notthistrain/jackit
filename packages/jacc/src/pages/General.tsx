import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useConfig } from '@/hooks/useConfig'
import { useModels } from '@/hooks/useModels'
import { useAppStore } from '@/stores/useAppStore'
import { usePreferences } from '@/hooks/usePreferences'
import { SourceBadge } from '@/components/SourceBadge'
import { useT, type Locale } from '@/i18n'

type Slot = 'opus' | 'sonnet' | 'haiku'

export function General() {
  const { t, locale, setLocale } = useT()
  const { config, loading, writeConfig } = useConfig()
  const { models } = useModels()
  const { setPage } = useAppStore()
  const { set: setPreference } = usePreferences()
  const [viewSlot, setViewSlot] = useState<Slot>('opus')

  if (loading || !config) {
    return <div className="p-6 text-xs text-muted">{t('common.loading')}</div>
  }

  const getItem = (key: string) => config.items.find((i) => i.key === key)

  const effortLevel = getItem('effortLevel')
  const skipDangerous = getItem('skipDangerousModePermissionPrompt')

  const boundModel = models.find((m) => m.slot === viewSlot)

  function handleLocaleChange(newLocale: Locale) {
    setLocale(newLocale)
    setPreference('locale', newLocale)
  }

  async function handleSlotChange(slot: Slot) {
    setViewSlot(slot)
    // 激活该槽位的模型（写入 settings.json）
    try {
      await invoke('activate_slot', { slot })
    } catch {
      // 槽位未绑定模型时忽略
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-5">{t('general.title')}</h2>

      <div className="flex flex-col gap-2.5">
        {/* 模型 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">{t('general.model')}</div>
            <div className="text-[11px] text-muted">{t('general.model.desc')}</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={viewSlot}
              onChange={(e) => handleSlotChange(e.target.value as Slot)}
              className="bg-sidebar border border-border text-foreground px-2 py-1 rounded-[2px] text-xs"
            >
              <option value="opus">Opus</option>
              <option value="sonnet">Sonnet</option>
              <option value="haiku">Haiku</option>
            </select>
            <span className="text-xs text-foreground bg-sidebar px-2.5 py-1 rounded-[2px] border border-border max-w-[160px] truncate">
              {boundModel
                ? `${boundModel.alias}${boundModel.context_size ? ` · ${boundModel.context_size}` : ''}`
                : t('general.model.unbound')}
            </span>
            <button
              onClick={() => setPage('models')}
              className="text-[11px] text-primary hover:underline"
            >
              {t('general.model.manage')}
            </button>
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
