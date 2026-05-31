import { Plus } from 'lucide-react'
import { fab } from './fab.variants'

export interface FabProps {
  onClick: () => void
  className?: string
}

export function Fab({ onClick, className }: FabProps) {
  const { root } = fab()

  return (
    <button onClick={onClick} className={root({ className })}>
      <Plus size={20} />
    </button>
  )
}
