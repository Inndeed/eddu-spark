import type { SessionStatus } from './types'

const dateTimeFormatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value))

export const statusLabel = (status: SessionStatus) => {
  if (status === 'lobby') {
    return 'เข้าห้อง'
  }
  if (status === 'question_open') {
    return 'คำถาม'
  }
  if (status === 'question_closed') {
    return 'เฉลย'
  }
  if (status === 'leaderboard') {
    return 'Top 5'
  }

  return 'จบเกม'
}

export const percentLabel = (value: number) => `${Math.round(value * 100)}%`
