import { motion } from 'framer-motion';
import socket from '../../../socket.js';

export default function EventCard({ event, isHost }) {
  if (!event) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, rotate: -3 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', damping: 14 }}
      style={{
        background: `linear-gradient(135deg, ${event.color}33 0%, #1A1A2E 100%)`,
        border: `3px solid ${event.color}`,
        borderRadius: '20px',
        padding: '2rem',
        maxWidth: '420px',
        width: '100%',
        margin: '0 auto',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        boxShadow: `0 0 40px ${event.color}40`,
      }}
    >
      <div style={{ fontSize: '3rem' }}>🎴</div>
      <h2 style={{
        color: event.color,
        fontWeight: 900,
        fontSize: '1.4rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {event.name}
      </h2>
      <p style={{ fontSize: '1rem', lineHeight: 1.6, opacity: 0.85 }}>
        {event.description}
      </p>

      {isHost && (
        <button
          className="btn btn-dark"
          onClick={() => socket.emit('host:closeEvent')}
          style={{ marginTop: '0.5rem' }}
        >
          Continue →
        </button>
      )}
    </motion.div>
  );
}
