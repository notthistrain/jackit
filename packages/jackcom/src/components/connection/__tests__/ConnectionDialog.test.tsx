import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConnectionDialog } from '../ConnectionDialog'

// --- Mocks ---

// i18n
const mockT = vi.fn((key: string) => key)
vi.mock('@/i18n', () => ({
  useT: () => ({ t: mockT, locale: 'zh', setLocale: vi.fn() }),
}))

// useSerialConfig
const mockSetConfig = vi.fn()
const mockSaveAsRecent = vi.fn()
let mockConfig = {
  portName: 'COM3',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
}
let mockRecentConfigs: any[] = []

vi.mock('@/hooks/useSerialConfig', () => ({
  useSerialConfig: () => ({
    config: mockConfig,
    setConfig: mockSetConfig,
    recentConfigs: mockRecentConfigs,
    saveAsRecent: mockSaveAsRecent,
  }),
}))

// useSerialPort
const mockOpen = vi.fn()
vi.mock('@/hooks/useSerialPort', () => ({
  useSerialPort: () => ({
    open: mockOpen,
    enumerate: vi.fn(() => Promise.resolve([])),
    close: vi.fn(),
    send: vi.fn(),
    closeAll: vi.fn(),
  }),
}))

// store
const mockToggleDialog = vi.fn()
vi.mock('@/lib/store', () => ({
  useMainStore: () => ({
    toggleConnectionDialog: mockToggleDialog,
  }),
}))

describe('ConnectionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig = {
      portName: 'COM3',
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none',
    }
    mockRecentConfigs = []
  })

  it('renders the dialog with title and form', () => {
    const onClose = vi.fn()
    render(<ConnectionDialog onClose={onClose} />)

    expect(mockT).toHaveBeenCalledWith('connection.title')
    // Cancel and Connect buttons should be present
    expect(screen.getByText('common.cancel')).toBeTruthy()
    expect(screen.getByText('connection.connect')).toBeTruthy()
  })

  it('calls open and closes on successful connect', async () => {
    mockOpen.mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<ConnectionDialog onClose={onClose} />)

    const connectBtn = screen.getByText('connection.connect')
    fireEvent.click(connectBtn)

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith({
        port_name: 'COM3',
        baud_rate: 115200,
        data_bits: 'eight',
        stop_bits: 'one',
        parity: 'none',
        flow_control: 'none',
      })
      expect(mockSaveAsRecent).toHaveBeenCalled()
      expect(mockToggleDialog).toHaveBeenCalledWith(false)
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('shows error when open fails', async () => {
    mockOpen.mockRejectedValue(new Error('Port busy'))
    const onClose = vi.fn()
    render(<ConnectionDialog onClose={onClose} />)

    const connectBtn = screen.getByText('connection.connect')
    fireEvent.click(connectBtn)

    await waitFor(() => {
      expect(screen.getByText('Port busy')).toBeTruthy()
    })
  })

  it('shows recent connections when available', () => {
    mockRecentConfigs = [
      { portName: 'COM1', baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
    ]
    const onClose = vi.fn()
    render(<ConnectionDialog onClose={onClose} />)

    expect(screen.getByText(/COM1/)).toBeTruthy()
  })

  it('closes on cancel button click', () => {
    const onClose = vi.fn()
    render(<ConnectionDialog onClose={onClose} />)

    const cancelBtn = screen.getByText('common.cancel')
    fireEvent.click(cancelBtn)

    expect(mockToggleDialog).toHaveBeenCalledWith(false)
    expect(onClose).toHaveBeenCalled()
  })

  it('clicking a recent connection directly connects', async () => {
    mockOpen.mockResolvedValue(undefined)
    mockRecentConfigs = [
      { portName: 'COM5', baudRate: 57600, dataBits: 7, stopBits: 2, parity: 'even', flowControl: 'hardware' },
    ]
    const onClose = vi.fn()
    render(<ConnectionDialog onClose={onClose} />)

    const recentBtn = screen.getByText(/COM5/)
    fireEvent.click(recentBtn)

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith({
        port_name: 'COM5',
        baud_rate: 57600,
        data_bits: 'seven',
        stop_bits: 'two',
        parity: 'even',
        flow_control: 'hardware',
      })
      expect(mockToggleDialog).toHaveBeenCalledWith(false)
      expect(onClose).toHaveBeenCalled()
    })
  })
})
