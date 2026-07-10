import type { QuizMode, SessionStatus } from './types'

const dateTimeFormatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value))

export const modeLabel = (mode: QuizMode) => {
  if (mode === 'knowledge_check') {
    return 'Classic Quiz'
  }

  return 'Classic Quiz'
}

export const statusLabel = (status: SessionStatus) => {
  if (status === 'lobby') {
    return 'Lobby'
  }
  if (status === 'question_open') {
    return 'Live Question'
  }
  if (status === 'question_closed') {
    return 'Reveal'
  }
  if (status === 'leaderboard') {
    return 'Leaderboard'
  }

  return 'Finished'
}

export const percentLabel = (value: number) => `${Math.round(value * 100)}%`
