import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { Course, QuestionBank, Question } from '../types/game.types'
import { coursesApi, questionsApi, settingsApi } from '../lib/api'

interface AdminContextValue {
  isAuthenticated: boolean
  login: (password: string) => Promise<boolean>
  logout: () => void
  courses: Course[]
  questionBanks: QuestionBank[]
  questions: Question[]
  selectedCourse: Course | null
  selectedBank: QuestionBank | null
  settings: Record<string, string>
  isLoading: boolean
  loadCourses: () => Promise<void>
  fetchCourses: () => Promise<void>
  loadBanks: (courseId: number) => Promise<void>
  loadQuestions: (bankId: number) => Promise<void>
  selectCourse: (course: Course | null) => void
  selectBank: (bank: QuestionBank | null) => void
  createCourse: (data: Omit<Course, 'id' | 'created_at'>) => Promise<Course>
  updateCourse: (id: number, data: Partial<Course>) => Promise<void>
  deleteCourse: (id: number) => Promise<void>
  createBank: (courseId: number, data: Omit<QuestionBank, 'id' | 'course_id' | 'question_count'>) => Promise<QuestionBank>
  updateBank: (bankId: number, data: Partial<QuestionBank>) => Promise<void>
  deleteBank: (bankId: number) => Promise<void>
  createQuestion: (bankId: number, data: Omit<Question, 'id' | 'bank_id'>) => Promise<void>
  updateQuestion: (id: number, data: Partial<Question>) => Promise<void>
  deleteQuestion: (id: number) => Promise<void>
  saveSettings: (data: Record<string, string>) => Promise<void>
  loadSettings: () => Promise<void>
}

export const AdminContext = createContext<AdminContextValue | null>(null)

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('admin_auth') === 'true'
  })
  const [courses, setCourses] = useState<Course[]>([])
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      sessionStorage.setItem('admin_password', password)
      // Try to fetch settings to verify password
      await settingsApi.getAll()
      sessionStorage.setItem('admin_auth', 'true')
      setIsAuthenticated(true)
      return true
    } catch {
      sessionStorage.removeItem('admin_password')
      sessionStorage.removeItem('admin_auth')
      setIsAuthenticated(false)
      return false
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem('admin_auth')
    sessionStorage.removeItem('admin_password')
    setIsAuthenticated(false)
  }, [])

  const loadCourses = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await coursesApi.getAll()
      setCourses(data)
    } catch (e) {
      console.error('Failed to load courses', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadBanks = useCallback(async (courseId: number) => {
    setIsLoading(true)
    try {
      const data = await coursesApi.getBanks(courseId)
      setQuestionBanks(data)
    } catch (e) {
      console.error('Failed to load banks', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadQuestions = useCallback(async (bankId: number) => {
    setIsLoading(true)
    try {
      const data = await questionsApi.getByBank(bankId)
      setQuestions(data)
    } catch (e) {
      console.error('Failed to load questions', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const selectCourse = useCallback((course: Course | null) => {
    setSelectedCourse(course)
    setSelectedBank(null)
    setQuestionBanks([])
    setQuestions([])
    if (course) loadBanks(course.id)
  }, [loadBanks])

  const selectBank = useCallback((bank: QuestionBank | null) => {
    setSelectedBank(bank)
    setQuestions([])
    if (bank) loadQuestions(bank.id)
  }, [loadQuestions])

  const createCourse = useCallback(async (data: Omit<Course, 'id' | 'created_at'>) => {
    const course = await coursesApi.create(data)
    setCourses(prev => [...prev, course])
    return course
  }, [])

  const updateCourse = useCallback(async (id: number, data: Partial<Course>) => {
    const updated = await coursesApi.update(id, data)
    setCourses(prev => prev.map(c => c.id === id ? updated : c))
  }, [])

  const deleteCourse = useCallback(async (id: number) => {
    await coursesApi.remove(id)
    setCourses(prev => prev.filter(c => c.id !== id))
    if (selectedCourse?.id === id) setSelectedCourse(null)
  }, [selectedCourse])

  const createBank = useCallback(async (courseId: number, data: Omit<QuestionBank, 'id' | 'course_id' | 'question_count'>) => {
    const bank = await coursesApi.createBank(courseId, data)
    setQuestionBanks(prev => [...prev, bank])
    return bank
  }, [])

  const updateBank = useCallback(async (bankId: number, data: Partial<QuestionBank>) => {
    await questionsApi.updateBank(bankId, data)
    setQuestionBanks(prev => prev.map(b => b.id === bankId ? { ...b, ...data } : b))
  }, [])

  const deleteBank = useCallback(async (bankId: number) => {
    await questionsApi.removeBank(bankId)
    setQuestionBanks(prev => prev.filter(b => b.id !== bankId))
    if (selectedBank?.id === bankId) setSelectedBank(null)
  }, [selectedBank])

  const createQuestion = useCallback(async (bankId: number, data: Omit<Question, 'id' | 'bank_id'>) => {
    const q = await questionsApi.create(bankId, data)
    setQuestions(prev => [...prev, q])
  }, [])

  const updateQuestion = useCallback(async (id: number, data: Partial<Question>) => {
    const updated = await questionsApi.update(id, data)
    setQuestions(prev => prev.map(q => q.id === id ? updated : q))
  }, [])

  const deleteQuestion = useCallback(async (id: number) => {
    await questionsApi.remove(id)
    setQuestions(prev => prev.filter(q => q.id !== id))
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const data = await settingsApi.getAll()
      setSettings(data)
    } catch (e) {
      console.error('Failed to load settings', e)
    }
  }, [])

  const saveSettings = useCallback(async (data: Record<string, string>) => {
    await settingsApi.updateAll(data)
    setSettings(data)
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadCourses()
      loadSettings()
    }
  }, [isAuthenticated, loadCourses, loadSettings])

  return (
    <AdminContext.Provider value={{
      isAuthenticated,
      login,
      logout,
      courses,
      questionBanks,
      questions,
      selectedCourse,
      selectedBank,
      settings,
      isLoading,
      loadCourses,
      fetchCourses: loadCourses,
      loadBanks,
      loadQuestions,
      selectCourse,
      selectBank,
      createCourse,
      updateCourse,
      deleteCourse,
      createBank,
      updateBank,
      deleteBank,
      createQuestion,
      updateQuestion,
      deleteQuestion,
      saveSettings,
      loadSettings,
    }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdminContext() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdminContext must be used within AdminProvider')
  return ctx
}
