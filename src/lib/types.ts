export type QuizMode = 'knowledge_check' | 'scenario_sprint' | 'team_pulse'

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
  choices: QuizChoice[]
  correctChoiceId: string
  timeLimitSec: number
  explanation: string
  facilitatorPrompt: string
  themeTag: string
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
  teamName: string
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
  teamName: string
  score: number
  correctAnswers: number
  rank: number
}

export interface TeamRanking {
  teamName: string
  score: number
  members: number
  correctAnswers: number
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
  }>
}

export interface TopicStat {
  themeTag: string
  totalQuestions: number
  accuracyRate: number
}

export interface SessionSummary {
  totalParticipants: number
  totalTeams: number
  hardestQuestion: string | null
  strongestTopic: string | null
  weakestTopic: string | null
}

export interface HostSessionView {
  session: LiveSession
  quizSet: QuizSet
  rankings: PlayerRanking[]
  teamRankings: TeamRanking[]
  questionStats: QuestionStats[]
  topicStats: TopicStat[]
  summary: SessionSummary
}

export interface PlayerQuestionView {
  id: string
  prompt: string
  choices: QuizChoice[]
  timeLimitSec: number
  questionNumber: number
  totalQuestions: number
  endsAt: string | null
  submittedChoiceId: string | null
}

export interface QuestionRevealView {
  questionId: string
  prompt: string
  choices: QuizChoice[]
  correctChoiceId: string
  explanation: string
  facilitatorPrompt: string
  distribution: Array<{
    choiceId: string
    text: string
    count: number
    isCorrect: boolean
  }>
  yourChoiceId: string | null
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
  reveal: QuestionRevealView | null
  leaderboard: {
    topPlayers: PlayerRanking[]
    topTeams: TeamRanking[]
    yourRank: number | null
    yourTeamRank: number | null
  }
  finalSummary: FinalSummaryView | null
  playerCount: number
}

export interface StoreShape {
  quizSets: QuizSet[]
  sessions: LiveSession[]
}
