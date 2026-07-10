import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'

import { BrandLogo } from '../components/BrandLogo'
import { ChoiceGlyph } from '../components/ChoiceGlyph'
import { SoundToggle } from '../components/SoundToggle'
import { fetchAppHealth, fetchHostSession, sendHostAction } from '../lib/api'
import { useQuizAudio } from '../lib/audio'
import { formatDateTime, percentLabel, statusLabel } from '../lib/format'
import { useCountdown, useSessionChannel } from '../lib/live'
import { signOutHostSession } from '../lib/supabase'
import { useHostSession } from '../lib/use-host-session'
import type { AppHealthData } from '../lib/api'
import type { HostSessionView } from '../lib/types'

const answerClassNames = ['answer-red', 'answer-orange', 'answer-yellow', 'answer-green'] as const

export function HostLivePage() {
  const { joinCode } = useParams()
  const { configured, session, ready } = useHostSession()
  const { muted, toggleMuted } = useQuizAudio(true)
  const [appHealth, setAppHealth] = useState<AppHealthData | null>(null)
  const [view, setView] = useState<HostSessionView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workingAction, setWorkingAction] = useState<string | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)

  const loadSession = useCallback(async () => {
    if (!joinCode || !session) {
      setLoading(false)
      return
    }

    try {
      const payload = await fetchHostSession(joinCode)
      setView(payload)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load session')
    } finally {
      setLoading(false)
    }
  }, [joinCode, session])

  useEffect(() => {
    void fetchAppHealth()
      .then((payload) => setAppHealth(payload))
      .catch((healthError) => {
        setError(healthError instanceof Error ? healthError.message : 'Unable to reach server')
      })
  }, [])

  useEffect(() => {
    if (!session || !joinCode || appHealth?.status === 'setup_required') {
      return
    }

    void loadSession()
  }, [appHealth?.status, joinCode, loadSession, session])

  useSessionChannel(joinCode, loadSession)

  const joinUrl = useMemo(() => {
    const baseUrl = appHealth?.appBaseUrl || window.location.origin
    return joinCode ? `${baseUrl}/play/join/${joinCode}` : ''
  }, [appHealth?.appBaseUrl, joinCode])

  useEffect(() => {
    if (!joinUrl) {
      setQrCodeUrl(null)
      return
    }

    void QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 280,
      color: {
        dark: '#0B0B0B',
        light: '#F2DEC9',
      },
    }).then(setQrCodeUrl)
  }, [joinUrl])

  const countdown = useCountdown(view?.session.questionEndsAt ?? null)

  const handleAction = async (action: string) => {
    if (!joinCode) {
      return
    }

    setWorkingAction(action)
    try {
      await sendHostAction(joinCode, action)
      await loadSession()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update')
    } finally {
      setWorkingAction(null)
    }
  }

  if (!configured || appHealth?.status === 'setup_required') {
    return (
      <main className="app-shell host-live-shell">
        <section className="host-panel">
          <h1>Live console ยังไม่พร้อม</h1>
          <Link className="button button-primary" to="/host">
            กลับ
          </Link>
        </section>
      </main>
    )
  }

  if (!ready) {
    return (
      <main className="app-shell host-live-shell">
        <section className="host-panel">
          <h1>กำลังโหลด...</h1>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="app-shell host-live-shell">
        <section className="host-panel">
          <h1>Host session ไม่พร้อม</h1>
          <Link className="button button-primary" to="/host">
            Login ใหม่
          </Link>
        </section>
      </main>
    )
  }

  if (loading && !view) {
    return (
      <main className="app-shell host-live-shell">
        <section className="host-panel">
          <h1>กำลังโหลด live...</h1>
        </section>
      </main>
    )
  }

  const currentQuestion =
    view && view.session.currentQuestionIndex >= 0
      ? view.quizSet.questions[view.session.currentQuestionIndex]
      : null
  const lastQuestion =
    view && view.session.lastClosedQuestionIndex !== null
      ? view.quizSet.questions[view.session.lastClosedQuestionIndex]
      : null
  const lastQuestionStats = view?.questionStats.find(
    (questionStat) => questionStat.questionId === lastQuestion?.id,
  )
  const isFinalQuestion =
    !!view &&
    view.session.currentQuestionIndex >= view.quizSet.questions.length - 1 &&
    view.session.currentQuestionIndex >= 0

  return (
    <main className="app-shell host-live-shell">
      <section className="host-topbar">
        <BrandLogo compact />
        <div className="header-actions">
          <SoundToggle muted={muted} onToggle={toggleMuted} />
          <button className="button button-ghost" onClick={() => void signOutHostSession()} type="button">
            Logout
          </button>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="live-grid">
        <div className="live-stage-panel">
          <div className="live-stage-topbar">
            <div>
              <span className="eyebrow">{view ? statusLabel(view.session.status) : '-'}</span>
              <h1>{view?.session.quizSetTitle}</h1>
            </div>
            <div className="live-meta-strip">
              <span>{view?.session.participants.length ?? 0} players</span>
              <span>{view ? formatDateTime(view.session.createdAt) : '-'}</span>
            </div>
          </div>

          <div className="kahoot-stage">
            <div className="kahoot-stage-header">
              <div>
                <span className="eyebrow">Question</span>
                <h2>
                  {currentQuestion
                    ? `${view!.session.currentQuestionIndex + 1} / ${view!.quizSet.questions.length}`
                    : 'พร้อมเริ่ม'}
                </h2>
              </div>
              {view?.session.status === 'question_open' ? (
                <div className="timer-badge timer-badge-large">{countdown}s</div>
              ) : null}
            </div>

            {currentQuestion ? (
              <div className="host-question-stage">
                <div className="stage-image-frame">
                  {currentQuestion.imageUrl ? (
                    <img alt={currentQuestion.imageAlt ?? currentQuestion.prompt} src={currentQuestion.imageUrl} />
                  ) : (
                    <div className="stage-image-empty">No image</div>
                  )}
                </div>
                <div className="stage-question-copy">
                  <p>{currentQuestion.prompt}</p>
                </div>
                <div className="host-answer-grid">
                  {currentQuestion.choices.map((choice, index) => (
                    <div className={`host-answer-card ${answerClassNames[index]}`} key={choice.id}>
                      <div className="host-answer-card-head">
                        <ChoiceGlyph index={index} />
                        {view?.session.status !== 'question_open' && currentQuestion.correctChoiceId === choice.id ? (
                          <span className="pill pill-success">Correct</span>
                        ) : null}
                      </div>
                      <strong>{choice.text}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="host-lobby-stage">
                <h2>รอผู้เล่นเข้าห้อง</h2>
                <p>กดเปิดข้อแรกเมื่อพร้อม</p>
              </div>
            )}
          </div>

          <div className="action-row action-row-spread">
            {view?.session.status === 'lobby' ? (
              <button
                className="button button-primary"
                disabled={workingAction === 'advance'}
                onClick={() => handleAction('advance')}
                type="button"
              >
                เปิดข้อแรก
              </button>
            ) : null}

            {view?.session.status === 'question_open' ? (
              <button
                className="button button-primary"
                disabled={workingAction === 'close_question'}
                onClick={() => handleAction('close_question')}
                type="button"
              >
                ปิดคำถาม
              </button>
            ) : null}

            {view?.session.status === 'question_closed' ? (
              <>
                <button
                  className="button button-secondary"
                  disabled={workingAction === 'show_leaderboard'}
                  onClick={() => handleAction('show_leaderboard')}
                  type="button"
                >
                  Leaderboard
                </button>
                <button
                  className="button button-primary"
                  disabled={workingAction === 'advance'}
                  onClick={() => handleAction(isFinalQuestion ? 'finish' : 'advance')}
                  type="button"
                >
                  {isFinalQuestion ? 'จบเกม' : 'ข้อถัดไป'}
                </button>
              </>
            ) : null}

            {view?.session.status === 'leaderboard' ? (
              <button
                className="button button-primary"
                disabled={workingAction === 'advance'}
                onClick={() => handleAction(isFinalQuestion ? 'finish' : 'advance')}
                type="button"
              >
                {isFinalQuestion ? 'จบเกม' : 'ข้อถัดไป'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="live-side-panel">
          <section className="join-qr-panel">
            <span className="eyebrow">Join</span>
            <div className="join-code-display">{view?.session.joinCode}</div>
            {qrCodeUrl ? <img alt="QR code for joining the room" src={qrCodeUrl} /> : null}
            <p>{joinUrl.replace(/^https?:\/\//, '')}</p>
          </section>

          <section className="host-panel side-panel-card">
            <div className="panel-header">
              <span className="eyebrow">Leaderboard</span>
              <h2>Top players</h2>
            </div>
            <div className="rank-list">
              {view?.rankings.slice(0, 8).map((ranking) => (
                <div className="rank-row" key={ranking.participantId}>
                  <span>#{ranking.rank}</span>
                  <strong>{ranking.displayName}</strong>
                  <span>{ranking.score}</span>
                </div>
              ))}
            </div>
          </section>

          {lastQuestion && lastQuestionStats ? (
            <section className="host-panel side-panel-card">
              <div className="panel-header">
                <span className="eyebrow">Reveal</span>
                <h2>{lastQuestion.prompt}</h2>
              </div>
              <div className="distribution-list">
                {lastQuestionStats.distribution.map((item) => (
                  <div className="distribution-row" key={item.choiceId}>
                    <div className="distribution-label">
                      <strong>{item.text}</strong>
                      {item.isCorrect ? <span className="pill pill-success">Correct</span> : null}
                    </div>
                    <div className="distribution-bar">
                      <span
                        style={{
                          width: `${
                            lastQuestionStats.totalSubmissions === 0
                              ? 0
                              : (item.count / lastQuestionStats.totalSubmissions) * 100
                          }%`,
                        }}
                      />
                    </div>
                    <span>{percentLabel(item.count / Math.max(1, lastQuestionStats.totalSubmissions))}</span>
                  </div>
                ))}
              </div>
              <p className="side-note">{lastQuestion.explanation}</p>
              <p className="side-note side-note-highlight">{lastQuestion.facilitatorPrompt}</p>
            </section>
          ) : null}

          <section className="host-panel side-panel-card">
            <div className="panel-header">
              <span className="eyebrow">Summary</span>
              <h2>Session</h2>
            </div>
            <div className="summary-grid summary-grid-tight">
              <article className="summary-card">
                <strong>Players</strong>
                <p>{view?.summary.totalParticipants ?? 0}</p>
              </article>
              <article className="summary-card">
                <strong>Hardest</strong>
                <p>{view?.summary.hardestQuestion ?? '-'}</p>
              </article>
              <article className="summary-card">
                <strong>Strongest</strong>
                <p>{view?.summary.strongestTopic ?? '-'}</p>
              </article>
              <article className="summary-card">
                <strong>Weakest</strong>
                <p>{view?.summary.weakestTopic ?? '-'}</p>
              </article>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
