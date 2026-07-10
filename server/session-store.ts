import { randomUUID } from 'node:crypto'

import type {
  FinalSummaryView,
  HostSessionView,
  LiveSession,
  Participant,
  PlayerRanking,
  PlayerSessionView,
  QuestionStats,
  QuizQuestion,
  QuizSet,
  SessionSummary,
  Submission,
  TeamRanking,
  TopicStat,
} from '../src/lib/types.js'
import { createServerSupabaseClient } from './supabase.js'

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

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

const toId = () => randomUUID()

const buildJoinCode = () =>
  Array.from({ length: 6 }, () => {
    const index = Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)
    return JOIN_CODE_ALPHABET[index]
  }).join('')

const createChoice = (text: string) => ({
  id: toId(),
  text,
})

const createQuestion = (
  prompt: string,
  choices: string[],
  correctChoiceIndex: number,
  timeLimitSec: number,
  explanation: string,
  facilitatorPrompt: string,
  themeTag: string,
): QuizQuestion => {
  const mappedChoices = choices.map((choice) => createChoice(choice))

  return {
    id: toId(),
    prompt,
    choices: mappedChoices,
    correctChoiceId: mappedChoices[correctChoiceIndex]?.id ?? mappedChoices[0].id,
    timeLimitSec,
    explanation,
    facilitatorPrompt,
    themeTag,
  }
}

