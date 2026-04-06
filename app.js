// ============================================================
//  NETWORK GAUNTLET — App Logic
//  University of Northwestern Ohio — IT260 Review Game
// ============================================================
//
//  HOW THIS FILE IS ORGANIZED:
//    1. State        — the single source of truth for all game data
//    2. Round config — maps round keys to question arrays & display names
//    3. Game flow    — start, reset, screen transitions
//    4. Question     — load, render, reveal
//    5. Scoring      — adjust scores, update all score displays
//    6. Timer        — start/pause/reset timer
//    7. UI helpers   — showScreen, updateAllScoreDisplays
//
// ============================================================

// ── 1. STATE ─────────────────────────────────────────────────
const state = {
  // Team names (editable on the home screen)
  teams:  ['Team Alpha', 'Team Bravo'],
  scores: [0, 0],

  // Current round & question
  currentRoundKey:      null,   // e.g. 'portBlitz'
  currentQuestionIndex: 0,
  answerRevealed:       false,

  // Timer state
  timerDefault:  30,   // seconds — editable via the timer input on question screen
  timerValue:    30,   // current countdown value
  timerRunning:  false,
  timerInterval: null,
  timerVisible:  false,
};


// ── 2. ROUND CONFIG ──────────────────────────────────────────
//  If you add a new round, add an entry here and a corresponding
//  question array in questions.js.

const ROUNDS = {
  portBlitz: {
    name:        'Port Blitz',
    type:        'reveal',      // 'reveal' | 'choice' | 'tf'
    questions:   () => portBlitzQuestions,
  },
  conceptSniper: {
    name:        'Concept Sniper',
    type:        'mixed',       // may have choices or be reveal-only per question
    questions:   () => conceptSniperQuestions,
  },
  scenarioStrike: {
    name:        'Scenario Strike',
    type:        'choice',
    questions:   () => scenarioStrikeQuestions,
  },
  trapOrTruth: {
    name:        'Trap or Truth',
    type:        'tf',
    questions:   () => trapOrTruthQuestions,
  },
  finalBoss: {
    name:        'Final Boss',
    type:        'choice',
    questions:   () => finalBossQuestions,
  },
};


// ── 3. GAME FLOW ─────────────────────────────────────────────

/** Called from the home screen Start button. Reads team names from inputs. */
function startGame() {
  const t1 = document.getElementById('team1-input').value.trim() || 'Team Alpha';
  const t2 = document.getElementById('team2-input').value.trim() || 'Team Bravo';
  state.teams[0] = t1;
  state.teams[1] = t2;

  updateAllScoreDisplays();
  showScreen('screen-menu');
}

/** Start a round: set the round key, reset to question 0, show question screen. */
function startRound(roundKey) {
  if (!ROUNDS[roundKey]) {
    console.error('Unknown round key:', roundKey);
    return;
  }
  state.currentRoundKey      = roundKey;
  state.currentQuestionIndex = 0;
  state.answerRevealed       = false;

  // Stop any running timer and reset it
  timerStop();
  state.timerValue = state.timerDefault;

  loadQuestion();
  showScreen('screen-question');
}

/** Hard reset: zero scores, clear round state, go to home screen. */
function resetGame() {
  if (!confirm('Reset the game? This will clear all scores and return to the home screen.')) return;

  state.scores  = [0, 0];
  state.teams   = ['Team Alpha', 'Team Bravo'];
  state.currentRoundKey      = null;
  state.currentQuestionIndex = 0;
  state.answerRevealed       = false;

  timerStop();
  state.timerValue   = state.timerDefault;
  state.timerVisible = false;

  // Reset home-screen inputs to defaults
  document.getElementById('team1-input').value = 'Team Alpha';
  document.getElementById('team2-input').value = 'Team Bravo';

  updateAllScoreDisplays();
  showScreen('screen-home');
}

/** Navigate back to the round menu from the question screen. */
function goBack() {
  timerStop();
  showScreen('screen-menu');
}


// ── 4. QUESTION RENDERING ───────────────────────────────────

