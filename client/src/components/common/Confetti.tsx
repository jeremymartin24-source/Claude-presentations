import { useEffect } from 'react'
import { useConfetti } from '../../hooks/useConfetti'

interface ConfettiProps {
  active: boolean
  mode?: 'default' | 'schoolPride' | 'winner'
}

export function Confetti({ active, mode = 'schoolPride' }: ConfettiProps) {
  const { fire, fireSchoolPride, fireWinner } = useConfetti()

  useEffect(() => {
    if (!active) return

    if (mode === 'schoolPride') {
      fireSchoolPride()
    } else if (mode === 'winner') {
      fireWinner()
    } else {
      fire()
    }
  }, [active, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
