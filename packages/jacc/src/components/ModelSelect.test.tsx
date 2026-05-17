import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

// Mock useAllModels
const mockModels = [
  { modelId: 1, modelName: 'claude-opus-4-6', providerName: 'Anthropic', keyName: 'Main Key' },
  { modelId: 2, modelName: 'claude-sonnet-4-6', providerName: 'Anthropic', keyName: 'Main Key' },
  { modelId: 3, modelName: 'gpt-4o', providerName: 'OpenRouter', keyName: 'router' },
]
const mockRefresh = vi.fn()

vi.mock('@/hooks/useAllModels', () => ({
  useAllModels: () => ({ models: mockModels, loading: false, refresh: mockRefresh }),
}))

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => {
    const map: Record<string, string> = {
      'general.slot.selectModel': '选择模型...',
      'general.slot.searchPlaceholder': '搜索模型名 / 服务商...',
    }
    return map[key] || key
  }}),
}))

import { ModelSelect } from './ModelSelect'

describe('ModelSelect', () => {
  test('renders placeholder when no value', () => {
    render(<ModelSelect value={null} onChange={vi.fn()} />)
    expect(screen.getByText('选择模型...')).toBeTruthy()
  })

  test('renders selected model name when value provided', () => {
    render(<ModelSelect value={1} onChange={vi.fn()} />)
    expect(screen.getByText('claude-opus-4-6')).toBeTruthy()
  })

  test('opens dropdown on click and shows all models', () => {
    render(<ModelSelect value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('选择模型...'))
    expect(screen.getByPlaceholderText('搜索模型名 / 服务商...')).toBeTruthy()
    expect(screen.getByText('claude-opus-4-6')).toBeTruthy()
    expect(screen.getByText('gpt-4o')).toBeTruthy()
  })

  test('filters models by search input', () => {
    render(<ModelSelect value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('选择模型...'))
    const input = screen.getByPlaceholderText('搜索模型名 / 服务商...')
    fireEvent.change(input, { target: { value: 'gpt' } })
    expect(screen.getByText('gpt-4o')).toBeTruthy()
    const items = screen.getAllByRole('option')
    expect(items).toHaveLength(1)
  })

  test('calls onChange and closes dropdown when model clicked', () => {
    const onChange = vi.fn()
    render(<ModelSelect value={null} onChange={onChange} />)
    fireEvent.click(screen.getByText('选择模型...'))
    fireEvent.click(screen.getByRole('option', { name: /gpt-4o/ }))
    expect(onChange).toHaveBeenCalledWith(3)
    expect(screen.queryByPlaceholderText('搜索模型名 / 服务商...')).toBeNull()
  })
})
