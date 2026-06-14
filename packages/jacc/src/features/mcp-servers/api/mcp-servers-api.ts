import type { ConfigOrigin, LayerConfig } from '@/shared/hooks/useConfig'

export interface McpServer {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export function extractMcpServers(config: LayerConfig | null): {
  servers: Record<string, McpServer>
  origin: ConfigOrigin
} {
  const item = config?.items.find(i => i.key === 'mcpServers')
  return {
    servers: (item?.value as Record<string, McpServer>) || {},
    origin: item?.origin || 'global',
  }
}

export function upsertServer(servers: Record<string, McpServer>, name: string, server: McpServer): Record<string, McpServer> {
  return { ...servers, [name]: server }
}

export function removeServer(servers: Record<string, McpServer>, name: string): Record<string, McpServer> {
  const next = { ...servers }
  delete next[name]
  return next
}
