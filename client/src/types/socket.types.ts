export interface JoinGamePayload {
  pin: string
  playerName: string
  team?: string
}

export interface BuzzerPressPayload {
  pin: string
  playerName: string
  timestamp: number
}

export interface SubmitAnswerPayload {
  pin: string
  playerName: string
  answer: string
  wagered?: number
  timeRemaining?: number
}

export interface PlayerJoinedEvent {
  playerName: string
  totalPlayers: number
  players: Array<{ name: string; team?: string; score: number }>
}

export interface GameStateEvent {
  phase: string
  question?: {
    id: number
    type: string
    question: string
    options?: string[]
    points: number
    time_limit: number
    category?: string
    difficulty: string
  }
  scores?: Array<{ name: string; score: number; team?: string; rank: number }>
  timer?: number
  currentQuestion?: number
  totalQuestions?: number
}

export interface AnswerResultEvent {
  correct: boolean
  pointsEarned: number
  newScore: number
  correctAnswer: string
}

export interface BuzzAcceptedEvent {
  playerName: string
  responseTime: number
}

export interface LeaderboardUpdateEvent {
  rankings: Array<{
    name: string
    score: number
    team?: string
    rank: number
  }>
}

export interface BuzzerQueueEvent {
  queue: Array<{
    playerName: string
    timestamp: number
    responseTime: number
  }>
}

export interface EliminationEvent {
  playerName: string
  survivorsLeft: number
}

export interface TerritoryUpdateEvent {
  grid: string[][]
  teamScores: Record<string, number>
}

export interface EscapeRoomProgressEvent {
  teams: Array<{
    name: string
    puzzlesCompleted: number
    totalPuzzles: number
    hintsUsed: number
    escaped: boolean
  }>
}
