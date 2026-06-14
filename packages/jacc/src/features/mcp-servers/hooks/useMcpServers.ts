import type { McpServer } from '../api/mcp-servers-api'
import { useCallback } from 'react'
import { useConfig } from '@/shared/hooks/useConfig'
import { extractMcpServers, removeServer, upsertServer } from '../api/mcp-servers-api'

export type { McpServer }

// 支持 "带空格" / '带空格' 引号参数与多余空白；优于朴素 split(' ')
function parseArgs(input: string): string[] {
  const re = /"[^"]*"|'[^']*'|\S+/g
  const out: string[] = []
  for (let m = re.exec(input); m !== null; m = re.exec(input))
    out.push(m[0].replace(/^["']|["']$/g, ''))
  return out
}

export function useMcpServers() {
  const { config, writeConfig } = useConfig()
  const { servers, origin } = extractMcpServers(config)

  const save = useCallback(async (name: string, server: McpServer) => {
    await writeConfig('mcpServers', upsertServer(servers, name, server), false)
  }, [servers, writeConfig])

  const remove = useCallback(async (name: string) => {
    await writeConfig('mcpServers', removeServer(servers, name), false)
  }, [servers, writeConfig])

  const add = useCallback(async (name: string, command: string, argsString: string) => {
    const server: McpServer = {
      command,
      args: argsString ? parseArgs(argsString) : undefined,
    }
    await writeConfig('mcpServers', upsertServer(servers, name, server), false)
  }, [servers, writeConfig])

  return { servers, origin, save, remove, add }
}
