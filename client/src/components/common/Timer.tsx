import { useEffect } from 'react'
import { clsx } from 'clsx'
import { useTimer } from '../../hooks/useTimer'

interface TimerProps {
  seconds: number
  onExpire?: () => void
  isRunning?: boolean
  size?: number
}

export function Timer({ seconds, onExpire, isRunning = false, size = 120 }: TimerProps) {
  const { timeLeft, start, stop, reset, progress } = useTimer(seconds)

  useEffect(() => {
    reset(seconds)
  }, [seconds]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isRunning) {
      start(onExpire)
    } else {
      stop()
    }
  }, [isRunning]) // eslint-disable-line react-hooks/exhaustive-deps

  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  const isLow = timeLeft <= 5
  const isCritical = timeLeft <= 3

  const strokeColor = isLow ? '#ef4444' : '#680001'
  const textColor = isLow ? 'text-red-400' : 'text-white'

  return (
    <div
      className={clsx(
        'relative flex items-center justify-center',
        isCritical && 'animate-pulse'
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1f2937"
          strokeWidth="8"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={clsx(
          'font-display font-bold tabular-nums',
          textColor,
          size >= 120 ? 'text-4xl' : size >= 80 ? 'text-2xl' : 'text-xl'
        )}>
          {timeLeft}
        </span>
      </div>
    </div>
  )
}
