import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  fetchAppHealth,
  fetchHostBootstrap,
  launchSession,
  saveQuizSet,
  type AppHealthData,
  type HostBootstrapData,
} from '../lib/api'
import { formatDateTime, modeLabel, statusLabel } from '../lib/format'
import {
  signInHostWithPassword,
  signOutHostSession,
} from '../lib/supabase'
import { useHostSession } from '../lib/use-host-session'
import type { QuizMode, QuizQuestion, QuizSet } from '../lib/types'

type QuizDraft = Omit<QuizSet, 'createdAt' | 'updatedAt'>

const createChoice = (text = '') => ({
  id: crypto.randomUUID(),
  text,
})

const createQuestion = (): QuizQuestion => {
  const firstChoice = createChoice()

  return {
    id: crypto.randomUUID(),
    prompt: '',
    choices: [firstChoice, createChoice(), createChoice(), createChoice()],
    correctChoiceId: firstChoice.id,
    timeLimitSec: 20,
    explanation: '',
    facilitatorPrompt: '',
    themeTag: 'learning-design',
  }
}

const createDraft = (): QuizDraft => ({
  id: crypto.randomUUID(),
  title: '',
  description: '',
  category: 'Internal Learning',
  language: 'th',
  mode: 'knowledge_check',
  questions: [createQuestion()],
})

const toDraft = (quizSet: QuizSet): QuizDraft => ({
  id: quizSet.id,
  title: quizSet.title,
  description: quizSet.description,
  category: quizSet.category,
  language: quizSet.language,
  mode: quizSet.mode,
  questions: quizSet.questions,
})

