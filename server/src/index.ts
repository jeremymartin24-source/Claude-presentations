import 'dotenv/config';
import http from 'http';
import os from 'os';
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

// Routes
app.use('/api', apiRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'UNOH Review Games', professor: 'Professor Martin' });
});

// Error handler
app.use(errorHandler);

// Socket.io
registerSocketHandlers(io);

// Initialize DB then start server
initializeDatabase();

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log('\n🎓 UNOH Review Games Server');
  console.log('   by Professor Martin');
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`\n   Local:   http://localhost:${PORT}`);

  // Show LAN IP for students
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`   Network: http://${net.address}:${PORT}`);
        console.log(`\n   ✅ Students join at: http://${net.address}:3000/join`);
      }
    }
  }
  console.log(`\n   Admin panel: http://localhost:3000/admin\n`);
});

export { io };
