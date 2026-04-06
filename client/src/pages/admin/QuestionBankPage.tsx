import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminContext } from '../../context/AdminContext';
import { AdminNav } from '../../components/admin/AdminNav';
import { QuestionEditor } from '../../components/admin/QuestionEditor';
import { api } from '../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';

const EXAM_TYPES = ['general', 'midterm', 'final'] as const;
const EXAM_LABELS: Record<string, string> = { general: '📘 General', midterm: '📝 Midterm', final: '🎓 Final' };

export default function QuestionBankPage() {
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('course');
  const { courses, fetchCourses } = useAdminContext();
  const [selectedCourse, setSelectedCourse] = useState<number | null>(courseId ? Number(courseId) : null);
  const [banks, setBanks] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [activeExamType, setActiveExamType] = useState<string>('general');
  const [showBankModal, setShowBankModal] = useState(false);
  const [showQEditor, setShowQEditor] = useState(false);
  const [editingQ, setEditingQ] = useState<any>(null);
  const [bankForm, setBankForm] = useState({ name: '', exam_type: 'general', difficulty: 'mixed' });

  useEffect(() => { fetchCourses(); }, []);
  useEffect(() => {
    if (selectedCourse) loadBanks(selectedCourse);
  }, [selectedCourse]);
  useEffect(() => {
    if (selectedBank) loadQuestions(selectedBank.id);
  }, [selectedBank]);

  const loadBanks = async (cid: number) => {
    const r = await api.get(`/courses/${cid}/banks`);
    setBanks(r.data);
  };
  const loadQuestions = async (bid: number) => {
    const r = await api.get(`/banks/${bid}/questions`);
    setQuestions(r.data);
  };

  const createBank = async () => {
    if (!bankForm.name || !selectedCourse) return;
    await api.post(`/courses/${selectedCourse}/banks`, bankForm);
    setShowBankModal(false);
    loadBanks(selectedCourse);
  };

  const deleteBank = async (id: number) => {
    if (!confirm('Delete this bank and all its questions?')) return;
    await api.delete(`/banks/${id}`);
    setSelectedBank(null);
    loadBanks(selectedCourse!);
  };

  const saveQuestion = async (data: any) => {
    if (editingQ) await api.put(`/questions/${editingQ.id}`, data);
    else await api.post(`/banks/${selectedBank.id}/questions`, data);
    loadQuestions(selectedBank.id);
    setShowQEditor(false);
    setEditingQ(null);
  };

  const deleteQuestion = async (id: number) => {
    if (!confirm('Delete this question?')) return;
    await api.delete(`/questions/${id}`);
    loadQuestions(selectedBank.id);
  };

  const filteredBanks = banks.filter(b => b.exam_type === activeExamType);

  return (
    <div className="min-h-screen bg-black">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-white mb-6">Question Banks</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Course + Bank selector */}
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Select Course</label>
              <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white"
                value={selectedCourse || ''} onChange={e => setSelectedCourse(Number(e.target.value))}>
                <option value="">-- Choose a course --</option>
                {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {selectedCourse && (
              <>
                {/* Exam type tabs */}
                <div className="flex gap-2">
                  {EXAM_TYPES.map(t => (
                    <button key={t} onClick={() => setActiveExamType(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeExamType === t ? 'bg-unoh-red text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>
                      {EXAM_LABELS[t]}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {filteredBanks.map(b => (
                    <div key={b.id}
                      onClick={() => setSelectedBank(b)}
                      className={`p-4 rounded-xl border cursor-pointer transition-colors ${selectedBank?.id === b.id ? 'border-unoh-red bg-unoh-red/10' : 'border-gray-700 bg-gray-900 hover:border-gray-500'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white font-medium">{b.name}</div>
                          <div className="text-gray-500 text-xs mt-1">{b.question_count || 0} questions · {b.difficulty}</div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); deleteBank(b.id); }} className="text-gray-600 hover:text-red-400 text-sm">🗑️</button>
                      </div>
                    </div>
                  ))}
                  {filteredBanks.length === 0 && <p className="text-gray-600 text-sm py-4 text-center">No {activeExamType} banks yet</p>}
                </div>

                <button onClick={() => setShowBankModal(true)} className="w-full btn-secondary text-sm py-3">
                  + New {EXAM_LABELS[activeExamType]} Bank
                </button>
              </>
            )}
          </div>

          {/* Right: Questions list */}
          <div className="lg:col-span-2">
            {selectedBank ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">{selectedBank.name}</h2>
                  <div className="flex gap-2">
                    <button onClick={() => window.location.href = '/admin/import'} className="btn-secondary text-sm px-4 py-2">📥 Import</button>
                    <button onClick={() => { setEditingQ(null); setShowQEditor(true); }} className="btn-primary text-sm px-4 py-2">+ Add Question</button>
                  </div>
                </div>

                <div className="space-y-2">
                  {questions.map((q: any) => (
                    <div key={q.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 hover:border-gray-600 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs bg-unoh-red/20 text-red-300 px-2 py-0.5 rounded uppercase font-mono">{q.type}</span>
                            <span className="text-xs text-gray-500">{q.category}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${q.difficulty === 'hard' ? 'bg-red-900 text-red-300' : q.difficulty === 'medium' ? 'bg-yellow-900 text-yellow-300' : 'bg-green-900 text-green-300'}`}>{q.difficulty}</span>
                          </div>
                          <p className="text-white text-sm">{q.question}</p>
                          <p className="text-green-400 text-xs mt-1">✓ {q.answer}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => { setEditingQ(q); setShowQEditor(true); }} className="text-gray-500 hover:text-white text-sm px-2">✏️</button>
                          <button onClick={() => deleteQuestion(q.id)} className="text-gray-600 hover:text-red-400 text-sm px-2">🗑️</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {questions.length === 0 && (
                    <div className="text-center text-gray-600 py-16">
                      <div className="text-4xl mb-3">❓</div>
                      <p>No questions yet. Add some or import from CSV.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-600">
                <div className="text-center">
                  <div className="text-4xl mb-3">👈</div>
                  <p>Select a question bank to view questions</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bank Modal */}
      <AnimatePresence>
        {showBankModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
            onClick={e => e.target === e.currentTarget && setShowBankModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md">
              <h2 className="text-2xl font-bold text-white mb-6">New Question Bank</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Bank Name *</label>
                  <input className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-unoh-red outline-none"
                    value={bankForm.name} onChange={e => setBankForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Chapter 3 Review" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Exam Type</label>
                  <select className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white"
                    value={bankForm.exam_type} onChange={e => setBankForm(f => ({ ...f, exam_type: e.target.value }))}>
                    <option value="general">General Review</option>
                    <option value="midterm">Midterm Review</option>
                    <option value="final">Final Review</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Difficulty</label>
                  <select className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white"
                    value={bankForm.difficulty} onChange={e => setBankForm(f => ({ ...f, difficulty: e.target.value }))}>
                    <option value="mixed">Mixed</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={createBank} className="flex-1 btn-primary">Create Bank</button>
                <button onClick={() => setShowBankModal(false)} className="btn-secondary px-6">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question Editor */}
      <AnimatePresence>
        {showQEditor && (
          <QuestionEditor
            initial={editingQ}
            onSave={saveQuestion}
            onCancel={() => { setShowQEditor(false); setEditingQ(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
