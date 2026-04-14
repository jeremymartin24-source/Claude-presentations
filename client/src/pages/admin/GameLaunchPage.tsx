import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminContext } from '../../context/AdminContext';
import { AdminNav } from '../../components/admin/AdminNav';
import { QRCodeDisplay } from '../../components/common/QRCodeDisplay';
import { api } from '../../lib/api';
import { motion } from 'framer-motion';

const GAMES = [
  { type: 'jeopardy',     name: 'Jeopardy',         icon: '📺', desc: 'Categories & points, team buzzers',   buzzer: true,  noDevices: true  },
  { type: 'kahoot',       name: 'Kahoot Quiz',       icon: '⚡', desc: 'Timed MC questions, live leaderboard', buzzer: false, noDevices: true  },
  { type: 'millionaire',  name: 'Millionaire',       icon: '💰', desc: 'Escalating difficulty with lifelines', buzzer: false, noDevices: true  },
  { type: 'battleroyale', name: 'Battle Royale',     icon: '⚔️', desc: 'Wrong answer = eliminated',           buzzer: false, noDevices: false },
  { type: 'escaperoom',   name: 'Escape Room',       icon: '🔐', desc: 'Team sequential puzzle chains',       buzzer: false, noDevices: false },
  { type: 'hotseat',      name: 'Hot Seat',          icon: '🔥', desc: 'One student vs. the class',           buzzer: false, noDevices: true  },
  { type: 'speedround',   name: 'Speed Round',       icon: '🚀', desc: 'Rapid-fire, fastest wins',            buzzer: true,  noDevices: false },
  { type: 'wager',        name: 'Confidence Wager',  icon: '🎲', desc: 'Bet your points on each answer',      buzzer: false, noDevices: false },
  { type: 'bingo',        name: 'Blackout Bingo',    icon: '🎱', desc: 'Random bingo cards per student',      buzzer: false, noDevices: false },
  { type: 'ranked',       name: 'Ranked!',           icon: '📊', desc: 'Put items in correct order',          buzzer: false, noDevices: false },
  { type: 'teamtakeover', name: 'Team Takeover',     icon: '🗺️', desc: 'Claim territories by answering',     buzzer: false, noDevices: true  },
  { type: 'codebreaker',  name: 'Code Breaker',      icon: '🔑', desc: 'Reveal letters to crack the phrase',  buzzer: false, noDevices: true  },
];

const EXAM_TYPES = [
  { value: 'general', label: '📘 General Review' },
  { value: 'midterm', label: '📝 Midterm Review' },
  { value: 'final', label: '🎓 Final Exam Review' },
];

