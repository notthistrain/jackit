import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EnvValueInput } from './EnvValueInput'

describe('envValueInput', () => {
  it('boolean renders a toggle writing 1/0', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<EnvValueInput type="boolean" value="0" onChange={onChange} />)
    await user.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('boolean shows on/off label with value', () => {
    render(<EnvValueInput type="boolean" value="1" onChange={vi.fn()} />)
    expect(screen.getByText(/1/)).toBeTruthy()
  })

  it('enum renders a select limited to enumValues', () => {
    render(<EnvValueInput type="enum" value="0" enumValues={['0', '1', '2']} onChange={vi.fn()} />)
    const opts = screen.getAllByRole('option')
    expect(opts.map(o => (o as HTMLOptionElement).value)).toEqual(['0', '1', '2'])
  })

  it('number renders a number input', () => {
    render(<EnvValueInput type="number" value="3" onChange={vi.fn()} />)
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('3')
  })

  it('string renders a text input', () => {
    render(<EnvValueInput type="string" value="x" onChange={vi.fn()} />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('x')
  })
})
