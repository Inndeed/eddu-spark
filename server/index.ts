import path from 'node:path'
import { createServer } from 'node:http'

import express from 'express'
import { WebSocket, WebSocketServer } from 'ws'

import type { QuizSet } from '../src/lib/types.js'
import { SessionStore } from './session-store.js'
import {
  createServerAuthClient,
  createServerSupabaseClient,
  hasSupabaseServerConfig,
} from './supabase.js'

const PORT = Number(process.env.PORT ?? 8787)
const APP_BASE_URL = process.env.APP_BASE_URL ?? ''
const store = new SessionStore()

type SocketWithChannels = WebSocket & {
  channels?: Set<string>
}

type HostRole = 'host' | 'admin'

type HostUser = {
  id: string
  email: string
  displayName: string | null
  role: HostRole
}

type AuthedRequest = express.Request & {
  hostUser?: HostUser
}

const app = express()
app.use(express.json({ limit: '8mb' }))

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

const isProduction = process.env.NODE_ENV === 'production'

const broadcastSession = (joinCode: string) => {
  const payload = JSON.stringify({
    type: 'session_updated',
    joinCode,
    at: new Date().toISOString(),
  })

  wss.clients.forEach((client) => {
    const socket = client as SocketWithChannels
    if (
      client.readyState === WebSocket.OPEN &&
      socket.channels?.has(`session:${joinCode}`)
    ) {
      client.send(payload)
    }
  })
}

const setupRequired = (response: express.Response) => {
  response.status(503).json({
    error:
      'Supabase server configuration is missing. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.',
  })
}

const handleError = (response: express.Response, error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  const status =
    message === 'Duplicate submission'
      ? 409
      : message.includes('เต็ม') || message.includes('ถูกใช้ไปแล้ว')
        ? 409
      : message.includes('not found')
        ? 404
        : message.includes('required') ||
            message.includes('Unknown') ||
            message.includes('Invalid') ||
            message.includes('กรุณา') ||
            message.includes('รองรับเฉพาะ')
          ? 400
          : 500
  response.status(status).json({ error: message })
}

const requireHostAuth: express.RequestHandler = async (
  request,
  response,
  next,
) => {
  if (!hasSupabaseServerConfig()) {
    setupRequired(response)
    return
  }

  const authorization = request.headers.authorization
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined

  if (!token) {
    response.status(401).json({ error: 'Host authentication required' })
    return
  }

  try {
    const authClient = createServerAuthClient()
    const serviceClient = createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)

    if (authError || !user) {
      response.status(401).json({ error: 'Host authentication required' })
      return
    }

    const { data: hostRows, error: hostError } = await serviceClient
      .from('host_users')
      .select('id, email, display_name, role, is_active')
      .eq('id', user.id)
      .eq('is_active', true)
      .limit(1)

    if (hostError) {
      throw hostError
    }

    const hostRow = hostRows?.[0]
    if (!hostRow) {
      response.status(403).json({ error: 'This user is not allowed to host sessions' })
      return
    }

    ;(request as AuthedRequest).hostUser = {
      id: hostRow.id as string,
      email: hostRow.email as string,
      displayName: (hostRow.display_name as string | null) ?? null,
      role: hostRow.role as HostRole,
    }

    next()
  } catch (error) {
    handleError(response, error)
  }
}

app.get('/api/health', (_request, response) => {
  response.json({
    status: hasSupabaseServerConfig() ? 'ok' : 'setup_required',
    mode: hasSupabaseServerConfig() ? 'supabase' : 'setup_required',
    appBaseUrl: APP_BASE_URL || null,
  })
})

app.get('/api/host/bootstrap', requireHostAuth, async (request, response) => {
  if (!hasSupabaseServerConfig()) {
    setupRequired(response)
    return
  }

  try {
    const authedRequest = request as AuthedRequest
    response.json({
      quizSets: await store.listQuizSets(),
      recentSessions: await store.listRecentSessions(),
      currentHost: authedRequest.hostUser ?? null,
      config: {
        scoringMode: '600 base + up to 400 speed bonus',
      },
    })
  } catch (error) {
    handleError(response, error)
  }
})

app.post('/api/quiz-sets', requireHostAuth, async (request, response) => {
  if (!hasSupabaseServerConfig()) {
    setupRequired(response)
    return
  }

  try {
    const payload = request.body as Omit<QuizSet, 'createdAt' | 'updatedAt'>
    const authedRequest = request as AuthedRequest
    const quizSet = await store.upsertQuizSet(payload, authedRequest.hostUser?.id ?? null)
    response.json(quizSet)
  } catch (error) {
    handleError(response, error)
  }
})