/** Loads and renders the current question based on state. */
function loadQuestion() {
  const round     = ROUNDS[state.currentRoundKey];
  const questions = round.questions();
  const q         = questions[state.currentQuestionIndex];
  const total     = questions.length;
  const idx       = state.currentQuestionIndex;

  // Reset reveal state
  state.answerRevealed = false;
  hideAnswerBox();

  // -- Header label and counter --
  document.getElementById('q-header-round').textContent = round.name;
  document.getElementById('q-round-label').textContent  = round.name;
  document.getElementById('q-counter').textContent      = `Question ${idx + 1} of ${total}`;
  document.getElementById('q-points-label').textContent =
    q.points === 1 ? '1 POINT' : `${q.points} POINTS`;

  // -- Question prompt --
  document.getElementById('q-prompt').textContent = q.prompt;

  // -- Determine display mode --
  //    - trapOrTruth round → always show TF buttons (even if choices are TRUE/FALSE)
  //    - question has choices array → show choice buttons
  //    - no choices → show reveal button

  const roundType   = round.type;
  const hasChoices  = q.choices && q.choices.length > 0;
  const isTF        = roundType === 'tf';

  hideAll(['choices-area', 'tf-area', 'reveal-area']);

  if (isTF) {
    renderTFButtons(q);
  } else if (hasChoices) {
    renderChoices(q);
  } else {
    // Reveal-only (Port Blitz, or Concept Sniper without choices)
    document.getElementById('reveal-area').style.display = 'block';
  }

  // -- Update score panel --
  updateScoringPanel(q);

  // -- Prev/Next buttons --
  document.getElementById('btn-prev').disabled = (idx === 0);
  document.getElementById('btn-next').textContent =
    (idx === total - 1) ? 'Finish &#9654;' : 'Next &#9654;';
  document.getElementById('btn-next').innerHTML =
    (idx === total - 1) ? 'Finish &#9654;' : 'Next &#9654;';

  // -- Reset timer --
  timerStop();
  state.timerValue = state.timerDefault;
  updateTimerDisplay();
}

/** Render multiple-choice buttons into the choices-area div. */
function renderChoices(q) {
  const area = document.getElementById('choices-area');
  area.innerHTML = '';
  area.style.display = 'grid';

  q.choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className   = 'choice-btn';
    btn.textContent = choice;
    btn.onclick     = () => selectChoice(btn, choice, q);
    area.appendChild(btn);
  });
}

/** Handle a multiple-choice selection. */
function selectChoice(btn, choice, q) {
  if (state.answerRevealed) return;

  revealAnswer();   // reveal regardless of correctness (instructor-led)

  // Visually mark correct / wrong
  const allBtns = document.querySelectorAll('.choice-btn');
  allBtns.forEach(b => {
    b.disabled = true;
    if (b.textContent === q.answer) {
      b.classList.add('correct');
    } else if (b === btn && b.textContent !== q.answer) {
      b.classList.add('wrong');
    }
  });
}

/** Render True/False buttons for Trap or Truth round. */
function renderTFButtons(q) {
  const area = document.getElementById('tf-area');
  area.style.display = 'flex';

  const trueBtn  = document.getElementById('tf-true');
  const falseBtn = document.getElementById('tf-false');

  // Reset state
  trueBtn.className  = 'tf-btn';
  falseBtn.className = 'tf-btn';
  trueBtn.disabled   = false;
  falseBtn.disabled  = false;
}

/** Handle a True/False selection. */
function selectTF(selection) {
  if (state.answerRevealed) return;

  const q        = getCurrentQuestion();
  const isRight  = selection === q.answer.toUpperCase();
  const trueBtn  = document.getElementById('tf-true');
  const falseBtn = document.getElementById('tf-false');

  revealAnswer();

  trueBtn.disabled  = true;
  falseBtn.disabled = true;

  if (q.answer.toUpperCase() === 'TRUE') {
    trueBtn.classList.add('correct');
    if (selection === 'FALSE') falseBtn.classList.add('wrong');
  } else {
    falseBtn.classList.add('correct');
    if (selection === 'TRUE') trueBtn.classList.add('wrong');
  }
}

/** Reveal the answer box. Called by Reveal button, choice selection, or TF selection. */
function revealAnswer() {
  if (state.answerRevealed) return;
  state.answerRevealed = true;

  const q = getCurrentQuestion();

  document.getElementById('answer-box-text').textContent        = q.answer;
  document.getElementById('answer-box-explanation').textContent = q.explanation || '';
  document.getElementById('answer-box').classList.add('visible');

  // Also show reveal-only button area answer if applicable
  // (The reveal button is replaced by the visible answer box — no extra action needed)

  timerStop();
}

