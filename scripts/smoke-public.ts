const DEFAULT_BASE_URL = 'https://eddu-spark-production.up.railway.app'

const baseUrl = (process.argv[2] || process.env.APP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')

const fail = (message: string) => {
  console.error(`FAIL ${message}`)
  process.exitCode = 1
}

const pass = (message: string) => {
  console.log(`OK ${message}`)
}

const requestText = async (path: string) => {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`)
  }

  return response.text()
}

const requestJson = async <T>(path: string) => {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`)
  }

  return (await response.json()) as T
}

type HealthPayload = {
  status: string
  mode: string
  appBaseUrl: string | null
}

try {
  const health = await requestJson<HealthPayload>('/api/health')
  if (health.status !== 'ok' || health.mode !== 'supabase') {
    fail(`health is not production-ready: ${JSON.stringify(health)}`)
  } else {
    pass(`health ok (${health.mode})`)
  }

  if (health.appBaseUrl && health.appBaseUrl.replace(/\/$/, '') !== baseUrl) {
    fail(`APP_BASE_URL mismatch: ${health.appBaseUrl}`)
  } else {
    pass('APP_BASE_URL matches public URL')
  }

  const html = await requestText('/')
  const assetMatches = html.match(/assets\/index-[\w-]+\.(?:js|css)/g) ?? []
  const assets = [...new Set(assetMatches)]

  if (assets.length < 2) {
    fail('missing built JS/CSS assets on landing HTML')
  } else {
    pass(`landing assets found (${assets.join(', ')})`)
  }

  await Promise.all(
    assets.map(async (asset) => {
      const response = await fetch(`${baseUrl}/${asset}`)
      if (!response.ok) {
        throw new Error(`${asset} returned ${response.status}`)
      }
    }),
  )
  pass('built assets are reachable')
} catch (error) {
  fail(error instanceof Error ? error.message : 'smoke check failed')
}
