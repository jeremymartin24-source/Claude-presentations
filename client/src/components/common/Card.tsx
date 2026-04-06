import { clsx } from 'clsx'

type CardVariant = 'default' | 'highlight' | 'game'

interface CardProps {
  variant?: CardVariant
  className?: string
  children: React.ReactNode
  onClick?: () => void
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-md',
  highlight: 'bg-gray-900 border border-unoh-red rounded-xl p-4 shadow-lg shadow-red-900/30 ring-1 ring-unoh-red/20',
  game: 'bg-gray-900 border border-unoh-red rounded-2xl p-8 shadow-xl shadow-red-900/20',
}

export function Card({ variant = 'default', className, children, onClick }: CardProps) {
  return (
    <div
      className={clsx(
        variantClasses[variant],
        onClick && 'cursor-pointer hover:border-unoh-red-light transition-all duration-200 hover:shadow-lg hover:shadow-red-900/30',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