export function HostPage() {
  const navigate = useNavigate()
  const { configured, session, ready, error: sessionError } = useHostSession()
  const [appHealth, setAppHealth] = useState<AppHealthData | null>(null)
  const [bootstrap, setBootstrap] = useState<HostBootstrapData | null>(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [draft, setDraft] = useState<QuizDraft>(() => createDraft())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [launchingId, setLaunchingId] = useState<string | null>(null)
  const [showLeaderboardEveryRound, setShowLeaderboardEveryRound] = useState(true)

  const liveSetupReady = configured && appHealth?.status !== 'setup_required'

  const loadBootstrap = useCallback(async () => {
    if (!session) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload = await fetchHostBootstrap()
      setBootstrap(payload)
      setDraft((current) =>
        payload.quizSets.some((quizSet) => quizSet.id === current.id)
          ? current
          : toDraft(payload.quizSets[0] ?? createDraft()),
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load host studio')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    void fetchAppHealth()
      .then((payload) => {
        setAppHealth(payload)
      })
      .catch((healthError) => {
        setError(healthError instanceof Error ? healthError.message : 'Unable to reach server')
      })
  }, [])

  useEffect(() => {
    if (!session || !liveSetupReady) {
      return
    }

    void loadBootstrap()
  }, [liveSetupReady, loadBootstrap, session])

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await signInHostWithPassword(email, password)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed')
      setLoading(false)
    }
  }

  const handleTopLevelChange = <K extends keyof QuizDraft>(
    key: K,
    value: QuizDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const handleQuestionChange = <K extends keyof QuizQuestion>(
    questionId: string,
    key: K,
    value: QuizQuestion[K],
  ) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId ? { ...question, [key]: value } : question,
      ),
    }))
  }

  const handleChoiceChange = (
    questionId: string,
    choiceId: string,
    text: string,
  ) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              choices: question.choices.map((choice) =>
                choice.id === choiceId ? { ...choice, text } : choice,
              ),
            }
          : question,
      ),
    }))
  }

  const addQuestion = () => {
    setDraft((current) => ({
      ...current,
      questions: [...current.questions, createQuestion()],
    }))
  }

  const removeQuestion = (questionId: string) => {
    setDraft((current) => {
      const nextQuestions = current.questions.filter(
        (question) => question.id !== questionId,
      )

      return {
        ...current,
        questions: nextQuestions.length > 0 ? nextQuestions : [createQuestion()],
      }
    })
  }

  const addChoice = (questionId: string) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              choices: [...question.choices, createChoice()],
            }
          : question,
      ),
    }))
  }

  const removeChoice = (questionId: string, choiceId: string) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question) => {
        if (question.id !== questionId || question.choices.length <= 2) {
          return question
        }

        const nextChoices = question.choices.filter((choice) => choice.id !== choiceId)
        return {
          ...question,
          choices: nextChoices,
          correctChoiceId:
            question.correctChoiceId === choiceId
              ? nextChoices[0].id
              : question.correctChoiceId,
        }
      }),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const payload = await saveQuizSet(draft)
      setDraft(toDraft(payload))
      await loadBootstrap()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save quiz')
    } finally {
      setSaving(false)
    }
  }

  const handleLaunch = async (quizSetId: string) => {
    setLaunchingId(quizSetId)
    setError(null)

    try {
      const sessionPayload = await launchSession(quizSetId, showLeaderboardEveryRound)
      navigate(`/host/live/${sessionPayload.joinCode}`)
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : 'Unable to launch')
      setLaunchingId(null)
    }
  }

  if (!configured || appHealth?.status === 'setup_required') {
    return (
      <main className="app-shell">
        <section className="auth-panel auth-panel-ci">
          <Link className="eyebrow-link" to="/">
            ← กลับหน้าแรก
          </Link>
          <span className="eyebrow">Live Setup Required</span>
          <h1>EDDU Spark ยังไม่ได้เชื่อม production backend</h1>
          <p className="hero-text">
            หน้านี้พร้อมสำหรับ Supabase + Railway แล้ว แต่เครื่องนี้ยังไม่มี env ที่จำเป็น
            สำหรับ host auth และ live persistence
          </p>
          <div className="setup-note">
            <strong>ต้องตั้งค่าอย่างน้อย:</strong>
            <p>
              `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
              `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `APP_BASE_URL`
            </p>
          </div>
        </section>
      </main>
    )
  }

  if (!ready && !session) {
    return (
      <main className="app-shell">
        <section className="auth-panel auth-panel-ci">
          <h1>กำลังโหลด host session...</h1>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="app-shell">
        <section className="auth-panel auth-panel-ci">
          <Link className="eyebrow-link" to="/">
            ← กลับหน้าแรก
          </Link>
          <span className="eyebrow">Host Access</span>
          <h1>เข้าสู่ Host Studio</h1>
          <p className="hero-text">
            ใช้บัญชี host ที่ถูก invite ไว้ใน Supabase Auth เพื่อจัดการ quiz set และเปิด
            live session
          </p>

          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              Host email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="host@eddu.org"
                type="email"
              />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                type="password"
              />
            </label>
            <button className="button button-primary" disabled={loading} type="submit">
              {loading ? 'กำลังเข้าใช้งาน...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
          {sessionError ? <p className="error-text">{sessionError}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell app-shell-ci">
      <section className="page-header page-header-ci">
        <div>
          <Link className="eyebrow-link" to="/">
            ← กลับหน้าแรก
          </Link>
          <span className="eyebrow">Host Studio</span>
          <h1>ออกแบบเกมและเปิด live session</h1>
          <p className="hero-text">
            Visual system ใหม่ยึดจาก CI เดียวกันทั้งหน้า studio, live console, และ player
            flow
          </p>
        </div>
        <div className="header-actions">
          <div className="host-chip">
            <strong>{bootstrap?.currentHost?.displayName || session.user.email}</strong>
            <span>{bootstrap?.currentHost?.role ?? 'host'}</span>
          </div>
          <label className="toggle-chip toggle-chip-ci">
            <input
              checked={showLeaderboardEveryRound}
              onChange={(event) => setShowLeaderboardEveryRound(event.target.checked)}
              type="checkbox"
            />
            Show leaderboard every round
          </label>
          <button
            className="button button-ghost"
            onClick={() => {
              void signOutHostSession()
            }}
            type="button"
          >
            Logout
          </button>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="studio-grid">
        <div className="content-panel content-panel-ci">
          <div className="panel-header">
            <span className="eyebrow">Quiz Editor</span>
            <h2>Build host-led internal sessions</h2>
          </div>

          <div className="field-grid">
            <label>
              Title
              <input
                value={draft.title}
                onChange={(event) => handleTopLevelChange('title', event.target.value)}
              />
            </label>
            <label>
              Category
              <input
                value={draft.category}
                onChange={(event) => handleTopLevelChange('category', event.target.value)}
              />
            </label>
            <label className="full-span">
              Description
              <textarea
                rows={3}
                value={draft.description}
                onChange={(event) =>
                  handleTopLevelChange('description', event.target.value)
                }
              />
            </label>
            <label>
              Mode
              <select
                value={draft.mode}
                onChange={(event) =>
                  handleTopLevelChange('mode', event.target.value as QuizMode)
                }
              >
                <option value="knowledge_check">Knowledge Check</option>
                <option value="scenario_sprint">Scenario Sprint</option>
                <option value="team_pulse">Team Pulse</option>
              </select>
            </label>
          </div>

          <div className="question-stack">
            {draft.questions.map((question, index) => (
              <article className="question-card question-card-ci" key={question.id}>
                <div className="question-header">
                  <div>
                    <span className="eyebrow">Question {index + 1}</span>
                    <h3>{question.prompt || 'New question'}</h3>
                  </div>
                  <button
                    className="mini-button"
                    onClick={() => removeQuestion(question.id)}
                    type="button"
                  >
                    ลบข้อ
                  </button>
                </div>

                <label className="full-span">
                  Prompt
                  <textarea
                    rows={2}
                    value={question.prompt}
                    onChange={(event) =>
                      handleQuestionChange(question.id, 'prompt', event.target.value)
                    }
                  />
                </label>

                <div className="field-grid compact-grid">
                  <label>
                    Theme tag
                    <input
                      value={question.themeTag}
                      onChange={(event) =>
                        handleQuestionChange(question.id, 'themeTag', event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Time limit (sec)
                    <input
                      max={60}
                      min={10}
                      type="number"
                      value={question.timeLimitSec}
                      onChange={(event) =>
                        handleQuestionChange(
                          question.id,
                          'timeLimitSec',
                          Number(event.target.value),
                        )
                      }
                    />
                  </label>
                </div>

                <div className="choices-grid">
                  {question.choices.map((choice, choiceIndex) => (
                    <div className="choice-row" key={choice.id}>
                      <label className="choice-radio">
                        <input
                          checked={question.correctChoiceId === choice.id}
                          name={`correct-${question.id}`}
                          onChange={() =>
                            handleQuestionChange(question.id, 'correctChoiceId', choice.id)
                          }
                          type="radio"
                        />
                        Correct
                      </label>
                      <input
                        value={choice.text}
                        placeholder={`Choice ${choiceIndex + 1}`}
                        onChange={(event) =>
                          handleChoiceChange(question.id, choice.id, event.target.value)
                        }
                      />
                      <button
                        className="mini-button"
                        onClick={() => removeChoice(question.id, choice.id)}
                        type="button"
                      >
                        ลบ
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  className="button button-secondary button-inline"
                  onClick={() => addChoice(question.id)}
                  type="button"
                >
                  เพิ่มตัวเลือก
                </button>

                <label className="full-span">
                  Explanation
                  <textarea
                    rows={2}
                    value={question.explanation}
                    onChange={(event) =>
                      handleQuestionChange(
                        question.id,
                        'explanation',
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="full-span">
                  Facilitator prompt
                  <textarea
                    rows={2}
                    value={question.facilitatorPrompt}
                    onChange={(event) =>
                      handleQuestionChange(
                        question.id,
                        'facilitatorPrompt',
                        event.target.value,
                      )
                    }
                  />
                </label>
              </article>
            ))}
          </div>

          <div className="editor-actions">
            <button className="button button-secondary" onClick={addQuestion} type="button">
              เพิ่มคำถาม
            </button>
            <button
              className="button button-ghost"
              onClick={() => setDraft(createDraft())}
              type="button"
            >
              New quiz set
            </button>
            <button
              className="button button-primary"
              disabled={saving}
              onClick={handleSave}
              type="button"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก quiz set'}
            </button>
          </div>
        </div>

        <div className="content-panel content-panel-ci">
          <div className="panel-header">
            <span className="eyebrow">Library</span>
            <h2>Quiz sets และ sessions ล่าสุด</h2>
          </div>

          {loading && !bootstrap ? <p>กำลังโหลด host studio...</p> : null}

          <div className="card-list">
            {bootstrap?.quizSets.map((quizSet) => (
              <article className="library-card library-card-ci" key={quizSet.id}>
                <div className="library-card-top">
                  <div>
                    <span className="badge badge-ci">{modeLabel(quizSet.mode)}</span>
                    <h3>{quizSet.title}</h3>
                  </div>
                  <span className="pill pill-ci">{quizSet.questions.length} questions</span>
                </div>
                <p>{quizSet.description}</p>
                <div className="library-meta">
                  <span>{quizSet.category}</span>
                  <span>Updated {formatDateTime(quizSet.updatedAt)}</span>
                </div>
                <div className="library-actions">
                  <button
                    className="button button-secondary button-inline"
                    onClick={() => setDraft(toDraft(quizSet))}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="button button-primary button-inline"
                    disabled={launchingId === quizSet.id}
                    onClick={() => handleLaunch(quizSet.id)}
                    type="button"
                  >
                    {launchingId === quizSet.id ? 'Opening...' : 'Launch live'}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="panel-header with-spacing">
            <span className="eyebrow">Recent Sessions</span>
            <h2>Session snapshots</h2>
          </div>

          <div className="card-list">
            {bootstrap?.recentSessions.map((sessionSummary) => (
              <article className="session-card session-card-ci" key={sessionSummary.id}>
                <div className="library-card-top">
                  <div>
                    <span className="badge badge-soft">
                      {statusLabel(sessionSummary.status)}
                    </span>
                    <h3>{sessionSummary.quizSetTitle}</h3>
                  </div>
                  <span className="join-code join-code-ci">{sessionSummary.joinCode}</span>
                </div>
                <div className="library-meta">
                  <span>{sessionSummary.participantCount} players</span>
                  <span>{formatDateTime(sessionSummary.updatedAt)}</span>
                </div>
                <Link
                  className="button button-secondary button-inline"
                  to={`/host/live/${sessionSummary.joinCode}`}
                >
                  Open console
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
