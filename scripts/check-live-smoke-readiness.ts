import './load-env.js'
import { discoverPublicSupabaseConfig } from './public-supabase-config.js'

const DEFAULT_BASE_URL = 'https://eddu-spark-production.up.railway.app'

const baseUrl = (process.argv[2] || process.env.APP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')

const envSupabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const envSupabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
const discoveredSupabaseConfig =
  envSupabaseUrl && envSupabaseAnonKey
    ? null
    : await discoverPublicSupabaseConfig(baseUrl).catch(() => null)
const hasSupabasePublicConfig = Boolean(
  (envSupabaseUrl && envSupabaseAnonKey) || discoveredSupabaseConfig,
)
const supabasePublicConfigSource =
  envSupabaseUrl && envSupabaseAnonKey
    ? 'env'
    : discoveredSupabaseConfig
      ? discoveredSupabaseConfig.source
      : 'missing'

const requiredEnv = [
  {
    label: 'Supabase public config from env or deployed asset',
    present: hasSupabasePublicConfig,
  },
  {
    label: 'SMOKE_HOST_EMAIL',
    present: Boolean(process.env.SMOKE_HOST_EMAIL),
  },
  {
    label: 'SMOKE_HOST_PASSWORD',
    present: Boolean(process.env.SMOKE_HOST_PASSWORD),
  },
] as const

const optionalEnv = [
  'SMOKE_QUIZ_SET_ID',
  'SMOKE_CAPACITY_CHECK',
  'EXPECTED_COMMIT_SHA',
] as const

const maskStatus = (key: string) => (process.env[key] ? 'set' : 'missing')

console.log(`Checking live smoke readiness for ${baseUrl}`)
console.log(`Supabase public config source: ${supabasePublicConfigSource}`)

requiredEnv.forEach((item) => {
  console.log(`${item.label}: ${item.present ? 'set' : 'missing'}`)
})

optionalEnv.forEach((key) => {
  console.log(`${key}: ${maskStatus(key)} (optional)`)
})

const missingRequired = requiredEnv
  .filter((item) => !item.present)
  .map((item) => item.label)

const response = await fetch(`${baseUrl}/api/health`)
if (!response.ok) {
  console.error(`FAIL /api/health returned ${response.status}`)
  process.exit(1)
}

const health = (await response.json()) as {
  status?: string
  mode?: string
  appBaseUrl?: string | null
  commitSha?: string | null
}

if (health.status !== 'ok' || health.mode !== 'supabase') {
  console.error(`FAIL public app is not production-ready: ${JSON.stringify(health)}`)
  process.exit(1)
}

if (health.appBaseUrl && health.appBaseUrl.replace(/\/$/, '') !== baseUrl) {
  console.error(`FAIL APP_BASE_URL mismatch: ${health.appBaseUrl}`)
  process.exit(1)
}

console.log(`OK public app health is ready (${health.commitSha?.slice(0, 7) ?? 'commit unknown'})`)

if (missingRequired.length > 0) {
  console.error(`FAIL missing env vars for live smoke: ${missingRequired.join(', ')}`)
  process.exit(1)
}

console.log('OK live smoke env is ready')
