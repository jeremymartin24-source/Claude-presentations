import React, { createContext, useContext, useState, useCallback } from 'react'
import type { GameType, Player, Question } from '../types/game.types'
import { useSocketContext } from './SocketContext'

interface GameState {
  pin: string | null
  gameType: GameType | null
  phase: 'idle' | 'lobby' | 'playing' | 'question' | 'answer' | 'leaderboard' | 'ended'
  players: Player[]
  scores: Array<{ name: string; score: number; team?: string; rank: number }>
  currentQuestion: Question | null
  currentQuestionIndex: number
  totalQuestions: number
  timer: number
  playerName: string | null
  playerTeam: string | null
  myScore: number
  myRank: number
  lastAnswerResult: { correct: boolean; pointsEarned: number; correctAnswer: string } | null
}

interface GameContextValue {
  gameState: GameState
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
  updateScores: (scores: GameState['scores']) => void
  addPlayer: (player: Player) => void
  setPhase: (phase: GameState['phase']) => void
  setCurrentQuestion: (q: Question | null) => void
  setPlayerInfo: (name: string, team?: string) => void
  startGame: (pin: string) => void
  nextQuestion: (pin: string) => void
  endGame: (pin: string) => void
  resetGame: () => void
}

const initialState: GameState = {
  pin: null,
  gameType: null,
  phase: 'idle',
  players: [],
  scores: [],
  currentQuestion: null,
  currentQuestionIndex: 0,
  totalQuestions: 0,
  timer: 0,
  playerName: null,
  playerTeam: null,
  myScore: 0,
  myRank: 0,
  lastAnswerResult: null,
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocketContext()
  const [gameState, setGameState] = useState<GameState>(initialState)

  const updateScores = useCallback((scores: GameState['scores']) => {
    setGameState(prev => ({ ...prev, scores }))
  }, [])

  const addPlayer = useCallback((player: Player) => {
    setGameState(prev => ({
      ...prev,
      players: [...prev.players.filter(p => p.name !== player.name), player],
    }))
  }, [])

  const setPhase = useCallback((phase: GameState['phase']) => {
    setGameState(prev => ({ ...prev, phase }))
  }, [])

  const setCurrentQuestion = useCallback((q: Question | null) => {
    setGameState(prev => ({ ...prev, currentQuestion: q }))
  }, [])

  const setPlayerInfo = useCallback((name: string, team?: string) => {
    setGameState(prev => ({ ...prev, playerName: name, playerTeam: team || null }))
  }, [])

  const startGame = useCallback((pin: string) => {
    socket?.emit('admin_start_game', { pin })
  }, [socket])

  const nextQuestion = useCallback((pin: string) => {
    socket?.emit('admin_next_question', { pin })
  }, [socket])

  const endGame = useCallback((pin: string) => {
    socket?.emit('admin_end_game', { pin })
  }, [socket])

  const resetGame = useCallback(() => {
    setGameState(initialState)
  }, [])

  return (
    <GameContext.Provider value={{
      gameState,
      setGameState,
      updateScores,
      addPlayer,
      setPhase,
      setCurrentQuestion,
      setPlayerInfo,
      startGame,
      nextQuestion,
      endGame,
      resetGame,
    }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGameContext() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGameContext must be used within GameProvider')
  return ctx
}
