import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EnvValueInput } from './EnvValueInput'

const t = (key: string) => key

describe('envValueInput', () => {
  it('boolean renders a toggle writing 1/0', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<EnvValueInput type="boolean" value="0" onChange={onChange} t={t} />)
    await user.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('boolean shows on/off label with value', () => {
    render(<EnvValueInput type="boolean" value="1" onChange={vi.fn()} t={t} />)
    expect(screen.getByText('envvars.value.on')).toBeTruthy()
  })

  it('boolean treats legacy "true" as on', () => {
    const onChange = vi.fn()
    render(<EnvValueInput type="boolean" value="true" onChange={onChange} t={t} />)
    expect(screen.getByText('envvars.value.on')).toBeTruthy()
  })

  it('enum renders a select limited to enumValues', () => {
    render(<EnvValueInput type="enum" value="0" enumValues={['0', '1', '2']} onChange={vi.fn()} t={t} />)
    const opts = screen.getAllByRole('option')
    expect(opts.map(o => (o as HTMLOptionElement).value)).toEqual(['0', '1', '2'])
  })

  it('number renders a number input', () => {
    render(<EnvValueInput type="number" value="3" onChange={vi.fn()} t={t} />)
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('3')
  })

  it('string renders a text input', () => {
    render(<EnvValueInput type="string" value="x" onChange={vi.fn()} t={t} />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('x')
  })
})
