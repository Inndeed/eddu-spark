import { useCallback, useEffect, useRef, useState } from 'react'

const AUDIO_PREF_KEY = 'eddu.quiz.audio-muted'
const BACKGROUND_FADE_MS = 320
const LOBBY_CROSSFADE_MS = 1_200
const LOBBY_AUDIBLE_END_SEC = 31.9
const LOBBY_LOOP_START_SEC = 0
const LOOP_MONITOR_MS = 50

export const QUIZ_AUDIO_ASSETS = {
  lobbyLoop: '/audio/lobby-loop.mp3',
  questionLoop: '/audio/question-loop.mp3',
  gameStart: '/audio/game-start.mp3',
  countdownUrgent: '/audio/countdown-urgent.mp3',
  timeUp: '/audio/time-up.mp3',
  awardThird: '/audio/award-third.mp3',
  awardSecond: '/audio/award-second.mp3',
  awardChampion: '/audio/award-champion.mp3',
} as const

export type QuizBackgroundTrack = 'lobbyLoop' | 'questionLoop'
export type QuizAudioCue = Exclude<keyof typeof QUIZ_AUDIO_ASSETS, QuizBackgroundTrack>

const BACKGROUND_TRACKS = new Set<QuizBackgroundTrack>(['lobbyLoop', 'questionLoop'])
const BACKGROUND_VOLUME: Record<QuizBackgroundTrack, number> = {
  lobbyLoop: 0.28,
  questionLoop: 0.2,
}

const CUE_VOLUME: Record<QuizAudioCue, number> = {
  gameStart: 0.68,
  countdownUrgent: 0.58,
  timeUp: 0.64,
  awardThird: 0.62,
  awardSecond: 0.64,
  awardChampion: 0.72,
}

interface BackgroundDeck {
  activeIndex: number
  audios: [HTMLAudioElement, HTMLAudioElement?]
  crossfading: boolean
  fadeFrame: number | null
  monitorId: number | null
  track: QuizBackgroundTrack
}

let backgroundDeck: BackgroundDeck | null = null

const getDeckAudio = (deck: BackgroundDeck, index: number) =>
  deck.audios[index] ?? deck.audios[0]

export const getAudioMutedPreference = () => {
  const raw = localStorage.getItem(AUDIO_PREF_KEY)
  return raw === '1'
}

const cancelDeckTimers = (deck: BackgroundDeck) => {
  if (deck.monitorId !== null) {
    window.clearInterval(deck.monitorId)
    deck.monitorId = null
  }
  if (deck.fadeFrame !== null) {
    window.cancelAnimationFrame(deck.fadeFrame)
    deck.fadeFrame = null
  }
  deck.crossfading = false
}

const disposeDeck = (deck: BackgroundDeck, fade = true) => {
  cancelDeckTimers(deck)
  const audios = deck.audios.filter((audio): audio is HTMLAudioElement => Boolean(audio))

  if (!fade) {
    audios.forEach((audio) => {
      audio.pause()
      audio.currentTime = 0
    })
    return
  }

  const initialVolumes = audios.map((audio) => audio.volume)
  const startedAt = performance.now()
  const fadeOut = (now: number) => {
    const progress = Math.max(0, Math.min(1, (now - startedAt) / BACKGROUND_FADE_MS))
    audios.forEach((audio, index) => {
      audio.volume = initialVolumes[index] * (1 - progress)
    })

    if (progress < 1) {
      window.requestAnimationFrame(fadeOut)
      return
    }

    audios.forEach((audio) => {
      audio.pause()
      audio.currentTime = 0
    })
  }
  window.requestAnimationFrame(fadeOut)
}

const pauseBackgroundDeck = () => {
  if (!backgroundDeck) {
    return
  }

  cancelDeckTimers(backgroundDeck)
  backgroundDeck.audios.forEach((audio, index) => {
    if (!audio) {
      return
    }
    audio.pause()
    audio.volume = index === backgroundDeck?.activeIndex
      ? BACKGROUND_VOLUME[backgroundDeck.track]
      : 0
  })
}

const startLobbyMonitor = (deck: BackgroundDeck) => {
  if (deck.monitorId !== null) {
    return
  }

  deck.monitorId = window.setInterval(() => {
    if (backgroundDeck !== deck || deck.crossfading) {
      return
    }

    const activeAudio = getDeckAudio(deck, deck.activeIndex)
    const nextIndex = deck.activeIndex === 0 ? 1 : 0
    const nextAudio = deck.audios[nextIndex]
    const overlapSec = LOBBY_CROSSFADE_MS / 1_000

    if (!nextAudio || activeAudio.paused || activeAudio.currentTime < LOBBY_AUDIBLE_END_SEC - overlapSec) {
      return
    }

    deck.crossfading = true
    nextAudio.currentTime = LOBBY_LOOP_START_SEC
    const missedCrossfadeWindow = activeAudio.currentTime >= LOBBY_AUDIBLE_END_SEC
    nextAudio.volume = missedCrossfadeWindow ? BACKGROUND_VOLUME.lobbyLoop : 0
    void nextAudio.play().catch(() => {
      deck.crossfading = false
    })

    // Background tabs can throttle timers. If the monitor wakes after the audible
    // section, swap immediately instead of fading through the source's quiet tail.
    if (missedCrossfadeWindow) {
      activeAudio.pause()
      activeAudio.currentTime = LOBBY_LOOP_START_SEC
      activeAudio.volume = 0
      deck.activeIndex = nextIndex
      deck.crossfading = false
      return
    }

    const startedAt = performance.now()
    const targetVolume = BACKGROUND_VOLUME.lobbyLoop
    const crossfade = (now: number) => {
      if (backgroundDeck !== deck) {
        return
      }

      const progress = Math.max(0, Math.min(1, (now - startedAt) / LOBBY_CROSSFADE_MS))
      activeAudio.volume = targetVolume * (1 - progress)
      nextAudio.volume = targetVolume * progress

      if (progress < 1) {
        deck.fadeFrame = window.requestAnimationFrame(crossfade)
        return
      }

      activeAudio.pause()
      activeAudio.currentTime = LOBBY_LOOP_START_SEC
      activeAudio.volume = 0
      deck.activeIndex = nextIndex
      deck.crossfading = false
      deck.fadeFrame = null
    }

    deck.fadeFrame = window.requestAnimationFrame(crossfade)
  }, LOOP_MONITOR_MS)
}

