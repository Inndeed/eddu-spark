export type QuizMode = 'knowledge_check'

export type SessionStatus =
  | 'lobby'
  | 'question_open'
  | 'question_closed'
  | 'leaderboard'
  | 'finished'

export interface QuizChoice {
  id: string
  text: string
}

export interface QuizQuestion {
  id: string
  prompt: string
  choices: [QuizChoice, QuizChoice, QuizChoice, QuizChoice]
  correctChoiceId: string
  timeLimitSec: number
  explanation: string
  facilitatorPrompt: string
  themeTag: string
  imagePath: string | null
  imageUrl: string | null
  imageAlt: string | null
}

export interface QuizSet {
  id: string
  title: string
  description: string
  category: string
  language: 'th'
  mode: QuizMode
  questions: QuizQuestion[]
  createdAt: string
  updatedAt: string
}

export interface HostUser {
  id: string
  email: string
  displayName: string | null
  role: 'host' | 'admin'
}

export interface Participant {
  id: string
  displayName: string
  joinedAt: string
  score: number
  correctAnswers: number
}

export interface Submission {
  id: string
  questionId: string
  participantId: string
  selectedChoiceId: string
  submittedAt: string
  responseMs: number
  isCorrect: boolean
  pointsAwarded: number
}

export interface LiveSession {
  id: string
  quizSetId: string
  quizSetTitle: string
  joinCode: string
  status: SessionStatus
  showLeaderboardEveryRound: boolean
  scoringMode: 'correct_plus_speed'
  createdAt: string
  updatedAt: string
  currentQuestionIndex: number
  lastClosedQuestionIndex: number | null
  questionStartedAt: string | null
  questionEndsAt: string | null
  participants: Participant[]
  submissions: Submission[]
}

export interface PlayerRanking {
  participantId: string
  displayName: string
  score: number
  correctAnswers: number
  currentStreak: number
  rank: number
}

export interface QuestionStats {
  questionId: string
  prompt: string
  themeTag: string
  totalSubmissions: number
  correctCount: number
  accuracyRate: number
  averagePoints: number
  distribution: Array<{
    choiceId: string
    text: string
    count: number
    isCorrect: boolean
  }>
}

export interface TopicStat {
  themeTag: string
  totalQuestions: number
  accuracyRate: number
}

export interface SessionSummary {
  totalParticipants: number
  hardestQuestion: string | null
  strongestTopic: string | null
  weakestTopic: string | null
}

export interface HostSessionView {
  session: LiveSession
  quizSet: QuizSet
  rankings: PlayerRanking[]
  questionStats: QuestionStats[]
  topicStats: TopicStat[]
  summary: SessionSummary
  currentQuestionSubmissionCount: number
}

export interface PlayerQuestionView {
  id: string
  prompt: string
  questionNumber: number
  totalQuestions: number
  endsAt: string | null
  submittedChoiceId: string | null
  choiceIds: [string, string, string, string]
}

export interface FinalSummaryView {
  hardestQuestion: string | null
  strongestTopic: string | null
  weakestTopic: string | null
}

export interface PlayerSessionView {
  session: Pick<
    LiveSession,
    | 'id'
    | 'joinCode'
    | 'quizSetTitle'
    | 'status'
    | 'showLeaderboardEveryRound'
    | 'currentQuestionIndex'
    | 'lastClosedQuestionIndex'
    | 'questionStartedAt'
    | 'questionEndsAt'
  >
  participant: Participant
  currentQuestion: PlayerQuestionView | null
  leaderboard: {
    topPlayers: PlayerRanking[]
    yourRank: number | null
  }
  finalSummary: FinalSummaryView | null
  playerCount: number
}

export interface StoreShape {
  quizSets: QuizSet[]
  sessions: LiveSession[]
}
