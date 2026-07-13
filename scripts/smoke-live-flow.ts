import { createClient } from '@supabase/supabase-js'
import { WebSocket } from 'ws'

import type { HostSessionView, PlayerSessionView, QuizSet } from '../src/lib/types.js'

const DEFAULT_BASE_URL = 'https://eddu-spark-production.up.railway.app'

const baseUrl = (process.argv[2] || process.env.APP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/ws`
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
const smokeHostEmail = process.env.SMOKE_HOST_EMAIL ?? ''
const smokeHostPassword = process.env.SMOKE_HOST_PASSWORD ?? ''
const requestedQuizSetId = process.env.SMOKE_QUIZ_SET_ID ?? ''

const fail = (message: string) => {
  console.error(`FAIL ${message}`)
  process.exitCode = 1
}

const pass = (message: string) => {
  console.log(`OK ${message}`)
}

const requireEnv = (value: string, name: string) => {
  if (!value) {
    throw new Error(`${name} is required for live smoke testing`)
  }

  return value
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

const requestJson = async <T>(
  path: string,
  init?: RequestInit,
  token?: string,
) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null
    throw new Error(`${path} returned ${response.status}: ${payload?.error ?? response.statusText}`)
  }

  return (await response.json()) as T
}

const openSessionSocket = async (joinCode: string) => {
  const socket = new WebSocket(wsUrl)

  await withTimeout(
    new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve())
      socket.once('error', reject)
    }),
    5000,
    'WebSocket open',
  )

  socket.send(JSON.stringify({ type: 'subscribe', joinCode }))
  await wait(150)

  if (socket.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket closed after live session subscribe')
  }

  return socket
}

const waitForSessionUpdate = async (socket: WebSocket, label: string) => {
  const message = await withTimeout(
    new Promise<string>((resolve, reject) => {
      socket.once('message', (data) => resolve(data.toString()))
      socket.once('error', reject)
    }),
    5000,
    label,
  )

  const payload = JSON.parse(message) as { type?: unknown; joinCode?: unknown }
  if (payload.type !== 'session_updated') {
    throw new Error(`${label} returned unexpected WebSocket payload`)
  }
}

const signInHost = async () => {
  requireEnv(supabaseUrl, 'SUPABASE_URL or VITE_SUPABASE_URL')
  requireEnv(supabaseAnonKey, 'SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY')
  requireEnv(smokeHostEmail, 'SMOKE_HOST_EMAIL')
  requireEnv(smokeHostPassword, 'SMOKE_HOST_PASSWORD')

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  const { data, error } = await client.auth.signInWithPassword({
    email: smokeHostEmail,
    password: smokeHostPassword,
  })

  if (error || !data.session?.access_token) {
    throw new Error(`Host sign-in failed: ${error?.message ?? 'missing session'}`)
  }

  return data.session.access_token
}

const pickQuizSet = (quizSets: QuizSet[]) => {
  if (quizSets.length === 0) {
    throw new Error('Host library has no quiz sets to launch')
  }

  const quizSet = requestedQuizSetId
    ? quizSets.find((item) => item.id === requestedQuizSetId)
    : quizSets[0]

  if (!quizSet) {
    throw new Error(`SMOKE_QUIZ_SET_ID ${requestedQuizSetId} was not found in the host library`)
  }

  if (quizSet.questions.length === 0) {
    throw new Error(`Quiz set ${quizSet.title} has no questions`)
  }

  return quizSet
}

type HostBootstrapPayload = {
  quizSets: QuizSet[]
}

type LaunchSessionPayload = {
  joinCode: string
}

type JoinPayload = {
  participantId: string
  joinCode: string
}

let joinCode: string | null = null
let hostToken: string | null = null

try {
  hostToken = await signInHost()
  pass('host can sign in with Supabase credentials')

  const bootstrap = await requestJson<HostBootstrapPayload>('/api/host/bootstrap', undefined, hostToken)
  const quizSet = pickQuizSet(bootstrap.quizSets)
  pass(`host library loaded quiz "${quizSet.title}"`)

  const launchedSession = await requestJson<LaunchSessionPayload>(
    '/api/sessions',
    {
      method: 'POST',
      body: JSON.stringify({ quizSetId: quizSet.id }),
    },
    hostToken,
  )
  joinCode = launchedSession.joinCode
  pass(`host launched room ${joinCode}`)

  const socket = await openSessionSocket(joinCode)
  pass('WebSocket subscribed to the live room')

  const playerName = `Smoke ${Date.now().toString(36)}`
  const joinedPlayer = await requestJson<JoinPayload>('/api/play/join', {
    method: 'POST',
    body: JSON.stringify({ joinCode, displayName: playerName }),
  })
  await waitForSessionUpdate(socket, 'player join broadcast')
  pass('player joined with name-only public flow')

  const lobbyView = await requestJson<HostSessionView>(`/api/host/sessions/${joinCode}`, undefined, hostToken)
  if (!lobbyView.session.participants.some((participant) => participant.id === joinedPlayer.participantId)) {
    throw new Error('Host lobby did not include the smoke player')
  }
  pass('host lobby sees the player')

  await requestJson(
    `/api/host/sessions/${joinCode}/actions`,
    {
      method: 'POST',
      body: JSON.stringify({ action: 'advance' }),
    },
    hostToken,
  )
  await waitForSessionUpdate(socket, 'question open broadcast')
  pass('host opened the first question')

  const playerQuestion = await requestJson<PlayerSessionView>(
    `/api/play/sessions/${joinCode}?participantId=${encodeURIComponent(joinedPlayer.participantId)}`,
  )
  if (playerQuestion.session.status !== 'question_open' || playerQuestion.currentQuestion?.choiceIds.length !== 4) {
    throw new Error('Player did not receive a live question with four choices')
  }
  pass('player sees one live question with four answer buttons')

  await requestJson(
    `/api/play/sessions/${joinCode}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({
        participantId: joinedPlayer.participantId,
        selectedChoiceId: playerQuestion.currentQuestion.choiceIds[0],
      }),
    },
  )
  await waitForSessionUpdate(socket, 'answer submission broadcast')
  pass('player submitted one locked answer')

  const closedHostView = await requestJson<HostSessionView>(`/api/host/sessions/${joinCode}`, undefined, hostToken)
  if (closedHostView.session.status !== 'question_closed') {
    await requestJson(
      `/api/host/sessions/${joinCode}/actions`,
      {
        method: 'POST',
        body: JSON.stringify({ action: 'close_question' }),
      },
      hostToken,
    )
    await waitForSessionUpdate(socket, 'manual close broadcast')
  }
  pass('question reached the reveal-ready state')

  await requestJson(
    `/api/host/sessions/${joinCode}/actions`,
    {
      method: 'POST',
      body: JSON.stringify({ action: 'show_leaderboard' }),
    },
    hostToken,
  )
  await waitForSessionUpdate(socket, 'leaderboard broadcast')

  const leaderboardView = await requestJson<HostSessionView>(`/api/host/sessions/${joinCode}`, undefined, hostToken)
  if (leaderboardView.session.status !== 'leaderboard' || leaderboardView.rankings.length === 0) {
    throw new Error('Leaderboard did not include player rankings')
  }
  pass('leaderboard shows player rankings')

  await requestJson(
    `/api/host/sessions/${joinCode}/actions`,
    {
      method: 'POST',
      body: JSON.stringify({ action: 'finish' }),
    },
    hostToken,
  )
  await waitForSessionUpdate(socket, 'finish broadcast')
  socket.close()

  const finalPlayerView = await requestJson<PlayerSessionView>(
    `/api/play/sessions/${joinCode}?participantId=${encodeURIComponent(joinedPlayer.participantId)}`,
  )
  if (finalPlayerView.session.status !== 'finished') {
    throw new Error('Player did not reach the finished state')
  }
  pass('finished state is visible to the player')
} catch (error) {
  fail(error instanceof Error ? error.message : 'live smoke check failed')
} finally {
  if (joinCode && hostToken) {
    await requestJson(
      `/api/host/sessions/${joinCode}/actions`,
      {
        method: 'POST',
        body: JSON.stringify({ action: 'finish' }),
      },
      hostToken,
    ).catch(() => null)
  }
}
