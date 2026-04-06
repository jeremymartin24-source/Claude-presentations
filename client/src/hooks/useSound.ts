import { useRef, useCallback, useState } from 'react'
import { Howl } from 'howler'

type SoundName = 'buzz' | 'correct' | 'wrong' | 'tick' | 'cheer' | 'music_loop' | 'countdown' | 'reveal' | 'elimination'

const SOUND_URLS: Record<SoundName, string> = {
  buzz: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAA' + btoa(
    // Short beep generated inline as base64 placeholder
    '\x00' // placeholder - in production use real audio files
  ),
  correct: '/sounds/correct.mp3',
  wrong: '/sounds/wrong.mp3',
  tick: '/sounds/tick.mp3',
  cheer: '/sounds/cheer.mp3',
  music_loop: '/sounds/music_loop.mp3',
  countdown: '/sounds/countdown.mp3',
  reveal: '/sounds/reveal.mp3',
  elimination: '/sounds/elimination.mp3',
}

export function useSound() {
  const sounds = useRef<Map<SoundName, Howl>>(new Map())
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolumeState] = useState(0.7)

  const getOrCreate = useCallback((name: SoundName): Howl => {
    if (!sounds.current.has(name)) {
      const howl = new Howl({
        src: [SOUND_URLS[name]],
        volume: volume,
        loop: name === 'music_loop',
        preload: false,
        onloaderror: () => {
          // Silently fail if sound file not found
        },
      })
      sounds.current.set(name, howl)
    }
    return sounds.current.get(name)!
  }, [volume])

  const play = useCallback((name: SoundName) => {
    if (isMuted) return
    try {
      const howl = getOrCreate(name)
      howl.play()
    } catch {
      // Ignore audio errors
    }
  }, [isMuted, getOrCreate])

  const stop = useCallback((name?: SoundName) => {
    if (name) {
      sounds.current.get(name)?.stop()
    } else {
      sounds.current.forEach(h => h.stop())
    }
  }, [])

  const setVolume = useCallback((v: number) => {
    setVolumeState(v)
    sounds.current.forEach(h => h.volume(v))
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev
      if (next) {
        sounds.current.forEach(h => h.mute(true))
      } else {
        sounds.current.forEach(h => h.mute(false))
      }
      return next
    })
  }, [])

  return { play, stop, setVolume, isMuted, toggleMute, volume }
}