const seedQuizSets = (): QuizSet[] => {
  const timestamp = nowIso()

  return [
    {
      id: toId(),
      title: 'EDDU Spark Fundamentals',
      description:
        'เกม warm-up สำหรับเช็กความเข้าใจเรื่อง workshop design, learning activation, และ internal product thinking',
      category: 'Internal Learning',
      language: 'th',
      mode: 'knowledge_check',
      createdAt: timestamp,
      updatedAt: timestamp,
      questions: [
        createQuestion(
          'ถ้าเราอยากให้ผู้เรียน “เอาไปใช้ต่อได้จริง” องค์ประกอบไหนสำคัญที่สุดใน 1-Day course',
          [
            'ใส่เนื้อหาให้เยอะที่สุดในหนึ่งวัน',
            'มี framework + workshop + next action ที่ชัด',
            'ใช้ศัพท์เท่ ๆ เพื่อให้ดู expert',
            'เพิ่ม slide animation ให้จำง่าย',
          ],
          1,
          20,
          'การเรียนรู้ที่แปลเป็นการใช้งานจริงต้องมีทั้งโครงคิด กิจกรรม และสิ่งที่เอากลับไปทำต่อได้',
          'ใน course ปัจจุบันของทีม มีจุดไหนที่ยังเป็น content-heavy แต่ activation ยังไม่พอ',
          'learning-design',
        ),
        createQuestion(
          'สำหรับ SME audience สิ่งที่ควรหลีกเลี่ยงมากที่สุดเวลาออกแบบ content คืออะไร',
          [
            'เริ่มจาก problem จริงของเจ้าของธุรกิจ',
            'พูด framework แบบ abstract โดยไม่มีตัวอย่างใช้จริง',
            'ใช้ case ที่ใกล้เคียงบริบทธุรกิจไทย',
            'ปิดท้ายด้วย checklist ที่ทำต่อได้',
          ],
          1,
          18,
          'SMEs ต้องการสิ่งที่ connect กับบริบทจริง ไม่ใช่ framework ลอย ๆ ที่ไม่รู้เอาไปใช้ตรงไหน',
          'ทีมเราเคยมีเนื้อหาส่วนไหนที่ “ดูดีแต่ใช้ยาก” แล้วจะแก้ยังไง',
          'audience-fit',
        ),
        createQuestion(
          'ถ้าจะใช้ game layer ระหว่าง workshop เป้าหมายที่ดีที่สุดคืออะไร',
          [
            'ทำให้คนแข่งกันอย่างเดียว',
            'ช่วยให้ผู้สอนรู้ทันทีว่าจุดไหนคนยังไม่เข้าใจ',
            'ยืดเวลา session ให้ดูแน่น',
            'ใช้แทน workshop discussion ทั้งหมด',
          ],
          1,
          18,
          'Game ที่ดีใน workshop คือเครื่องมือทำให้เห็น understanding gap และเปิดบทสนทนาต่อ ไม่ใช่จบที่ความสนุก',
          'ถ้าเอา Spark ไปแทรกใน class จริง เราควรใช้มันช่วงไหนเพื่อสร้าง learning value สูงสุด',
          'engagement',
        ),
        createQuestion(
          'โจทย์ไหนสะท้อน “scenario sprint” ได้เหมาะที่สุดสำหรับ EDDU',
          [
            'ท่องจำ definition ของ marketing 8 ข้อ',
            'เลือก action ที่ควรทำก่อนเมื่อ SME ยอดขายตกแต่ลูกค้าเดิมยังมี',
            'ถามสีที่ชอบใน slide deck',
            'จับผิดคำสะกดภาษาอังกฤษ',
          ],
          1,
          22,
          'Scenario sprint ควรพาผู้เรียนใช้ judgment กับ business situation จริง ไม่ใช่แค่ท่องจำหรือ trivia',
          'ในแต่ละ course ของเรา มี scenario ไหนที่ควรเอามาแปลงเป็น decision game ได้บ้าง',
          'scenario-thinking',
        ),
      ],
    },
    {
      id: toId(),
      title: 'Facilitator Pulse Check',
      description:
        'เกมสำหรับทีมผู้นำ workshop เพื่อตรวจ readiness เรื่องการ facilitation, reflection, และ debrief',
      category: 'Facilitation',
      language: 'th',
      mode: 'scenario_sprint',
      createdAt: timestamp,
      updatedAt: timestamp,
      questions: [
        createQuestion(
          'เมื่อ participant ตอบผิดเยอะทั้งห้อง สิ่งที่ host ควรทำก่อนคืออะไร',
          [
            'ข้ามไปข้อถัดไปทันทีเพื่อรักษา pace',
            'เฉลยเลยโดยไม่ถามอะไรเพิ่ม',
            'pause สั้น ๆ แล้วชวนถอดว่า misconception อยู่ตรงไหน',
            'ให้คะแนนติดลบเพื่อกระตุ้น',
          ],
          2,
          20,
          'คำตอบผิดจำนวนมากคือสัญญาณของ insight ไม่ใช่ failure ของห้องเรียน การ debrief คือจุดที่เปลี่ยนข้อมูลเป็นการเรียนรู้',
          'ทีมเรามีวิธี debrief ที่สม่ำเสมอพอหรือยังเวลาคนส่วนใหญ่เข้าใจไม่ตรงกัน',
          'facilitation',
        ),
        createQuestion(
          'leaderboard ควรถูกใช้แบบไหนถึงจะไม่กดดันคนเกินไปในบริบท internal',
          [
            'เปิดรายชื่อเต็มทุกข้อโดยไม่มีทางเลือก',
            'ใช้เป็นช่วง checkpoint และเน้น team momentum ด้วย',
            'แสดงแต่คนที่ได้ศูนย์คะแนน',
            'ซ่อนคะแนนทั้งหมดแล้วเหลือแต่ confetti',
          ],
          1,
          18,
          'ในบริบท internal เกมควรช่วยสร้างพลัง ไม่ใช่ทำให้คนไม่กล้าเล่น การใช้ leaderboard แบบเป็น checkpoint จะบาลานซ์กว่า',
          'session แบบไหนควรเน้น team ranking มากกว่า individual ranking',
          'psychological-safety',
        ),
        createQuestion(
          'ถ้าอยากใช้ Spark เพื่อเก็บ signal หลังจบ module สิ่งที่ควรถามคืออะไร',
          [
            'คำถามที่วัดว่าใครจำ definition ได้แม่นที่สุดอย่างเดียว',
            'คำถามที่บังคับให้เลือก action หรือ principle ที่จะนำไปใช้ต่อ',
            'คำถามที่ random เพื่อให้สนุก',
            'ถามเรื่องที่ยังไม่ได้สอนใน session',
          ],
          1,
          20,
          'ถ้าเป้าหมายคือ application คำถามต้องเชื่อมกลับไปที่การตัดสินใจหรือการนำ framework ไปใช้จริง',
          'ตอนนี้ทีมเราวัดแค่ recall หรือวัด readiness to apply ด้วย',
          'application',
        ),
      ],
    },
  ]
}

export class SessionStore {
  private get supabase() {
    return createServerSupabaseClient()
  }

