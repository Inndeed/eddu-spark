import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'

import { BrandLogo } from '../components/BrandLogo'
import { ChoiceGlyph } from '../components/ChoiceGlyph'
import { SoundToggle } from '../components/SoundToggle'
import { fetchAppHealth, fetchHostSession, sendHostAction } from '../lib/api'
import { useQuizAudio } from '../lib/audio'
import { percentLabel } from '../lib/format'
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
  const [fullscreenActive, setFullscreenActive] = useState(false)
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, boolean>>({})

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

  useEffect(() => {
    const syncFullscreenState = () => {
      setFullscreenActive(Boolean(document.fullscreenElement))
    }

    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
    }
  }, [])

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

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        return
      }

      await document.exitFullscreen()
    } catch (fullscreenError) {
      setError(fullscreenError instanceof Error ? fullscreenError.message : 'Unable to change fullscreen')
    }
  }

  const registerImageFailure = (imageUrl: string) => {
    setFailedImageUrls((current) => {
      if (current[imageUrl]) {
        return current
      }

      return {
        ...current,
        [imageUrl]: true,
      }
    })
  }

  const renderHostLiveState = (title: string, actionLabel?: string) => (
    <main className="app-shell host-live-shell host-live-shell-state">
      <section className="host-panel host-state-panel">
        <BrandLogo compact to="/host" />
        <div className="auth-loading-state">
          <span className="eyebrow">Host Live</span>
          <h1>{title}</h1>
        </div>
        {actionLabel ? (
          <Link className="button button-primary" to="/host">
            {actionLabel}
          </Link>
        ) : null}
      </section>
    </main>
  )

  if (!configured || appHealth?.status === 'setup_required') {
    return renderHostLiveState('Live console ยังไม่พร้อม', 'กลับ')
  }

  if (!ready) {
    return renderHostLiveState('กำลังโหลด...')
  }

  if (!session) {
    return renderHostLiveState('Host session ไม่พร้อม', 'Login ใหม่')
  }

  if (loading && !view) {
    return renderHostLiveState('กำลังโหลด live...')
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
  const revealSummaryCards =
    closedQuestion && closedQuestionStats
      ? [
          { label: 'ถูก', value: percentLabel(closedQuestionStats.accuracyRate) },
          { label: 'เหลือ', value: String(remainingQuestions) },
          { label: 'ตอบแล้ว', value: String(closedQuestionStats.totalSubmissions) },
        ]
      : []

  return (
    <main className="app-shell host-live-shell host-live-shell-immersive">
      <aside className="host-topbar host-live-rail">
        <BrandLogo compact to="/host" />
        <div className="header-actions host-live-rail-actions">
          <button className="button button-ghost" onClick={() => void toggleFullscreen()} type="button">
            {fullscreenActive ? 'Exit full' : 'Full screen'}
          </button>
          <SoundToggle muted={muted} onToggle={toggleMuted} />
          <button className="button button-ghost" onClick={() => void signOutHostSession()} type="button">
            Logout
          </button>
        </div>
      </aside>

      <section className="host-live-main">
        {error ? <p className="error-text">{error}</p> : null}

        <section className="live-grid live-grid-single">
          <div className="live-stage-panel live-stage-panel-full">
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
                  <div className="panel-header panel-header-lobby">
                    <div>
                      <span className="eyebrow">Players</span>
                      <h2>{participants.length}</h2>
                    </div>
                    <div className="action-row action-row-spread lobby-stage-actions">
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
            </div>
          ) : null}

          {showQuestion && currentQuestion ? (
            <div className="kahoot-stage kahoot-stage-focus stage-animate-in">
              <div className="kahoot-stage-header question-stage-header">
                <div>
                  <span className="eyebrow">Question</span>
                  <h2>
                    {view!.session.currentQuestionIndex + 1} / {view!.quizSet.questions.length}
                  </h2>
                </div>
                <div className="stage-status-strip question-stage-status-strip">
                  <div className="stage-progress-pill question-stage-progress">
                    {view?.currentQuestionSubmissionCount ?? 0}/{view?.session.participants.length ?? 0} ตอบแล้ว
                  </div>
                  <div
                    className={`timer-badge timer-badge-large question-stage-timer ${
                      isTimerUrgent ? 'timer-badge-urgent' : ''
                    }`.trim()}
                  >
                    {countdown}s
                  </div>
                </div>
              </div>
              <div
                className={`stage-tension-bar question-stage-tension-bar ${isTimerUrgent ? 'is-urgent' : ''}`.trim()}
                aria-hidden="true"
              >
                <span style={{ width: `${countdownRatio * 100}%` }} />
              </div>

              <div
                className={`host-question-stage ${currentQuestion.imageUrl ? '' : 'host-question-stage-no-image'}`.trim()}
              >
                {currentQuestion.imageUrl ? (
                  failedImageUrls[currentQuestion.imageUrl] ? (
                    <div className="stage-image-empty">
                      <span>ภาพไม่พร้อมแสดงผล</span>
                    </div>
                  ) : (
                    <div className="stage-image-frame">
                      <img
                        alt={currentQuestion.imageAlt ?? currentQuestion.prompt}
                        onError={() => registerImageFailure(currentQuestion.imageUrl!)}
                        src={currentQuestion.imageUrl}
                      />
                    </div>
                  )
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
                      <div className="host-answer-card-main">
                        <ChoiceGlyph index={index} />
                        <strong>{choice.text}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="action-row action-row-spread question-stage-actions">
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
                <div className="reveal-stage-header-actions">
                  <div className="stage-progress-pill">
                    เหลือ {remainingQuestions} ข้อ
                  </div>
                  <button
                    className="button button-primary"
                    disabled={workingAction === 'show_leaderboard'}
                    onClick={() => handleAction('show_leaderboard')}
                    type="button"
                  >
                    Summary
                  </button>
                </div>
              </div>
              {correctRevealChoice ? (
                <div className="reveal-spotlight stage-animate-in">
                  <div className={`reveal-spotlight-glyph ${answerClassNames[closedQuestion.choices.findIndex((choice) => choice.id === correctRevealChoice.id)]}`}>
                    <ChoiceGlyph index={closedQuestion.choices.findIndex((choice) => choice.id === correctRevealChoice.id)} />
                  </div>
                  <div className="reveal-spotlight-copy">
                    <span className="eyebrow">Correct</span>
                    <strong>คำตอบที่ถูก</strong>
                  </div>
                </div>
              ) : null}

              <div
                className={`host-question-stage reveal-question-stage ${
                  closedQuestion.imageUrl ? '' : 'host-question-stage-no-image'
                }`.trim()}
              >
                {closedQuestion.imageUrl ? (
                  failedImageUrls[closedQuestion.imageUrl] ? (
                    <div className="stage-image-empty stage-image-empty-reveal">
                      <span>ภาพไม่พร้อมแสดงผล</span>
                    </div>
                  ) : (
                    <div className="stage-image-frame stage-image-frame-reveal">
                      <img
                        alt={closedQuestion.imageAlt ?? closedQuestion.prompt}
                        onError={() => registerImageFailure(closedQuestion.imageUrl!)}
                        src={closedQuestion.imageUrl}
                      />
                    </div>
                  )
                ) : null}

                <div className="stage-question-copy stage-question-copy-reveal">
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
                        <div className="host-answer-card-main">
                          <ChoiceGlyph index={index} />
                          <strong>{choice.text}</strong>
                        </div>
                        <div className="answer-card-status">
                          <span className={`pill ${isCorrect ? 'pill-success pill-correct-answer' : ''}`.trim()}>
                            {isCorrect ? 'คำตอบที่ถูก' : `${distributionItem?.count ?? 0} โหวต`}
                          </span>
                        </div>
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
            </div>
          ) : null}

          {showLeaderboard ? (
            <div className="kahoot-stage leaderboard-stage stage-animate-in">
              <div className="kahoot-stage-header">
                <div>
                  <span className="eyebrow">Summary</span>
                  <h2>หลังข้อนี้</h2>
                </div>
                <div className="summary-stage-header-actions">
                  <div className="stage-progress-pill">
                    เหลือ {remainingQuestions} ข้อ
                  </div>
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

                {revealSummaryCards.length > 0 ? (
                  <section className="host-panel side-panel-card embedded-panel embedded-panel-compact">
                    <div className="panel-header">
                      <span className="eyebrow">Round</span>
                      <h2>หลังข้อนี้</h2>
                    </div>
                    <div className="summary-grid summary-grid-tight">
                      {revealSummaryCards.map((card, index) => (
                        <article
                          className="summary-card summary-card-enter"
                          key={card.label}
                          style={{ animationDelay: `${260 + index * 60}ms` }}
                        >
                          <strong>{card.label}</strong>
                          <p>{card.value}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
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
      </section>
    </main>
  )
}
