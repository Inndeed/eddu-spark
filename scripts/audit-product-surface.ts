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

console.log('OK product surface has no legacy Eddu Spark/team/multi-mode terms')
