import { Server, Socket } from 'socket.io';
import { getRoom } from '../gameRooms';
import { shuffle } from '../../utils/shuffle';

export function registerCodeBreakerHandlers(io: Server, socket: Socket) {
  socket.on('codebreaker:start', ({ pin, phrase }: { pin: string; phrase: string }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const upperPhrase = phrase.toUpperCase();
    room.codePhrase = upperPhrase;
    room.revealedLetters = upperPhrase.split('').map(c => c === ' ' || c === '/' ? true : false);
    room.phase = 'playing';
    room.currentQuestion = 0;
    room.settings.shuffledQuestions = shuffle(room.questions);

    const masked = room.revealedLetters.map((revealed, i) =>
      upperPhrase[i] === ' ' ? ' ' : (revealed ? upperPhrase[i] : '_')
    );
    io.to(pin).emit('codebreaker:started', {
      masked,
      totalQuestions: room.questions.length,
      phraseLength: upperPhrase.replace(/ /g, '').length,
    });
    showNextQuestion(io, pin, room);
  });

  socket.on('codebreaker:answer', ({ pin, playerName, answer }: { pin: string; playerName: string; answer: string }) => {
    const room = getRoom(pin);
    if (!room || room.phase !== 'question') return;

    const question = room.settings.currentQ as any;
    if (!question) return;

    const correct = answer.toLowerCase().trim() === question.answer.toLowerCase().trim();
    const player = room.players.get(playerName);

    if (correct && player) {
      player.score += question.points || 100;
      // Reveal a random hidden letter
      if (room.revealedLetters && room.codePhrase) {
        const hiddenIndices = room.revealedLetters
          .map((r, i) => (!r ? i : -1))
          .filter(i => i >= 0);
        if (hiddenIndices.length > 0) {
          const idx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
          room.revealedLetters[idx] = true;
          io.to(pin).emit('codebreaker:letter_revealed', {
            index: idx,
            letter: room.codePhrase[idx],
            masked: room.revealedLetters.map((rev, i) =>
              room.codePhrase![i] === ' ' ? ' ' : (rev ? room.codePhrase![i] : '_')
            ),
            revealedBy: playerName,
          });
        }
      }
      io.to(pin).emit('answer_result', { correct: true, pointsEarned: question.points || 100, playerName });
    } else {
      io.to(pin).emit('answer_result', { correct: false, pointsEarned: 0, playerName });
    }

    setTimeout(() => {
      room.currentQuestion++;
      if (room.currentQuestion < room.questions.length) {
        showNextQuestion(io, pin, room);
      } else {
        endGame(io, pin, room);
      }
    }, 2000);
  });

  socket.on('codebreaker:guess_phrase', ({ pin, teamName, guess }: { pin: string; teamName: string; guess: string }) => {
    const room = getRoom(pin);
    if (!room || !room.codePhrase) return;

    const correct = guess.toUpperCase().trim() === room.codePhrase.trim();
    if (correct) {
      // Reveal all letters
      room.revealedLetters = room.codePhrase.split('').map(() => true);
      io.to(pin).emit('codebreaker:phrase_solved', {
        phrase: room.codePhrase,
        solvedBy: teamName,
      });
      // Bonus points to all team members
      room.players.forEach(p => {
        if (p.team === teamName || !teamName) p.score += 500;
      });
      endGame(io, pin, room);
    } else {
      // Penalty
      const player = room.players.get(teamName);
      if (player) player.score = Math.max(0, player.score - 100);
      socket.emit('codebreaker:wrong_guess', { penalty: 100 });
    }
  });

  socket.on('codebreaker:next', ({ pin }: { pin: string }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id) return;
    room.currentQuestion++;
    if (room.currentQuestion < room.questions.length) {
      showNextQuestion(io, pin, room);
    } else {
      endGame(io, pin, room);
    }
  });

  // No-devices mode: host marks a player as having answered correctly
  // Reveals a letter without advancing to the next question
  socket.on('codebreaker:host_correct', ({ pin, playerName }: { pin: string; playerName: string }) => {
    const room = getRoom(pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (!room.codePhrase || !room.revealedLetters) return;

    const question = room.settings.currentQ as any;
    if (!question) return;

    const player = Array.from(room.players.values()).find(p => p.name === playerName);
    if (player) {
      player.score += question.points || 100;
    }

    // Reveal a random hidden letter
    const hiddenIndices = room.revealedLetters
      .map((r, i) => (!r ? i : -1))
      .filter(i => i >= 0);

    if (hiddenIndices.length > 0) {
      const idx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
      room.revealedLetters[idx] = true;
      io.to(pin).emit('codebreaker:letter_revealed', {
        index: idx,
        letter: room.codePhrase[idx],
        masked: room.revealedLetters.map((rev, i) =>
          room.codePhrase![i] === ' ' ? ' ' : (rev ? room.codePhrase![i] : '_')
        ),
        revealedBy: playerName,
        score: player?.score ?? 0,
      });
    }

    // Update scores for all clients
    const scores = Array.from(room.players.values())
      .sort((a: any, b: any) => b.score - a.score)
      .map((p: any) => ({ name: p.name, score: p.score }));
    io.to(pin).emit('scores_update', { scores });
  });
}

function showNextQuestion(io: Server, pin: string, room: any) {
  const q = room.settings.shuffledQuestions?.[room.currentQuestion] || room.questions[room.currentQuestion];
  if (!q) return;
  room.settings.currentQ = q;
  room.phase = 'question';
  io.to(pin).emit('question_reveal', {
    question: q.question,
    options: q.options,
    timeLimit: q.time_limit || 30,
    questionNumber: room.currentQuestion + 1,
    totalQuestions: room.questions.length,
  });
}

function endGame(io: Server, pin: string, room: any) {
  room.phase = 'ended';
  const scores = Array.from(room.players.values())
    .sort((a: any, b: any) => b.score - a.score)
    .map((p: any, i: number) => ({ rank: i + 1, name: p.name, team: p.team, score: p.score }));
  io.to(pin).emit('game_over', { finalScores: scores });
}
