import type { ConfigOrigin, LayerConfig } from '@/shared/hooks/useConfig'

export const MODEL_ENV_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
] as const

export function extractEnv(config: LayerConfig | null): {
  env: Record<string, string>
  origin: ConfigOrigin
} {
  const item = config?.items.find(i => i.key === 'env')
  return {
    env: (item?.value as Record<string, string>) || {},
    origin: item?.origin || 'global',
  }
}

export function splitEnv(env: Record<string, string>): {
  regularEntries: [string, string][]
  modelEntries: [string, string][]
} {
  const entries = Object.entries(env)
  return {
    regularEntries: entries.filter(([k]) => !(MODEL_ENV_KEYS as readonly string[]).includes(k)),
    modelEntries: entries.filter(([k]) => (MODEL_ENV_KEYS as readonly string[]).includes(k)),
  }
}

export function setEnvVar(env: Record<string, string>, key: string, value: string): Record<string, string> {
  return { ...env, [key]: value }
}

export function deleteEnvVar(env: Record<string, string>, key: string): Record<string, string> {
  const next = { ...env }
  delete next[key]
  return next
}
