import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EnvVarCombobox } from './EnvVarCombobox'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

describe('envVarCombobox', () => {
  it('filters options by query', async () => {
    const user = userEvent.setup()
    render(<EnvVarCombobox value="" onSelect={vi.fn()} />)
    await user.type(screen.getByRole('textbox'), 'token')
    expect(screen.getByText('ANTHROPIC_AUTH_TOKEN')).toBeTruthy()
    expect(screen.queryByText('HTTPS_PROXY')).toBeNull()
  })

  it('renders group headers', async () => {
    const user = userEvent.setup()
    render(<EnvVarCombobox value="" onSelect={vi.fn()} />)
    await user.type(screen.getByRole('textbox'), 'anthropic')
    expect(screen.getByText('envgroup.auth')).toBeTruthy()
  })

  it('closes dropdown when the input loses focus', async () => {
    const user = userEvent.setup()
    render(<EnvVarCombobox value="" onSelect={vi.fn()} />)
    const input = screen.getByRole('textbox')
    await user.click(input)
    expect(screen.getByText('ANTHROPIC_API_KEY')).toBeTruthy()
    fireEvent.blur(input)
    expect(screen.queryByText('ANTHROPIC_API_KEY')).toBeNull()
  })

  it('keeps dropdown open while clicking an option (no premature blur)', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<EnvVarCombobox value="" onSelect={onSelect} />)
    await user.type(screen.getByRole('textbox'), 'API_KEY')
    await user.click(screen.getByText('ANTHROPIC_API_KEY'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'ANTHROPIC_API_KEY' }))
  })

  it('excludes already-set keys from the dropdown', async () => {
    const user = userEvent.setup()
    render(<EnvVarCombobox value="" onSelect={vi.fn()} existingKeys={['ANTHROPIC_API_KEY']} />)
    await user.click(screen.getByRole('textbox'))
    expect(screen.queryByText('ANTHROPIC_API_KEY')).toBeNull()
  })

  it('slotManaged option is disabled and not selectable', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<EnvVarCombobox value="" onSelect={onSelect} />)
    await user.type(screen.getByRole('textbox'), 'AUTH_TOKEN')
    const opt = screen.getByText('ANTHROPIC_AUTH_TOKEN').closest('[data-disabled]')
    expect(opt?.getAttribute('data-disabled')).toBe('true')
    await user.click(screen.getByText('ANTHROPIC_AUTH_TOKEN'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selecting a catalog option calls onSelect with meta', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<EnvVarCombobox value="" onSelect={onSelect} />)
    await user.type(screen.getByRole('textbox'), 'API_KEY')
    await user.click(screen.getByText('ANTHROPIC_API_KEY'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'ANTHROPIC_API_KEY', sensitive: true }))
  })

  it('allows custom value not in catalog', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<EnvVarCombobox value="" onSelect={onSelect} />)
    await user.type(screen.getByRole('textbox'), 'MY_CUSTOM_VAR')
    await user.click(screen.getByText(/useCustom/))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'MY_CUSTOM_VAR', sensitive: false }))
  })
})
