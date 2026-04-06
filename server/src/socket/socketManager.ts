import { Server, Socket } from 'socket.io';
import { db } from '../config/database';
import { resolvePin, removePin } from '../services/pinService';
import {
  createRoom, getRoom, addPlayer, deleteRoom,
  getRoomByHostSocket, getRoomByPlayerSocket,
} from './gameRooms';
import { registerJeopardyHandlers } from './handlers/jeopardyHandler';
import { registerKahootHandlers } from './handlers/kahootHandler';
import { registerSpeedroundHandlers as registerSpeedRoundHandlers } from './handlers/speedroundHandler';
import { registerBattleRoyaleHandlers } from './handlers/battleroyaleHandler';
import { registerMillionaireHandlers } from './handlers/millionaireHandler';
import { registerWagerHandlers } from './handlers/wagerHandler';
import { registerBingoHandlers } from './handlers/bingoHandler';
import { registerRankedHandlers } from './handlers/rankedHandler';
import { registerTeamTakeoverHandlers } from './handlers/teamtakeoverHandler';
import { registerEscapeRoomHandlers } from './handlers/escaperoomHandler';
import { registerHotSeatHandlers } from './handlers/hotseatHandler';
import { registerCodeBreakerHandlers } from './handlers/codebreakerHandler';

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {

    // HOST: create a room for a game
    socket.on('host_game', ({ pin, gameType, bankId, settings }) => {
      const pinData = resolvePin(pin);
      if (!pinData) {
        socket.emit('error', { message: 'Invalid PIN' });
        return;
      }

      let questions: any[] = [];
      if (bankId) {
        const rows = db.prepare('SELECT * FROM questions WHERE bank_id = ?').all(bankId) as any[];
        questions = rows.map(q => ({ ...q, options: q.options ? JSON.parse(q.options) : null }));
      }

      const room = createRoom(pin, gameType, socket.id, questions, settings || {});
      socket.join(pin);
      socket.emit('room_created', { pin, playerCount: 0, questions: questions.length });
    });

    // PLAYER: join a game by PIN
    socket.on('join_game', ({ pin, playerName, team }: { pin: string; playerName: string; team?: string }) => {
      const room = getRoom(pin);
      if (!room) {
        socket.emit('join_error', { message: 'Game not found. Check your PIN.' });
        return;
      }
      if (room.phase !== 'lobby') {
        socket.emit('join_error', { message: 'Game already in progress.' });
        return;
      }

      addPlayer(pin, {
        socketId: socket.id,
        name: playerName,
        team: team || undefined,
        score: 0,
        streak: 0,
        alive: true,
      });
      socket.join(pin);

      const players = Array.from(room.players.values());
      io.to(pin).emit('player_joined', {
        playerName,
        totalPlayers: players.length,
        players: players.map(p => ({ name: p.name, team: p.team })),
      });
      socket.emit('join_success', { pin, gameType: room.gameType, playerName });
    });

    // DISCONNECT
    socket.on('disconnect', () => {
      // Check if host disconnected
      const hostRoom = getRoomByHostSocket(socket.id);
      if (hostRoom) {
        io.to(hostRoom.pin).emit('host_disconnected', { message: 'Professor disconnected.' });
        deleteRoom(hostRoom.pin);
        removePin(hostRoom.pin);
        return;
      }

      // Check if player disconnected
      const playerRoom = getRoomByPlayerSocket(socket.id);
      if (playerRoom) {
        const player = Array.from(playerRoom.players.values()).find(p => p.socketId === socket.id);
        if (player) {
          playerRoom.players.delete(player.name);
          io.to(playerRoom.pin).emit('player_left', {
            playerName: player.name,
            totalPlayers: playerRoom.players.size,
          });
        }
      }
    });

    // Register all game handlers
    registerJeopardyHandlers(io, socket);
    registerKahootHandlers(io, socket);
    registerSpeedRoundHandlers(io, socket);
    registerBattleRoyaleHandlers(io, socket);
    registerMillionaireHandlers(io, socket);
    registerWagerHandlers(io, socket);
    registerBingoHandlers(io, socket);
    registerRankedHandlers(io, socket);
    registerTeamTakeoverHandlers(io, socket);
    registerEscapeRoomHandlers(io, socket);
    registerHotSeatHandlers(io, socket);
    registerCodeBreakerHandlers(io, socket);
  });
}
