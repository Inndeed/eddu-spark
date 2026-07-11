import { randomUUID } from 'node:crypto'

import type {
  FinalSummaryView,
  HostSessionView,
  LiveSession,
  Participant,
  PlayerRanking,
  PlayerSessionView,
  QuestionStats,
  QuizChoice,
  QuizQuestion,
  QuizSet,
  SessionSummary,
  Submission,
  TopicStat,
} from '../src/lib/types.js'
import { createServerSupabaseClient } from './supabase.js'

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_PLAYERS_PER_SESSION = 100
const DEFAULT_QUESTION_TIME_SEC = 15
const HOT_STREAK_BONUS = 100
const QUESTION_IMAGE_BUCKET = 'question-images'
const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

interface QuizSetRow {
  id: string
  title: string
  description: string
  category: string
  language: 'th'
  mode: QuizSet['mode']
  created_at: string
  updated_at: string
}

interface QuizQuestionRow {
  id: string
  quiz_set_id: string
  position: number
  prompt: string
  choices: QuizQuestion['choices']
  correct_choice_id: string
  time_limit_sec: number
  explanation: string
  facilitator_prompt: string
  theme_tag: string
  image_path?: string | null
  image_alt?: string | null
}

interface LiveSessionRow {
  id: string
  quiz_set_id: string
  quiz_set_title: string
  join_code: string
  status: LiveSession['status']
  show_leaderboard_every_round: boolean
  scoring_mode: LiveSession['scoringMode']
  created_at: string
  updated_at: string
  current_question_index: number
  last_closed_question_index: number | null
  question_started_at: string | null
  question_ends_at: string | null
}

interface ParticipantRow {
  id: string
  session_id: string
  display_name: string
  team_name: string
  joined_at: string
  score: number
  correct_answers: number
}

interface SubmissionRow {
  id: string
  session_id: string
  question_id: string
  participant_id: string
  selected_choice_id: string
  submitted_at: string
  response_ms: number
  is_correct: boolean
  points_awarded: number
}

const nowIso = () => new Date().toISOString()
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ')
const normalizeImageReference = (value: string | null | undefined) => value?.trim() || null
const isExternalImageUrl = (value: string) => /^https?:\/\//i.test(value)
const toId = () => randomUUID()

const buildJoinCode = () =>
  Array.from({ length: 6 }, () => {
    const index = Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)
    return JOIN_CODE_ALPHABET[index]
  }).join('')

const createChoice = (text: string): QuizChoice => ({
  id: toId(),
  text,
})

const createQuestion = (
  prompt: string,
  choices: [string, string, string, string],
  correctChoiceIndex: number,
  timeLimitSec: number,
  explanation: string,
  facilitatorPrompt: string,
  themeTag: string,
): QuizQuestion => {
  const mappedChoices = choices.map((choice) => createChoice(choice)) as [
    QuizChoice,
    QuizChoice,
    QuizChoice,
    QuizChoice,
  ]

  return {
    id: toId(),
    prompt,
    choices: mappedChoices,
    correctChoiceId: mappedChoices[correctChoiceIndex]?.id ?? mappedChoices[0].id,
    timeLimitSec: Math.min(timeLimitSec, DEFAULT_QUESTION_TIME_SEC),
    explanation,
    facilitatorPrompt,
    themeTag,
    imagePath: null,
    imageUrl: null,
    imageAlt: null,
  }
}

