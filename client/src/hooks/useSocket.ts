import { useCallback } from 'react'
import { useSocketContext } from '../context/SocketContext'
import type {
  JoinGamePayload,
  BuzzerPressPayload,
  SubmitAnswerPayload,
  GameStateEvent,
  AnswerResultEvent,
  LeaderboardUpdateEvent,
  PlayerJoinedEvent,
  BuzzAcceptedEvent,
} from '../types/socket.types'

export function useSocket() {
  const { socket, isConnected } = useSocketContext()

  const emit = useCallback(<T>(event: string, data?: T) => {
    if (socket?.connected) {
      socket.emit(event, data)
    } else {
      console.warn(`Socket not connected. Cannot emit: ${event}`)
    }
  }, [socket])

  const on = useCallback(<T>(event: string, handler: (data: T) => void) => {
    socket?.on(event, handler)
    return () => { socket?.off(event, handler) }
  }, [socket])

  const off = useCallback((event: string, handler?: (...args: unknown[]) => void) => {
    socket?.off(event, handler)
  }, [socket])

  // Typed emit helpers
  const joinGame = useCallback((payload: JoinGamePayload) => {
    emit('join_game', payload)
  }, [emit])

  const pressBuzzer = useCallback((payload: BuzzerPressPayload) => {
    emit('buzzer_press', payload)
  }, [emit])

  const submitAnswer = useCallback((payload: SubmitAnswerPayload) => {
    emit('submit_answer', payload)
  }, [emit])

  const adminStartGame = useCallback((pin: string) => {
    emit('admin_start_game', { pin })
  }, [emit])

  const adminNextQuestion = useCallback((pin: string) => {
    emit('admin_next_question', { pin })
  }, [emit])

  const adminEndGame = useCallback((pin: string) => {
    emit('admin_end_game', { pin })
  }, [emit])

  const adminAcceptBuzz = useCallback((pin: string, playerName: string) => {
    emit('admin_accept_buzz', { pin, playerName })
  }, [emit])

  const adminRejectBuzz = useCallback((pin: string, playerName: string) => {
    emit('admin_reject_buzz', { pin, playerName })
  }, [emit])

  const adminAwardPoints = useCallback((pin: string, playerName: string, points: number) => {
    emit('admin_award_points', { pin, playerName, points })
  }, [emit])

  // Typed on helpers
  const onGameState = useCallback((handler: (data: GameStateEvent) => void) => {
    return on<GameStateEvent>('game_state', handler)
  }, [on])

  const onAnswerResult = useCallback((handler: (data: AnswerResultEvent) => void) => {
    return on<AnswerResultEvent>('answer_result', handler)
  }, [on])

  const onLeaderboardUpdate = useCallback((handler: (data: LeaderboardUpdateEvent) => void) => {
    return on<LeaderboardUpdateEvent>('leaderboard_update', handler)
  }, [on])

  const onPlayerJoined = useCallback((handler: (data: PlayerJoinedEvent) => void) => {
    return on<PlayerJoinedEvent>('player_joined', handler)
  }, [on])

  const onBuzzAccepted = useCallback((handler: (data: BuzzAcceptedEvent) => void) => {
    return on<BuzzAcceptedEvent>('buzz_accepted', handler)
  }, [on])

  return {
    socket,
    isConnected,
    emit,
    on,
    off,
    joinGame,
    pressBuzzer,
    submitAnswer,
    adminStartGame,
    adminNextQuestion,
    adminEndGame,
    adminAcceptBuzz,
    adminRejectBuzz,
    adminAwardPoints,
    onGameState,
    onAnswerResult,
    onLeaderboardUpdate,
    onPlayerJoined,
    onBuzzAccepted,
  }
}