export default function GameLaunchPage() {
  const { courses, fetchCourses } = useAdminContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [isPrefilled, setIsPrefilled] = useState(false);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [selectedExam, setSelectedExam] = useState('general');
  const [banks, setBanks] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [settings, setSettings] = useState<any>({ teams: false, teamCount: 2, soundEnabled: true, noJoin: false, virtualPlayers: [] });
  const [playerNames, setPlayerNames] = useState('');
  const [launched, setLaunched] = useState<any>(null);
  const [launching, setLaunching] = useState(false);
  const [jeopardyCompat, setJeopardyCompat] = useState<{
    categoryCount: number;
    perCategory: Record<string, number>;
    warnings: string[];
  } | null>(null);
  const [compatLoading, setCompatLoading] = useState(false);

  useEffect(() => { fetchCourses(); }, []);

  // Pre-fill from a previous session ("Run Again" flow).
  // Runs once courses are loaded so we can resolve the course object.
  useEffect(() => {
    const prefill = (location.state as any)?.prefill;
    if (!prefill || isPrefilled || courses.length === 0) return;

    const game = GAMES.find(g => g.type === prefill.gameType);
    if (game) setSelectedGame(game);

    if (prefill.courseId) {
      const course = courses.find((c: any) => c.id === prefill.courseId);
      if (course) setSelectedCourse(course);
    }

    if (prefill.bankId) {
      api.get(`/banks/${prefill.bankId}`)
        .then(r => setSelectedBank(r.data))
        .catch(() => {});
    }

    if (prefill.settings) {
      try {
        const parsed = typeof prefill.settings === 'string'
          ? JSON.parse(prefill.settings)
          : prefill.settings;
        setSettings(parsed);
        if (parsed.virtualPlayers?.length) {
          setPlayerNames((parsed.virtualPlayers as string[]).join('\n'));
        }
      } catch { /* ignore bad JSON */ }
    }

    setIsPrefilled(true);
    setStep(3);
  }, [courses, isPrefilled]);
  useEffect(() => {
    if (selectedCourse) {
      api.get(`/courses/${selectedCourse.id}/banks`).then(r => setBanks(r.data));
    }
  }, [selectedCourse]);

  const filteredBanks = banks.filter(b => b.exam_type === selectedExam);

  // Fetch Jeopardy compatibility info when a bank is selected for Jeopardy
  const fetchJeopardyCompat = useCallback(async (bankId: number) => {
    setCompatLoading(true);
    setJeopardyCompat(null);
    try {
      const r = await api.get(`/banks/${bankId}/questions`);
      const questions: Array<{ category?: string }> = r.data;
      const perCategory: Record<string, number> = {};
      for (const q of questions) {
        const cat = (q.category || 'General').trim();
        perCategory[cat] = (perCategory[cat] ?? 0) + 1;
      }
      const categoryCount = Object.keys(perCategory).length;
      const warnings: string[] = [];
      for (const [cat, count] of Object.entries(perCategory)) {
        if (count < 3) warnings.push(`"${cat}" has only ${count} question${count === 1 ? '' : 's'} (need ≥3 for a full column)`);
      }
      if (categoryCount < 5) warnings.push(`Only ${categoryCount} categor${categoryCount === 1 ? 'y' : 'ies'} found — Jeopardy works best with 5–6`);
      setJeopardyCompat({ categoryCount, perCategory, warnings });
    } catch {
      // silently ignore
    } finally {
      setCompatLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedGame?.type === 'jeopardy' && selectedBank?.id) {
      fetchJeopardyCompat(selectedBank.id);
    } else {
      setJeopardyCompat(null);
    }
  }, [selectedGame, selectedBank]);

  const launch = async () => {
    setLaunching(true);
    try {
      const r = await api.post('/games/create', {
        game_type: selectedGame.type,
        bank_id: selectedBank?.id,
        course_id: selectedCourse?.id,
        settings,
      });
      setLaunched(r.data);
      setStep(4);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.response?.data?.error || e?.message || 'Unknown error';
      alert(`Failed to create game session: ${detail}`);
    } finally {
      setLaunching(false);
    }
  };

  const enterGameView = () => {
    navigate(`/game/${selectedGame.type}`, { state: { pin: launched.pin, bankId: selectedBank?.id, settings } });
  };

  return (
    <div className="min-h-screen bg-black">
      <AdminNav />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-white mb-2">Launch a Game</h1>
        <p className="text-gray-400 mb-8">Step {step} of {step < 4 ? '3' : '3'}</p>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-10">
          {['Game Type', 'Course & Content', 'Settings', 'Launch!'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step > i ? 'bg-unoh-red text-white' : step === i + 1 ? 'bg-unoh-red text-white' : 'bg-gray-800 text-gray-500'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-sm hidden sm:block ${step === i + 1 ? 'text-white' : 'text-gray-500'}`}>{label}</span>
              {i < 3 && <div className="w-8 h-0.5 bg-gray-700" />}
            </div>
          ))}
        </div>

        {/* Step 1: Pick game type */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Choose a Game Type</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {GAMES.map(g => (
                <motion.button key={g.type} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { setSelectedGame(g); setStep(2); }}
                  className="bg-gray-900 border-2 border-gray-700 hover:border-unoh-red rounded-2xl p-5 text-left transition-colors group">
                  <div className="text-3xl mb-2">{g.icon}</div>
                  <div className="text-white font-bold group-hover:text-red-300 transition-colors">{g.name}</div>
                  <div className="text-gray-500 text-xs mt-1">{g.desc}</div>
                  {g.buzzer && <div className="mt-2 text-xs text-unoh-red font-medium">🔔 Buzzer</div>}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Course & Content */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-4xl">{selectedGame.icon}</span>
              <div>
                <h2 className="text-xl font-bold text-white">{selectedGame.name}</h2>
                <p className="text-gray-400 text-sm">{selectedGame.desc}</p>
              </div>
            </div>

            <div>
              <label className="block text-gray-300 font-medium mb-2">Select Course</label>
              <div className="grid grid-cols-2 gap-3">
                {courses.map((c: any) => (
                  <button key={c.id} onClick={() => { setSelectedCourse(c); setSelectedBank(null); }}
                    className={`p-4 rounded-xl border text-left transition-colors ${selectedCourse?.id === c.id ? 'border-unoh-red bg-unoh-red/10' : 'border-gray-700 bg-gray-900 hover:border-gray-500'}`}>
                    <div className="text-white font-medium">{c.name}</div>
                    <div className="text-gray-500 text-xs">{c.subject}</div>
                  </button>
                ))}
              </div>
            </div>

            {selectedCourse && (
              <>
                <div>
                  <label className="block text-gray-300 font-medium mb-2">Exam Type</label>
                  <div className="flex gap-3">
                    {EXAM_TYPES.map(t => (
                      <button key={t.value} onClick={() => { setSelectedExam(t.value); setSelectedBank(null); }}
                        className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${selectedExam === t.value ? 'border-unoh-red bg-unoh-red text-white' : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-white'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 font-medium mb-2">Question Bank</label>
                  {filteredBanks.length > 0 ? (
                    <div className="space-y-2">
                      {filteredBanks.map(b => (
                        <button key={b.id} onClick={() => setSelectedBank(b)}
                          className={`w-full p-4 rounded-xl border text-left transition-colors ${selectedBank?.id === b.id ? 'border-unoh-red bg-unoh-red/10' : 'border-gray-700 bg-gray-900 hover:border-gray-500'}`}>
                          <div className="text-white font-medium">{b.name}</div>
                          <div className="text-gray-500 text-xs">{b.question_count || 0} questions · {b.difficulty}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm py-4">No {selectedExam} banks for this course. <button className="text-unoh-red hover:underline" onClick={() => navigate('/admin/banks')}>Create one →</button></p>
                  )}

                  {/* Jeopardy compatibility card */}
                  {selectedGame?.type === 'jeopardy' && selectedBank && (
                    <div className="mt-4 rounded-xl border border-blue-700 bg-blue-950/60 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-blue-400 font-bold text-sm uppercase tracking-wide">Jeopardy Compatibility</span>
                        {compatLoading && <span className="text-gray-500 text-xs animate-pulse">Analyzing...</span>}
                      </div>
                      {jeopardyCompat && !compatLoading && (
                        <>
                          <div className="flex gap-6 mb-3 flex-wrap">
                            <div className="text-center">
                              <div className="text-2xl font-black text-white">{jeopardyCompat.categoryCount}</div>
                              <div className="text-gray-400 text-xs">Categories</div>
                            </div>
                            {Object.entries(jeopardyCompat.perCategory).slice(0, 6).map(([cat, count]) => (
                              <div key={cat} className="text-center">
                                <div className={`text-xl font-black ${count < 3 ? 'text-red-400' : count < 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                                  {count}
                                </div>
                                <div className="text-gray-500 text-xs max-w-20 truncate" title={cat}>{cat}</div>
                              </div>
                            ))}
                          </div>
                          {jeopardyCompat.warnings.length > 0 ? (
                            <div className="space-y-1">
                              {jeopardyCompat.warnings.map((w, i) => (
                                <div key={i} className="flex items-start gap-2 text-yellow-400 text-xs">
                                  <span className="shrink-0">⚠️</span><span>{w}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-green-400 text-xs">✓ Bank looks good for Jeopardy!</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(1)} className="btn-secondary px-6">← Back</button>
              <button onClick={() => setStep(3)} disabled={!selectedBank} className="btn-primary flex-1 disabled:opacity-40">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Settings */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h2 className="text-xl font-bold text-white">Game Settings</h2>
              {isPrefilled && (
                <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-unoh-red/20 border border-unoh-red/40 text-red-300">
                  ▶ Pre-filled from last session
                  <button onClick={() => { setIsPrefilled(false); setStep(1); }}
                    className="ml-1 text-red-400 hover:text-white" title="Start fresh">✕</button>
                </span>
              )}
            </div>
            {isPrefilled && selectedGame && (
              <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-xl px-5 py-3">
                <span className="text-2xl">{selectedGame.icon}</span>
                <div className="flex-1">
                  <div className="text-white font-bold">{selectedGame.name}</div>
                  <div className="text-gray-500 text-xs">
                    {selectedBank?.name ?? 'No bank selected'}{selectedCourse ? ` · ${selectedCourse.name}` : ''}
                  </div>
                </div>
                <button onClick={() => setStep(1)}
                  className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors">
                  Change
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-xl px-5 py-4">
                <div>
                  <div className="text-white font-medium">Teams Mode</div>
                  <div className="text-gray-500 text-sm">Split students into competing teams</div>
                </div>
                <button onClick={() => setSettings((s: any) => ({ ...s, teams: !s.teams }))}
                  className={`w-12 h-6 rounded-full transition-colors ${settings.teams ? 'bg-unoh-red' : 'bg-gray-700'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white mx-0.5 transition-transform ${settings.teams ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {settings.teams && (
                <div className="bg-gray-900 border border-gray-700 rounded-xl px-5 py-4">
                  <label className="block text-gray-300 text-sm mb-2">Number of Teams</label>
                  <input type="number" min={2} max={8} value={settings.teamCount}
                    onChange={e => setSettings((s: any) => ({ ...s, teamCount: Number(e.target.value) }))}
                    className="w-24 bg-black border border-gray-700 rounded-lg px-3 py-2 text-white text-center" />
                </div>
              )}

              <div className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-xl px-5 py-4">
                <div>
                  <div className="text-white font-medium">Sound Effects</div>
                  <div className="text-gray-500 text-sm">Play buzz, correct, wrong sounds</div>
                </div>
                <button onClick={() => setSettings((s: any) => ({ ...s, soundEnabled: !s.soundEnabled }))}
                  className={`w-12 h-6 rounded-full transition-colors ${settings.soundEnabled ? 'bg-unoh-red' : 'bg-gray-700'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white mx-0.5 transition-transform ${settings.soundEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {selectedGame?.noDevices ? (
                <div className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-xl px-5 py-4">
                  <div>
                    <div className="text-white font-medium">No Devices Required</div>
                    <div className="text-gray-500 text-sm">Pre-enter players/teams — host scores verbally from the game view</div>
                  </div>
                  <button onClick={() => setSettings((s: any) => ({ ...s, noJoin: !s.noJoin }))}
                    className={`w-12 h-6 rounded-full transition-colors ${settings.noJoin ? 'bg-unoh-red' : 'bg-gray-700'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white mx-0.5 transition-transform ${settings.noJoin ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 opacity-40 cursor-not-allowed">
                  <div>
                    <div className="text-gray-500 font-medium">No Devices Required</div>
                    <div className="text-gray-600 text-sm">Not available for {selectedGame?.name} — player input is required</div>
                  </div>
                  <div className="w-12 h-6 rounded-full bg-gray-800" />
                </div>
              )}

              {settings.noJoin && (
                <div className="bg-gray-900 border border-gray-700 rounded-xl px-5 py-4 space-y-2">
                  <label className="block text-gray-300 text-sm font-medium">Player / Team Names</label>
                  <p className="text-gray-500 text-xs">One name per line. These are added to the game automatically.</p>
                  <textarea
                    rows={5}
                    placeholder={'Team A\nTeam B\nTeam C\nAlice\nBob'}
                    value={playerNames}
                    onChange={e => {
                      setPlayerNames(e.target.value);
                      const names = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
                      setSettings((s: any) => ({ ...s, virtualPlayers: names }));
                    }}
                    className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono resize-none focus:outline-none focus:border-unoh-red"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(2)} className="btn-secondary px-6">← Back</button>
              <button onClick={launch} disabled={launching} className="btn-primary flex-1 text-xl py-4">
                {launching ? '⏳ Creating...' : '🚀 Launch Game!'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Launched */}
        {step === 4 && launched && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
            <div className="text-5xl">🎉</div>
            <h2 className="text-3xl font-bold text-white">Game Ready!</h2>
            <p className="text-gray-400">Students can now join using the PIN or QR code</p>

            <div className="flex justify-center">
              <QRCodeDisplay pin={launched.pin} joinUrl={launched.joinUrl} size={250} />
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={enterGameView}
              className="btn-primary text-2xl px-12 py-5 mx-auto inline-block">
              Enter Game View →
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