const seedQuizSets = (): QuizSet[] => {
  const timestamp = nowIso()

  return [
    {
      id: toId(),
      title: 'Eddu Quiz Demo',
      description: 'ชุดเดโมสำหรับเล่นสดใน workshop',
      category: 'Internal Learning',
      language: 'th',
      mode: 'knowledge_check',
      createdAt: timestamp,
      updatedAt: timestamp,
      questions: [
        createQuestion(
          'ใน workshop ที่ดี อะไรทำให้คนเอาไปใช้ต่อได้จริง',
          [
            'เนื้อหาเยอะที่สุด',
            'มี framework และ next action',
            'ใช้ศัพท์ยากให้ดู expert',
            'ใส่ animation เยอะ ๆ',
          ],
          1,
          15,
          'การเรียนรู้ที่นำไปใช้ต่อได้ ต้องมีทั้งโครงคิดและสิ่งที่ลงมือทำต่อได้ทันที',
          'ตอนนี้ class ไหนของเราควรเพิ่ม next action ให้ชัดขึ้น',
          'learning-design',
        ),
        createQuestion(
          'ถ้ายอดขายตก แต่ลูกค้าเดิมยังกลับมาซื้ออยู่ สิ่งที่ควรเช็กก่อนคืออะไร',
          [
            'เปลี่ยนโลโก้ทันที',
            'เร่งยิงแอดทุกช่อง',
            'ดู funnel และข้อเสนอที่หน้าซื้อ',
            'ลดราคาทุกสินค้า',
          ],
          2,
          15,
          'เมื่อฐานลูกค้าเดิมยังตอบสนอง ปัญหามักอยู่ที่ conversion หรือข้อเสนอในจุดซื้อ',
          'ทีมเราแยกได้ชัดพอหรือยังระหว่างปัญหา traffic กับปัญหา conversion',
          'decision-making',
        ),
        createQuestion(
          'ถ้าคนตอบผิดเยอะทั้งห้อง host ควรทำอะไรก่อน',
          [
            'ข้ามไปข้อถัดไป',
            'เฉลยทันทีโดยไม่ถามต่อ',
            'หยุดสั้น ๆ แล้วชวนถอด misconception',
            'ให้ติดลบเพื่อเร่งเกม',
          ],
          2,
          15,
          'คำตอบผิดจำนวนมากคือสัญญาณการเรียนรู้ ไม่ใช่แค่คะแนนที่ตกลง',
          'มีช่วงไหนในคลาสเราที่ควร debrief มากกว่าปล่อยผ่าน',
          'facilitation',
        ),
        createQuestion(
          'ถ้าต้องเลือกคำถามหนึ่งแบบสำหรับ game layer ในคลาส ควรเลือกแบบไหน',
          [
            'โจทย์ให้ตัดสินใจจากสถานการณ์จริง',
            'ท่องจำคำจำกัดความยาว ๆ',
            'ถามเรื่องที่ยังไม่สอน',
            'random trivia ไม่มีบริบท',
          ],
          0,
          15,
          'โจทย์ที่ดีควรสะท้อนการตัดสินใจจริง เพื่อเปิด discussion ต่อได้',
          'course ไหนของเราควรแปลงเป็น scenario question เพิ่ม',
          'scenario-thinking',
        ),
      ],
    },
  ]
}

const toQuestionTuple = (choices: QuizChoice[]) => {
  return choices as [QuizChoice, QuizChoice, QuizChoice, QuizChoice]
}

const parseBase64File = (base64: string) => {
  const match = base64.match(/^data:(.+);base64,(.+)$/)
  if (!match) {
    throw new Error('Invalid image payload')
  }

  const [, contentType, encoded] = match
  const extension = ALLOWED_IMAGE_TYPES.get(contentType)
  if (!extension) {
    throw new Error('รองรับเฉพาะไฟล์ JPG, PNG, หรือ WEBP')
  }

  return {
    contentType,
    extension,
    bytes: Buffer.from(encoded, 'base64'),
  }
}

export class SessionStore {
  private get supabase() {
    return createServerSupabaseClient()
  }

  async init() {
    await this.ensureQuestionImageBucket()

    const { count, error } = await this.supabase
      .from('quiz_sets')
      .select('id', { count: 'exact', head: true })

    if (error) {
      throw error
    }

    if ((count ?? 0) > 0) {
      return
    }

    const quizSets = seedQuizSets()
    const quizSetRows = quizSets.map((quizSet) => ({
      id: quizSet.id,
      title: quizSet.title,
      description: quizSet.description,
      category: quizSet.category,
      language: quizSet.language,
      mode: quizSet.mode,
      created_at: quizSet.createdAt,
      updated_at: quizSet.updatedAt,
    }))
    const questionRows = quizSets.flatMap((quizSet) =>
      quizSet.questions.map((question, position) => ({
        id: question.id,
        quiz_set_id: quizSet.id,
        position,
        prompt: question.prompt,
        choices: question.choices,
        correct_choice_id: question.correctChoiceId,
        time_limit_sec: question.timeLimitSec,
        explanation: question.explanation,
        facilitator_prompt: question.facilitatorPrompt,
        theme_tag: question.themeTag,
        image_path: question.imagePath,
        image_alt: question.imageAlt,
        created_at: quizSet.createdAt,
        updated_at: quizSet.updatedAt,
      })),
    )

    const { error: quizSetInsertError } = await this.supabase.from('quiz_sets').insert(quizSetRows)
    if (quizSetInsertError) {
      throw quizSetInsertError
    }

    const { error: questionInsertError } = await this.supabase
      .from('quiz_questions')
      .insert(questionRows)
    if (questionInsertError) {
      throw questionInsertError
    }
  }

  async uploadQuestionImage(base64File: string, altText: string) {
    await this.ensureQuestionImageBucket()
    const { bytes, contentType, extension } = parseBase64File(base64File)
    const path = `questions/${toId()}.${extension}`

    const { error } = await this.supabase.storage
      .from(QUESTION_IMAGE_BUCKET)
      .upload(path, bytes, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      throw error
    }

    return {
      imagePath: path,
      imageUrl: this.getQuestionImageUrl(path),
      imageAlt: normalizeText(altText) || null,
    }
  }

