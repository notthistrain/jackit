import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SlotRow } from './SlotRow'

vi.mock('@/features/models', () => ({
  ModelSelect: ({ value, onChange }: { value: number | null, onChange: (id: number) => void }) => (
    <button data-testid="model-select" onClick={() => onChange(99)}>
      MS:
      {String(value)}
    </button>
  ),
}))

vi.mock('@/i18n', () => ({ useT: () => ({ t: (k: string) => k }) }))

function baseProps() {
  return {
    slot: 'opus' as const,
    label: 'Opus',
    isCurrent: false,
    isBound: true,
    isDrifted: false,
    driftTip: '',
    modelValue: 1 as number | null,
    contextValue: '',
    contextOptions: ['1m'],
    modelString: '→ model = "opus"',
    onModelChange: vi.fn(),
    onContextChange: vi.fn(),
    onApply: vi.fn(),
  }
}

describe('slotRow', () => {
  it('renders slot label', () => {
    render(<SlotRow {...baseProps()} />)
    expect(screen.getByText('Opus')).toBeTruthy()
  })

  it('renders current badge when isCurrent=true', () => {
    render(<SlotRow {...baseProps()} isCurrent={true} />)
    expect(screen.getByText('general.slot.current')).toBeTruthy()
  })

  it('does not render current badge when isCurrent=false', () => {
    render(<SlotRow {...baseProps()} isCurrent={false} />)
    expect(screen.queryByText('general.slot.current')).toBeNull()
  })

  it('renders drift badge when isDrifted=true', () => {
    render(<SlotRow {...baseProps()} isDrifted={true} driftTip="tip" />)
    expect(screen.getByText('general.slot.drift')).toBeTruthy()
  })

  it('does not render drift badge when isDrifted=false', () => {
    render(<SlotRow {...baseProps()} />)
    expect(screen.queryByText('general.slot.drift')).toBeNull()
  })

  it('calls onModelChange when ModelSelect changes', async () => {
    const user = userEvent.setup()
    const onModelChange = vi.fn()
    render(<SlotRow {...baseProps()} onModelChange={onModelChange} />)
    await user.click(screen.getByTestId('model-select'))
    expect(onModelChange).toHaveBeenCalledWith(99)
  })

  it('calls onContextChange when context select changes', async () => {
    const user = userEvent.setup()
    const onContextChange = vi.fn()
    render(<SlotRow {...baseProps()} onContextChange={onContextChange} contextOptions={['1m']} />)
    await user.selectOptions(screen.getByRole('combobox'), '1m')
    expect(onContextChange).toHaveBeenCalledWith('1m')
  })

  it('shows apply button when isBound and not isCurrent, and calls onApply', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(<SlotRow {...baseProps()} isBound={true} isCurrent={false} onApply={onApply} />)
    const applyBtn = screen.getByText('general.apply')
    await user.click(applyBtn)
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it('does not show apply button when isCurrent=true and not drifted', () => {
    render(<SlotRow {...baseProps()} isBound={true} isCurrent={true} isDrifted={false} />)
    expect(screen.queryByText('general.apply')).toBeNull()
  })

  it('shows apply button when current slot has drifted (so user can re-sync)', () => {
    render(<SlotRow {...baseProps()} isBound={true} isCurrent={true} isDrifted={true} />)
    expect(screen.getByText('general.apply')).toBeTruthy()
  })

  it('does not show apply button when isBound=false', () => {
    render(<SlotRow {...baseProps()} isBound={false} isCurrent={false} />)
    expect(screen.queryByText('general.apply')).toBeNull()
  })

  it('shows modelString when isCurrent=true', () => {
    render(<SlotRow {...baseProps()} isCurrent={true} modelString="→ model = X" />)
    expect(screen.getByText('→ model = X')).toBeTruthy()
  })

  it('does not show modelString when isCurrent=false', () => {
    render(<SlotRow {...baseProps()} isCurrent={false} modelString="→ model = X" />)
    expect(screen.queryByText('→ model = X')).toBeNull()
  })

  it('disables context select when isBound=false', () => {
    render(<SlotRow {...baseProps()} isBound={false} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.disabled).toBe(true)
  })
})
