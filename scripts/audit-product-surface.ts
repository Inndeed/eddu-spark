import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const scanRoots = ['src', 'server', 'scripts', 'README.md', 'index.html']
const ignoredFiles = new Set(['scripts/audit-product-surface.ts'])
const fileExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.md', '.html', '.css'])

const forbiddenPatterns: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bEDDU Spark\b|\bEddu Spark\b/, label: 'old Eddu Spark branding' },
  { pattern: /\bmodeLabel\b/, label: 'old multi-mode label helper' },
  { pattern: /\bTeamRanking\b|\bteamName\b/, label: 'public team ranking/name field' },
  { pattern: /\bKnowledge Check\b|\bScenario Sprint\b|\bTeam Pulse\b/, label: 'old exposed game mode label' },
  { pattern: /\bshowLeaderboardEveryRound\b/, label: 'old leaderboard-every-round toggle surface' },
]

const walk = async (entry: string): Promise<string[]> => {
  const absolutePath = path.join(rootDir, entry)
  const stat = await readdir(path.dirname(absolutePath), { withFileTypes: true })
    .then((items) => items.find((item) => item.name === path.basename(absolutePath)))
    .catch(() => null)

  if (!stat) {
    return []
  }

  if (stat.isFile()) {
    return fileExtensions.has(path.extname(entry)) ? [entry] : []
  }

  const children = await readdir(absolutePath, { withFileTypes: true })
  const nested = await Promise.all(
    children.map((child) => walk(path.join(entry, child.name))),
  )
  return nested.flat()
}

const files = (await Promise.all(scanRoots.map(walk)))
  .flat()
  .filter((file) => !ignoredFiles.has(file))

const failures: string[] = []

for (const file of files) {
  const content = await readFile(path.join(rootDir, file), 'utf8')
  const lines = content.split(/\r?\n/)

  lines.forEach((line, index) => {
    forbiddenPatterns.forEach(({ pattern, label }) => {
      if (pattern.test(line)) {
        failures.push(`${file}:${index + 1} contains ${label}`)
      }
    })
  })
}

if (failures.length > 0) {
  console.error('Product surface audit failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

const hostLivePage = await readFile(path.join(rootDir, 'src/pages/HostLivePage.tsx'), 'utf8')
const globalCss = await readFile(path.join(rootDir, 'src/index.css'), 'utf8')
const serverIndex = await readFile(path.join(rootDir, 'server/index.ts'), 'utf8')
const sessionStore = await readFile(path.join(rootDir, 'server/session-store.ts'), 'utf8')
const clientJoinCode = await readFile(path.join(rootDir, 'src/lib/join-code.ts'), 'utf8')
const clientLive = await readFile(path.join(rootDir, 'src/lib/live.ts'), 'utf8')
const clientStorage = await readFile(path.join(rootDir, 'src/lib/storage.ts'), 'utf8')
const playerJoinPage = await readFile(path.join(rootDir, 'src/pages/PlayerJoinPage.tsx'), 'utf8')
const playerNamePage = await readFile(path.join(rootDir, 'src/pages/PlayerNamePage.tsx'), 'utf8')
const playerSessionPage = await readFile(path.join(rootDir, 'src/pages/PlayerSessionPage.tsx'), 'utf8')

const hostLiveLayoutChecks: Array<{ passed: boolean; label: string }> = [
  {
    passed: hostLivePage.includes('className="host-live-rail"'),
    label: 'Host Live renders the control rail as its own element',
  },
  {
    passed: !hostLivePage.includes('host-topbar host-live-rail'),
    label: 'Host Live rail is not mixed with the old topbar class',
  },
  {
    passed: /grid-template-columns:\s*70px\s+minmax\(0,\s*1fr\)/.test(globalCss),
    label: 'Host Live desktop layout reserves a compact left rail',
  },
  {
    passed: /grid-template-columns:\s*minmax\(420px,\s*1\.28fr\)\s+minmax\(320px,\s*0\.72fr\)/.test(globalCss),
    label: 'Reveal layout prioritizes the image area over secondary cards',
  },
  {
    passed: /min-height:\s*clamp\(66px,\s*11\.4vh,\s*94px\)/.test(globalCss),
    label: 'Host answer cards are compact enough for a no-scroll projection stage',
  },
]

const productionReadinessChecks: Array<{ passed: boolean; label: string }> = [
  {
    passed: serverIndex.includes('version: APP_VERSION'),
    label: 'Health endpoint exposes the app version for release verification',
  },
  {
    passed: serverIndex.includes('commitSha: COMMIT_SHA'),
    label: 'Health endpoint exposes the runtime commit sha when the platform provides it',
  },
]

const joinCodeResilienceChecks: Array<{ passed: boolean; label: string }> = [
  {
    passed: /export const normalizeJoinCode/.test(clientJoinCode) &&
      /replace\(\s*\/\[\^A-Z0-9\]\/g,\s*''\s*\)\.slice\(0,\s*6\)/.test(clientJoinCode),
    label: 'Client exposes shared join-code normalization for pasted spaces and separators',
  },
  {
    passed: !/maxLength=\{?6\}?/.test(playerJoinPage),
    label: 'Player code entry does not truncate pasted room codes before normalization',
  },
  {
    passed: playerJoinPage.includes('setJoinCode(normalizeJoinCode(event.target.value))'),
    label: 'Player code entry normalizes pasted input before storing it',
  },
  {
    passed: /export const normalizeJoinCode/.test(sessionStore) &&
      /replace\(\s*\/\[\^A-Z0-9\]\/g,\s*''\s*\)\.slice\(0,\s*6\)/.test(sessionStore),
    label: 'Server exposes the same resilient join-code normalization',
  },
  {
    passed: serverIndex.includes("socket.channels?.add(`session:${normalizeJoinCode(message.joinCode)}`)") &&
      serverIndex.includes("const normalizedJoinCode = normalizeJoinCode(joinCode)"),
    label: 'WebSocket and broadcast paths use normalized join codes',
  },
  {
    passed: playerNamePage.includes('const normalizedJoinCode = normalizeJoinCode(joinCode)'),
    label: 'Deep-link player name route normalizes join codes before API calls',
  },
  {
    passed: playerSessionPage.includes('const normalizedJoinCode = normalizeJoinCode(joinCode ??') &&
      playerSessionPage.includes('fetchPlayerSession(normalizedJoinCode, participantId)') &&
      playerSessionPage.includes('submitAnswer(normalizedJoinCode, participantId, choiceId)'),
    label: 'Player session route normalizes join codes before reconnect, fetch, and submit',
  },
  {
    passed: clientStorage.includes('normalizeJoinCode(record.joinCode)') &&
      clientLive.includes('const normalizedJoinCode = normalizeJoinCode(joinCode)'),
    label: 'Client storage and live channel use normalized join-code keys',
  },
]

;[
  ...hostLiveLayoutChecks,
  ...productionReadinessChecks,
  ...joinCodeResilienceChecks,
].forEach(({ passed, label }) => {
  if (!passed) {
    failures.push(label)
  }
})

if (failures.length > 0) {
  console.error('Product surface audit failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('OK product surface has no legacy Eddu Spark/team/multi-mode terms and keeps Host Live controls in the side rail')
