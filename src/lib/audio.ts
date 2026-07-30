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

const BACKGROUND_LOOP_POINTS: Partial<Record<QuizBackgroundTrack, { startSec: number; endSec: number }>> = {
  // The source lobby loop has a long quiet tail. Jump before that tail so the lobby stays alive.
  lobbyLoop: { startSec: 0, endSec: 32.1 },
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
  const mutedRef = useRef(muted)
  const backgroundTrackRef = useRef<QuizBackgroundTrack | null>(backgroundTrack)
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null)
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
    const audio = backgroundAudioRef.current
    const activeTrack = backgroundTrackRef.current
    if (!enabled || !audio || !activeTrack) {
      return
    }

    audio.volume = BACKGROUND_VOLUME[activeTrack]
    void audio.play().catch(() => undefined)
  }, [enabled])

  useEffect(() => {
    backgroundTrackRef.current = backgroundTrack

    if (!enabled || !backgroundTrack) {
      backgroundAudioRef.current?.pause()
      return
    }

    const audio = new Audio(QUIZ_AUDIO_ASSETS[backgroundTrack])
    const loopPoint = BACKGROUND_LOOP_POINTS[backgroundTrack]
    audio.loop = !loopPoint
    audio.preload = 'auto'
    audio.volume = BACKGROUND_VOLUME[backgroundTrack]
    backgroundAudioRef.current = audio

    const handleLoopBoundary = () => {
      if (!loopPoint || audio.currentTime < loopPoint.endSec) {
        return
      }

      audio.currentTime = loopPoint.startSec
      if (!audio.paused && !mutedRef.current) {
        void audio.play().catch(() => undefined)
      }
    }

    audio.addEventListener('timeupdate', handleLoopBoundary)

    if (!mutedRef.current) {
      void audio.play().catch(() => undefined)
    }

    return () => {
      audio.removeEventListener('timeupdate', handleLoopBoundary)
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
  }, [backgroundTrack, enabled])

  useEffect(() => {
    mutedRef.current = muted
    localStorage.setItem(AUDIO_PREF_KEY, muted ? '1' : '0')

    if (muted) {
      backgroundAudioRef.current?.pause()
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

  const toggleMuted = useCallback(
    () => {
      const nextMuted = !mutedRef.current
      mutedRef.current = nextMuted
      localStorage.setItem(AUDIO_PREF_KEY, nextMuted ? '1' : '0')

      if (nextMuted) {
        backgroundAudioRef.current?.pause()
      } else {
        preloadCueAudio()
        resumeBackgroundAudio()
      }

      setMuted(nextMuted)
    },
    [preloadCueAudio, resumeBackgroundAudio],
  )

  return {
    muted,
    playCue,
    toggleMuted,
  }
}