const createBackgroundDeck = (track: QuizBackgroundTrack): BackgroundDeck => {
  const firstAudio = new Audio(QUIZ_AUDIO_ASSETS[track])
  firstAudio.preload = 'auto'
  firstAudio.volume = BACKGROUND_VOLUME[track]

  if (track === 'questionLoop') {
    firstAudio.loop = true
    return {
      activeIndex: 0,
      audios: [firstAudio],
      crossfading: false,
      fadeFrame: null,
      monitorId: null,
      track,
    }
  }

  const secondAudio = new Audio(QUIZ_AUDIO_ASSETS[track])
  secondAudio.preload = 'auto'
  secondAudio.volume = 0
  return {
    activeIndex: 0,
    audios: [firstAudio, secondAudio],
    crossfading: false,
    fadeFrame: null,
    monitorId: null,
    track,
  }
}

const playBackgroundTrack = (track: QuizBackgroundTrack) => {
  if (backgroundDeck?.track !== track) {
    if (backgroundDeck) {
      disposeDeck(backgroundDeck)
    }
    backgroundDeck = createBackgroundDeck(track)
  }

  const deck = backgroundDeck
  const activeAudio = getDeckAudio(deck, deck.activeIndex)
  activeAudio.volume = BACKGROUND_VOLUME[track]
  if (track === 'lobbyLoop') {
    startLobbyMonitor(deck)
  }
  void activeAudio.play().catch(() => undefined)
}

const stopBackgroundTrack = () => {
  if (!backgroundDeck) {
    return
  }
  const deck = backgroundDeck
  backgroundDeck = null
  disposeDeck(deck)
}

export const primeLobbyAudioFromGesture = () => {
  if (getAudioMutedPreference()) {
    return
  }
  playBackgroundTrack('lobbyLoop')
}

export const cancelPrimedLobbyAudio = () => {
  if (backgroundDeck?.track === 'lobbyLoop') {
    stopBackgroundTrack()
  }
}

export function useQuizAudio(
  enabled: boolean,
  backgroundTrack: QuizBackgroundTrack | null = 'lobbyLoop',
) {
  const [muted, setMuted] = useState(() => getAudioMutedPreference())
  const mutedRef = useRef(muted)
  const cueAudioRefs = useRef<Partial<Record<QuizAudioCue, HTMLAudioElement>>>({})

  const preloadCueAudio = useCallback(() => {
    Object.entries(QUIZ_AUDIO_ASSETS).forEach(([key, src]) => {
      if (BACKGROUND_TRACKS.has(key as QuizBackgroundTrack)) {
        return
      }

      const cueKey = key as QuizAudioCue
      if (!cueAudioRefs.current[cueKey]) {
        const cueAudio = new Audio(src)
        cueAudio.preload = 'auto'
        cueAudio.volume = CUE_VOLUME[cueKey]
        cueAudioRefs.current[cueKey] = cueAudio
      }

      cueAudioRefs.current[cueKey]?.load()
    })
  }, [])

  const resumeBackgroundAudio = useCallback(() => {
    if (!enabled || !backgroundTrack) {
      return
    }
    playBackgroundTrack(backgroundTrack)
  }, [backgroundTrack, enabled])

  useEffect(() => {
    if (!enabled || !backgroundTrack) {
      stopBackgroundTrack()
      return
    }

    if (!mutedRef.current) {
      playBackgroundTrack(backgroundTrack)
    }

    return () => {
      stopBackgroundTrack()
    }
  }, [backgroundTrack, enabled])

  useEffect(() => {
    mutedRef.current = muted
    localStorage.setItem(AUDIO_PREF_KEY, muted ? '1' : '0')

    if (muted) {
      pauseBackgroundDeck()
      return
    }

    resumeBackgroundAudio()
  }, [muted, resumeBackgroundAudio])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const unlockAudio = () => {
      preloadCueAudio()
      if (!mutedRef.current) {
        resumeBackgroundAudio()
      }
    }

    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [enabled, preloadCueAudio, resumeBackgroundAudio])

  const playCue = useCallback(
    (cue: QuizAudioCue) => {
      if (!enabled || mutedRef.current) {
        return
      }

      const existingAudio = cueAudioRefs.current[cue]
      const audio = existingAudio ?? new Audio(QUIZ_AUDIO_ASSETS[cue])
      audio.preload = 'auto'
      audio.volume = CUE_VOLUME[cue]
      audio.currentTime = 0
      cueAudioRefs.current[cue] = audio

      void audio.play().catch(() => undefined)
    },
    [enabled],
  )

  const toggleMuted = useCallback(() => {
    const nextMuted = !mutedRef.current
    mutedRef.current = nextMuted
    localStorage.setItem(AUDIO_PREF_KEY, nextMuted ? '1' : '0')

    if (nextMuted) {
      pauseBackgroundDeck()
    } else {
      preloadCueAudio()
      resumeBackgroundAudio()
    }

    setMuted(nextMuted)
  }, [preloadCueAudio, resumeBackgroundAudio])

  return {
    muted,
    playCue,
    toggleMuted,
  }
}
