import type {
  HostUser,
  HostSessionView,
  PlayerSessionView,
  QuizSet,
} from './types'
import { localizeErrorMessage } from './errors'
import { getHostAccessToken } from './supabase'

export interface HostBootstrapData {
  quizSets: QuizSet[]
  currentHost: HostUser | null
  config: {
    scoringMode: string
  }
}

export interface UploadedQuestionImage {
  imagePath: string
  imageUrl: string
  imageAlt: string | null
}

export interface AppHealthData {
  status: 'ok' | 'setup_required'
  mode: 'supabase' | 'setup_required'
  appBaseUrl: string | null
}

const request = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  token?: string | null,
) => {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null
    throw new Error(localizeErrorMessage(payload?.error ?? 'Request failed'))
  }

  return (await response.json()) as T
}

const getRequiredHostToken = async () => {
  const token = await getHostAccessToken()
  if (!token) {
    throw new Error(localizeErrorMessage('Host authentication required'))
  }

  return token
}

export const fetchAppHealth = () => request<AppHealthData>('/api/health')

export const fetchHostBootstrap = async () =>
  request<HostBootstrapData>('/api/host/bootstrap', undefined, await getRequiredHostToken())

export const saveQuizSet = async (
  quizSet: Omit<QuizSet, 'createdAt' | 'updatedAt'>,
) =>
  request<QuizSet>(
    '/api/quiz-sets',
    {
      method: 'POST',
      body: JSON.stringify(quizSet),
    },
    await getRequiredHostToken(),
  )

export const deleteQuizSet = async (quizSetId: string) =>
  request<{ success: true }>(
    `/api/quiz-sets/${quizSetId}`,
    {
      method: 'DELETE',
    },
    await getRequiredHostToken(),
  )

export const launchSession = async (
  quizSetId: string,
) =>
  request<{ joinCode: string }>(
    '/api/sessions',
    {
      method: 'POST',
      body: JSON.stringify({ quizSetId }),
    },
    await getRequiredHostToken(),
  )

export const uploadQuestionImage = async (file: string, alt: string) =>
  request<UploadedQuestionImage>(
    '/api/quiz-assets/questions',
    {
      method: 'POST',
      body: JSON.stringify({ file, alt }),
    },
    await getRequiredHostToken(),
  )

export const fetchHostSession = async (joinCode: string) =>
  request<HostSessionView>(
    `/api/host/sessions/${joinCode}`,
    undefined,
    await getRequiredHostToken(),
  )

export const sendHostAction = async (
  joinCode: string,
  action: string,
) =>
  request(
    `/api/host/sessions/${joinCode}/actions`,
    {
      method: 'POST',
      body: JSON.stringify({ action }),
    },
    await getRequiredHostToken(),
  )

export const joinSession = (
  joinCode: string,
  displayName: string,
) =>
  request<{ participantId: string; joinCode: string }>('/api/play/join', {
    method: 'POST',
    body: JSON.stringify({ joinCode, displayName }),
  })

export const fetchPlayerSession = (joinCode: string, participantId: string) =>
  request<PlayerSessionView>(
    `/api/play/sessions/${joinCode}?participantId=${encodeURIComponent(
      participantId,
    )}`,
  )

export const submitAnswer = (
  joinCode: string,
  participantId: string,
  selectedChoiceId: string,
) =>
  request(
    `/api/play/sessions/${joinCode}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({ participantId, selectedChoiceId }),
    },
  )
