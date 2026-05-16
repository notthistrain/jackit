import { FolderOpen } from 'lucide-react'

interface EmptyStateProps {
  onSelectProject: () => void
}

export function EmptyState({ onSelectProject }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <FolderOpen size={48} className="text-muted mb-3" />
      <p className="text-sm font-medium text-foreground mb-1.5">还没有打开项目</p>
      <p className="text-xs text-muted mb-4">选择一个包含 .claude 目录的项目开始配置</p>
      <button
        onClick={onSelectProject}
        className="px-5 py-2 bg-primary text-white text-xs rounded-[4px] cursor-pointer hover:opacity-90"
      >
        选择项目目录
      </button>
    </div>
  )
}
