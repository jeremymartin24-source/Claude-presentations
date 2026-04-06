import { useEffect, useState } from 'react';
import AdminNav from '../../components/admin/AdminNav';
import { api } from '../../lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [lanIP, setLanIP] = useState('');

  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data)).catch(() => {});
    // Get server IP from health endpoint origin
    setLanIP(window.location.hostname);
  }, []);

  const set = (key: string, val: string) => setSettings(s => ({ ...s, [key]: val }));

  const save = async () => {
    await api.put('/settings', settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const studentJoinUrl = `http://${lanIP}:3000/join`;

  return (
    <div className="min-h-screen bg-black">
      <AdminNav />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

        <div className="space-y-6">
          {/* Branding */}
          <div className="game-card space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-gray-700 pb-3">Branding</h2>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Professor Name</label>
              <input className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-unoh-red outline-none"
                value={settings.professor_name || ''} onChange={e => set('professor_name', e.target.value)} />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">University Name</label>
              <input className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-unoh-red outline-none"
                value={settings.university_name || ''} onChange={e => set('university_name', e.target.value)} />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">University Abbreviation</label>
              <input className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-unoh-red outline-none"
                value={settings.university_short || ''} onChange={e => set('university_short', e.target.value)} />
            </div>
          </div>

          {/* Preferences */}
          <div className="game-card space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-gray-700 pb-3">Preferences</h2>
            {[
              { key: 'sounds_enabled', label: 'Sound Effects', desc: 'Play buzz, correct, wrong sounds during games' },
              { key: 'animations_enabled', label: 'Animations', desc: 'Enable confetti, slide animations, and effects' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{label}</div>
                  <div className="text-gray-500 text-sm">{desc}</div>
                </div>
                <button
                  onClick={() => set(key, settings[key] === 'true' ? 'false' : 'true')}
                  className={`w-12 h-6 rounded-full transition-colors ${settings[key] === 'true' ? 'bg-unoh-red' : 'bg-gray-700'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white mx-0.5 transition-transform ${settings[key] === 'true' ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
          </div>

          {/* Security */}
          <div className="game-card space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-gray-700 pb-3">Security</h2>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Admin Password</label>
              <input type="password" className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-unoh-red outline-none"
                value={settings.admin_password || ''} onChange={e => set('admin_password', e.target.value)}
                placeholder="Enter new password to change" />
              <p className="text-gray-600 text-xs mt-1">Leave blank to keep current password</p>
            </div>
          </div>

          {/* Network Info */}
          <div className="game-card space-y-3">
            <h2 className="text-lg font-bold text-white border-b border-gray-700 pb-3">Network (Classroom)</h2>
            <div className="bg-black rounded-lg px-4 py-3">
              <p className="text-gray-400 text-sm mb-1">Student Join URL:</p>
              <p className="text-unoh-red font-mono text-lg break-all">{studentJoinUrl}</p>
            </div>
            <p className="text-gray-600 text-sm">Students on the same WiFi network should use this URL, or scan the QR code when you launch a game.</p>
            <p className="text-yellow-600 text-xs">⚠️ Make sure your laptop's firewall allows port 3000 and 3001 on your local network.</p>
          </div>

          <button onClick={save} className="w-full btn-primary text-xl py-4">
            {saved ? '✅ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
