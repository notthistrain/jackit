import { invoke } from '@tauri-apps/api/core'
import { describe, expect, it, vi } from 'vitest'
import { apiKeysApi, modelsApi, providersApi } from './models-api'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('providersApi', () => {
  it('list calls list_providers', () => {
    providersApi.list()
    expect(invoke).toHaveBeenCalledWith('list_providers')
  })

  it('create calls add_provider with input', () => {
    const input = { name: 'X', base_url: 'http://x', notes: null }
    providersApi.create(input)
    expect(invoke).toHaveBeenCalledWith('add_provider', { input })
  })
})

describe('apiKeysApi', () => {
  it('list calls list_api_keys with providerId', () => {
    apiKeysApi.list(1)
    expect(invoke).toHaveBeenCalledWith('list_api_keys', { providerId: 1 })
  })
})

describe('modelsApi', () => {
  it('test calls test_model with id', () => {
    modelsApi.test(5)
    expect(invoke).toHaveBeenCalledWith('test_model', { id: 5 })
  })
})
