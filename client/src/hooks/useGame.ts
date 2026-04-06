import { useEffect, useCallback } from 'react'
import { useGameContext } from '../context/GameContext'
import { useSocket } from './useSocket'
import type { GameStateEvent, AnswerResultEvent, LeaderboardUpdateEvent, PlayerJoinedEvent } from '../types/socket.types'
import type { Question } from '../types/game.types'

export function useGame() {
  const { gameState, setGameState, addPlayer } = useGameContext()
  const { socket, isConnected, joinGame, pressBuzzer, submitAnswer } = useSocket()

  useEffect(() => {
    if (!socket) return

    const handleGameState = (data: GameStateEvent) => {
      setGameState(prev => ({
        ...prev,
        phase: data.phase as typeof prev.phase,
        currentQuestion: data.question as Question | null,
        currentQuestionIndex: data.currentQuestion ?? prev.currentQuestionIndex,
        totalQuestions: data.totalQuestions ?? prev.totalQuestions,
        timer: data.timer ?? prev.timer,
        scores: data.scores ?? prev.scores,
      }))
    }

    const handleAnswerResult = (data: AnswerResultEvent) => {
      setGameState(prev => ({
        ...prev,
        myScore: data.newScore,
        lastAnswerResult: {
          correct: data.correct,
          pointsEarned: data.pointsEarned,
          correctAnswer: data.correctAnswer,
        },
      }))
    }

    const handleLeaderboardUpdate = (data: LeaderboardUpdateEvent) => {
      setGameState(prev => ({
        ...prev,
        scores: data.rankings,
      }))
    }

    const handlePlayerJoined = (data: PlayerJoinedEvent) => {
      addPlayer({
        name: data.playerName,
        score: 0,
        streak: 0,
        alive: true,
      })
    }

    const handlePlayerLeft = (data: { playerName: string }) => {
      setGameState(prev => ({
        ...prev,
        players: prev.players.filter(p => p.name !== data.playerName),
      }))
    }

    socket.on('game_state', handleGameState)
    socket.on('answer_result', handleAnswerResult)
    socket.on('leaderboard_update', handleLeaderboardUpdate)
    socket.on('player_joined', handlePlayerJoined)
    socket.on('player_left', handlePlayerLeft)

    return () => {
      socket.off('game_state', handleGameState)
      socket.off('answer_result', handleAnswerResult)
      socket.off('leaderboard_update', handleLeaderboardUpdate)
      socket.off('player_joined', handlePlayerJoined)
      socket.off('player_left', handlePlayerLeft)
    }
  }, [socket, setGameState, addPlayer])

  const join = useCallback((pin: string, playerName: string, team?: string) => {
    joinGame({ pin, playerName, team })
    setGameState(prev => ({
      ...prev,
      pin,
      playerName,
      playerTeam: team || null,
      phase: 'lobby',
    }))
  }, [joinGame, setGameState])

  const buzz = useCallback(() => {
    if (!gameState.pin || !gameState.playerName) return
    pressBuzzer({
      pin: gameState.pin,
      playerName: gameState.playerName,
      timestamp: Date.now(),
    })
  }, [gameState.pin, gameState.playerName, pressBuzzer])

  const answer = useCallback((answerText: string, wagered?: number) => {
    if (!gameState.pin || !gameState.playerName) return
    submitAnswer({
      pin: gameState.pin,
      playerName: gameState.playerName,
      answer: answerText,
      wagered,
    })
  }, [gameState.pin, gameState.playerName, submitAnswer])

  return {
    gameState,
    isConnected,
    join,
    buzz,
    answer,
  }
}