function hideAnswerBox() {
  document.getElementById('answer-box').classList.remove('visible');
  document.getElementById('answer-box-text').textContent        = '';
  document.getElementById('answer-box-explanation').textContent = '';
}

/** Advance to the next question (or go to final scores if last question). */
function nextQuestion() {
  const questions = ROUNDS[state.currentRoundKey].questions();
  if (state.currentQuestionIndex < questions.length - 1) {
    state.currentQuestionIndex++;
    loadQuestion();
  } else {
    // End of round — go to winner/score screen
    showWinnerScreen();
  }
}

/** Go back to the previous question. */
function prevQuestion() {
  if (state.currentQuestionIndex > 0) {
    state.currentQuestionIndex--;
    loadQuestion();
  }
}

/** Get the currently active question object. */
function getCurrentQuestion() {
  return ROUNDS[state.currentRoundKey].questions()[state.currentQuestionIndex];
}

/** Hide multiple DOM elements by id (sets display:none). */
function hideAll(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}


// ── 5. SCORING ───────────────────────────────────────────────

/**
 * Adjust a team's score by `delta` points.
 * @param {number} teamIndex  0 or 1
 * @param {number} delta      positive or negative integer
 */
function adjustScore(teamIndex, delta) {
  state.scores[teamIndex] = Math.max(0, state.scores[teamIndex] + delta);
  updateAllScoreDisplays();
}

/**
 * Award the current question's point value to a team.
 * Called from the quick-add buttons in the scoring panel.
 */
function awardPoints(teamIndex) {
  const q = getCurrentQuestion();
  adjustScore(teamIndex, q.points);
}

/** Rebuild the scoring panel quick-add buttons to show current question's point value. */
function updateScoringPanel(q) {
  [0, 1].forEach(i => {
    document.getElementById(`score-name-${i}`).textContent = state.teams[i];
    document.getElementById(`score-val-${i}`).textContent  = state.scores[i];

    const quickArea = document.getElementById(`quick-btns-${i}`);
    quickArea.innerHTML = '';

    // Button to award this question's exact point value
    const awardBtn = document.createElement('button');
    awardBtn.className   = 'btn-quick';
    awardBtn.textContent = `+${q.points} pts (this Q)`;
    awardBtn.onclick     = () => awardPoints(i);
    quickArea.appendChild(awardBtn);

    // Extra quick-adjust buttons
    [2, 5].forEach(val => {
      const b = document.createElement('button');
      b.className   = 'btn-quick';
      b.textContent = `+${val}`;
      b.onclick     = () => adjustScore(i, val);
      quickArea.appendChild(b);
    });
  });
}

/** Update every score display element across all screens. */
function updateAllScoreDisplays() {
  const ids = [
    ['menu-team1-name', 'menu-team1-score', 'menu-team2-name', 'menu-team2-score'],
    ['q-team1-name',    'q-team1-score',    'q-team2-name',    'q-team2-score'],
    ['score-name-0',    'score-val-0',      'score-name-1',    'score-val-1'],
    ['final-name-0',    'final-score-0',    'final-name-1',    'final-score-1'],
  ];

  // Simple flat update — team names and scores
  const setIfExists = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setIfExists('menu-team1-name', state.teams[0]);
  setIfExists('menu-team2-name', state.teams[1]);
  setIfExists('menu-team1-score', state.scores[0]);
  setIfExists('menu-team2-score', state.scores[1]);

  setIfExists('q-team1-name', state.teams[0]);
  setIfExists('q-team2-name', state.teams[1]);
  setIfExists('q-team1-score', state.scores[0]);
  setIfExists('q-team2-score', state.scores[1]);

  setIfExists('score-name-0', state.teams[0]);
  setIfExists('score-name-1', state.teams[1]);
  setIfExists('score-val-0', state.scores[0]);
  setIfExists('score-val-1', state.scores[1]);

  setIfExists('final-name-0', state.teams[0]);
  setIfExists('final-name-1', state.teams[1]);
  setIfExists('final-score-0', state.scores[0]);
  setIfExists('final-score-1', state.scores[1]);
}


// ── 6. TIMER ─────────────────────────────────────────────────

