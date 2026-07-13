export const normalizeJoinCode = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)

export const isCompleteJoinCode = (value: string) => normalizeJoinCode(value).length === 6
