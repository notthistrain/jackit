import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Square, X } from 'lucide-react'
import { useT } from '@/i18n'

export function TitleBar() {
  const appWindow = getCurrentWindow()
  const { t } = useT()

  return (
    <div className="h-8 flex items-center bg-sidebar border-b border-border select-none">
      <div className="pl-3 text-xs text-muted" data-tauri-drag-region>
        {t('app.title')}
      </div>
      <div data-tauri-drag-region className="flex-1 h-full" />
      <div className="flex h-full">
        <button
          onClick={() => appWindow.minimize()}
          className="w-11 h-full flex items-center justify-center hover:bg-border/50 text-muted-foreground"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="w-11 h-full flex items-center justify-center hover:bg-border/50 text-muted-foreground"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => appWindow.close()}
          className="w-11 h-full flex items-center justify-center hover:bg-danger/80 hover:text-white text-muted-foreground"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
