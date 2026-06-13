import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Square, X } from 'lucide-react'
import { useT } from '@/i18n'
import { titleBar } from './title-bar.variants'

export function TitleBar() {
  const appWindow = getCurrentWindow()
  const { t } = useT()
  const { root, title, dragRegion, buttons, button } = titleBar()

  return (
    <div className={root()}>
      <div className={title()} data-tauri-drag-region>
        {t('app.title')}
      </div>
      <div data-tauri-drag-region className={dragRegion()} />
      <div className={buttons()}>
        <button
          onClick={() => appWindow.minimize()}
          className={button({ buttonType: 'minimize' })}
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className={button({ buttonType: 'maximize' })}
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => appWindow.close()}
          className={button({ buttonType: 'close' })}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