/** Toggle start/pause the countdown timer. */
function timerStartPause() {
  if (state.timerRunning) {
    timerStop();
  } else {
    timerStart();
  }
}

function timerStart() {
  if (state.timerValue <= 0) state.timerValue = state.timerDefault;
  state.timerRunning = true;
  document.getElementById('timer-start-btn').textContent = '⏸ Pause';

  state.timerInterval = setInterval(() => {
    if (state.timerValue > 0) {
      state.timerValue--;
      updateTimerDisplay();
    } else {
      timerStop();
      // Flash the display red when time is up
      const disp = document.getElementById('timer-display');
      disp.classList.add('danger');
    }
  }, 1000);
}

function timerStop() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.timerRunning  = false;
  const btn = document.getElementById('timer-start-btn');
  if (btn) btn.textContent = '▶ Start';
}

/** Reset timer to the default duration. */
function timerReset() {
  timerStop();
  state.timerValue = state.timerDefault;
  updateTimerDisplay();
}

/**
 * Update the default timer duration from the input field.
 * @param {string|number} seconds
 */
function timerSetDefault(seconds) {
  const val = parseInt(seconds, 10);
  if (!isNaN(val) && val >= 5) {
    state.timerDefault = val;
    if (!state.timerRunning) {
      state.timerValue = val;
      updateTimerDisplay();
    }
  }
}

/** Refresh the timer display element with color coding. */
function updateTimerDisplay() {
  const disp = document.getElementById('timer-display');
  if (!disp) return;

  const secs = state.timerValue;
  const mm   = Math.floor(secs / 60);
  const ss   = String(secs % 60).padStart(2, '0');
  disp.textContent = `${mm}:${ss}`;

  // Color-code based on remaining time
  disp.classList.remove('warning', 'danger');
  const pct = secs / state.timerDefault;
  if (pct <= 0.2)      disp.classList.add('danger');
  else if (pct <= 0.4) disp.classList.add('warning');
}

/** Show or hide the timer panel. */
function toggleTimer() {
  state.timerVisible = !state.timerVisible;
  const section = document.getElementById('timer-section');
  const btn     = document.getElementById('btn-timer-toggle');

  if (state.timerVisible) {
    section.classList.remove('hidden');
    btn.textContent = '⏱ Hide Timer';
  } else {
    section.classList.add('hidden');
    btn.textContent = '⏱ Timer';
    timerStop();
  }
}


// ── 7. SCREEN SYSTEM ─────────────────────────────────────────

/**
 * Switch the visible screen.
 * @param {string} screenId  e.g. 'screen-home', 'screen-menu', etc.
 */
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

/** Build and show the winner/final scores screen. */
function showWinnerScreen() {
  updateAllScoreDisplays();

  const [s0, s1] = state.scores;
  const [t0, t1] = state.teams;

  const trophyEl   = document.getElementById('winner-trophy');
  const subtitleEl = document.getElementById('winner-subtitle');
  const nameEl     = document.getElementById('winner-team-name');
  const scoreEl    = document.getElementById('winner-score-line');
  const card0      = document.getElementById('final-card-0');
  const card1      = document.getElementById('final-card-1');

  // Remove previous winner highlight
  card0.classList.remove('winner-highlight');
  card1.classList.remove('winner-highlight');
  nameEl.classList.remove('tie');

  if (s0 > s1) {
    trophyEl.textContent  = '🏆';
    subtitleEl.textContent = 'Winner';
    nameEl.textContent     = t0;
    scoreEl.textContent    = `Final Score: ${s0} pts`;
    card0.classList.add('winner-highlight');
  } else if (s1 > s0) {
    trophyEl.textContent  = '🏆';
    subtitleEl.textContent = 'Winner';
    nameEl.textContent     = t1;
    scoreEl.textContent    = `Final Score: ${s1} pts`;
    card1.classList.add('winner-highlight');
  } else {
    trophyEl.textContent  = '🤝';
    subtitleEl.textContent = "It's a Tie!";
    nameEl.textContent     = `${t0} & ${t1}`;
    nameEl.classList.add('tie');
    scoreEl.textContent    = `Score: ${s0} pts each`;
  }

  showScreen('screen-winner');
}


// ── INIT ─────────────────────────────────────────────────────
//  Nothing to do on load — state is already initialized above.
//  The home screen is shown by default in the HTML (class="screen active").
