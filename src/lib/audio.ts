import { useEffect, useState } from 'react'

const AUDIO_PREF_KEY = 'eddu.quiz.audio-muted'

export const getAudioMutedPreference = () => {
  const raw = localStorage.getItem(AUDIO_PREF_KEY)
  return raw === '1'
}

export function useQuizAudio(enabled: boolean) {
  const [muted, setMuted] = useState(() => getAudioMutedPreference())

  useEffect(() => {
    localStorage.setItem(AUDIO_PREF_KEY, muted ? '1' : '0')
  }, [muted])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const audio = new Audio('/audio/workshop-loop.wav')
    audio.loop = true
    audio.volume = 0.34

    if (!muted) {
      void audio.play().catch(() => undefined)
    }

    return () => {
      audio.pause()
      audio.currentTime = 0
    }
  }, [enabled, muted])

  return {
    muted,
    toggleMuted: () => {
      setMuted((current) => !current)
    },
  }
}
