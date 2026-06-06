import type { MergedConfig } from '@/shared/hooks/useConfig'

export interface McpServer {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export function extractMcpServers(config: MergedConfig | null): {
  servers: Record<string, McpServer>
  scope: 'global' | 'project'
} {
  const item = config?.items.find(i => i.key === 'mcpServers')
  return {
    servers: (item?.value as Record<string, McpServer>) || {},
    scope: item?.scope || 'global',
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
