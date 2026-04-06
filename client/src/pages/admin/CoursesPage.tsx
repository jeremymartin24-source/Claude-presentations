import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminContext } from '../../context/AdminContext';
import { AdminNav } from '../../components/admin/AdminNav';
import { motion, AnimatePresence } from 'framer-motion';

export default function CoursesPage() {
  const { courses, fetchCourses, createCourse, updateCourse, deleteCourse } = useAdminContext();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', subject: '', description: '' });

  useEffect(() => { fetchCourses(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', subject: '', description: '' }); setShowModal(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ name: c.name, subject: c.subject || '', description: c.description || '' }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editing) await updateCourse(editing.id, form);
    else await createCourse(form);
    setShowModal(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this course and all its question banks?')) return;
    await deleteCourse(id);
  };

  return (
    <div className="min-h-screen bg-black">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Courses</h1>
            <p className="text-gray-400 mt-1">Manage your courses and question banks</p>
          </div>
          <button onClick={openCreate} className="btn-primary">+ New Course</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course: any) => (
            <motion.div key={course.id} layout
              className="game-card hover:border-unoh-red-light transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{course.name}</h3>
                  {course.subject && <p className="text-unoh-red text-sm font-medium mt-1">{course.subject}</p>}
                  {course.description && <p className="text-gray-400 text-sm mt-2 line-clamp-2">{course.description}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => navigate(`/admin/banks?course=${course.id}`)}
                  className="flex-1 bg-unoh-red hover:bg-unoh-red-dark text-white rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  📚 Question Banks
                </button>
                <button onClick={() => openEdit(course)} className="btn-secondary px-3 py-2 text-sm">✏️</button>
                <button onClick={() => handleDelete(course.id)} className="bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-red-300 rounded-lg px-3 py-2 text-sm transition-colors">🗑️</button>
              </div>
            </motion.div>
          ))}
          {courses.length === 0 && (
            <div className="col-span-3 text-center text-gray-600 py-20">
              <div className="text-5xl mb-4">📚</div>
              <p className="text-xl">No courses yet</p>
              <p className="text-sm mt-2">Create your first course to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md">
              <h2 className="text-2xl font-bold text-white mb-6">{editing ? 'Edit Course' : 'New Course'}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Course Name *</label>
                  <input className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-unoh-red outline-none"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Networking Fundamentals" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Course Code / Subject</label>
                  <input className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-unoh-red outline-none"
                    value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. IT200" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Description</label>
                  <textarea className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-unoh-red outline-none resize-none"
                    rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional course description" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleSave} className="flex-1 btn-primary">Save Course</button>
                <button onClick={() => setShowModal(false)} className="btn-secondary px-6">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
