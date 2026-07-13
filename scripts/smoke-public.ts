import { WebSocket } from 'ws'

const DEFAULT_BASE_URL = 'https://eddu-spark-production.up.railway.app'

const baseUrl = (process.argv[2] || process.env.APP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/ws`

const fail = (message: string) => {
  console.error(`FAIL ${message}`)
  process.exitCode = 1
}

const pass = (message: string) => {
  console.log(`OK ${message}`)
}

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, label: string) =>
  new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timeout)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timeout)
        reject(error)
      })
  })

const requestText = async (path: string) => {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`)
  }

  return response.text()
}

const readLandingAssets = (html: string) => [...new Set(html.match(/assets\/index-[\w-]+\.(?:js|css)/g) ?? [])]

const requestJson = async <T>(path: string) => {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`)
  }

  return (await response.json()) as T
}

const expectJsonStatus = async (
  path: string,
  expectedStatus: number,
  init?: RequestInit,
) => {
  const response = await fetch(`${baseUrl}${path}`, init)
  const contentType = response.headers.get('content-type') ?? ''

  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}, expected ${expectedStatus}`)
  }

  if (!contentType.includes('application/json')) {
    throw new Error(`${path} did not return JSON`)
  }

  const payload = (await response.json()) as { error?: unknown }
  if (typeof payload.error !== 'string' || payload.error.length === 0) {
    throw new Error(`${path} did not return a JSON error payload`)
  }
}

const verifyWebSocket = async () => {
  const socket = new WebSocket(wsUrl)

  await withTimeout(
    new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve())
      socket.once('error', reject)
    }),
    5000,
    'WebSocket open',
  )

  socket.send(JSON.stringify({ type: 'subscribe', joinCode: 'SMOKE1' }))
  await new Promise((resolve) => setTimeout(resolve, 150))

  if (socket.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket closed after valid subscribe')
  }

  socket.send('not-json')
  const message = await withTimeout(
    new Promise<string>((resolve, reject) => {
      socket.once('message', (data) => resolve(data.toString()))
      socket.once('error', reject)
    }),
    5000,
    'WebSocket invalid-message response',
  )

  const payload = JSON.parse(message) as { type?: unknown; message?: unknown }
  if (payload.type !== 'error' || typeof payload.message !== 'string') {
    throw new Error('WebSocket did not return the expected error payload')
  }

  socket.close()
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
  const assets = readLandingAssets(html)

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

  const deepLinkPaths = ['/play', '/play/join/SMOKE1', '/host', '/host/live/SMOKE1']
  await Promise.all(
    deepLinkPaths.map(async (path) => {
      const routeHtml = await requestText(path)
      const routeAssets = readLandingAssets(routeHtml)
      if (routeAssets.length < 2) {
        throw new Error(`${path} did not return the SPA shell`)
      }
    }),
  )
  pass(`SPA deep links return the app shell (${deepLinkPaths.join(', ')})`)

  await expectJsonStatus('/api/play/sessions/SMOKE1', 404)
  await expectJsonStatus('/api/play/join', 404, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      joinCode: 'SMOKE1',
      displayName: 'Smoke Tester',
    }),
  })
  await expectJsonStatus('/api/host/bootstrap', 401)
  pass('public/host API routes return expected JSON status responses')

  await verifyWebSocket()
  pass('public WebSocket endpoint accepts subscriptions and returns protocol errors')
} catch (error) {
  fail(error instanceof Error ? error.message : 'smoke check failed')
}
