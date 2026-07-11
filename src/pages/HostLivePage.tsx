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

const answerClassNames = ['answer-red', 'answer-orange', 'answer-yellow', 'answer-green'] as const
const podiumOrder = [1, 0, 2] as const

export function HostLivePage() {
  const { joinCode } = useParams()
  const { configured, session, ready } = useHostSession()
  const { muted, toggleMuted } = useQuizAudio(true)
  const [appHealth, setAppHealth] = useState<AppHealthData | null>(null)
  const [view, setView] = useState<Awaited<ReturnType<typeof fetchHostSession>> | null>(null)
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
      width: 300,
      color: {
        dark: '#131313',
        light: '#FFF7ED',
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

  const sessionStatus = view?.session.status ?? 'lobby'
  const currentQuestion =
    view && view.session.currentQuestionIndex >= 0
      ? view.quizSet.questions[view.session.currentQuestionIndex]
      : null
  const closedQuestion =
    view && view.session.lastClosedQuestionIndex !== null
      ? view.quizSet.questions[view.session.lastClosedQuestionIndex]
      : null
  const closedQuestionStats = view?.questionStats.find(
    (questionStat) => questionStat.questionId === closedQuestion?.id,
  )
  const topFive = view?.rankings.slice(0, 5) ?? []
  const podiumPlayers = podiumOrder
    .map((index) => topFive[index])
    .filter((ranking): ranking is NonNullable<(typeof topFive)[number]> => Boolean(ranking))
  const podiumRemainder = topFive.filter((ranking) => ranking.rank > 3)
  const participants = [...(view?.session.participants ?? [])].sort((left, right) =>
    left.joinedAt.localeCompare(right.joinedAt),
  )
  const showLobby = sessionStatus === 'lobby'
  const showQuestion = sessionStatus === 'question_open'
  const showReveal = sessionStatus === 'question_closed'
  const showLeaderboard = sessionStatus === 'leaderboard'
  const showFinished = sessionStatus === 'finished'
  const totalQuestions = view?.quizSet.questions.length ?? 0
  const remainingQuestions = view
    ? Math.max(totalQuestions - ((view.session.lastClosedQuestionIndex ?? -1) + 1), 0)
    : 0
  const isTimerUrgent = showQuestion && countdown > 0 && countdown <= 5
  const isFinalQuestion =
    !!view &&
    view.session.currentQuestionIndex >= view.quizSet.questions.length - 1 &&
    view.session.currentQuestionIndex >= 0
  const countdownRatio = currentQuestion
    ? Math.max(0, Math.min(1, countdown / Math.max(1, currentQuestion.timeLimitSec)))
    : 0
  const winner = topFive[0] ?? null
  const correctRevealChoice =
    closedQuestion?.choices.find((choice) => choice.id === closedQuestion.correctChoiceId) ?? null

  return (
    <main className="app-shell host-live-shell">
      <section className="host-topbar">
        <BrandLogo compact to="/host" />
        <div className="header-actions">
          <SoundToggle muted={muted} onToggle={toggleMuted} />
          <button className="button button-ghost" onClick={() => void signOutHostSession()} type="button">
            Logout
          </button>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="live-grid live-grid-single">
        <div className="live-stage-panel live-stage-panel-full">
          <div className="live-stage-topbar">
            <div>
              <span className="eyebrow">{statusLabel(sessionStatus)}</span>
              <h1>{view?.session.quizSetTitle}</h1>
            </div>
            <div className="live-meta-strip">
              <span>{view?.session.participants.length ?? 0} คน</span>
              <span>{view ? formatDateTime(view.session.createdAt) : '-'}</span>
            </div>
          </div>

          {showLobby ? (
            <div className="kahoot-stage lobby-stage stage-animate-in">
              <div className="lobby-hero">
                <div className="join-qr-panel join-qr-panel-wide">
                  <span className="eyebrow">Join</span>
                  <div className="join-code-display">{view?.session.joinCode}</div>
                  {qrCodeUrl ? <img alt="QR code for joining the room" src={qrCodeUrl} /> : null}
                  <p>{joinUrl.replace(/^https?:\/\//, '')}</p>
                </div>

                <div className="lobby-players-panel">
                  <div className="panel-header">
                    <span className="eyebrow">Players</span>
                    <h2>{participants.length}</h2>
                  </div>
                  <div className="player-bubble-cloud">
                    {participants.length > 0 ? (
                      participants.map((participant, index) => (
                        <div
                          className="player-bubble"
                          key={participant.id}
                          style={{ animationDelay: `${index * 45}ms` }}
                        >
                          {participant.displayName}
                        </div>
                      ))
                    ) : (
                      <p className="lobby-empty-copy">รอคนเข้าห้อง</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="action-row action-row-spread">
                <button
                  className="button button-primary"
                  disabled={workingAction === 'advance'}
                  onClick={() => handleAction('advance')}
                  type="button"
                >
                  เปิดข้อแรก
                </button>
              </div>
            </div>
          ) : null}

          {showQuestion && currentQuestion ? (
            <div className="kahoot-stage kahoot-stage-focus stage-animate-in">
              <div className="kahoot-stage-header">
                <div>
                  <span className="eyebrow">Question</span>
                  <h2>
                    {view!.session.currentQuestionIndex + 1} / {view!.quizSet.questions.length}
                  </h2>
                </div>
                <div className="stage-status-strip">
                  <div className="stage-progress-pill">
                    {view?.currentQuestionSubmissionCount ?? 0}/{view?.session.participants.length ?? 0} ตอบแล้ว
                  </div>
                  <div className={`timer-badge timer-badge-large ${isTimerUrgent ? 'timer-badge-urgent' : ''}`.trim()}>
                    {countdown}s
                  </div>
                </div>
              </div>
              <div className={`stage-tension-bar ${isTimerUrgent ? 'is-urgent' : ''}`.trim()} aria-hidden="true">
                <span style={{ width: `${countdownRatio * 100}%` }} />
              </div>

              <div
                className={`host-question-stage ${currentQuestion.imageUrl ? '' : 'host-question-stage-no-image'}`.trim()}
              >
                {currentQuestion.imageUrl ? (
                  <div className="stage-image-frame">
                    <img alt={currentQuestion.imageAlt ?? currentQuestion.prompt} src={currentQuestion.imageUrl} />
                  </div>
                ) : null}

                <div className="stage-question-copy stage-question-copy-hero">
                  <p>{currentQuestion.prompt}</p>
                </div>

                <div className="host-answer-grid">
                  {currentQuestion.choices.map((choice, index) => (
                    <div
                      className={`host-answer-card host-answer-card-enter ${answerClassNames[index]}`}
                      key={choice.id}
                      style={{ animationDelay: `${index * 70}ms` }}
                    >
                      <div className="host-answer-card-head">
                        <ChoiceGlyph index={index} />
                      </div>
                      <strong>{choice.text}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="action-row action-row-spread">
                <button
                  className="button button-primary"
                  disabled={workingAction === 'close_question'}
                  onClick={() => handleAction('close_question')}
                  type="button"
                >
                  จบข้อนี้
                </button>
              </div>
            </div>
          ) : null}

          {showReveal && closedQuestion && closedQuestionStats ? (
            <div className="kahoot-stage results-stage stage-animate-in">
              <div className="kahoot-stage-header">
                <div>
                  <span className="eyebrow">Reveal</span>
                  <h2>
                    {view!.session.lastClosedQuestionIndex! + 1} / {view!.quizSet.questions.length}
                  </h2>
                </div>
                <div className="stage-progress-pill">
                  เหลือ {remainingQuestions} ข้อ
                </div>
              </div>
              {correctRevealChoice ? (
                <div className="reveal-spotlight stage-animate-in">
                  <div className={`reveal-spotlight-glyph ${answerClassNames[closedQuestion.choices.findIndex((choice) => choice.id === correctRevealChoice.id)]}`}>
                    <ChoiceGlyph index={closedQuestion.choices.findIndex((choice) => choice.id === correctRevealChoice.id)} />
                  </div>
                  <div className="reveal-spotlight-copy">
                    <span className="eyebrow">Correct</span>
                    <strong>{correctRevealChoice.text}</strong>
                  </div>
                </div>
              ) : null}

              <div className={`host-question-stage ${closedQuestion.imageUrl ? '' : 'host-question-stage-no-image'}`.trim()}>
                {closedQuestion.imageUrl ? (
                  <div className="stage-image-frame">
                    <img alt={closedQuestion.imageAlt ?? closedQuestion.prompt} src={closedQuestion.imageUrl} />
                  </div>
                ) : null}

                <div className="stage-question-copy">
                  <p>{closedQuestion.prompt}</p>
                </div>

                <div className="host-answer-grid host-answer-grid-reveal">
                  {closedQuestion.choices.map((choice, index) => {
                    const distributionItem = closedQuestionStats.distribution.find(
                      (item) => item.choiceId === choice.id,
                    )
                    const isCorrect = closedQuestion.correctChoiceId === choice.id

                    return (
                      <div
                        className={`host-answer-card host-answer-card-enter ${answerClassNames[index]} ${
                          isCorrect ? 'is-correct' : 'is-incorrect'
                        }`.trim()}
                        key={choice.id}
                        style={{ animationDelay: `${index * 90}ms` }}
                      >
                        <div className="host-answer-card-head">
                          <ChoiceGlyph index={index} />
                          <div className="answer-card-status">
                            <span className={`pill ${isCorrect ? 'pill-success pill-correct-answer' : ''}`.trim()}>
                              {isCorrect ? 'คำตอบที่ถูก' : `${distributionItem?.count ?? 0} โหวต`}
                            </span>
                          </div>
                        </div>
                        <strong>{choice.text}</strong>
                        <div className="distribution-bar distribution-bar-answer">
                          <span
                            style={{
                              width: `${Math.round(
                                ((distributionItem?.count ?? 0) / Math.max(1, closedQuestionStats.totalSubmissions)) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="answer-stat-row">
                          <span>{distributionItem?.count ?? 0} โหวต</span>
                          <span>
                            {percentLabel(
                              (distributionItem?.count ?? 0) /
                                Math.max(1, closedQuestionStats.totalSubmissions),
                            )}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="post-question-grid post-question-grid-tight">
                <section className="host-panel side-panel-card embedded-panel embedded-panel-compact">
                  <div className="panel-header">
                    <span className="eyebrow">Top 5</span>
                    <h2>Top 5</h2>
                  </div>
                  <div className="rank-list">
                    {topFive.length > 0 ? (
                      topFive.map((ranking, index) => (
                        <div
                          className="rank-row rank-row-highlight rank-row-enter"
                          key={ranking.participantId}
                          style={{ animationDelay: `${index * 80}ms` }}
                        >
                          <span>#{ranking.rank}</span>
                          <strong>{ranking.displayName}</strong>
                          <div className="rank-row-meta">
                            {ranking.currentStreak >= 2 ? (
                              <span className="pill pill-streak">Hot {ranking.currentStreak}</span>
                            ) : null}
                            <span>{ranking.score}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="side-note">ยังไม่มีคะแนน</p>
                    )}
                  </div>
                </section>

                <section className="host-panel side-panel-card embedded-panel embedded-panel-compact">
                  <div className="panel-header">
                    <span className="eyebrow">Round</span>
                    <h2>จบข้อนี้</h2>
                  </div>
                  <div className="summary-grid summary-grid-tight">
                    <article className="summary-card summary-card-enter" style={{ animationDelay: '0ms' }}>
                      <strong>ถูก</strong>
                      <p>{percentLabel(closedQuestionStats.accuracyRate)}</p>
                    </article>
                    <article className="summary-card summary-card-enter" style={{ animationDelay: '60ms' }}>
                      <strong>เหลือ</strong>
                      <p>{remainingQuestions}</p>
                    </article>
                    <article className="summary-card summary-card-enter" style={{ animationDelay: '120ms' }}>
                      <strong>ตอบแล้ว</strong>
                      <p>{closedQuestionStats.totalSubmissions}</p>
                    </article>
                    <article className="summary-card summary-card-enter" style={{ animationDelay: '180ms' }}>
                      <strong>เฉลย</strong>
                      <p>{closedQuestion.explanation || '-'}</p>
                    </article>
                    <article className="summary-card summary-card-enter" style={{ animationDelay: '240ms' }}>
                      <strong>ชวนคุย</strong>
                      <p>{closedQuestion.facilitatorPrompt || '-'}</p>
                    </article>
                  </div>
                </section>
              </div>

              <div className="action-row action-row-spread">
                <button
                  className="button button-secondary"
                  disabled={workingAction === 'show_leaderboard'}
                  onClick={() => handleAction('show_leaderboard')}
                  type="button"
                >
                  Top 5
                </button>
                <button
                  className="button button-primary"
                  disabled={workingAction === 'advance' || workingAction === 'finish'}
                  onClick={() => handleAction(isFinalQuestion ? 'finish' : 'advance')}
                  type="button"
                >
                  {isFinalQuestion ? 'จบเกม' : 'ข้อถัดไป'}
                </button>
              </div>
            </div>
          ) : null}

          {showLeaderboard ? (
            <div className="kahoot-stage leaderboard-stage stage-animate-in">
              <div className="kahoot-stage-header">
                <div>
                  <span className="eyebrow">Leaderboard</span>
                  <h2>Top 5</h2>
                </div>
                <div className="stage-progress-pill">
                  เหลือ {remainingQuestions} ข้อ
                </div>
              </div>
              {winner ? (
                <div className="leaderboard-winner-banner">
                  <span className="eyebrow">Leading</span>
                  <strong>{winner.displayName}</strong>
                  <div className="leaderboard-meta">
                    <span>{winner.score} pts</span>
                    {winner.currentStreak >= 2 ? <span className="pill pill-streak">Hot {winner.currentStreak}</span> : null}
                  </div>
                </div>
              ) : null}

              <div className="leaderboard-stage-grid">
                {topFive.length > 0 ? (
                  <>
                    <div className="leaderboard-podium">
                      {podiumPlayers.map((ranking) => (
                        <article
                          className={`leaderboard-card leaderboard-card-podium leaderboard-card-enter leaderboard-card-rank-${ranking.rank} ${
                            ranking.rank === 1 ? 'leaderboard-card-winner' : ''
                          }`.trim()}
                          key={ranking.participantId}
                          style={{ animationDelay: `${(ranking.rank - 1) * 90}ms` }}
                        >
                          <span className="leaderboard-rank">#{ranking.rank}</span>
                          <strong>{ranking.displayName}</strong>
                          <div className="leaderboard-meta">
                            <span>{ranking.score} pts</span>
                            {ranking.currentStreak >= 2 ? (
                              <span className="pill pill-streak">Hot {ranking.currentStreak}</span>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>

                    {podiumRemainder.length > 0 ? (
                      <div className="rank-list">
                        {podiumRemainder.map((ranking, index) => (
                          <div
                            className="rank-row rank-row-highlight rank-row-enter"
                            key={ranking.participantId}
                            style={{ animationDelay: `${260 + index * 70}ms` }}
                          >
                            <span>#{ranking.rank}</span>
                            <strong>{ranking.displayName}</strong>
                            <div className="rank-row-meta">
                              {ranking.currentStreak >= 2 ? (
                                <span className="pill pill-streak">Hot {ranking.currentStreak}</span>
                              ) : null}
                              <span>{ranking.score}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <section className="host-panel side-panel-card embedded-panel embedded-panel-compact">
                    <p className="side-note">ยังไม่มีคะแนน</p>
                  </section>
                )}
              </div>

              <div className="action-row action-row-spread">
                <button
                  className="button button-primary"
                  disabled={workingAction === 'advance' || workingAction === 'finish'}
                  onClick={() => handleAction(isFinalQuestion ? 'finish' : 'advance')}
                  type="button"
                >
                  {isFinalQuestion ? 'จบเกม' : 'ข้อถัดไป'}
                </button>
              </div>
            </div>
          ) : null}

          {showFinished ? (
            <div className="kahoot-stage final-stage stage-animate-in">
              <div className="kahoot-stage-header">
                <div>
                  <span className="eyebrow">Finished</span>
                  <h2>สรุปเกม</h2>
                </div>
                <Link className="button button-secondary button-inline" to="/host">
                  กลับไป Library
                </Link>
              </div>

              <div className="post-question-grid final-stage-grid">
                <section className="host-panel side-panel-card embedded-panel">
                  <div className="panel-header">
                    <span className="eyebrow">Top 5</span>
                    <h2>Top 5</h2>
                  </div>
                  {topFive.length > 0 ? (
                    <>
                      <div className="leaderboard-podium leaderboard-podium-final">
                        {podiumPlayers.map((ranking) => (
                          <article
                            className={`leaderboard-card leaderboard-card-podium leaderboard-card-enter leaderboard-card-rank-${ranking.rank} ${
                              ranking.rank === 1 ? 'leaderboard-card-winner' : ''
                            }`.trim()}
                            key={ranking.participantId}
                            style={{ animationDelay: `${(ranking.rank - 1) * 90}ms` }}
                          >
                            <span className="leaderboard-rank">#{ranking.rank}</span>
                            <strong>{ranking.displayName}</strong>
                            <div className="leaderboard-meta">
                              <span>{ranking.score} pts</span>
                            </div>
                          </article>
                        ))}
                      </div>

                      {podiumRemainder.length > 0 ? (
                        <div className="rank-list">
                          {podiumRemainder.map((ranking, index) => (
                            <div
                              className="rank-row rank-row-highlight rank-row-enter"
                              key={ranking.participantId}
                              style={{ animationDelay: `${260 + index * 70}ms` }}
                            >
                              <span>#{ranking.rank}</span>
                              <strong>{ranking.displayName}</strong>
                              <span>{ranking.score}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="side-note">ยังไม่มีคะแนน</p>
                  )}
                </section>

                <section className="host-panel side-panel-card embedded-panel">
                  <div className="panel-header">
                    <span className="eyebrow">Summary</span>
                    <h2>ภาพรวม</h2>
                  </div>
                  <div className="summary-grid">
                    <article className="summary-card summary-card-enter" style={{ animationDelay: '60ms' }}>
                      <strong>ผู้เล่น</strong>
                      <p>{view?.summary.totalParticipants ?? 0}</p>
                    </article>
                    <article className="summary-card summary-card-enter" style={{ animationDelay: '120ms' }}>
                      <strong>ยากสุด</strong>
                      <p>{view?.summary.hardestQuestion ?? '-'}</p>
                    </article>
                    <article className="summary-card summary-card-enter" style={{ animationDelay: '180ms' }}>
                      <strong>เด่นสุด</strong>
                      <p>{view?.summary.strongestTopic ?? '-'}</p>
                    </article>
                    <article className="summary-card summary-card-enter" style={{ animationDelay: '240ms' }}>
                      <strong>อ่อนสุด</strong>
                      <p>{view?.summary.weakestTopic ?? '-'}</p>
                    </article>
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
