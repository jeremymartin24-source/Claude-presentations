import { io } from 'socket.io-client';

// In dev, Vite proxies /socket.io → localhost:3001 via vite.config.js
// In production, same-origin server handles it
const socket = io({
  autoConnect: true,
  reconnectionAttempts: 5,
});

export default socket;
