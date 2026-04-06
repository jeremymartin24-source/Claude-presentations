import { useState } from 'react'
import { clsx } from 'clsx'
import { Button } from '../common/Button'
import type { Question } from '../../types/game.types'

interface QuestionEditorProps {
  initial?: Partial<Question>
  onSave: (data: Omit<Question, 'id' | 'bank_id'>) => Promise<void>
  onCancel: () => void
}

const defaultQuestion: Omit<Question, 'id' | 'bank_id'> = {
  type: 'mc',
  question: '',
  options: ['', '', '', ''],
  answer: '',
  hint: '',
  points: 100,
  time_limit: 30,
  category: '',
  difficulty: 'medium',
}

export function QuestionEditor({ initial, onSave, onCancel }: QuestionEditorProps) {
  const [form, setForm] = useState<Omit<Question, 'id' | 'bank_id'>>({
    ...defaultQuestion,
    ...initial,
    options: initial?.options ?? defaultQuestion.options,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field: keyof typeof form, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const setOption = (idx: number, value: string) => {
    const opts = [...(form.options || ['', '', '', ''])]
    opts[idx] = value
    set('options', opts)
  }

  const addOption = () => {
    set('options', [...(form.options || []), ''])
  }

  const removeOption = (idx: number) => {
    const opts = (form.options || []).filter((_, i) => i !== idx)
    set('options', opts)
  }

  const handleSave = async () => {
    if (!form.question.trim()) { setError('Question text is required'); return }
    if (!form.answer.trim()) { setError('Answer is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-unoh-red'
  const labelCls = 'block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide'

  return (
    <div className="space-y-4 bg-gray-900 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white text-lg">{initial?.id ? 'Edit Question' : 'Add Question'}</h3>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-700 text-red-300 px-3 py-2 rounded-lg text-sm">{error}</div>
      )}

      {/* Type + Difficulty row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Type</label>
          <select
            className={inputCls}
            value={form.type}
            onChange={e => set('type', e.target.value)}
          >
            <option value="mc">Multiple Choice</option>
            <option value="tf">True / False</option>
            <option value="short">Short Answer</option>
            <option value="order">Ordering</option>
            <option value="bingo_term">Bingo Term</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Difficulty</label>
          <select
            className={inputCls}
            value={form.difficulty}
            onChange={e => set('difficulty', e.target.value)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Question text */}
      <div>
        <label className={labelCls}>Question *</label>
        <textarea
          className={clsx(inputCls, 'resize-none')}
          rows={3}
          value={form.question}
          onChange={e => set('question', e.target.value)}
          placeholder="Enter the question..."
        />
      </div>

      {/* Options (MC or Order) */}
      {(form.type === 'mc' || form.type === 'order') && (
        <div>
          <label className={labelCls}>
            {form.type === 'mc' ? 'Answer Options' : 'Items to Order'}
          </label>
          <div className="space-y-2">
            {(form.options || []).map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                {form.type === 'mc' && (
                  <span className="text-xs font-bold text-gray-500 w-5">{String.fromCharCode(65 + i)}.</span>
                )}
                {form.type === 'order' && (
                  <span className="text-xs font-bold text-gray-500 w-5">{i + 1}.</span>
                )}
                <input
                  className={clsx(inputCls, 'flex-1')}
                  value={opt}
                  onChange={e => setOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                />
                {(form.options || []).length > 2 && (
                  <button
                    onClick={() => removeOption(i)}
                    className="text-red-400 hover:text-red-300 text-lg leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {(form.options || []).length < 8 && (
              <button
                onClick={addOption}
                className="text-sm text-unoh-red hover:text-unoh-red-light font-semibold"
              >
                + Add Option
              </button>
            )}
          </div>
        </div>
      )}

      {/* True/False */}
      {form.type === 'tf' && (
        <div>
          <label className={labelCls}>Correct Answer</label>
          <div className="flex gap-3">
            {['True', 'False'].map(val => (
              <button
                key={val}
                onClick={() => set('answer', val)}
                className={clsx(
                  'px-6 py-2 rounded-lg font-bold border transition-all',
                  form.answer === val
                    ? 'bg-unoh-red border-unoh-red text-white'
                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
                )}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Answer (for non-TF) */}
      {form.type !== 'tf' && (
        <div>
          <label className={labelCls}>
            {form.type === 'mc' ? 'Correct Answer (must match one option exactly)' : 'Answer *'}
          </label>
          <input
            className={inputCls}
            value={form.answer}
            onChange={e => set('answer', e.target.value)}
            placeholder="Correct answer..."
          />
        </div>
      )}

      {/* Points, Time Limit, Category row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Points</label>
          <input
            type="number"
            className={inputCls}
            value={form.points}
            onChange={e => set('points', Number(e.target.value))}
            min={0}
            step={50}
          />
        </div>
        <div>
          <label className={labelCls}>Time (sec)</label>
          <input
            type="number"
            className={inputCls}
            value={form.time_limit}
            onChange={e => set('time_limit', Number(e.target.value))}
            min={5}
            max={300}
          />
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <input
            className={inputCls}
            value={form.category || ''}
            onChange={e => set('category', e.target.value)}
            placeholder="Optional..."
          />
        </div>
      </div>

      {/* Hint */}
      <div>
        <label className={labelCls}>Hint (optional)</label>
        <input
          className={inputCls}
          value={form.hint || ''}
          onChange={e => set('hint', e.target.value)}
          placeholder="Give students a helpful hint..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          Save Question
        </Button>
      </div>
    </div>
  )
}
