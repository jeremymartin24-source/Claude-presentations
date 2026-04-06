import { Server, Socket } from 'socket.io';
import { getRoom } from '../gameRooms';

export function registerHotSeatHandlers(io: Server, socket: Socket) {
  socket.on('hotseat:select_student', ({ pin, studentName }: { pin: string; studentName: string }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id) return;
    room.phase = 'playing';
    io.to(pin).emit('hotseat:student_selected', { studentName });
  });

  socket.on('hotseat:submit_question', ({ pin, playerName, question }: { pin: string; playerName: string; question: string }) => {
    const room = getRoom(pin);
    if (!room) return;
    if (!(room.settings as any).questionQueue) (room.settings as any).questionQueue = [];
    const qItem = { id: Date.now(), askedBy: playerName, question };
    (room.settings as any).questionQueue.push(qItem);
    // Send updated queue to host only
    io.to(room.hostSocketId).emit('hotseat:queue_updated', { queue: (room.settings as any).questionQueue });
  });

  socket.on('hotseat:ask_question', ({ pin, questionId }: { pin: string; questionId: number }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id) return;
    const q = (room.settings as any).questionQueue?.find((item: any) => item.id === questionId);
    if (q) {
      room.settings.currentQuestion = q;
      io.to(pin).emit('hotseat:question_asked', { question: q.question, askedBy: q.askedBy });
    }
  });

  socket.on('hotseat:open_voting', ({ pin }: { pin: string }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id) return;
    room.settings.votes = { up: 0, down: 0 };
    io.to(pin).emit('hotseat:voting_open');
  });

  socket.on('hotseat:vote', ({ pin, vote }: { pin: string; vote: 'up' | 'down' }) => {
    const room = getRoom(pin);
    if (!room || !room.settings.votes) return;
    room.settings.votes[vote]++;
    io.to(room.hostSocketId).emit('hotseat:vote_update', { votes: room.settings.votes });
  });

  socket.on('hotseat:award_points', ({ pin, studentName, points }: { pin: string; studentName: string; points: number }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id) return;
    const player = room.players.get(studentName);
    if (player) {
      player.score += points;
      io.to(pin).emit('hotseat:points_awarded', { studentName, points, newScore: player.score });
    }
  });

  socket.on('hotseat:end', ({ pin }: { pin: string }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id) return;
    room.phase = 'ended';
    const scores = Array.from(room.players.values())
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score }));
    io.to(pin).emit('game_over', { finalScores: scores });
  });
}