  async listQuizSets() {
    const { data: quizSetRows, error } = await this.supabase
      .from('quiz_sets')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      throw error
    }

    return clone(await this.hydrateQuizSets((quizSetRows ?? []) as QuizSetRow[]))
  }

  async upsertQuizSet(
    input: Omit<QuizSet, 'createdAt' | 'updatedAt'> & { createdAt?: string },
    createdBy?: string | null,
  ) {
    const title = normalizeText(input.title)
    if (!title) {
      throw new Error('Quiz set title is required')
    }

    if (input.questions.length === 0) {
      throw new Error('At least one question is required')
    }

    const questions = input.questions.map((question, index) =>
      this.validateQuestion(question, index),
    )
    const existingQuizSet = await this.getQuizSet(input.id)
    const timestamp = nowIso()

    const quizSetRow = {
      id: input.id || toId(),
      title,
      description: normalizeText(input.description),
      category: normalizeText(input.category) || 'Internal Learning',
      language: 'th' as const,
      mode: 'knowledge_check' as const,
      created_by: createdBy ?? null,
      created_at: existingQuizSet?.createdAt ?? input.createdAt ?? timestamp,
      updated_at: timestamp,
    }

    const { error: upsertError } = await this.supabase.from('quiz_sets').upsert(quizSetRow, {
      onConflict: 'id',
    })
    if (upsertError) {
      throw upsertError
    }

    const { error: deleteQuestionsError } = await this.supabase
      .from('quiz_questions')
      .delete()
      .eq('quiz_set_id', quizSetRow.id)
    if (deleteQuestionsError) {
      throw deleteQuestionsError
    }

    const questionRows = questions.map((question, position) => ({
      id: question.id || toId(),
      quiz_set_id: quizSetRow.id,
      position,
      prompt: question.prompt,
      choices: question.choices,
      correct_choice_id: question.correctChoiceId,
      time_limit_sec: question.timeLimitSec,
      explanation: question.explanation,
      facilitator_prompt: question.facilitatorPrompt,
      theme_tag: question.themeTag,
      image_path: question.imagePath,
      image_alt: question.imageAlt,
      created_at: timestamp,
      updated_at: timestamp,
    }))

    const { error: insertQuestionsError } = await this.supabase
      .from('quiz_questions')
      .insert(questionRows)
    if (insertQuestionsError) {
      throw insertQuestionsError
    }

    const quizSet = await this.getQuizSet(quizSetRow.id)
    if (!quizSet) {
      throw new Error('Quiz set not found')
    }

    return clone(quizSet)
  }

  async deleteQuizSet(quizSetId: string) {
    const quizSet = await this.getQuizSet(quizSetId)
    if (!quizSet) {
      throw new Error('Quiz set not found')
    }

    const { count, error: countError } = await this.supabase
      .from('live_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_set_id', quizSetId)

    if (countError) {
      throw countError
    }

    if ((count ?? 0) > 0) {
      throw new Error('ลบ Quiz นี้ไม่ได้ เพราะมี session ที่เคยใช้งานแล้ว')
    }

    const { error: deleteError } = await this.supabase
      .from('quiz_sets')
      .delete()
      .eq('id', quizSetId)

    if (deleteError) {
      throw deleteError
    }
  }

  async launchSession(quizSetId: string, createdBy?: string | null) {
    const quizSet = await this.getQuizSet(quizSetId)
    if (!quizSet) {
      throw new Error('Quiz set not found')
    }

    let joinCode = buildJoinCode()
    while (await this.sessionExistsForJoinCode(joinCode)) {
      joinCode = buildJoinCode()
    }

    const timestamp = nowIso()
    const sessionRow = {
      id: toId(),
      quiz_set_id: quizSet.id,
      quiz_set_title: quizSet.title,
      join_code: joinCode,
      status: 'lobby' as const,
      show_leaderboard_every_round: false,
      scoring_mode: 'correct_plus_speed' as const,
      created_by: createdBy ?? null,
      created_at: timestamp,
      updated_at: timestamp,
      current_question_index: -1,
      last_closed_question_index: null,
      question_started_at: null,
      question_ends_at: null,
    }

    const { error } = await this.supabase.from('live_sessions').insert(sessionRow)
    if (error) {
      throw error
    }

    const session = await this.loadSessionByJoinCode(joinCode)
    if (!session) {
      throw new Error('Session not found')
    }

    return clone(session)
  }

  async getQuizSet(quizSetId: string) {
    const { data: quizSetRows, error } = await this.supabase
      .from('quiz_sets')
      .select('*')
      .eq('id', quizSetId)
      .limit(1)

    if (error) {
      throw error
    }

    const quizSetRow = (quizSetRows?.[0] ?? null) as QuizSetRow | null
    if (!quizSetRow) {
      return null
    }

    const { data: questionRows, error: questionError } = await this.supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_set_id', quizSetId)
      .order('position', { ascending: true })

    if (questionError) {
      throw questionError
    }

    return this.mapQuizSet(quizSetRow, (questionRows ?? []) as QuizQuestionRow[])
  }

  async joinPlayer(joinCode: string, displayName: string) {
    const session = await this.loadSessionByJoinCode(joinCode)
    if (!session) {
      throw new Error('Session not found')
    }

    if (session.status === 'finished') {
      throw new Error('Session has ended')
    }

    if (session.participants.length >= MAX_PLAYERS_PER_SESSION) {
      throw new Error('ห้องนี้เต็มแล้ว (สูงสุด 100 คน)')
    }

    const normalizedName = normalizeText(displayName)
    if (!normalizedName) {
      throw new Error('กรุณาใส่ชื่อก่อนเข้าเล่น')
    }

    const existingParticipant = session.participants.find(
      (participant) => participant.displayName.toLowerCase() === normalizedName.toLowerCase(),
    )
    if (existingParticipant) {
      throw new Error('ชื่อนี้ถูกใช้ไปแล้ว')
    }

    const participantRow = {
      id: toId(),
      session_id: session.id,
      display_name: normalizedName,
      team_name: '',
      joined_at: nowIso(),
      score: 0,
      correct_answers: 0,
    }

    const { error } = await this.supabase.from('session_participants').insert(participantRow)
    if (error) {
      if ('code' in error && error.code === '23505') {
        throw new Error('ชื่อนี้ถูกใช้ไปแล้ว')
      }

      throw error
    }

    return this.mapParticipant(participantRow)
  }

  async submitAnswer(joinCode: string, participantId: string, selectedChoiceId: string) {
    const session = await this.loadSessionByJoinCode(joinCode)
    if (!session) {
      throw new Error('Session not found')
    }

    if (session.status !== 'question_open') {
      throw new Error('Question is not open')
    }

    const participant = session.participants.find((item) => item.id === participantId)
    if (!participant) {
      throw new Error('Participant not found')
    }

    const quizSet = await this.getQuizSet(session.quizSetId)
    const question = quizSet?.questions[session.currentQuestionIndex]
    if (!question) {
      throw new Error('Question not found')
    }

    const existingSubmission = session.submissions.find(
      (submission) =>
        submission.participantId === participantId && submission.questionId === question.id,
    )
    if (existingSubmission) {
      throw new Error('Duplicate submission')
    }

    const startedAt = Date.parse(session.questionStartedAt ?? nowIso())
    const timeLimitMs = question.timeLimitSec * 1000
    const responseMs = Math.max(0, Date.now() - startedAt)
    const isCorrect = question.correctChoiceId === selectedChoiceId
    const speedRatio = Math.max(0, 1 - responseMs / timeLimitMs)
    const streakBefore = this.getConsecutiveCorrectCount(
      session,
      quizSet,
      participantId,
      session.currentQuestionIndex - 1,
    )
    const streakBonus = isCorrect && streakBefore >= 1 ? HOT_STREAK_BONUS : 0
    const pointsAwarded = isCorrect ? 600 + Math.round(speedRatio * 400) + streakBonus : 0

    const submissionRow = {
      id: toId(),
      session_id: session.id,
      question_id: question.id,
      participant_id: participantId,
      selected_choice_id: selectedChoiceId,
      submitted_at: nowIso(),
      response_ms: responseMs,
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
    }

    const { error: insertSubmissionError } = await this.supabase
      .from('session_submissions')
      .insert(submissionRow)
    if (insertSubmissionError) {
      if ('code' in insertSubmissionError && insertSubmissionError.code === '23505') {
        throw new Error('Duplicate submission')
      }
      throw insertSubmissionError
    }

    const { error: updateParticipantError } = await this.supabase
      .from('session_participants')
      .update({
        score: participant.score + pointsAwarded,
        correct_answers: participant.correctAnswers + (isCorrect ? 1 : 0),
      })
      .eq('id', participant.id)
    if (updateParticipantError) {
      throw updateParticipantError
    }

    const answeredCountForQuestion =
      session.submissions.filter((submission) => submission.questionId === question.id).length + 1

    if (session.participants.length > 0 && answeredCountForQuestion >= session.participants.length) {
      const { error: closeError } = await this.supabase
        .from('live_sessions')
        .update(this.closeQuestion(session.currentQuestionIndex))
        .eq('id', session.id)
        .eq('status', 'question_open')

      if (closeError) {
        throw closeError
      }
    }

    return clone(this.mapSubmission(submissionRow))
  }

  async applyHostAction(joinCode: string, action: string) {
    const session = await this.loadSessionByJoinCode(joinCode)
    if (!session) {
      throw new Error('Session not found')
    }

    const quizSet = await this.getQuizSet(session.quizSetId)
    if (!quizSet) {
      throw new Error('Quiz set not found')
    }

    let nextPatch: Partial<LiveSessionRow> = {}

    if (action === 'advance') {
      nextPatch = this.openNextQuestion(session, quizSet)
    } else if (action === 'close_question') {
      if (session.status !== 'question_open') {
        throw new Error('No active question to close')
      }
      nextPatch = this.closeQuestion(session.currentQuestionIndex)
    } else if (action === 'show_leaderboard') {
      if (session.lastClosedQuestionIndex === null) {
        throw new Error('Leaderboard is unavailable before a question closes')
      }
      nextPatch = {
        status: 'leaderboard',
        question_started_at: null,
        question_ends_at: null,
        updated_at: nowIso(),
      }
    } else if (action === 'finish') {
      nextPatch = this.finishSession(session)
    } else {
      throw new Error('Unknown action')
    }

    const { error } = await this.supabase.from('live_sessions').update(nextPatch).eq('id', session.id)
    if (error) {
      throw error
    }

    const nextSession = await this.loadSessionByJoinCode(joinCode)
    if (!nextSession) {
      throw new Error('Session not found')
    }

    return clone(nextSession)
  }

  async tick() {
    const { data: sessionRows, error } = await this.supabase
      .from('live_sessions')
      .select('*')
      .eq('status', 'question_open')
      .lte('question_ends_at', nowIso())

    if (error) {
      throw error
    }

    const changedJoinCodes: string[] = []

    for (const sessionRow of (sessionRows ?? []) as LiveSessionRow[]) {
      const { error: updateError } = await this.supabase
        .from('live_sessions')
        .update(this.closeQuestion(sessionRow.current_question_index))
        .eq('id', sessionRow.id)

      if (updateError) {
        throw updateError
      }

      changedJoinCodes.push(sessionRow.join_code)
    }

    return changedJoinCodes
  }

  async buildHostView(joinCode: string): Promise<HostSessionView> {
    const session = await this.loadSessionByJoinCode(joinCode)
    if (!session) {
      throw new Error('Session not found')
    }

    const quizSet = await this.getQuizSet(session.quizSetId)
    if (!quizSet) {
      throw new Error('Quiz set not found')
    }

    const rankings = this.buildRankings(session, quizSet)
    const questionStats = this.buildQuestionStats(session, quizSet)
    const topicStats = this.buildTopicStats(questionStats)
    const summary = this.buildSummary(session, questionStats, topicStats)
    const currentQuestionSubmissionCount =
      session.currentQuestionIndex >= 0
        ? session.submissions.filter(
            (submission) =>
              submission.questionId === quizSet.questions[session.currentQuestionIndex]?.id,
          ).length
        : 0

    return clone({
      session,
      quizSet,
      rankings,
      questionStats,
      topicStats,
      summary,
      currentQuestionSubmissionCount,
    })
  }

  async buildPlayerView(joinCode: string, participantId: string): Promise<PlayerSessionView> {
    const session = await this.loadSessionByJoinCode(joinCode)
    if (!session) {
      throw new Error('Session not found')
    }

    const participant = session.participants.find((item) => item.id === participantId)
    if (!participant) {
      throw new Error('Participant not found')
    }

    const quizSet = await this.getQuizSet(session.quizSetId)
    if (!quizSet) {
      throw new Error('Quiz set not found')
    }

    const rankings = this.buildRankings(session, quizSet)
    const yourRank = rankings.find((item) => item.participantId === participantId)?.rank ?? null

    return clone({
      session: {
        id: session.id,
        joinCode: session.joinCode,
        quizSetTitle: session.quizSetTitle,
        status: session.status,
        showLeaderboardEveryRound: session.showLeaderboardEveryRound,
        currentQuestionIndex: session.currentQuestionIndex,
        lastClosedQuestionIndex: session.lastClosedQuestionIndex,
        questionStartedAt: session.questionStartedAt,
        questionEndsAt: session.questionEndsAt,
      },
      participant,
      currentQuestion:
        session.status === 'question_open'
          ? this.buildPlayerQuestionView(session, quizSet, participantId)
          : null,
      leaderboard: {
        topPlayers: rankings.slice(0, 8),
        yourRank,
      },
      finalSummary: session.status === 'finished' ? this.buildFinalSummary(session, quizSet) : null,
      playerCount: session.participants.length,
    })
  }

  private async ensureQuestionImageBucket() {
    const { data, error } = await this.supabase.storage.getBucket(QUESTION_IMAGE_BUCKET)
    if (!error && data) {
      return
    }

    const { error: createError } = await this.supabase.storage.createBucket(QUESTION_IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: '5MB',
      allowedMimeTypes: [...ALLOWED_IMAGE_TYPES.keys()],
    })

    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw createError
    }
  }

  private async sessionExistsForJoinCode(joinCode: string) {
    const { data, error } = await this.supabase
      .from('live_sessions')
      .select('id')
      .eq('join_code', joinCode)
      .limit(1)

    if (error) {
      throw error
    }

    return Boolean(data?.[0])
  }

  private async hydrateQuizSets(quizSetRows: QuizSetRow[]) {
    if (quizSetRows.length === 0) {
      return []
    }

    const quizSetIds = quizSetRows.map((quizSet) => quizSet.id)
    const { data: questionRows, error } = await this.supabase
      .from('quiz_questions')
      .select('*')
      .in('quiz_set_id', quizSetIds)
      .order('position', { ascending: true })

    if (error) {
      throw error
    }

    const mappedQuestionRows = (questionRows ?? []) as QuizQuestionRow[]
    return quizSetRows.map((quizSetRow) =>
      this.mapQuizSet(
        quizSetRow,
        mappedQuestionRows.filter((questionRow) => questionRow.quiz_set_id === quizSetRow.id),
      ),
    )
  }

  private async loadSessionByJoinCode(joinCode: string) {
    const { data: sessionRows, error } = await this.supabase
      .from('live_sessions')
      .select('*')
      .eq('join_code', joinCode.toUpperCase())
      .limit(1)

    if (error) {
      throw error
    }

    const sessionRow = (sessionRows?.[0] ?? null) as LiveSessionRow | null
    if (!sessionRow) {
      return null
    }

    return this.hydrateSession(sessionRow)
  }

  private async hydrateSession(sessionRow: LiveSessionRow) {
    const [participantsResult, submissionsResult] = await Promise.all([
      this.supabase
        .from('session_participants')
        .select('*')
        .eq('session_id', sessionRow.id)
        .order('joined_at', { ascending: true }),
      this.supabase
        .from('session_submissions')
        .select('*')
        .eq('session_id', sessionRow.id)
        .order('submitted_at', { ascending: true }),
    ])

    if (participantsResult.error) {
      throw participantsResult.error
    }

    if (submissionsResult.error) {
      throw submissionsResult.error
    }

    return this.mapSession(
      sessionRow,
      (participantsResult.data ?? []) as ParticipantRow[],
      (submissionsResult.data ?? []) as SubmissionRow[],
    )
  }

  private mapQuizSet(quizSetRow: QuizSetRow, questionRows: QuizQuestionRow[]): QuizSet {
    return {
      id: quizSetRow.id,
      title: quizSetRow.title,
      description: quizSetRow.description,
      category: quizSetRow.category,
      language: quizSetRow.language,
      mode: 'knowledge_check',
      createdAt: quizSetRow.created_at,
      updatedAt: quizSetRow.updated_at,
      questions: questionRows
        .sort((left, right) => left.position - right.position)
        .map((questionRow) => {
          const imagePath = questionRow.image_path ?? null
          return {
            id: questionRow.id,
            prompt: questionRow.prompt,
            choices: toQuestionTuple(questionRow.choices),
            correctChoiceId: questionRow.correct_choice_id,
            timeLimitSec: questionRow.time_limit_sec,
            explanation: questionRow.explanation,
            facilitatorPrompt: questionRow.facilitator_prompt,
            themeTag: questionRow.theme_tag,
            imagePath,
            imageUrl: imagePath ? this.getQuestionImageUrl(imagePath) : null,
            imageAlt: questionRow.image_alt ?? null,
          }
        }),
    }
  }

  private mapSession(
    sessionRow: LiveSessionRow,
    participantRows: ParticipantRow[],
    submissionRows: SubmissionRow[],
  ): LiveSession {
    return {
      id: sessionRow.id,
      quizSetId: sessionRow.quiz_set_id,
      quizSetTitle: sessionRow.quiz_set_title,
      joinCode: sessionRow.join_code,
      status: sessionRow.status,
      showLeaderboardEveryRound: sessionRow.show_leaderboard_every_round,
      scoringMode: sessionRow.scoring_mode,
      createdAt: sessionRow.created_at,
      updatedAt: sessionRow.updated_at,
      currentQuestionIndex: sessionRow.current_question_index,
      lastClosedQuestionIndex: sessionRow.last_closed_question_index,
      questionStartedAt: sessionRow.question_started_at,
      questionEndsAt: sessionRow.question_ends_at,
      participants: participantRows.map((row) => this.mapParticipant(row)),
      submissions: submissionRows.map((row) => this.mapSubmission(row)),
    }
  }

  private mapParticipant(row: ParticipantRow): Participant {
    return {
      id: row.id,
      displayName: row.display_name,
      joinedAt: row.joined_at,
      score: row.score,
      correctAnswers: row.correct_answers,
    }
  }

  private mapSubmission(row: SubmissionRow): Submission {
    return {
      id: row.id,
      questionId: row.question_id,
      participantId: row.participant_id,
      selectedChoiceId: row.selected_choice_id,
      submittedAt: row.submitted_at,
      responseMs: row.response_ms,
      isCorrect: row.is_correct,
      pointsAwarded: row.points_awarded,
    }
  }

  private validateQuestion(question: QuizQuestion, index: number): QuizQuestion {
    const prompt = normalizeText(question.prompt)
    const explanation = normalizeText(question.explanation)
    const facilitatorPrompt = normalizeText(question.facilitatorPrompt)
    const themeTag = normalizeText(question.themeTag) || 'general'
    const imageAlt = normalizeText(question.imageAlt ?? '')
    const imagePath = normalizeImageReference(question.imagePath)
    const choices = question.choices.map((choice) => ({
      id: choice.id || toId(),
      text: normalizeText(choice.text),
    }))

    if (!prompt) {
      throw new Error(`Question ${index + 1} is missing a prompt`)
    }

    if (choices.length !== 4 || choices.some((choice) => !choice.text)) {
      throw new Error(`Question ${index + 1} must have exactly four choices`)
    }

    if (imagePath && imagePath.includes('://') && !isExternalImageUrl(imagePath)) {
      throw new Error(`Question ${index + 1} has an invalid image URL`)
    }

    const correctChoiceId = choices.some((choice) => choice.id === question.correctChoiceId)
      ? question.correctChoiceId
      : choices[0].id

    return {
      id: question.id || toId(),
      prompt,
      choices: toQuestionTuple(choices),
      correctChoiceId,
      timeLimitSec: Math.max(10, Math.min(DEFAULT_QUESTION_TIME_SEC, question.timeLimitSec || DEFAULT_QUESTION_TIME_SEC)),
      explanation,
      facilitatorPrompt,
      themeTag,
      imagePath,
      imageUrl: imagePath ? this.getQuestionImageUrl(imagePath) : null,
      imageAlt: imageAlt || null,
    }
  }

  private openNextQuestion(session: LiveSession, quizSet: QuizSet): Partial<LiveSessionRow> {
    if (session.status === 'finished') {
      throw new Error('Session has already finished')
    }

    const nextIndex = session.currentQuestionIndex < 0 ? 0 : session.currentQuestionIndex + 1
    if (nextIndex >= quizSet.questions.length) {
      return this.finishSession(session)
    }

    const nextQuestion = quizSet.questions[nextIndex]
    const startedAt = Date.now()

    return {
      status: 'question_open',
      current_question_index: nextIndex,
      question_started_at: new Date(startedAt).toISOString(),
      question_ends_at: new Date(startedAt + Math.min(nextQuestion.timeLimitSec, DEFAULT_QUESTION_TIME_SEC) * 1000).toISOString(),
      updated_at: nowIso(),
    }
  }

  private closeQuestion(currentQuestionIndex: number): Partial<LiveSessionRow> {
    return {
      status: 'question_closed',
      last_closed_question_index: currentQuestionIndex,
      question_started_at: null,
      question_ends_at: null,
      updated_at: nowIso(),
    }
  }

  private finishSession(session: LiveSession): Partial<LiveSessionRow> {
    return {
      status: 'finished',
      question_started_at: null,
      question_ends_at: null,
      last_closed_question_index:
        session.currentQuestionIndex >= 0
          ? Math.max(session.lastClosedQuestionIndex ?? 0, session.currentQuestionIndex)
          : session.lastClosedQuestionIndex,
      updated_at: nowIso(),
    }
  }

  private buildRankings(session: LiveSession, quizSet: QuizSet): PlayerRanking[] {
    return [...session.participants]
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }

        if (right.correctAnswers !== left.correctAnswers) {
          return right.correctAnswers - left.correctAnswers
        }

        return left.joinedAt.localeCompare(right.joinedAt)
      })
      .map((participant, index) => ({
        participantId: participant.id,
        displayName: participant.displayName,
        score: participant.score,
        correctAnswers: participant.correctAnswers,
        currentStreak: this.getCurrentStreak(session, quizSet, participant.id),
        rank: index + 1,
      }))
  }

  private buildQuestionStats(session: LiveSession, quizSet: QuizSet): QuestionStats[] {
    return quizSet.questions.map((question) => {
      const submissions = session.submissions.filter(
        (submission) => submission.questionId === question.id,
      )
      const correctCount = submissions.filter((submission) => submission.isCorrect).length
      const distribution = question.choices.map((choice) => ({
        choiceId: choice.id,
        text: choice.text,
        count: submissions.filter((submission) => submission.selectedChoiceId === choice.id).length,
        isCorrect: choice.id === question.correctChoiceId,
      }))
      const averagePoints =
        submissions.length === 0
          ? 0
          : Math.round(
              submissions.reduce((total, submission) => total + submission.pointsAwarded, 0) /
                submissions.length,
            )

      return {
        questionId: question.id,
        prompt: question.prompt,
        themeTag: question.themeTag,
        totalSubmissions: submissions.length,
        correctCount,
        accuracyRate:
          submissions.length === 0 ? 0 : Number((correctCount / submissions.length).toFixed(2)),
        averagePoints,
        distribution,
      }
    })
  }

  private buildTopicStats(questionStats: QuestionStats[]): TopicStat[] {
    const topicMap = new Map<string, { totalQuestions: number; accuracySum: number }>()

    for (const stat of questionStats) {
      const current = topicMap.get(stat.themeTag) ?? { totalQuestions: 0, accuracySum: 0 }
      current.totalQuestions += 1
      current.accuracySum += stat.accuracyRate
      topicMap.set(stat.themeTag, current)
    }

    return [...topicMap.entries()].map(([themeTag, value]) => ({
      themeTag,
      totalQuestions: value.totalQuestions,
      accuracyRate: Number((value.accuracySum / value.totalQuestions).toFixed(2)),
    }))
  }

  private buildSummary(
    session: LiveSession,
    questionStats: QuestionStats[],
    topicStats: TopicStat[],
  ): SessionSummary {
    const hardestQuestion =
      [...questionStats].sort((left, right) => left.accuracyRate - right.accuracyRate)[0]?.prompt ??
      null
    const strongestTopic =
      [...topicStats].sort((left, right) => right.accuracyRate - left.accuracyRate)[0]?.themeTag ??
      null
    const weakestTopic =
      [...topicStats].sort((left, right) => left.accuracyRate - right.accuracyRate)[0]?.themeTag ??
      null

    return {
      totalParticipants: session.participants.length,
      hardestQuestion,
      strongestTopic,
      weakestTopic,
    }
  }

  private buildPlayerQuestionView(session: LiveSession, quizSet: QuizSet, participantId: string) {
    const question = quizSet.questions[session.currentQuestionIndex]
    if (!question) {
      return null
    }

    const existingSubmission = session.submissions.find(
      (submission) =>
        submission.participantId === participantId && submission.questionId === question.id,
    )

    return {
      id: question.id,
      prompt: question.prompt,
      questionNumber: session.currentQuestionIndex + 1,
      totalQuestions: quizSet.questions.length,
      endsAt: session.questionEndsAt,
      submittedChoiceId: existingSubmission?.selectedChoiceId ?? null,
      choiceIds: question.choices.map((choice) => choice.id) as [string, string, string, string],
    }
  }

  private buildFinalSummary(session: LiveSession, quizSet: QuizSet): FinalSummaryView {
    const questionStats = this.buildQuestionStats(session, quizSet)
    const topicStats = this.buildTopicStats(questionStats)
    const summary = this.buildSummary(session, questionStats, topicStats)

    return {
      hardestQuestion: summary.hardestQuestion,
      strongestTopic: summary.strongestTopic,
      weakestTopic: summary.weakestTopic,
    }
  }

  private getConsecutiveCorrectCount(
    session: LiveSession,
    quizSet: QuizSet,
    participantId: string,
    endQuestionIndex: number,
  ) {
    if (endQuestionIndex < 0) {
      return 0
    }

    let streak = 0

    for (let questionIndex = endQuestionIndex; questionIndex >= 0; questionIndex -= 1) {
      const questionId = quizSet.questions[questionIndex]?.id
      if (!questionId) {
        break
      }

      const submission = session.submissions.find(
        (item) => item.participantId === participantId && item.questionId === questionId,
      )

      if (!submission?.isCorrect) {
        break
      }

      streak += 1
    }

    return streak
  }

  private getCurrentStreak(session: LiveSession, quizSet: QuizSet, participantId: string) {
    return this.getConsecutiveCorrectCount(
      session,
      quizSet,
      participantId,
      Math.max(session.lastClosedQuestionIndex ?? session.currentQuestionIndex, session.currentQuestionIndex),
    )
  }

  private getQuestionImageUrl(path: string) {
    if (isExternalImageUrl(path)) {
      return path
    }

    const {
      data: { publicUrl },
    } = this.supabase.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(path)

    return publicUrl
  }
}
