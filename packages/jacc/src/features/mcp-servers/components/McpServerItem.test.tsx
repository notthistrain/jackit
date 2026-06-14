import type { McpServer } from '../api/mcp-servers-api'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { McpServerItem } from './McpServerItem'

vi.mock('@/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

const mockT = (key: string) => key

describe('mcpServerItem', () => {
  const server: McpServer = {
    command: 'node',
    args: ['server.js', '--port', '3000'],
    env: { NODE_ENV: 'production', API_KEY: 'secret' },
  }

  it('renders name and command preview', () => {
    render(
      <McpServerItem
        name="test-server"
        server={server}
        expanded={false}
        origin="global"
        showSource
        onToggle={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        t={mockT}
      />,
    )
    expect(screen.getByText('test-server')).toBeTruthy()
    expect(screen.getByText(/node/)).toBeTruthy()
    expect(screen.getByText(/server.js --port 3000/)).toBeTruthy()
  })

  it('calls onToggle when header is clicked', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(
      <McpServerItem
        name="test-server"
        server={server}
        expanded={false}
        origin="global"
        showSource
        onToggle={onToggle}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        t={mockT}
      />,
    )
    await user.click(screen.getByText('test-server'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('shows expanded content when expanded is true', () => {
    render(
      <McpServerItem
        name="test-server"
        server={server}
        expanded={true}
        origin="global"
        showSource
        onToggle={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        t={mockT}
      />,
    )
    expect(screen.getByDisplayValue('node')).toBeTruthy()
    expect(screen.getByDisplayValue('server.js --port 3000')).toBeTruthy()
    expect(screen.getByDisplayValue('NODE_ENV')).toBeTruthy()
    expect(screen.getByDisplayValue('production')).toBeTruthy()
  })

  it('calls onSave when command input is changed', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(
      <McpServerItem
        name="test-server"
        server={server}
        expanded={true}
        origin="global"
        showSource
        onToggle={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
        t={mockT}
      />,
    )
    const commandInput = screen.getByDisplayValue('node')
    await user.type(commandInput, 'x')
    // Check that onSave was called with updated command
    expect(onSave).toHaveBeenLastCalledWith({ ...server, command: 'nodex' })
  })

  it('calls onSave when args input is changed', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(
      <McpServerItem
        name="test-server"
        server={server}
        expanded={true}
        origin="global"
        showSource
        onToggle={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
        t={mockT}
      />,
    )
    const argsInput = screen.getByDisplayValue('server.js --port 3000')
    await user.type(argsInput, 'x')
    // Check that onSave was called with updated args
    expect(onSave).toHaveBeenLastCalledWith({ ...server, args: ['server.js', '--port', '3000x'] })
  })

  it('calls onSave with undefined args when args input is cleared', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(
      <McpServerItem
        name="test-server"
        server={server}
        expanded={true}
        origin="global"
        showSource
        onToggle={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
        t={mockT}
      />,
    )
    const argsInput = screen.getByDisplayValue('server.js --port 3000')
    await user.clear(argsInput)
    expect(onSave).toHaveBeenCalledWith({ ...server, args: undefined })
  })

  it('calls onSave when env value is changed', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(
      <McpServerItem
        name="test-server"
        server={server}
        expanded={true}
        origin="global"
        showSource
        onToggle={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
        t={mockT}
      />,
    )
    const envValueInput = screen.getByDisplayValue('production')
    await user.type(envValueInput, 'x')
    // Check that onSave was called with updated env
    expect(onSave).toHaveBeenLastCalledWith({
      ...server,
      env: { NODE_ENV: 'productionx', API_KEY: 'secret' },
    })
  })

  it('calls onDelete when delete button is clicked', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(
      <McpServerItem
        name="test-server"
        server={server}
        expanded={true}
        origin="global"
        showSource
        onToggle={vi.fn()}
        onSave={vi.fn()}
        onDelete={onDelete}
        t={mockT}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'mcp.delete' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('renders env rows for each env entry', () => {
    render(
      <McpServerItem
        name="test-server"
        server={server}
        expanded={true}
        origin="global"
        showSource
        onToggle={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        t={mockT}
      />,
    )
    expect(screen.getByDisplayValue('NODE_ENV')).toBeTruthy()
    expect(screen.getByDisplayValue('production')).toBeTruthy()
    expect(screen.getByDisplayValue('API_KEY')).toBeTruthy()
    expect(screen.getByDisplayValue('secret')).toBeTruthy()
  })
})
