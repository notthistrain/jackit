import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { dialog } from './dialog.variants'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Dialog({ open, onClose, title, children, footer, size }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  const { overlay, content, header, title: titleClass, body, footer: footerClass } = dialog({ size })

  return (
    <div
      ref={overlayRef}
      className={overlay()}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) {
          onClose()
        }
      }}
    >
      <div className={content()}>
        {title && (
          <div className={header()}>
            <h3 className={titleClass()}>{title}</h3>
          </div>
        )}
        <div className={body()}>{children}</div>
        {footer && <div className={footerClass()}>{footer}</div>}
      </div>
    </div>
  )
}
