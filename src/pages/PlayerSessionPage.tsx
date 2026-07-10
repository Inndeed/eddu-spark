import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { fetchPlayerSession, submitAnswer } from '../lib/api'
import { useCountdown, useSessionChannel } from '../lib/live'
import { getPlayerRecord, setPlayerRecord } from '../lib/storage'
import type { PlayerSessionView } from '../lib/types'

export function PlayerSessionPage() {
  const { joinCode } = useParams()
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const queryParticipantId = query.get('participantId')
  const rememberedParticipantId = joinCode ? getPlayerRecord(joinCode)?.participantId : null
  const participantId = queryParticipantId ?? rememberedParticipantId

  const [view, setView] = useState<PlayerSessionView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submittingChoiceId, setSubmittingChoiceId] = useState<string | null>(null)

  const loadSession = useCallback(async () => {
    if (!joinCode || !participantId) {
      setLoading(false)
      return
    }

    try {
      const payload = await fetchPlayerSession(joinCode, participantId)
      setView(payload)
      setPlayerRecord({
        joinCode,
        participantId,
        displayName: payload.participant.displayName,
        teamName: payload.participant.teamName,
      })
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load session')
    } finally {
      setLoading(false)
    }
  }, [joinCode, participantId])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  useSessionChannel(joinCode, loadSession)

  const countdown = useCountdown(view?.currentQuestion?.endsAt ?? null)

  const handleSubmit = async (choiceId: string) => {
    if (!joinCode || !participantId) {
      return
    }

    setSubmittingChoiceId(choiceId)
    try {
      await submitAnswer(joinCode, participantId, choiceId)
      await loadSession()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Submit failed')
    } finally {
      setSubmittingChoiceId(null)
    }
  }

  if (!participantId || !joinCode) {
    return (
      <main className="app-shell player-shell">
        <section className="player-join-panel">
          <h1>ยังไม่มีข้อมูลผู้เล่น</h1>
          <Link className="button button-primary" to="/play">
            กลับไป join ใหม่
          </Link>
        </section>
      </main>
    )
  }

  if (loading && !view) {
    return (
      <main className="app-shell player-shell">
        <section className="player-join-panel">
          <h1>กำลังเชื่อม session...</h1>
        </section>
      </main>
    )
  }

  const submittedChoiceId = view?.currentQuestion?.submittedChoiceId ?? null

  return (
    <main className="app-shell player-shell">
      <section className="player-session-shell">
        <div className="player-topbar">
          <div>
            <span className="eyebrow">Live Session</span>
            <h1>{view?.session.quizSetTitle}</h1>
          </div>
          <div className="player-meta">
            <span>{view?.participant.displayName}</span>
            <span>{view?.participant.teamName}</span>
            <span>{view?.playerCount ?? 0} players</span>
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        {view?.session.status === 'lobby' ? (
          <section className="player-card">
            <span className="eyebrow">Waiting Room</span>
            <h2>host กำลังเตรียมเริ่มเกม</h2>
            <p>เมื่อคำถามถูกเปิด หน้านี้จะอัปเดตอัตโนมัติ</p>
          </section>
        ) : null}

        {view?.currentQuestion ? (
          <section className="player-card live-question-card">
            <div className="stage-header">
              <div>
                <span className="eyebrow">
                  Question {view.currentQuestion.questionNumber} /{' '}
                  {view.currentQuestion.totalQuestions}
                </span>
                <h2>{view.currentQuestion.prompt}</h2>
              </div>
              <div className="timer-badge">{countdown}s</div>
            </div>
            <div className="answer-grid">
              {view.currentQuestion.choices.map((choice) => {
                const isSubmitted = submittedChoiceId === choice.id
                return (
                  <button
                    className={`answer-card ${isSubmitted ? 'answer-card-selected' : ''}`}
                    disabled={!!submittedChoiceId || submittingChoiceId === choice.id}
                    key={choice.id}
                    onClick={() => handleSubmit(choice.id)}
                    type="button"
                  >
                    <strong>{choice.text}</strong>
                    {isSubmitted ? <span className="pill pill-success">Locked in</span> : null}
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}

        {view?.reveal ? (
          <section className="player-card">
            <span className="eyebrow">Reveal</span>
            <h2>{view.reveal.prompt}</h2>
            <p className="lead-text">{view.reveal.explanation}</p>
            <div className="distribution-list">
              {view.reveal.distribution.map((choice) => (
                <div className="distribution-row" key={choice.choiceId}>
                  <div className="distribution-label">
                    <strong>{choice.text}</strong>
                    {choice.isCorrect ? <span className="pill pill-success">Correct</span> : null}
                    {view.reveal?.yourChoiceId === choice.choiceId ? (
                      <span className="pill">Your answer</span>
                    ) : null}
                  </div>
                  <div className="distribution-bar">
                    <span
                      style={{
                        width: `${
                          view.playerCount === 0 ? 0 : (choice.count / view.playerCount) * 100
                        }%`,
                      }}
                    />
                  </div>
                  <span>{choice.count}</span>
                </div>
              ))}
            </div>
            <p className="prompt-note">{view.reveal.facilitatorPrompt}</p>
          </section>
        ) : null}

        {view?.session.status === 'leaderboard' || view?.session.status === 'finished' ? (
          <section className="player-card">
            <div className="panel-header">
              <span className="eyebrow">Leaderboard</span>
              <h2>
                คุณอยู่อันดับ #{view.leaderboard.yourRank ?? '-'} | ทีมอันดับ #
                {view.leaderboard.yourTeamRank ?? '-'}
              </h2>
            </div>
            <div className="rankings-grid">
              <div>
                <h3>Top Players</h3>
                <div className="rank-list">
                  {view.leaderboard.topPlayers.map((player) => (
                    <div className="rank-row" key={player.participantId}>
                      <span>#{player.rank}</span>
                      <div>
                        <strong>{player.displayName}</strong>
                        <p>{player.teamName}</p>
                      </div>
                      <strong>{player.score}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3>Top Teams</h3>
                <div className="rank-list">
                  {view.leaderboard.topTeams.map((team) => (
                    <div className="rank-row" key={team.teamName}>
                      <span>#{team.rank}</span>
                      <div>
                        <strong>{team.teamName}</strong>
                        <p>{team.members} members</p>
                      </div>
                      <strong>{team.score}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {view?.finalSummary ? (
          <section className="player-card final-summary-card">
            <span className="eyebrow">Session Summary</span>
            <h2>สิ่งที่ทีมควรเอากลับไปคิดต่อ</h2>
            <div className="summary-grid">
              <article className="summary-card">
                <strong>Hardest question</strong>
                <p>{view.finalSummary.hardestQuestion ?? 'ยังไม่มีข้อมูล'}</p>
              </article>
              <article className="summary-card">
                <strong>Strongest topic</strong>
                <p>{view.finalSummary.strongestTopic ?? 'ยังไม่มีข้อมูล'}</p>
              </article>
              <article className="summary-card">
                <strong>Weakest topic</strong>
                <p>{view.finalSummary.weakestTopic ?? 'ยังไม่มีข้อมูล'}</p>
              </article>
            </div>
            <Link className="button button-secondary" to="/play">
              กลับไปหน้า join
            </Link>
          </section>
        ) : null}
      </section>
    </main>
  )
}
