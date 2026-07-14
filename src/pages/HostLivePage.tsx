import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'

import { BrandLogo } from '../components/BrandLogo'
import { ChoiceGlyph } from '../components/ChoiceGlyph'
import { PosterFrame } from '../components/PosterFrame'
import { SoundToggle } from '../components/SoundToggle'
import { fetchAppHealth, fetchHostSession, sendHostAction } from '../lib/api'
import { useQuizAudio } from '../lib/audio'
import { toLocalizedError } from '../lib/errors'
import { percentLabel } from '../lib/format'
import { useCountdown, useSessionChannel } from '../lib/live'
import { signOutHostSession } from '../lib/supabase'
import { useHostSession } from '../lib/use-host-session'
import type { AppHealthData } from '../lib/api'

const answerClassNames = ['answer-red', 'answer-orange', 'answer-yellow', 'answer-green'] as const
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
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle')

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
      setError(toLocalizedError(loadError, 'โหลดห้องไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }, [joinCode, session])

  useEffect(() => {
    void fetchAppHealth()
      .then((payload) => setAppHealth(payload))
      .catch((healthError) => {
        setError(toLocalizedError(healthError, 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ'))
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

  useEffect(() => {
    if (copyState === 'idle') {
      return
    }

    const timeout = window.setTimeout(() => {
      setCopyState('idle')
    }, 1800)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [copyState])

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
      setError(toLocalizedError(actionError, 'อัปเดตข้อมูลไม่สำเร็จ'))
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
      setError(toLocalizedError(fullscreenError, 'เปลี่ยนโหมดเต็มจอไม่สำเร็จ'))
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

  const handleCopyJoinUrl = async () => {
    if (!joinUrl) {
      setCopyState('error')
      return
    }

    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopyState('success')
    } catch {
      setCopyState('error')
    }
  }

  const renderHostLiveState = (title: string, actionLabel?: string) => (
    <main className="app-shell">
      <PosterFrame className="poster-frame-page poster-frame-live-shell" contentClassName="host-live-shell host-live-shell-state">
        <section className="host-panel host-state-panel">
          <BrandLogo compact to="/host" />
          <div className="auth-loading-state">
            <span className="eyebrow">Live</span>
            <h1>{title}</h1>
          </div>
          {actionLabel ? (
            <Link className="button button-primary" to="/host">
              {actionLabel}
            </Link>
          ) : null}
        </section>
      </PosterFrame>
    </main>
  )

  if (!configured || appHealth?.status === 'setup_required') {
    return renderHostLiveState('หน้า Live ยังไม่พร้อม', 'กลับ')
  }

  if (!ready) {
    return renderHostLiveState('กำลังโหลด...')
  }

  if (!session) {
    return renderHostLiveState('Session ของ Host ไม่พร้อม', 'Login ใหม่')
  }

  if (loading && !view) {
    return renderHostLiveState('กำลังโหลดหน้า Live...')
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
  const ceremonyPlayers = [3, 2, 1]
    .map((rank) => topFive.find((entry) => entry.rank === rank))
    .filter((ranking): ranking is NonNullable<(typeof topFive)[number]> => Boolean(ranking))
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

  return (
    <main className="app-shell">
      <PosterFrame className="poster-frame-page poster-frame-live-shell" contentClassName="host-live-shell host-live-shell-immersive">
        <aside className="host-live-rail" aria-label="Host controls">
          <BrandLogo compact to="/host" />
          <div className="header-actions host-live-rail-actions">
            <button className="button button-ghost" onClick={() => void toggleFullscreen()} type="button">
              {fullscreenActive ? 'ย่อ' : 'เต็มจอ'}
            </button>
            <SoundToggle muted={muted} onToggle={toggleMuted} />
            <button className="button button-ghost" onClick={() => void signOutHostSession()} type="button">
              ออก
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
                  <span className="eyebrow">เข้า</span>
                  <div className="join-code-display">{view?.session.joinCode}</div>
                  {qrCodeUrl ? <img alt="QR code for joining the room" src={qrCodeUrl} /> : null}
                  <div className="join-url-panel">
                    <p>{joinUrl.replace(/^https?:\/\//, '')}</p>
                    <div className="join-url-actions">
                      <button
                        className="button button-secondary button-inline"
                        onClick={() => void handleCopyJoinUrl()}
                        type="button"
                      >
                        {copyState === 'success' ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
                      </button>
                      {copyState === 'error' ? (
                        <span className="join-url-feedback">คัดลอกไม่สำเร็จ</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="lobby-players-panel">
                  <div className="panel-header panel-header-lobby">
                    <div>
                      <span className="eyebrow">ผู้เล่น</span>
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
              <div className="kahoot-stage-header question-stage-header compact-stage-header">
                <div className="question-stage-counter">
                  <span className="eyebrow">ข้อ</span>
                  <h2>
                    {view!.session.currentQuestionIndex + 1}/{view!.quizSet.questions.length}
                  </h2>
                </div>
                <div className="question-stage-header-actions">
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
                  <button
                    className="button button-primary button-inline question-stage-close"
                    disabled={workingAction === 'close_question'}
                    onClick={() => handleAction('close_question')}
                    type="button"
                  >
                    จบข้อนี้
                  </button>
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
            </div>
          ) : null}

          {showReveal && closedQuestion && closedQuestionStats ? (
            <div className="kahoot-stage results-stage stage-animate-in">
              <div className="kahoot-stage-header reveal-stage-header compact-stage-header">
                <div className="reveal-stage-title">
                  <span className="eyebrow">เฉลย</span>
                  <h2>
                    {view!.session.lastClosedQuestionIndex! + 1}/{view!.quizSet.questions.length}
                  </h2>
                </div>
                <div className="reveal-stage-header-actions">
                  <button
                    className="button button-primary"
                    disabled={workingAction === 'show_leaderboard'}
                    onClick={() => handleAction('show_leaderboard')}
                    type="button"
                  >
                    สรุป
                  </button>
                </div>
              </div>
              <div
                className={`host-question-stage reveal-question-stage ${
                  closedQuestion.imageUrl ? 'reveal-question-stage-with-image' : 'host-question-stage-no-image'
                }`.trim()}
              >
                <div className={`reveal-media-column ${closedQuestion.imageUrl ? 'reveal-media-column-with-image' : ''}`.trim()}>
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
                </div>

                <div className="host-answer-grid host-answer-grid-reveal">
                  {closedQuestion.choices.map((choice, index) => {
                    const distributionItem = closedQuestionStats.distribution.find(
                      (item) => item.choiceId === choice.id,
                    )
                    const isCorrect = closedQuestion.correctChoiceId === choice.id
                    const voteCount = distributionItem?.count ?? 0

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
                          <span className={`pill ${isCorrect ? 'pill-success pill-correct-answer' : 'pill-vote-count'}`.trim()}>
                            {isCorrect ? 'คำตอบที่ถูก' : `${voteCount} โหวต`}
                          </span>
                        </div>
                        <div className="distribution-bar distribution-bar-answer">
                          <span
                            style={{
                              width: `${Math.round(
                                (voteCount / Math.max(1, closedQuestionStats.totalSubmissions)) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="answer-stat-row">
                          <span>{voteCount} โหวต</span>
                          <span>
                            {percentLabel(
                              voteCount / Math.max(1, closedQuestionStats.totalSubmissions),
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
                  <span className="eyebrow">สรุป</span>
                  <h2>สรุปคะแนน</h2>
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
              <div className="leaderboard-stage-grid leaderboard-stage-grid-single">
                {topFive.length > 0 ? (
                  <section className="leaderboard-summary-panel">
                    <div className="leaderboard-scoreboard">
                      <div className="leaderboard-scoreboard-head">
                        <span>No.</span>
                        <span>ชื่อผู้เล่น</span>
                        <span>คะแนน</span>
                        <span>Hot Streak</span>
                      </div>

                      <div className="leaderboard-scoreboard-body">
                        {topFive.map((ranking, index) => (
                          <article
                            className={`leaderboard-scoreboard-row leaderboard-card-enter ${
                              ranking.rank === 1 ? 'is-top-rank' : ''
                            }`.trim()}
                            key={ranking.participantId}
                            style={{ animationDelay: `${index * 80}ms` }}
                          >
                            <span className="leaderboard-scoreboard-rank">#{ranking.rank}</span>
                            <strong className="leaderboard-scoreboard-name">{ranking.displayName}</strong>
                            <span className="leaderboard-scoreboard-score">{ranking.score}</span>
                            <span className="leaderboard-scoreboard-streak">
                              {ranking.currentStreak >= 2 ? (
                                <span className="pill pill-streak">Hot {ranking.currentStreak}</span>
                              ) : (
                                <span className="leaderboard-scoreboard-streak-slot" aria-hidden="true" />
                              )}
                            </span>
                          </article>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="host-panel side-panel-card embedded-panel embedded-panel-compact">
                    <p className="side-note">ยังไม่มีคะแนน</p>
                  </section>
                )}
              </div>
            </div>
          ) : null}

            {showFinished ? (
              <div className="kahoot-stage final-stage stage-animate-in">
              <div className="kahoot-stage-header">
                <div>
                  <span className="eyebrow">จบเกม</span>
                  <h2>สรุปเกม</h2>
                </div>
                <Link className="button button-secondary button-inline" to="/host">
                  กลับไป Library
                </Link>
              </div>

              <div className="final-ceremony-stage">
                {topFive.length > 0 ? (
                  <>
                    <div className={`ceremony-podium ceremony-podium-${ceremonyPlayers.length}`.trim()}>
                      {ceremonyPlayers.map((ranking, index) => (
                        <article
                          className={`ceremony-card ceremony-card-rank-${ranking.rank} ceremony-card-enter ${
                            ranking.rank === 1 ? 'ceremony-card-champion' : ''
                          }`.trim()}
                          key={ranking.participantId}
                          style={{ animationDelay: `${index * 520}ms` }}
                        >
                          {ranking.rank === 1 ? (
                            <div className="ceremony-confetti" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                              <span />
                              <span />
                              <span />
                            </div>
                          ) : null}
                          <span className="ceremony-rank">#{ranking.rank}</span>
                          <strong>{ranking.displayName}</strong>
                          <div className="ceremony-meta">
                            <span>{ranking.score} คะแนน</span>
                            {ranking.currentStreak >= 2 ? (
                              <span className="pill pill-streak">Hot {ranking.currentStreak}</span>
                            ) : null}
                          </div>
                          {ranking.rank === 1 ? <span className="ceremony-champion-label">Champion</span> : null}
                        </article>
                      ))}
                    </div>

                    <section className="final-top-five-list">
                      <div className="panel-header">
                        <span className="eyebrow">อันดับ</span>
                        <h2>Top 5</h2>
                      </div>
                      <div className="rank-list rank-list-top-five">
                        {topFive.map((ranking, index) => (
                          <div
                            className={`rank-row rank-row-highlight rank-row-enter ${
                              ranking.rank === 1 ? 'rank-row-winner' : ''
                            }`.trim()}
                            key={ranking.participantId}
                            style={{ animationDelay: `${220 + index * 80}ms` }}
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
                    </section>
                  </>
                ) : (
                  <section className="host-panel side-panel-card embedded-panel embedded-panel-compact">
                    <p className="side-note">ยังไม่มีคะแนน</p>
                  </section>
                )}
              </div>
              </div>
            ) : null}
            </div>
          </section>
        </section>
      </PosterFrame>
    </main>
  )
}
