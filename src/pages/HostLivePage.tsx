import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { fetchAppHealth, fetchHostSession, sendHostAction } from '../lib/api'
import { formatDateTime, percentLabel, statusLabel } from '../lib/format'
import { useCountdown, useSessionChannel } from '../lib/live'
import { signOutHostSession } from '../lib/supabase'
import { useHostSession } from '../lib/use-host-session'
import type { AppHealthData } from '../lib/api'
import type { HostSessionView } from '../lib/types'

export function HostLivePage() {
  const { joinCode } = useParams()
  const { configured, session, ready } = useHostSession()
  const [appHealth, setAppHealth] = useState<AppHealthData | null>(null)
  const [view, setView] = useState<HostSessionView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workingAction, setWorkingAction] = useState<string | null>(null)

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
      .then((payload) => {
        setAppHealth(payload)
      })
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
      <main className="app-shell">
        <section className="auth-panel auth-panel-ci">
          <h1>Live console ยังไม่พร้อมใช้งาน</h1>
          <p className="hero-text">ต้องเชื่อม Supabase + Railway env ให้ครบก่อนเปิด session จริง</p>
          <Link className="button button-primary" to="/host">
            กลับไปหน้า host
          </Link>
        </section>
      </main>
    )
  }

  if (!ready) {
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
          <h1>Host session ไม่พร้อมใช้งาน</h1>
          <Link className="button button-primary" to="/host">
            กลับไป login ใหม่
          </Link>
        </section>
      </main>
    )
  }

  if (loading && !view) {
    return (
      <main className="app-shell">
        <section className="auth-panel auth-panel-ci">
          <h1>กำลังโหลด live console...</h1>
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
    <main className="app-shell app-shell-ci">
      <section className="page-header page-header-ci">
        <div>
          <Link className="eyebrow-link" to="/host">
            ← กลับ Host Studio
          </Link>
          <span className="eyebrow">Host Live Console</span>
          <h1>{view?.session.quizSetTitle}</h1>
        </div>
        <div className="header-actions">
          <div className="join-code-panel join-code-panel-ci">
            <span>Join code</span>
            <strong>{view?.session.joinCode}</strong>
          </div>
          <button className="button button-ghost" onClick={() => void signOutHostSession()} type="button">
            Logout
          </button>
          <Link className="button button-secondary" to="/play">
            เปิดหน้า join
          </Link>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="console-grid">
        <div className="content-panel content-panel-ci">
          <div className="status-strip status-strip-ci">
            <span className="badge badge-ci">{view ? statusLabel(view.session.status) : '-'}</span>
            <span>{view?.session.participants.length ?? 0} players</span>
            <span>{view?.teamRankings.length ?? 0} teams</span>
            <span>Started {view ? formatDateTime(view.session.createdAt) : '-'}</span>
          </div>

          <div className="live-stage live-stage-ci">
            <div className="stage-header">
              <div>
                <span className="eyebrow">Live Stage</span>
                <h2>
                  {currentQuestion
                    ? `ข้อ ${view!.session.currentQuestionIndex + 1} / ${view!.quizSet.questions.length}`
                    : 'พร้อมเริ่ม session'}
                </h2>
              </div>
              {view?.session.status === 'question_open' ? (
                <div className="timer-badge timer-badge-ci">{countdown}s</div>
              ) : null}
            </div>

            {currentQuestion ? (
              <>
                <p className="lead-text lead-text-contrast">{currentQuestion.prompt}</p>
                <div className="answer-grid">
                  {currentQuestion.choices.map((choice, index) => (
                    <div className="answer-card answer-card-static answer-card-ci" key={choice.id}>
                      <span className="choice-index">{index + 1}</span>
                      <strong>{choice.text}</strong>
                      {view?.session.status !== 'question_open' &&
                      currentQuestion.correctChoiceId === choice.id ? (
                        <span className="pill pill-success">Correct</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="lead-text lead-text-contrast">
                session นี้กำลังรอผู้เล่นและพร้อมเปิดคำถามข้อแรกเมื่อ host ต้องการ
              </p>
            )}

            <div className="action-row">
              {view?.session.status === 'lobby' ? (
                <button
                  className="button button-primary"
                  disabled={workingAction === 'advance'}
                  onClick={() => handleAction('advance')}
                  type="button"
                >
                  เปิดคำถามข้อแรก
                </button>
              ) : null}

              {view?.session.status === 'question_open' ? (
                <button
                  className="button button-primary"
                  disabled={workingAction === 'close_question'}
                  onClick={() => handleAction('close_question')}
                  type="button"
                >
                  ปิดคำถามตอนนี้
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
                    Show leaderboard
                  </button>
                  <button
                    className="button button-primary"
                    disabled={workingAction === 'advance'}
                    onClick={() => handleAction(isFinalQuestion ? 'finish' : 'advance')}
                    type="button"
                  >
                    {isFinalQuestion ? 'จบ session' : 'ไปข้อถัดไป'}
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
                  {isFinalQuestion ? 'จบ session' : 'ไปข้อถัดไป'}
                </button>
              ) : null}
            </div>
          </div>

          {lastQuestion && lastQuestionStats ? (
            <div className="reveal-panel reveal-panel-ci">
              <div className="panel-header">
                <span className="eyebrow">Reveal & Debrief</span>
                <h2>หลังจบคำถามข้อก่อนหน้า</h2>
              </div>
              <p className="lead-text">{lastQuestion.explanation}</p>
              <div className="distribution-list">
                {lastQuestionStats.distribution.map((item) => (
                  <div className="distribution-row" key={item.choiceId}>
                    <div className="distribution-label">
                      <strong>{item.text}</strong>
                      {lastQuestion.correctChoiceId === item.choiceId ? (
                        <span className="pill pill-success">Correct</span>
                      ) : null}
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
                    <span>{item.count}</span>
                  </div>
                ))}
              </div>
              <p className="prompt-note">
                Facilitator prompt: {lastQuestion.facilitatorPrompt || 'ไม่มี prompt เพิ่ม'}
              </p>
            </div>
          ) : null}
        </div>

        <div className="content-panel content-panel-ci">
          <div className="panel-header">
            <span className="eyebrow">Scoreboard</span>
            <h2>Momentum ของผู้เล่นและทีม</h2>
          </div>

          <div className="rankings-grid rankings-grid-compact">
            <div>
              <h3>Top Players</h3>
              <div className="rank-list">
                {view?.rankings.slice(0, 8).map((ranking) => (
                  <div className="rank-row rank-row-ci" key={ranking.participantId}>
                    <span>#{ranking.rank}</span>
                    <div>
                      <strong>{ranking.displayName}</strong>
                      <p>{ranking.teamName}</p>
                    </div>
                    <strong>{ranking.score}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3>Top Teams</h3>
              <div className="rank-list">
                {view?.teamRankings.slice(0, 5).map((ranking) => (
                  <div className="rank-row rank-row-ci" key={ranking.teamName}>
                    <span>#{ranking.rank}</span>
                    <div>
                      <strong>{ranking.teamName}</strong>
                      <p>{ranking.members} members</p>
                    </div>
                    <strong>{ranking.score}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="summary-grid">
            <article className="summary-card summary-card-ci">
              <span className="eyebrow">Hardest Question</span>
              <strong>{view?.summary.hardestQuestion ?? 'ยังไม่มีข้อมูล'}</strong>
            </article>
            <article className="summary-card summary-card-ci">
              <span className="eyebrow">Strongest Topic</span>
              <strong>{view?.summary.strongestTopic ?? 'ยังไม่มีข้อมูล'}</strong>
            </article>
            <article className="summary-card summary-card-ci">
              <span className="eyebrow">Weakest Topic</span>
              <strong>{view?.summary.weakestTopic ?? 'ยังไม่มีข้อมูล'}</strong>
            </article>
          </div>

          <div className="insight-table insight-table-ci">
            <div className="table-head">
              <span>Theme</span>
              <span>Accuracy</span>
            </div>
            {view?.topicStats.map((topic) => (
              <div className="table-row" key={topic.themeTag}>
                <span>{topic.themeTag}</span>
                <strong>{percentLabel(topic.accuracyRate)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
