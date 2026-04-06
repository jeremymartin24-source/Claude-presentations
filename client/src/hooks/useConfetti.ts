import { useCallback } from 'react'
import confetti from 'canvas-confetti'

export function useConfetti() {
  const fire = useCallback((options?: confetti.Options) => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      ...options,
    })
  }, [])

  const fireSchoolPride = useCallback(() => {
    // UNOH colors: Red, White, Black + Gold
    const end = Date.now() + 3000

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#680001', '#ffffff', '#000000', '#FFD700'],
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#680001', '#ffffff', '#000000', '#FFD700'],
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }
    frame()
  }, [])

  const fireWinner = useCallback(() => {
    const count = 200
    const defaults = { origin: { y: 0.7 } }

    function shoot() {
      confetti({
        ...defaults,
        particleCount: Math.floor(count * 0.25),
        spread: 26,
        startVelocity: 55,
        colors: ['#680001', '#8a0001'],
      })
      confetti({
        ...defaults,
        particleCount: Math.floor(count * 0.2),
        spread: 60,
        colors: ['#ffffff', '#f5f5f5'],
      })
      confetti({
        ...defaults,
        particleCount: Math.floor(count * 0.35),
        spread: 100,
        decay: 0.91,
        scalar: 0.8,
        colors: ['#FFD700', '#FFA500'],
      })
      confetti({
        ...defaults,
        particleCount: Math.floor(count * 0.1),
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2,
        colors: ['#680001', '#ffffff'],
      })
    }

    shoot()
    setTimeout(shoot, 400)
    setTimeout(shoot, 800)
  }, [])

  return { fire, fireSchoolPride, fireWinner }
}
