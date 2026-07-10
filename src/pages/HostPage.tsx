import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { BrandLogo } from '../components/BrandLogo'
import {
  fetchAppHealth,
  fetchHostBootstrap,
  launchSession,
  saveQuizSet,
  uploadQuestionImage,
  type AppHealthData,
  type HostBootstrapData,
} from '../lib/api'
import { formatDateTime, statusLabel } from '../lib/format'
import { signInHostWithPassword, signOutHostSession } from '../lib/supabase'
import { useHostSession } from '../lib/use-host-session'
import type { QuizQuestion, QuizSet } from '../lib/types'

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
    timeLimitSec: 15,
    explanation: '',
    facilitatorPrompt: '',
    themeTag: 'general',
    imagePath: null,
    imageUrl: null,
    imageAlt: null,
  }
}

const createDraft = (): QuizDraft => ({
  id: crypto.randomUUID(),
  title: 'Eddu Quiz',
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
  mode: 'knowledge_check',
  questions: quizSet.questions,
})

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'))
    reader.readAsDataURL(file)
  })

const isExternalImageUrl = (value: string) => /^https?:\/\//i.test(value.trim())

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
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null)
  const [manualImageUrls, setManualImageUrls] = useState<Record<string, string>>({})
  const [isEditorOpen, setIsEditorOpen] = useState(false)

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
      .then((payload) => setAppHealth(payload))
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

  const handleChoiceChange = (questionId: string, choiceId: string, text: string) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              choices: question.choices.map((choice) =>
                choice.id === choiceId ? { ...choice, text } : choice,
              ) as QuizQuestion['choices'],
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
      const nextQuestions = current.questions.filter((question) => question.id !== questionId)
      return {
        ...current,
        questions: nextQuestions.length > 0 ? nextQuestions : [createQuestion()],
      }
    })
  }

  const startNewQuiz = () => {
    setDraft(createDraft())
    setManualImageUrls({})
    setIsEditorOpen(true)
  }

  const openQuizEditor = (quizSet: QuizSet) => {
    setDraft(toDraft(quizSet))
    setManualImageUrls(
      Object.fromEntries(
        quizSet.questions.map((question) => [
          question.id,
          question.imagePath && isExternalImageUrl(question.imagePath) ? question.imagePath : '',
        ]),
      ),
    )
    setIsEditorOpen(true)
  }

  const handleQuestionImageUpload = async (questionId: string, file?: File | null) => {
    if (!file) {
      return
    }

    setUploadingQuestionId(questionId)
    setError(null)

    try {
      const encoded = await readFileAsDataUrl(file)
      const uploaded = await uploadQuestionImage(encoded, file.name.replace(/\.[^.]+$/, ''))
      setDraft((current) => ({
        ...current,
        questions: current.questions.map((question) =>
          question.id === questionId
            ? {
                ...question,
                imagePath: uploaded.imagePath,
                imageUrl: uploaded.imageUrl,
                imageAlt: uploaded.imageAlt,
              }
            : question,
        ),
      }))
      setManualImageUrls((current) => ({ ...current, [questionId]: '' }))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed')
    } finally {
      setUploadingQuestionId(null)
    }
  }

  const handleQuestionImageUrlChange = (questionId: string, value: string) => {
    setManualImageUrls((current) => ({ ...current, [questionId]: value }))
    const trimmed = value.trim()

    if (!trimmed) {
      handleQuestionChange(questionId, 'imagePath', null)
      handleQuestionChange(questionId, 'imageUrl', null)
      return
    }

    if (!isExternalImageUrl(trimmed)) {
      return
    }

    handleQuestionChange(questionId, 'imagePath', trimmed)
    handleQuestionChange(questionId, 'imageUrl', trimmed)
  }

  const handleSave = async () => {
    const invalidImageUrl = draft.questions.find((question) => {
      const manualValue = manualImageUrls[question.id]
      return manualValue && manualValue.trim() && !isExternalImageUrl(manualValue)
    })

    if (invalidImageUrl) {
      setError('Image URL ต้องขึ้นต้นด้วย http:// หรือ https://')
      return
    }

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
      const sessionPayload = await launchSession(quizSetId)
      navigate(`/host/live/${sessionPayload.joinCode}`)
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : 'Unable to launch')
      setLaunchingId(null)
    }
  }

  if (!configured || appHealth?.status === 'setup_required') {
    return (
      <main className="app-shell host-shell">
        <section className="host-panel">
          <BrandLogo compact to="/host" />
          <h1>Setup required</h1>
          <p>ต้องใส่ env ของ Supabase และ APP_BASE_URL ก่อน</p>
          <Link className="button button-secondary" to="/">
            กลับ
          </Link>
        </section>
      </main>
    )
  }

  if (!ready && !session) {
    return (
      <main className="app-shell host-shell">
        <section className="host-panel">
          <h1>กำลังโหลด...</h1>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="app-shell host-shell">
        <section className="host-panel host-login-panel">
          <BrandLogo />
          <form className="entry-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                placeholder="host@eddu.org"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="button button-primary button-block" disabled={loading} type="submit">
              {loading ? 'กำลังเข้า...' : 'เข้าสู่ Host'}
            </button>
          </form>
          {sessionError ? <p className="error-text error-text-centered">{sessionError}</p> : null}
          {error ? <p className="error-text error-text-centered">{error}</p> : null}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell host-shell">
      <section className="host-topbar">
        <BrandLogo compact to="/host" />
        <div className="header-actions">
          <div className="host-badge">
            <strong>{bootstrap?.currentHost?.displayName || session.user.email}</strong>
            <span>{bootstrap?.currentHost?.role ?? 'host'}</span>
          </div>
          <button className="button button-ghost" onClick={() => void signOutHostSession()} type="button">
            Logout
          </button>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="studio-grid">
        <div className="host-panel host-library-panel">
          <div className="panel-header">
            <span className="eyebrow">Library</span>
            <h2>Quiz</h2>
          </div>

          <div className="library-toolbar">
            <p className="library-helper-text">เลือกชุดที่ต้องการแล้วกดแก้ไขหรือเริ่มเล่น</p>
            <button className="button button-primary" onClick={startNewQuiz} type="button">
              New Quiz
            </button>
          </div>

          {loading && !bootstrap ? <p>กำลังโหลด...</p> : null}

          <div className="card-list">
            {bootstrap?.quizSets.map((quizSet) => (
              <article className="library-card" key={quizSet.id}>
                <div className="library-card-top">
                  <div>
                    <h3>{quizSet.title}</h3>
                    <p>{quizSet.questions.length} ข้อ</p>
                  </div>
                  <span className="pill">{formatDateTime(quizSet.updatedAt)}</span>
                </div>
                <div className="library-actions">
                  <button
                    className="button button-secondary button-inline"
                    onClick={() => openQuizEditor(quizSet)}
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
                    {launchingId === quizSet.id ? 'Opening...' : 'Launch'}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="panel-header">
            <span className="eyebrow">Recent</span>
            <h2>ล่าสุด</h2>
          </div>

          <div className="card-list">
            {bootstrap?.recentSessions.map((sessionSummary) => (
              <article className="library-card" key={sessionSummary.id}>
                <div className="library-card-top">
                  <div>
                    <h3>{sessionSummary.quizSetTitle}</h3>
                    <p>{statusLabel(sessionSummary.status)}</p>
                  </div>
                  <span className="join-pill">{sessionSummary.joinCode}</span>
                </div>
                <div className="library-meta">
                  <span>{sessionSummary.participantCount} คน</span>
                  <span>{formatDateTime(sessionSummary.updatedAt)}</span>
                </div>
                <Link className="button button-secondary button-inline" to={`/host/live/${sessionSummary.joinCode}`}>
                  Open
                </Link>
              </article>
            ))}
          </div>
        </div>

        {isEditorOpen ? (
          <div className="host-panel host-editor-panel">
            <div className="panel-header">
              <span className="eyebrow">Editor</span>
              <h2>{draft.title || 'New Quiz'}</h2>
            </div>

            <div className="field-grid compact-field-grid">
              <label>
                Title
                <input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </label>
              <label>
                Description
                <input
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="question-stack">
              {draft.questions.map((question, index) => (
                <article className="question-card" key={question.id}>
                  <div className="question-header">
                    <div>
                      <span className="eyebrow">Q{index + 1}</span>
                      <h3>{question.prompt || 'New question'}</h3>
                    </div>
                    <button className="mini-button" onClick={() => removeQuestion(question.id)} type="button">
                      ลบ
                    </button>
                  </div>

                  <label>
                    Prompt
                    <textarea
                      rows={2}
                      value={question.prompt}
                      onChange={(event) =>
                        handleQuestionChange(question.id, 'prompt', event.target.value)
                      }
                    />
                  </label>

                  <div className="question-image-block">
                    {question.imageUrl ? (
                      <img alt={question.imageAlt ?? `Question ${index + 1}`} src={question.imageUrl} />
                    ) : (
                      <div className="image-empty-state">ยังไม่มีภาพ</div>
                    )}
                    <div className="image-controls">
                      <label className="button button-secondary button-inline file-button">
                        {uploadingQuestionId === question.id ? 'Uploading...' : 'Upload image'}
                        <input
                          accept="image/png,image/jpeg,image/webp"
                          hidden
                          type="file"
                          onChange={(event) =>
                            void handleQuestionImageUpload(question.id, event.target.files?.[0] ?? null)
                          }
                        />
                      </label>
                      {question.imageUrl ? (
                        <button
                          className="button button-ghost button-inline"
                          onClick={() => {
                            handleQuestionChange(question.id, 'imagePath', null)
                            handleQuestionChange(question.id, 'imageUrl', null)
                            handleQuestionChange(question.id, 'imageAlt', null)
                            setManualImageUrls((current) => ({ ...current, [question.id]: '' }))
                          }}
                          type="button"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <label>
                      Image URL
                      <input
                        placeholder="https://..."
                        value={
                          manualImageUrls[question.id] ??
                          (question.imagePath && isExternalImageUrl(question.imagePath)
                            ? question.imagePath
                            : '')
                        }
                        onChange={(event) =>
                          handleQuestionImageUrlChange(question.id, event.target.value)
                        }
                      />
                    </label>
                  </div>

                  <div className="field-grid compact-field-grid">
                    <label>
                      Time
                      <input
                        max={15}
                        min={10}
                        type="number"
                        value={question.timeLimitSec}
                        onChange={(event) =>
                          handleQuestionChange(question.id, 'timeLimitSec', Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      Topic
                      <input
                        value={question.themeTag}
                        onChange={(event) =>
                          handleQuestionChange(question.id, 'themeTag', event.target.value)
                        }
                      />
                    </label>
                  </div>

                  <div className="choices-grid host-choices-grid">
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
                          {choiceIndex + 1}
                        </label>
                        <input
                          placeholder={`Choice ${choiceIndex + 1}`}
                          value={choice.text}
                          onChange={(event) =>
                            handleChoiceChange(question.id, choice.id, event.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <label>
                    Explain
                    <textarea
                      rows={2}
                      value={question.explanation}
                      onChange={(event) =>
                        handleQuestionChange(question.id, 'explanation', event.target.value)
                      }
                    />
                  </label>

                  <label>
                    Debrief prompt
                    <textarea
                      rows={2}
                      value={question.facilitatorPrompt}
                      onChange={(event) =>
                        handleQuestionChange(question.id, 'facilitatorPrompt', event.target.value)
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
              <button className="button button-ghost" onClick={() => setIsEditorOpen(false)} type="button">
                กลับไป Library
              </button>
              <button className="button button-primary" disabled={saving} onClick={handleSave} type="button">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="host-panel host-editor-panel editor-empty-panel">
            <span className="eyebrow">Editor</span>
            <h2>เลือก Quiz ก่อน</h2>
            <p>กด Edit หรือ New Quiz เพื่อเริ่ม</p>
          </div>
        )}
      </section>
    </main>
  )
}
