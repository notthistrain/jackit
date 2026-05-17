import { FolderOpen } from 'lucide-react'
import { useT } from '@/i18n'

interface EmptyStateProps {
  onSelectProject: () => void
}

export function EmptyState({ onSelectProject }: EmptyStateProps) {
  const { t } = useT()
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <FolderOpen size={48} className="text-muted mb-3" />
      <p className="text-sm font-medium text-foreground mb-1.5">{t('empty.title')}</p>
      <p className="text-xs text-muted mb-4">{t('empty.desc')}</p>
      <button
        onClick={onSelectProject}
        className="px-5 py-2 bg-primary text-white text-xs rounded-[4px] cursor-pointer hover:opacity-90"
      >
        {t('empty.select')}
      </button>
    </div>
  )
}
