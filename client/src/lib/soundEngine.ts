// Sound engine using Howler.js
// Falls back gracefully if Howler is not available or sounds fail to load

let Howl: any = null;

// Lazy-load Howler
async function getHowl() {
  if (Howl) return Howl;
  try {
    const howler = await import('howler');
    Howl = howler.Howl;
  } catch {
    // Howler not available
  }
  return Howl;
}

type SoundName = 'buzz' | 'correct' | 'wrong' | 'tick' | 'cheer' | 'music';

const SOUND_URLS: Record<SoundName, string> = {
  buzz: '/sounds/buzz.mp3',
  correct: '/sounds/correct.mp3',
  wrong: '/sounds/wrong.mp3',
  tick: '/sounds/tick.mp3',
  cheer: '/sounds/cheer.mp3',
  music: '/sounds/music.mp3',
};

const sounds: Partial<Record<SoundName, any>> = {};
let muted = false;

export async function playSound(name: SoundName) {
  if (muted) return;
  const HowlClass = await getHowl();
  if (!HowlClass) return;

  if (!sounds[name]) {
    sounds[name] = new HowlClass({ src: [SOUND_URLS[name]], volume: 0.6, preload: true });
  }
  try {
    sounds[name]?.play();
  } catch { /* Ignore audio errors */ }
}

export function setMuted(val: boolean) { muted = val; }
export function isMuted() { return muted; }
export function toggleMute() { muted = !muted; return muted; }
