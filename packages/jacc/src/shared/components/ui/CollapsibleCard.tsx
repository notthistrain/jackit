import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { collapsibleCard } from './collapsible-card.variants'

export interface CollapsibleCardProps {
  expanded: boolean
  onToggle: () => void
  header: ReactNode
  headerRight?: ReactNode
  children: ReactNode
}

export function CollapsibleCard({
  expanded,
  onToggle,
  header,
  headerRight,
  children,
}: CollapsibleCardProps) {
  const { root, header: headerClass, headerLeft, headerRight: headerRightClass, icon, content } =
    collapsibleCard({ expanded })

  return (
    <div className={root()}>
      <div className={headerClass()} onClick={onToggle}>
        <div className={headerLeft()}>
          {expanded ? (
            <ChevronDown size={14} className={icon()} />
          ) : (
            <ChevronRight size={14} className={icon()} />
          )}
          {header}
        </div>
        {headerRight && (
          <div className={headerRightClass()} onClick={(e) => e.stopPropagation()}>
            {headerRight}
          </div>
        )}
      </div>
      {expanded && <div className={content()}>{children}</div>}
    </div>
  )
}
