const PLAYER_RECORDS_KEY = 'eddu.spark.player-records'

export interface PlayerRecord {
  joinCode: string
  participantId: string
  displayName: string
  teamName: string
}

export const getPlayerRecord = (joinCode: string) => {
  const records = localStorage.getItem(PLAYER_RECORDS_KEY)
  if (!records) {
    return null
  }

  const parsed = JSON.parse(records) as Record<string, PlayerRecord>
  return parsed[joinCode.toUpperCase()] ?? null
}

export const setPlayerRecord = (record: PlayerRecord) => {
  const records = localStorage.getItem(PLAYER_RECORDS_KEY)
  const parsed = records ? (JSON.parse(records) as Record<string, PlayerRecord>) : {}
  parsed[record.joinCode.toUpperCase()] = record
  localStorage.setItem(PLAYER_RECORDS_KEY, JSON.stringify(parsed))
}
