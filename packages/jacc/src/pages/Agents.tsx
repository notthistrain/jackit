import { Bot } from 'lucide-react'

export function Agents() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Bot size={48} className="text-muted mb-3" />
      <p className="text-sm font-medium text-foreground mb-1.5">Agents 管理</p>
      <p className="text-xs text-muted text-center max-w-[280px]">
        Agents 功能开发中。完成后将支持独立的 Agent 目录管理。
      </p>
    </div>
  )
}
