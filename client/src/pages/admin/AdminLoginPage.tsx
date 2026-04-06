import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminContext } from '../../context/AdminContext';
import { motion } from 'framer-motion';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAdminContext();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const ok = await login(password);
    if (ok) {
      navigate('/admin');
    } else {
      setError('Incorrect password. Try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-900 border border-unoh-red rounded-2xl p-10 w-full max-w-md shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-3xl font-display font-black text-white uppercase tracking-wider">UNOH Review Games</h1>
          <p className="text-gray-400 mt-2">Admin Access · Professor Martin</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full bg-black border border-gray-700 focus:border-unoh-red rounded-lg px-4 py-3 text-white placeholder-gray-600 outline-none transition-colors text-lg"
              autoFocus
            />
          </div>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm">
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full btn-primary text-xl py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Checking...' : 'Enter Admin Panel'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            ← Back to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
}
