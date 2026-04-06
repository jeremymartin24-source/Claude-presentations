import { clsx } from 'clsx'

interface ProgressBarProps {
  value: number // 0-100
  color?: string
  label?: string
  animated?: boolean
  height?: 'sm' | 'md' | 'lg'
  showPercent?: boolean
}

const heightClasses = {
  sm: 'h-2',
  md: 'h-4',
  lg: 'h-6',
}

export function ProgressBar({
  value,
  color,
  label,
  animated = true,
  height = 'md',
  showPercent = false,
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value))
  const barColor = color || '#680001'

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm font-medium text-gray-300">{label}</span>}
          {showPercent && <span className="text-sm font-bold text-white">{Math.round(clampedValue)}%</span>}
        </div>
      )}
      <div className={clsx('w-full bg-gray-800 rounded-full overflow-hidden', heightClasses[height])}>
        <div
          className={clsx(
            'h-full rounded-full',
            animated && 'transition-all duration-500 ease-out'
          )}
          style={{
            width: `${clampedValue}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 8px ${barColor}66`,
          }}
        />
      </div>
    </div>
  )
}
