import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FabProps {
  onClick: () => void
  className?: string
}

export function Fab({ onClick, className }: FabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-5 right-6 w-11 h-11 rounded-full',
        'bg-primary text-white shadow-lg',
        'flex items-center justify-center',
        'opacity-40 hover:opacity-100 transition-opacity cursor-pointer',
        className,
      )}
    >
      <Plus size={20} />
    </button>
  )
}
