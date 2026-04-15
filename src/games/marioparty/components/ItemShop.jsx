import { motion, AnimatePresence } from 'framer-motion';
import { ITEMS } from '../../../../shared/items.js';
import socket from '../../../socket.js';

export default function ItemShop({ gameState, playerId, isHost }) {
  const shopItems = gameState?.shopItems ?? [];
  const myPlayer = gameState?.players.find(p => p.id === playerId);
  const myCoins = myPlayer?.coins ?? 0;
  const myItems = myPlayer?.items ?? [];
  const isCurrentPlayer = gameState?.currentPlayerId === playerId;
  const canBuy = isCurrentPlayer && !isHost;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(135deg, #1A1A2E 0%, #2C1654 100%)',
        border: '2px solid #9B59B6',
        borderRadius: '16px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: '500px',
        width: '100%',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ color: '#9B59B6', fontWeight: 900, textTransform: 'uppercase', fontSize: '1.1rem' }}>
          🛒 Item Shop
        </h3>
        {!isHost && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="badge badge-coin">🪙 {myCoins}</span>
            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Inventory: {myItems.length}/3</span>
          </div>
        )}
      </div>

      {/* Shop items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {shopItems.map(itemId => {
          const item = ITEMS[itemId];
          if (!item) return null;
          const affordable = myCoins >= item.price;
          const inventoryFull = myItems.length >= 3;
          const alreadyHave = myItems.includes(itemId);

          return (
            <motion.div
              key={itemId}
              whileHover={{ scale: 1.01 }}
              style={{
                background: 'rgba(155,89,182,0.1)',
                border: '1px solid rgba(155,89,182,0.3)',
                borderRadius: '10px',
                padding: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem',
              }}
            >
              <span style={{ fontSize: '1.8rem' }}>{item.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: '#D7BDE2' }}>{item.name}</div>
                <div style={{ fontSize: '0.78rem', opacity: 0.7, lineHeight: 1.4 }}>{item.description}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                <span className="badge badge-coin">🪙 {item.price}</span>
                {canBuy && (
                  <button
                    className={`btn btn-sm ${affordable && !inventoryFull ? 'btn-purple' : 'btn-dark'}`}
                    onClick={() => socket.emit('player:buyItem', { itemId })}
                    disabled={!affordable || inventoryFull}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {inventoryFull ? 'Full' : !affordable ? 'Broke' : 'Buy'}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Current player's inventory */}
      {!isHost && myItems.length > 0 && (
        <div>
          <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.4rem' }}>Your items:</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {myItems.map((itemId, i) => {
              const item = ITEMS[itemId];
              return item ? (
                <span key={i} style={{
                  background: 'rgba(155,89,182,0.2)',
                  border: '1px solid #9B59B6',
                  borderRadius: '8px',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.8rem',
                }}>
                  {item.emoji} {item.name}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* Close button */}
      {(canBuy || isHost) && (
        <button
          className="btn btn-dark"
          onClick={() => socket.emit('player:closeShop')}
          style={{ alignSelf: 'center' }}
        >
          {isHost ? 'Close Shop' : 'Done Shopping →'}
        </button>
      )}
    </motion.div>
  );
}
