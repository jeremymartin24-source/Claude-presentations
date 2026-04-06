export type GameType =
  | 'jeopardy'
  | 'kahoot'
  | 'millionaire'
  | 'escaperoom'
  | 'hotseat'
  | 'speedround'
  | 'battleroyale'
  | 'wager'
  | 'bingo'
  | 'ranked'
  | 'teamtakeover'
  | 'codebreaker'

export interface Question {
  id: number
  bank_id: number
  type: 'mc' | 'tf' | 'short' | 'order' | 'bingo_term'
  question: string
  options?: string[]
  answer: string
  hint?: string
  points: number
  time_limit: number
  category?: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface Player {
  name: string
  team?: string
  score: number
  streak: number
  alive: boolean
  socketId?: string
}

export interface GameRoom {
  pin: string
  gameType: GameType
  phase: 'lobby' | 'playing' | 'question' | 'answer' | 'leaderboard' | 'ended'
  players: Player[]
  currentQuestion: number
  settings: GameSettings
}

export interface GameSettings {
  timeLimit?: number
  maxPlayers?: number
  teams?: boolean
  teamNames?: string[]
  pointMultiplier?: number
  soundEnabled?: boolean
}

export interface Course {
  id: number
  name: string
  subject?: string
  description?: string
  created_at: string
}

export interface QuestionBank {
  id: number
  course_id: number
  name: string
  exam_type: 'midterm' | 'final' | 'general'
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  question_count?: number
}

export interface GameSession {
  id: number
  game_type: GameType
  course_id?: number
  bank_id?: number
  pin?: string
  settings?: string
  started_at: string
  ended_at?: string
  status: 'active' | 'ended'
}

export interface LeaderboardEntry {
  name: string
  team?: string
  score: number
  rank: number
  streak?: number
}
