import 'dotenv/config';
import http from 'http';
import os from 'os';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { PORT, NODE_ENV } from './config/env';
import { initializeDatabase } from './config/database';
import apiRoutes from './routes/index';
import { registerSocketHandlers } from './socket/socketManager';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', apiRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'UNOH Review Games', professor: 'Professor Martin' });
});

// In production: serve the built React app from client/dist
if (NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  // SPA fallback — send index.html for any non-API route
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

// Socket.io
registerSocketHandlers(io);

// Initialize DB then start server
initializeDatabase();

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log('\n🎓 UNOH Review Games Server');
  console.log('   by Professor Martin — University of Northwestern Ohio');
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Port: ${PORT}`);

  if (NODE_ENV === 'production') {
    const publicUrl = process.env.PUBLIC_URL || `https://claude-presentations-production.up.railway.app`;
    console.log(`\n   ✅ Live at: ${publicUrl}`);
    console.log(`   ✅ Students join at: ${publicUrl}/join`);
    console.log(`   ✅ Admin panel: ${publicUrl}/admin\n`);
  } else {
    const nets = os.networkInterfaces();
    for (const iface of Object.values(nets)) {
      for (const net of iface || []) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`\n   ✅ Students join at: http://${net.address}:3000/join`);
        }
      }
    }
    console.log(`   Admin panel: http://localhost:3000/admin\n`);
  }
});

export { io };

