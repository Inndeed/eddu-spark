import { useCallback, useEffect, useRef, useState } from 'react'

const AUDIO_PREF_KEY = 'eddu.quiz.audio-muted'
const FADE_STEP_MS = 40

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

export const getAudioMutedPreference = () => {
  const raw = localStorage.getItem(AUDIO_PREF_KEY)
  return raw === '1'
}

export function useQuizAudio(
  enabled: boolean,
  backgroundTrack: QuizBackgroundTrack | null = 'lobbyLoop',
) {
  const [muted, setMuted] = useState(() => getAudioMutedPreference())
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null)
  const cueAudioRefs = useRef<Partial<Record<QuizAudioCue, HTMLAudioElement>>>({})

  useEffect(() => {
    localStorage.setItem(AUDIO_PREF_KEY, muted ? '1' : '0')
  }, [muted])

  useEffect(() => {
    if (!enabled || !backgroundTrack) {
      backgroundAudioRef.current?.pause()
      return
    }

    const audio = new Audio(QUIZ_AUDIO_ASSETS[backgroundTrack])
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = BACKGROUND_VOLUME[backgroundTrack]
    backgroundAudioRef.current = audio

    if (!muted) {
      void audio.play().catch(() => undefined)
    }

    return () => {
      let nextVolume = audio.volume
      const fadeTimer = window.setInterval(() => {
        nextVolume = Math.max(0, nextVolume - 0.08)
        audio.volume = nextVolume

        if (nextVolume <= 0) {
          window.clearInterval(fadeTimer)
          audio.pause()
          audio.currentTime = 0
        }
      }, FADE_STEP_MS)

      if (backgroundAudioRef.current === audio) {
        backgroundAudioRef.current = null
      }
    }
  }, [backgroundTrack, enabled, muted])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const preloadAudio = () => {
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
    }

    window.addEventListener('pointerdown', preloadAudio, { once: true })
    window.addEventListener('keydown', preloadAudio, { once: true })

    return () => {
      window.removeEventListener('pointerdown', preloadAudio)
      window.removeEventListener('keydown', preloadAudio)
    }
  }, [enabled])

  const playCue = useCallback(
    (cue: QuizAudioCue) => {
      if (!enabled || muted) {
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
    [enabled, muted],
  )

  return {
    muted,
    playCue,
    toggleMuted: () => {
      setMuted((current) => !current)
    },
  }
}
