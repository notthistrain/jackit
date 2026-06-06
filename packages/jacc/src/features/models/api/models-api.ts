import { invoke } from '@tauri-apps/api/core'

// ===== 类型定义 =====
export interface Provider {
  id: number
  name: string
  base_url: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateProviderInput {
  name: string
  base_url: string
  notes: string | null
}

export interface UpdateProviderInput {
  name?: string
  base_url?: string
  notes?: string
}

export interface ApiKeyView {
  id: number
  provider_id: number
  name: string
  api_key_masked: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateApiKeyInput {
  provider_id: number
  name: string
  api_key: string
  notes: string | null
}

export interface UpdateApiKeyInput {
  name?: string
  api_key?: string
  notes?: string
}

export interface Model {
  id: number
  api_key_id: number
  model_name: string
  context_size: string | null
  created_at: string
  updated_at: string
}

export interface CreateModelInput {
  api_key_id: number
  model_name: string
  context_size: string | null
}

export interface UpdateModelInput {
  model_name?: string
  context_size?: string
}

export interface FlatModel {
  modelId: number
  modelName: string
  providerName: string
  keyName: string
}

// ===== Provider API =====
export const providersApi = {
  list: () => invoke<Provider[]>('list_providers'),
  create: (input: CreateProviderInput) => invoke<void>('add_provider', { input }),
  update: (id: number, input: UpdateProviderInput) => invoke<void>('update_provider', { id, input }),
  delete: (id: number) => invoke<void>('delete_provider', { id }),
}

// ===== ApiKey API =====
export const apiKeysApi = {
  list: (providerId: number) => invoke<ApiKeyView[]>('list_api_keys', { providerId }),
  create: (input: CreateApiKeyInput) => invoke<void>('add_api_key', { input }),
  update: (id: number, input: UpdateApiKeyInput) => invoke<void>('update_api_key', { id, input }),
  delete: (id: number) => invoke<void>('delete_api_key', { id }),
}

// ===== Model API =====
export const modelsApi = {
  list: (apiKeyId: number) => invoke<Model[]>('list_models', { apiKeyId }),
  create: (input: CreateModelInput) => invoke<void>('add_model', { input }),
  update: (id: number, input: UpdateModelInput) => invoke<void>('update_model', { id, input }),
  delete: (id: number) => invoke<void>('delete_model', { id }),
  test: (id: number) => invoke<string>('test_model', { id }),
}
