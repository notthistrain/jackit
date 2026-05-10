import type { Tool, UpdateInfo } from '@/lib/types'
import { invoke } from '@tauri-apps/api/core'

export async function getInstalledTools(): Promise<Tool[]> {
  return invoke('db_query_tools', { filter: 'installed' })
}

export async function getMarketTools(): Promise<Tool[]> {
  return invoke('db_query_tools', { filter: 'not_installed' })
}

export async function getAllTools(): Promise<Tool[]> {
  return invoke('db_query_tools', { filter: 'all' })
}

export async function installTool(toolId: number, version?: string): Promise<void> {
  return invoke('tl_install', { toolId, version: version || null })
}

export async function uninstallTool(toolId: number): Promise<void> {
  return invoke('tl_uninstall', { toolId })
}

export async function launchTool(filePath: string): Promise<number> {
  return invoke('tl_launch', { filePath })
}

export async function runToolById(toolId: number): Promise<void> {
  const tool = await invoke<Tool>('db_query_tool_by_id', { id: toolId })
  if (!tool.file_path)
    throw new Error('tool file path is empty')
  await launchTool(tool.file_path)
}

export async function checkUpdate(): Promise<UpdateInfo | null> {
  return invoke('updater_check')
}

export async function downloadUpdate(versionId: number, size: number): Promise<void> {
  return invoke('updater_download', { versionId, size })
}

export async function applyUpdate(): Promise<void> {
  return invoke('updater_apply')
}

export async function syncNow(): Promise<void> {
  return invoke('sync_now')
}

export async function getConfig(key: string): Promise<string> {
  return invoke('config_get', { key })
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  return invoke('config_set', { key, value })
}

export function getManualURL(serverAddr: string, manualPath: string, toolId: number): string {
  return `${serverAddr}${manualPath}?id=${toolId}`
}
