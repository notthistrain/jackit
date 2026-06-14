import type { SlotBindingFull } from '@/shared/hooks/useSlotBindings'
import { describe, expect, it } from 'vitest'
import { buildDriftItems } from './drift'

// 模拟真实 t()：字典查找 + {param} 插值
const dict: Record<string, string> = {
  'general.slot.driftModel': '模型',
  'general.slot.driftUrl': 'URL',
  'general.slot.driftKey': '密钥',
  'general.slot.driftActual': '实际 {value}',
  'general.slot.driftEmpty': '空',
}
function t(key: string, params?: Record<string, string>): string {
  let s = dict[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params))
      s = s.replaceAll(`{${k}}`, v)
  }
  return s
}

function makeBinding(overrides: Partial<SlotBindingFull> = {}): SlotBindingFull {
  return {
    intent: {
      slot: 'opus',
      model_id: 1,
      model_name: 'claude-opus-4-6',
      provider_id: 1,
      provider_name: 'P',
      base_url: 'https://a.com',
      api_key_masked: 'sk-***aaaa',
      context_size: null,
    },
    actual: { model_name: 'claude-opus-4-6', base_url: 'https://a.com', api_key_masked: 'sk-***aaaa' },
    matches: { model_name: true, base_url: true, api_key: true },
    ...overrides,
  } as SlotBindingFull
}

describe('buildDriftItems', () => {
  it('returns no items when nothing drifted', () => {
    expect(buildDriftItems(makeBinding(), t)).toEqual([])
  })

  it('includes the actual model value when model_name drifted', () => {
    const b = makeBinding({
      matches: { model_name: false, base_url: true, api_key: true },
      actual: { model_name: 'claude-sonnet-4-6', base_url: 'https://a.com', api_key_masked: 'sk-***aaaa' },
    })
    const items = buildDriftItems(b, t)
    expect(items).toHaveLength(1)
    expect(items[0]).toContain('模型')
    expect(items[0]).toContain('claude-sonnet-4-6')
  })

  it('includes the masked actual key when api_key drifted', () => {
    const b = makeBinding({
      matches: { model_name: true, base_url: true, api_key: false },
      actual: { model_name: 'm', base_url: 'u', api_key_masked: 'sk-***9999' },
    })
    const items = buildDriftItems(b, t)
    expect(items[0]).toContain('密钥')
    expect(items[0]).toContain('sk-***9999')
  })

  it('shows the empty marker when the actual value is null', () => {
    const b = makeBinding({
      matches: { model_name: false, base_url: true, api_key: true },
      actual: { model_name: null, base_url: null, api_key_masked: null },
    })
    const items = buildDriftItems(b, t)
    expect(items[0]).toContain('空')
  })

  it('lists multiple drifted fields in model/url/key order with actual values', () => {
    const b = makeBinding({
      matches: { model_name: false, base_url: false, api_key: false },
      actual: { model_name: 'm2', base_url: 'https://b.com', api_key_masked: 'sk-***2222' },
    })
    expect(buildDriftItems(b, t)).toEqual([
      '模型（实际 m2）',
      'URL（实际 https://b.com）',
      '密钥（实际 sk-***2222）',
    ])
  })
})