  async init() {
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
        created_at: quizSet.createdAt,
        updated_at: quizSet.updatedAt,
      })),
    )

    const { error: quizSetInsertError } = await this.supabase
      .from('quiz_sets')
      .insert(quizSetRows)

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

  async listRecentSessions() {
    const { data: sessionRows, error } = await this.supabase
      .from('live_sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(8)

    if (error) {
      throw error
    }

    const summaries = await Promise.all(
      ((sessionRows ?? []) as LiveSessionRow[]).map(async (sessionRow) => {
        const { count, error: countError } = await this.supabase
          .from('session_participants')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', sessionRow.id)

        if (countError) {
          throw countError
        }

        return {
          id: sessionRow.id,
          joinCode: sessionRow.join_code,
          quizSetTitle: sessionRow.quiz_set_title,
          status: sessionRow.status,
          createdAt: sessionRow.created_at,
          updatedAt: sessionRow.updated_at,
          participantCount: count ?? 0,
        }
      }),
    )

    return clone(summaries)
  }

  async upsertQuizSet(
    input: Omit<QuizSet, 'createdAt' | 'updatedAt'> & {
      createdAt?: string
    },
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
      mode: input.mode,
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

  async launchSession(
    quizSetId: string,
    showLeaderboardEveryRound: boolean,
    createdBy?: string | null,
  ) {
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
      show_leaderboard_every_round: showLeaderboardEveryRound,
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

  async joinPlayer(joinCode: string, displayName: string, teamName: string) {
    const session = await this.loadSessionByJoinCode(joinCode)
    if (!session) {
      throw new Error('Session not found')
    }

    if (session.status === 'finished') {
      throw new Error('Session has ended')
    }

    const normalizedName = normalizeText(displayName)
    const normalizedTeam = normalizeText(teamName)

    if (!normalizedName || !normalizedTeam) {
      throw new Error('Name and team are required')
    }

    const existingParticipant = session.participants.find(
      (participant) =>
        participant.displayName.toLowerCase() === normalizedName.toLowerCase() &&
        participant.teamName.toLowerCase() === normalizedTeam.toLowerCase(),
    )

    if (existingParticipant) {
      return clone(existingParticipant)
    }

    const participantRow = {
      id: toId(),
      session_id: session.id,
      display_name: normalizedName,
      team_name: normalizedTeam,
      joined_at: nowIso(),
      score: 0,
      correct_answers: 0,
    }

    const { error } = await this.supabase.from('session_participants').insert(participantRow)

    if (error) {
      if ('code' in error && error.code === '23505') {
        const latestSession = await this.loadSessionByJoinCode(joinCode)
        const participant = latestSession?.participants.find(
          (item) =>
            item.displayName.toLowerCase() === normalizedName.toLowerCase() &&
            item.teamName.toLowerCase() === normalizedTeam.toLowerCase(),
        )
        if (participant) {
          return clone(participant)
        }
      }

      throw error
    }

    return this.mapParticipant(participantRow)
  }

  async submitAnswer(
    joinCode: string,
    participantId: string,
    selectedChoiceId: string,
  ) {
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
        submission.participantId === participantId &&
        submission.questionId === question.id,
    )

    if (existingSubmission) {
      throw new Error('Duplicate submission')
    }

    const startedAt = Date.parse(session.questionStartedAt ?? nowIso())
    const timeLimitMs = question.timeLimitSec * 1000
    const responseMs = Math.max(0, Date.now() - startedAt)
    const isCorrect = question.correctChoiceId === selectedChoiceId
    const speedRatio = Math.max(0, 1 - responseMs / timeLimitMs)
    const pointsAwarded = isCorrect ? 600 + Math.round(speedRatio * 400) : 0

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

    const { error } = await this.supabase
      .from('live_sessions')
      .update(nextPatch)
      .eq('id', session.id)

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

    const rankings = this.buildRankings(session)
    const teamRankings = this.buildTeamRankings(session)
    const questionStats = this.buildQuestionStats(session, quizSet)
    const topicStats = this.buildTopicStats(questionStats)
    const summary = this.buildSummary(session, questionStats, topicStats)

    return clone({
      session,
      quizSet,
      rankings,
      teamRankings,
      questionStats,
      topicStats,
      summary,
    })
  }

  async buildPlayerView(
    joinCode: string,
    participantId: string,
  ): Promise<PlayerSessionView> {
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

    const rankings = this.buildRankings(session)
    const teamRankings = this.buildTeamRankings(session)
    const yourRank =
      rankings.find((item) => item.participantId === participantId)?.rank ?? null
    const yourTeamRank =
      teamRankings.find((item) => item.teamName === participant.teamName)?.rank ?? null

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
      reveal:
        session.lastClosedQuestionIndex !== null && session.status !== 'question_open'
          ? this.buildRevealView(session, quizSet, participantId)
          : null,
      leaderboard: {
        topPlayers: rankings.slice(0, 8),
        topTeams: teamRankings.slice(0, 5),
        yourRank,
        yourTeamRank,
      },
      finalSummary:
        session.status === 'finished'
          ? this.buildFinalSummary(session, quizSet)
          : null,
      playerCount: session.participants.length,
    })
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
      mode: quizSetRow.mode,
      createdAt: quizSetRow.created_at,
      updatedAt: quizSetRow.updated_at,
      questions: questionRows
        .sort((left, right) => left.position - right.position)
        .map((questionRow) => ({
          id: questionRow.id,
          prompt: questionRow.prompt,
          choices: questionRow.choices,
          correctChoiceId: questionRow.correct_choice_id,
          timeLimitSec: questionRow.time_limit_sec,
          explanation: questionRow.explanation,
          facilitatorPrompt: questionRow.facilitator_prompt,
          themeTag: questionRow.theme_tag,
        })),
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
      teamName: row.team_name,
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
    const choices = question.choices
      .map((choice) => ({
        id: choice.id || toId(),
        text: normalizeText(choice.text),
      }))
      .filter((choice) => choice.text.length > 0)

    if (!prompt) {
      throw new Error(`Question ${index + 1} is missing a prompt`)
    }

    if (choices.length < 2) {
      throw new Error(`Question ${index + 1} needs at least two choices`)
    }

    const correctChoiceId = choices.some((choice) => choice.id === question.correctChoiceId)
      ? question.correctChoiceId
      : choices[0].id

    return {
      id: question.id || toId(),
      prompt,
      choices,
      correctChoiceId,
      timeLimitSec: Math.max(10, Math.min(60, question.timeLimitSec || 20)),
      explanation,
      facilitatorPrompt,
      themeTag,
    }
  }

  private openNextQuestion(session: LiveSession, quizSet: QuizSet): Partial<LiveSessionRow> {
    if (session.status === 'finished') {
      throw new Error('Session has already finished')
    }

    const nextIndex =
      session.currentQuestionIndex < 0 ? 0 : session.currentQuestionIndex + 1

    if (nextIndex >= quizSet.questions.length) {
      return this.finishSession(session)
    }

    const nextQuestion = quizSet.questions[nextIndex]
    const startedAt = Date.now()

    return {
      status: 'question_open',
      current_question_index: nextIndex,
      question_started_at: new Date(startedAt).toISOString(),
      question_ends_at: new Date(
        startedAt + nextQuestion.timeLimitSec * 1000,
      ).toISOString(),
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
          ? Math.max(
              session.lastClosedQuestionIndex ?? 0,
              session.currentQuestionIndex,
            )
          : session.lastClosedQuestionIndex,
      updated_at: nowIso(),
    }
  }

  private buildRankings(session: LiveSession): PlayerRanking[] {
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
        teamName: participant.teamName,
        score: participant.score,
        correctAnswers: participant.correctAnswers,
        rank: index + 1,
      }))
  }

  private buildTeamRankings(session: LiveSession): TeamRanking[] {
    const teamMap = new Map<
      string,
      { score: number; members: number; correctAnswers: number }
    >()

    for (const participant of session.participants) {
      const current = teamMap.get(participant.teamName) ?? {
        score: 0,
        members: 0,
        correctAnswers: 0,
      }
      current.score += participant.score
      current.members += 1
      current.correctAnswers += participant.correctAnswers
      teamMap.set(participant.teamName, current)
    }

    return [...teamMap.entries()]
      .map(([teamName, stats]) => ({ teamName, ...stats }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }

        return right.correctAnswers - left.correctAnswers
      })
      .map((team, index) => ({
        ...team,
        rank: index + 1,
      }))
  }

  private buildQuestionStats(
    session: LiveSession,
    quizSet: QuizSet,
  ): QuestionStats[] {
    return quizSet.questions.map((question) => {
      const submissions = session.submissions.filter(
        (submission) => submission.questionId === question.id,
      )
      const correctCount = submissions.filter((submission) => submission.isCorrect).length
      const distribution = question.choices.map((choice) => ({
        choiceId: choice.id,
        text: choice.text,
        count: submissions.filter(
          (submission) => submission.selectedChoiceId === choice.id,
        ).length,
      }))
      const averagePoints =
        submissions.length === 0
          ? 0
          : Math.round(
              submissions.reduce(
                (total, submission) => total + submission.pointsAwarded,
                0,
              ) / submissions.length,
            )

      return {
        questionId: question.id,
        prompt: question.prompt,
        themeTag: question.themeTag,
        totalSubmissions: submissions.length,
        correctCount,
        accuracyRate:
          submissions.length === 0
            ? 0
            : Number((correctCount / submissions.length).toFixed(2)),
        averagePoints,
        distribution,
      }
    })
  }

  private buildTopicStats(questionStats: QuestionStats[]): TopicStat[] {
    const topicMap = new Map<string, { totalQuestions: number; accuracySum: number }>()

    for (const stat of questionStats) {
      const current = topicMap.get(stat.themeTag) ?? {
        totalQuestions: 0,
        accuracySum: 0,
      }
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
      [...questionStats].sort((left, right) => left.accuracyRate - right.accuracyRate)[0]
        ?.prompt ?? null
    const strongestTopic =
      [...topicStats].sort((left, right) => right.accuracyRate - left.accuracyRate)[0]
        ?.themeTag ?? null
    const weakestTopic =
      [...topicStats].sort((left, right) => left.accuracyRate - right.accuracyRate)[0]
        ?.themeTag ?? null

    return {
      totalParticipants: session.participants.length,
      totalTeams: new Set(session.participants.map((participant) => participant.teamName))
        .size,
      hardestQuestion,
      strongestTopic,
      weakestTopic,
    }
  }

  private buildPlayerQuestionView(
    session: LiveSession,
    quizSet: QuizSet,
    participantId: string,
  ) {
    const question = quizSet.questions[session.currentQuestionIndex]
    if (!question) {
      return null
    }

    const existingSubmission = session.submissions.find(
      (submission) =>
        submission.participantId === participantId &&
        submission.questionId === question.id,
    )

    return {
      id: question.id,
      prompt: question.prompt,
      choices: question.choices,
      timeLimitSec: question.timeLimitSec,
      questionNumber: session.currentQuestionIndex + 1,
      totalQuestions: quizSet.questions.length,
      endsAt: session.questionEndsAt,
      submittedChoiceId: existingSubmission?.selectedChoiceId ?? null,
    }
  }

  private buildRevealView(
    session: LiveSession,
    quizSet: QuizSet,
    participantId: string,
  ) {
    const question = quizSet.questions[session.lastClosedQuestionIndex ?? -1]
    if (!question) {
      return null
    }

    const submissions = session.submissions.filter(
      (submission) => submission.questionId === question.id,
    )
    const yourSubmission = submissions.find(
      (submission) => submission.participantId === participantId,
    )

    return {
      questionId: question.id,
      prompt: question.prompt,
      choices: question.choices,
      correctChoiceId: question.correctChoiceId,
      explanation: question.explanation,
      facilitatorPrompt: question.facilitatorPrompt,
      distribution: question.choices.map((choice) => ({
        choiceId: choice.id,
        text: choice.text,
        count: submissions.filter(
          (submission) => submission.selectedChoiceId === choice.id,
        ).length,
        isCorrect: choice.id === question.correctChoiceId,
      })),
      yourChoiceId: yourSubmission?.selectedChoiceId ?? null,
    }
  }

  private buildFinalSummary(
    session: LiveSession,
    quizSet: QuizSet,
  ): FinalSummaryView {
    const questionStats = this.buildQuestionStats(session, quizSet)
    const topicStats = this.buildTopicStats(questionStats)
    const summary = this.buildSummary(session, questionStats, topicStats)

    return {
      hardestQuestion: summary.hardestQuestion,
      strongestTopic: summary.strongestTopic,
      weakestTopic: summary.weakestTopic,
    }
  }
}
