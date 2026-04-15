import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ITEMS } from '../../../../shared/items.js';
import socket from '../../../socket.js';

export default function ItemUsePanel({ gameState, playerId }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectingTarget, setSelectingTarget] = useState(false);

  const phase = gameState?.phase;
  const isMyTurn = gameState?.currentPlayerId === playerId;
  const myPlayer = gameState?.players?.find(p => p.id === playerId);
  const myItems = myPlayer?.items ?? [];
  const otherPlayers = (gameState?.players ?? []).filter(p => p.id !== playerId);

  if (!isMyTurn || (phase !== 'itemUse' && phase !== 'warpSelect')) return null;

  function useItem(itemId) {
    const item = ITEMS[itemId];
    if (!item) return;

    if (item.effect.type === 'steal' || item.effect.type === 'warp') {
      // Need target selection or special handling
      if (item.effect.type === 'steal') {
        setSelectedItem(itemId);
        setSelectingTarget(true);
      } else {
        // Warp — server handles destination selection via host
        socket.emit('player:useItem', { itemId });
      }
    } else {
      socket.emit('player:useItem', { itemId });
    }
  }

  function useOnTarget(targetId) {
    if (!selectedItem) return;
    socket.emit('player:useItem', { itemId: selectedItem, targetPlayerId: targetId });
    setSelectedItem(null);
    setSelectingTarget(false);
  }

  function skipItems() {
    socket.emit('player:skipItem');
  }

  if (myItems.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        opacity: 0.6,
      }}>
        <p style={{ fontSize: '0.85rem' }}>No items in inventory</p>
        <button className="btn btn-dark btn-sm" onClick={skipItems}>
          Roll the Dice →
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      <p style={{ fontSize: '0.8rem', opacity: 0.7, textAlign: 'center' }}>
        Use an item before rolling, or skip
      </p>

      {/* Item buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {myItems.map(itemId => {
          const item = ITEMS[itemId];
          if (!item) return null;

          return (
            <motion.button
              key={itemId}
              onClick={() => useItem(itemId)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'rgba(155,89,182,0.15)',
                border: '1px solid rgba(155,89,182,0.4)',
                borderRadius: '10px',
                padding: '0.6rem 0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.7rem',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#ECF0F1',
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>{item.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{item.name}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{item.description}</div>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#9B59B6', fontWeight: 700 }}>USE</span>
            </motion.button>
          );
        })}
      </div>

      {/* Target selection for steal */}
      <AnimatePresence>
        {selectingTarget && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: 'rgba(231,76,60,0.1)',
              border: '1px solid rgba(231,76,60,0.4)',
              borderRadius: '10px',
              padding: '0.7rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <p style={{ fontSize: '0.8rem', color: '#E74C3C', fontWeight: 700 }}>
              Select target to steal from:
            </p>
            {otherPlayers.map(p => (
              <button
                key={p.id}
                className="btn btn-red btn-sm"
                onClick={() => useOnTarget(p.id)}
              >
                🧤 {p.name} ({p.coins} coins)
              </button>
            ))}
            <button
              className="btn btn-dark btn-sm"
              onClick={() => { setSelectingTarget(false); setSelectedItem(null); }}
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip button */}
      <button className="btn btn-dark btn-sm" onClick={skipItems} style={{ alignSelf: 'center' }}>
        Skip → Roll
      </button>
    </div>
  );
}
