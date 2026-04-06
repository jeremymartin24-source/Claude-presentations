import { useEffect, useState, useRef } from 'react';
import { useAdminContext } from '../../context/AdminContext';
import { AdminNav } from '../../components/admin/AdminNav';
import { api } from '../../lib/api';

export default function ImportPage() {
  const { courses, fetchCourses } = useAdminContext();
  const [activeTab, setActiveTab] = useState<'csv' | 'json'>('csv');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [banks, setBanks] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchCourses(); }, []);
  useEffect(() => {
    if (selectedCourse) {
      api.get(`/courses/${selectedCourse}/banks`).then(r => setBanks(r.data));
    }
  }, [selectedCourse]);

  const downloadTemplate = () => { window.location.href = '/api/import/template'; };

  const importCSV = async () => {
    if (!file || !selectedBank) return;
    setLoading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('bank_id', selectedBank);
    try {
      const r = await api.post('/import/csv', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(r.data);
    } catch (e: any) {
      setResult({ error: e.response?.data?.error || 'Import failed' });
    } finally {
      setLoading(false);
    }
  };

  const importJSON = async () => {
    if (!jsonText || !selectedBank) return;
    setLoading(true);
    try {
      const questions = JSON.parse(jsonText);
      const r = await api.post('/import/json', { bank_id: Number(selectedBank), questions });
      setResult(r.data);
    } catch (e: any) {
      setResult({ error: e.message || 'Invalid JSON or import failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <AdminNav />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Import Questions</h1>
            <p className="text-gray-400 mt-1">Bulk import questions via CSV or JSON</p>
          </div>
          <button onClick={downloadTemplate} className="btn-secondary text-sm px-4 py-2">📥 Download CSV Template</button>
        </div>

        {/* Target bank selection */}
        <div className="game-card mb-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Import Destination</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Course</label>
              <select className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white"
                value={selectedCourse} onChange={e => { setSelectedCourse(e.target.value); setSelectedBank(''); }}>
                <option value="">Select course...</option>
                {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Question Bank</label>
              <select className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white"
                value={selectedBank} onChange={e => setSelectedBank(e.target.value)} disabled={!selectedCourse}>
                <option value="">Select bank...</option>
                {banks.map((b: any) => <option key={b.id} value={b.id}>{b.name} ({b.exam_type})</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6">
          {(['csv', 'json'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === tab ? 'bg-unoh-red text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {activeTab === 'csv' ? (
          <div className="space-y-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-unoh-red rounded-2xl p-10 text-center cursor-pointer transition-colors">
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)} />
              <div className="text-4xl mb-3">📄</div>
              {file ? (
                <p className="text-white font-medium">{file.name}</p>
              ) : (
                <>
                  <p className="text-gray-400">Drop a CSV file here or click to browse</p>
                  <p className="text-gray-600 text-sm mt-1">Max 5MB</p>
                </>
              )}
            </div>
            <button onClick={importCSV} disabled={!file || !selectedBank || loading}
              className="w-full btn-primary py-4 text-lg disabled:opacity-40">
              {loading ? 'Importing...' : '📥 Import CSV'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Paste JSON array of questions</label>
              <textarea
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-unoh-red outline-none resize-none"
                rows={12}
                placeholder={`[\n  {\n    "type": "mc",\n    "question": "What does RAM stand for?",\n    "options": ["Random Access Memory", "Read Access Memory", "Rapid Action Memory", "Random Array Memory"],\n    "answer": "Random Access Memory",\n    "difficulty": "easy",\n    "category": "Hardware"\n  }\n]`}
                value={jsonText}
                onChange={e => setJsonText(e.target.value)}
              />
            </div>
            <button onClick={importJSON} disabled={!jsonText || !selectedBank || loading}
              className="w-full btn-primary py-4 text-lg disabled:opacity-40">
              {loading ? 'Importing...' : '📥 Import JSON'}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`mt-6 p-5 rounded-xl border ${result.error ? 'border-red-700 bg-red-900/20' : 'border-green-700 bg-green-900/20'}`}>
            {result.error ? (
              <p className="text-red-400">❌ {result.error}</p>
            ) : (
              <>
                <p className="text-green-400 font-bold">✅ Imported {result.imported} questions successfully!</p>
                {result.errors?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-yellow-400 text-sm">{result.errors.length} rows skipped:</p>
                    <ul className="text-yellow-600 text-xs mt-1 space-y-1">
                      {result.errors.slice(0, 5).map((e: string, i: number) => <li key={i}>• {e}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
