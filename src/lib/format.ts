import type { QuizMode, SessionStatus } from './types'

const dateTimeFormatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value))

export const modeLabel = (mode: QuizMode) => {
  if (mode === 'knowledge_check') {
    return 'Quiz'
  }

  return 'Quiz'
}

export const statusLabel = (status: SessionStatus) => {
  if (status === 'lobby') {
    return 'Join'
  }
  if (status === 'question_open') {
    return 'Question'
  }
  if (status === 'question_closed') {
    return 'Reveal'
  }
  if (status === 'leaderboard') {
    return 'Top 5'
  }

  return 'Finished'
}

export const percentLabel = (value: number) => `${Math.round(value * 100)}%`
