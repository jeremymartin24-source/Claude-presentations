import { useState, useEffect } from 'react';
import socket from './socket.js';
import MarioPartyHost from './games/marioparty/MarioPartyHost.jsx';
import MarioPartyPlayer from './games/marioparty/MarioPartyPlayer.jsx';

// App manages which "screen" we're on based on URL params + socket join
export default function App() {
  const [screen, setScreen] = useState('home'); // home | host | player
  const [gameState, setGameState] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState(null);
  const [error, setError] = useState('');

  // ── Parse URL for deep-linking ───────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role');
    const code = params.get('code');
    if (role === 'host') handleCreateRoom();
    else if (role === 'player' && code) setRoomCode(code.toUpperCase());
  }, []);

  // ── Socket listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    socket.on('game:joined', ({ code, isHost: asHost, playerId: pid }) => {
      setRoomCode(code);
      setPlayerId(pid ?? socket.id);
      setScreen(asHost ? 'host' : 'player');
      setError('');
    });

    socket.on('game:state', (state) => {
      setGameState(state);
    });

    socket.on('game:error', ({ message }) => {
      setError(message);
    });

    return () => {
      socket.off('game:joined');
      socket.off('game:state');
      socket.off('game:error');
    };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleCreateRoom() {
    socket.emit('host:create');
  }

  function handleJoin(name, code) {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!code.trim()) { setError('Enter a room code'); return; }
    socket.emit('player:join', { name: name.trim(), code: code.trim().toUpperCase() });
  }

  // ── Render screens ────────────────────────────────────────────────────────
  if (screen === 'host') {
    return <MarioPartyHost gameState={gameState} roomCode={roomCode} />;
  }

  if (screen === 'player') {
    return <MarioPartyPlayer gameState={gameState} roomCode={roomCode} playerId={playerId} />;
  }

  return <HomeScreen onHost={handleCreateRoom} onJoin={handleJoin} error={error} initialCode={roomCode} />;
}

// ── Home screen component ──────────────────────────────────────────────────
function HomeScreen({ onHost, onJoin, error, initialCode }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode || '');

  return (
    <div className="home-screen">
      <div className="home-logo">🎲</div>

      <div className="home-title">
        <h1 className="title" style={{ color: '#E74C3C' }}>UNOH</h1>
        <p className="title" style={{ fontSize: '1.4rem', color: '#F1C40F' }}>Review Game Platform</p>
        <p className="subtitle" style={{ marginTop: '0.5rem' }}>Mario Party Edition 🎮</p>
      </div>

      <div className="home-cards">
        {/* Host card */}
        <div className="home-card" style={{ borderColor: '#E74C3C' }}>
          <h2 style={{ color: '#E74C3C' }}>📺 Host</h2>
          <p className="subtitle">Project on the big screen and run the game.</p>
          <button className="btn btn-red btn-lg" onClick={onHost}>
            Create Room
          </button>
        </div>

        {/* Player card */}
        <div className="home-card" style={{ borderColor: '#3498DB' }}>
          <h2 style={{ color: '#3498DB' }}>📱 Player</h2>
          <p className="subtitle">Join on your phone with a room code.</p>
          <input
            className="input"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
          />
          <input
            className="input"
            placeholder="Room code (e.g. ABCD)"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
            maxLength={4}
            style={{ textTransform: 'uppercase', letterSpacing: '0.3em', textAlign: 'center' }}
          />
          <button
            className="btn btn-blue btn-lg"
            onClick={() => onJoin(name, code)}
            disabled={!name || code.length < 4}
          >
            Join Game
          </button>
        </div>
      </div>

      {error && (
        <p style={{ color: '#E74C3C', fontWeight: 700, textAlign: 'center' }}>
          ⚠️ {error}
        </p>
      )}

      <p style={{ opacity: 0.3, fontSize: '0.75rem', textAlign: 'center' }}>
        UNOH Review Game Platform · Mario Party Mode
      </p>
    </div>
  );
}
