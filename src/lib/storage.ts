import { normalizeJoinCode } from './join-code'

const PLAYER_RECORDS_KEY = 'eddu.quiz.player-records'

export interface PlayerRecord {
  joinCode: string
  participantId: string
  displayName: string
}

export const getPlayerRecord = (joinCode: string) => {
  const records = localStorage.getItem(PLAYER_RECORDS_KEY)
  if (!records) {
    return null
  }

  const parsed = JSON.parse(records) as Record<string, PlayerRecord>
  return parsed[normalizeJoinCode(joinCode)] ?? null
}

export const setPlayerRecord = (record: PlayerRecord) => {
  const records = localStorage.getItem(PLAYER_RECORDS_KEY)
  const parsed = records ? (JSON.parse(records) as Record<string, PlayerRecord>) : {}
  const normalizedJoinCode = normalizeJoinCode(record.joinCode)
  parsed[normalizedJoinCode] = {
    ...record,
    joinCode: normalizedJoinCode,
  }
  localStorage.setItem(PLAYER_RECORDS_KEY, JSON.stringify(parsed))
}
