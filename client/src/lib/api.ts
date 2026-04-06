import axios from 'axios'
import type { Course, QuestionBank, Question, GameSession } from '../types/game.types'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor for auth
api.interceptors.request.use((config) => {
  const password = sessionStorage.getItem('admin_password')
  if (password) {
    config.headers['x-admin-password'] = password
  }
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export const coursesApi = {
  getAll: () => api.get<Course[]>('/courses').then(r => r.data),
  create: (data: Omit<Course, 'id' | 'created_at'>) => api.post<Course>('/courses', data).then(r => r.data),
  update: (id: number, data: Partial<Course>) => api.put<Course>(`/courses/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/courses/${id}`).then(r => r.data),
  getBanks: (courseId: number) => api.get<QuestionBank[]>(`/courses/${courseId}/banks`).then(r => r.data),
  createBank: (courseId: number, data: Omit<QuestionBank, 'id' | 'course_id' | 'question_count'>) =>
    api.post<QuestionBank>(`/courses/${courseId}/banks`, data).then(r => r.data),
}

export const questionsApi = {
  getByBank: (bankId: number) => api.get<Question[]>(`/banks/${bankId}/questions`).then(r => r.data),
  create: (bankId: number, data: Omit<Question, 'id' | 'bank_id'>) =>
    api.post<Question>(`/banks/${bankId}/questions`, data).then(r => r.data),
  update: (id: number, data: Partial<Question>) => api.put<Question>(`/questions/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/questions/${id}`).then(r => r.data),
  getBank: (bankId: number) => api.get<QuestionBank>(`/banks/${bankId}`).then(r => r.data),
  updateBank: (bankId: number, data: Partial<QuestionBank>) =>
    api.put<QuestionBank>(`/banks/${bankId}`, data).then(r => r.data),
  removeBank: (bankId: number) => api.delete(`/banks/${bankId}`).then(r => r.data),
}

export const gamesApi = {
  create: (data: {
    game_type: string
    bank_id?: number
    course_id?: number
    settings?: object
  }) => api.post<{ pin: string; session_id: number }>('/games', data).then(r => r.data),
  getByPin: (pin: string) => api.get(`/games/${pin}`).then(r => r.data),
  end: (pin: string) => api.post(`/games/${pin}/end`).then(r => r.data),
}

export const sessionsApi = {
  getAll: () => api.get<GameSession[]>('/sessions').then(r => r.data),
  getById: (id: number) => api.get<GameSession>(`/sessions/${id}`).then(r => r.data),
  exportCsv: (id: number) => api.get(`/sessions/${id}/export`, { responseType: 'blob' }).then(r => r.data),
}

export const settingsApi = {
  getAll: () => api.get<Record<string, string>>('/settings').then(r => r.data),
  updateAll: (data: Record<string, string>) => api.put('/settings', data).then(r => r.data),
}

export const statsApi = {
  getOverview: () => api.get<{
    totalGames: number
    totalStudents: number
    totalQuestions: number
    gameTypeCounts: Array<{ game_type: string; count: number }>
    topStudents: Array<{ name: string; avgScore: number; gamesPlayed: number }>
  }>('/stats/overview').then(r => r.data),
  getRecent: () => api.get<GameSession[]>('/stats/recent').then(r => r.data),
}

export const importApi = {
  csv: (bankId: number, formData: FormData) =>
    api.post<{ imported: number; errors: string[] }>(`/import/csv/${bankId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),
  json: (bankId: number, data: object) =>
    api.post<{ imported: number; errors: string[] }>(`/import/json/${bankId}`, data).then(r => r.data),
  getTemplate: () => api.get('/import/template', { responseType: 'blob' }).then(r => r.data),
}