app.post('/api/quiz-assets/questions', requireHostAuth, async (request, response) => {
  if (!hasSupabaseServerConfig()) {
    setupRequired(response)
    return
  }

  try {
    const payload = await store.uploadQuestionImage(
      String(request.body?.file ?? ''),
      String(request.body?.alt ?? ''),
    )
    response.json(payload)
  } catch (error) {
    handleError(response, error)
  }
})

app.post('/api/sessions', requireHostAuth, async (request, response) => {
  if (!hasSupabaseServerConfig()) {
    setupRequired(response)
    return
  }

  try {
    const authedRequest = request as AuthedRequest
    const quizSetId = String(request.body?.quizSetId ?? '')
    const session = await store.launchSession(quizSetId, authedRequest.hostUser?.id ?? null)
    response.json(session)
  } catch (error) {
    handleError(response, error)
  }
})

app.get('/api/host/sessions/:joinCode', requireHostAuth, async (request, response) => {
  if (!hasSupabaseServerConfig()) {
    setupRequired(response)
    return
  }

  try {
    const view = await store.buildHostView(String(request.params.joinCode))
    response.json(view)
  } catch (error) {
    handleError(response, error)
  }
})

app.post(
  '/api/host/sessions/:joinCode/actions',
  requireHostAuth,
  async (request, response) => {
    if (!hasSupabaseServerConfig()) {
      setupRequired(response)
      return
    }

    try {
      const session = await store.applyHostAction(
        String(request.params.joinCode),
        String(request.body?.action ?? ''),
      )
      broadcastSession(session.joinCode)
      response.json(session)
    } catch (error) {
      handleError(response, error)
    }
  },
)

app.post('/api/play/join', async (request, response) => {
  if (!hasSupabaseServerConfig()) {
    setupRequired(response)
    return
  }

  try {
    const joinCode = String(request.body?.joinCode ?? '').toUpperCase()
    const displayName = String(request.body?.displayName ?? '')
    const participant = await store.joinPlayer(joinCode, displayName)
    broadcastSession(joinCode)
    response.json({ participantId: participant.id, joinCode })
  } catch (error) {
    handleError(response, error)
  }
})

app.get('/api/play/sessions/:joinCode', async (request, response) => {
  if (!hasSupabaseServerConfig()) {
    setupRequired(response)
    return
  }

  try {
    const participantId = String(request.query.participantId ?? '')
    const view = await store.buildPlayerView(
      String(request.params.joinCode),
      participantId,
    )
    response.json(view)
  } catch (error) {
    handleError(response, error)
  }
})

app.post('/api/play/sessions/:joinCode/submit', async (request, response) => {
  if (!hasSupabaseServerConfig()) {
    setupRequired(response)
    return
  }

  try {
    const participantId = String(request.body?.participantId ?? '')
    const selectedChoiceId = String(request.body?.selectedChoiceId ?? '')
    const submission = await store.submitAnswer(
      String(request.params.joinCode),
      participantId,
      selectedChoiceId,
    )
    broadcastSession(String(request.params.joinCode).toUpperCase())
    response.json(submission)
  } catch (error) {
    handleError(response, error)
  }
})

wss.on('connection', (socket: SocketWithChannels) => {
  socket.channels = new Set<string>()

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as {
        type?: string
        joinCode?: string
      }

      if (message.type === 'subscribe' && message.joinCode) {
        socket.channels?.add(`session:${message.joinCode.toUpperCase()}`)
      }
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid message' }))
    }
  })
})

const start = async () => {
  if (hasSupabaseServerConfig()) {
    await store.init()
  }

  setInterval(async () => {
    if (!hasSupabaseServerConfig()) {
      return
    }

    try {
      const changedJoinCodes = await store.tick()
      changedJoinCodes.forEach((joinCode) => broadcastSession(joinCode))
    } catch (error) {
      console.error(error)
    }
  }, 1000)

  if (isProduction) {
    const distDir = path.join(process.cwd(), 'dist')
    app.use(express.static(distDir))
    app.use((request, response, next) => {
      if (request.path.startsWith('/api')) {
        next()
        return
      }

      response.sendFile(path.join(distDir, 'index.html'))
    })
  }

  server.listen(PORT, () => {
    console.log(`Eddu Quiz server listening on http://localhost:${PORT}`)
  })
}

start().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
