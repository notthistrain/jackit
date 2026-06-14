import type { SlotBindingFull } from '@/shared/hooks/useSlotBindings'

type TFn = (key: string, params?: Record<string, string>) => string

/**
 * 构建槽位 drift 描述列表。每项附带 settings.json 中的实际值，
 * 让用户能直观看到「配置 vs 实际」到底差在哪里。
 *
 * 顺序固定为 model / url / key，非当前 slot 的 base_url、api_key
 * 在后端始终视为匹配（不检测），因此这里只会在真正漂移时产出对应项。
 */
export function buildDriftItems(binding: SlotBindingFull, t: TFn): string[] {
  const items: string[] = []
  if (!binding.matches.model_name)
    items.push(formatItem(t('general.slot.driftModel'), binding.actual.model_name, t))
  if (!binding.matches.base_url)
    items.push(formatItem(t('general.slot.driftUrl'), binding.actual.base_url, t))
  if (!binding.matches.api_key)
    items.push(formatItem(t('general.slot.driftKey'), binding.actual.api_key_masked, t))
  return items
}

function formatItem(label: string, actual: string | null, t: TFn): string {
  const value = actual ?? t('general.slot.driftEmpty')
  return `${label}（${t('general.slot.driftActual', { value })}）`
}
