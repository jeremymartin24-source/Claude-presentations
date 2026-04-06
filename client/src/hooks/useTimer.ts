import { useState, useEffect, useRef, useCallback } from 'react'

export function useTimer(initialSeconds: number) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onExpireRef = useRef<(() => void) | null>(null)

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback((onExpire?: () => void) => {
    onExpireRef.current = onExpire || null
    setIsRunning(true)
  }, [])

  const stop = useCallback(() => {
    setIsRunning(false)
    clear()
  }, [clear])

  const reset = useCallback((newSeconds?: number) => {
    stop()
    setTimeLeft(newSeconds ?? initialSeconds)
  }, [stop, initialSeconds])

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!)
            intervalRef.current = null
            setIsRunning(false)
            onExpireRef.current?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clear()
    }

    return clear
  }, [isRunning, clear])

  // Update timeLeft when initialSeconds changes
  useEffect(() => {
    setTimeLeft(initialSeconds)
  }, [initialSeconds])

  const progress = initialSeconds > 0 ? timeLeft / initialSeconds : 0

  return { timeLeft, isRunning, start, stop, reset, progress }
}
