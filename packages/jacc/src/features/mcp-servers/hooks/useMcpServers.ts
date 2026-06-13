import type { McpServer } from '../api/mcp-servers-api'
import { useCallback } from 'react'
import { useConfig } from '@/shared/hooks/useConfig'
import { extractMcpServers, removeServer, upsertServer } from '../api/mcp-servers-api'

export type { McpServer }

export function useMcpServers() {
  const { config, writeConfig } = useConfig()
  const { servers, scope } = extractMcpServers(config)

  const save = useCallback(async (name: string, server: McpServer) => {
    await writeConfig(scope, 'mcpServers', upsertServer(servers, name, server))
  }, [scope, servers, writeConfig])

  const remove = useCallback(async (name: string) => {
    await writeConfig(scope, 'mcpServers', removeServer(servers, name))
  }, [scope, servers, writeConfig])

  const add = useCallback(async (name: string, command: string, argsString: string) => {
    const server: McpServer = {
      command,
      args: argsString ? argsString.split(' ') : undefined,
    }
    await writeConfig(scope, 'mcpServers', upsertServer(servers, name, server))
  }, [scope, servers, writeConfig])

  return { servers, scope, save, remove, add }
}
