import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { ChoiceGlyph } from '../components/ChoiceGlyph'
import { fetchPlayerSession, submitAnswer } from '../lib/api'
import { useCountdown, useSessionChannel } from '../lib/live'
import { getPlayerRecord, setPlayerRecord } from '../lib/storage'
import type { PlayerSessionView } from '../lib/types'

const answerClassNames = ['answer-red', 'answer-orange', 'answer-yellow', 'answer-green'] as const

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
  const [optimisticSubmission, setOptimisticSubmission] = useState<{
    questionId: string
    choiceId: string
  } | null>(null)

  const loadSession = useCallback(async () => {
    if (!joinCode || !participantId) {
      setLoading(false)
      return
    }

    try {
      const payload = await fetchPlayerSession(joinCode, participantId)
      setView(payload)
      setOptimisticSubmission((current) => {
        if (!current || !payload.currentQuestion) {
          return null
        }

        if (payload.currentQuestion.id !== current.questionId) {
          return null
        }

        if (payload.currentQuestion.submittedChoiceId) {
          return {
            questionId: current.questionId,
            choiceId: payload.currentQuestion.submittedChoiceId,
          }
        }

        return payload.session.status === 'question_open' ? current : null
      })
      setPlayerRecord({
        joinCode,
        participantId,
        displayName: payload.participant.displayName,
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
    if (!joinCode || !participantId || !view?.currentQuestion) {
      return
    }

    setSubmittingChoiceId(choiceId)
    setError(null)
    setOptimisticSubmission({
      questionId: view.currentQuestion.id,
      choiceId,
    })

    try {
      await submitAnswer(joinCode, participantId, choiceId)
      void loadSession()
    } catch (submitError) {
      setOptimisticSubmission(null)
      setError(submitError instanceof Error ? submitError.message : 'Submit failed')
    } finally {
      setSubmittingChoiceId(null)
    }
  }

  if (!participantId || !joinCode) {
    return (
      <main className="player-live-shell">
        <section className="player-full-panel">
          <h1>ยังไม่พบผู้เล่น</h1>
          <Link className="button button-primary" to="/play">
            Join ใหม่
          </Link>
        </section>
      </main>
    )
  }

  if (loading && !view) {
    return (
      <main className="player-live-shell">
        <section className="player-full-panel">
          <h1>กำลังเชื่อม...</h1>
        </section>
      </main>
    )
  }

  const submittedChoiceId =
    view?.currentQuestion?.submittedChoiceId ??
    (optimisticSubmission?.questionId === view?.currentQuestion?.id
      ? optimisticSubmission?.choiceId ?? null
      : null)
  const isLiveQuestion = view?.session.status === 'question_open' && !!view?.currentQuestion && !submittedChoiceId
  const isWaitingDuringQuestion =
    view?.session.status === 'question_open' && !!view?.currentQuestion && !!submittedChoiceId

  return (
    <main className="player-live-shell">
      {error ? <p className="error-banner">{error}</p> : null}

      {view?.session.status === 'lobby' ? (
        <section className="player-full-panel player-wait-panel">
          <span className="eyebrow">Join</span>
          <h1>{joinCode}</h1>
          <p>{view.playerCount} players</p>
        </section>
      ) : null}

      {isLiveQuestion ? (
        <section className="player-answer-stage">
          <div className="player-stage-meta">
            <span>{countdown}s</span>
            <span>
              {view?.currentQuestion?.questionNumber}/{view?.currentQuestion?.totalQuestions}
            </span>
          </div>
          <div className="player-answer-grid">
            {view?.currentQuestion?.choiceIds.map((choiceId, index) => (
              <button
                className={`player-answer-button ${answerClassNames[index]} ${
                  submittingChoiceId === choiceId ? 'is-submitting' : ''
                }`.trim()}
                disabled={submittingChoiceId !== null}
                key={choiceId}
                onClick={() => handleSubmit(choiceId)}
                type="button"
              >
                <ChoiceGlyph index={index} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {isWaitingDuringQuestion ? (
        <section className="player-full-panel player-wait-panel">
          <span className="eyebrow">Locked</span>
          <h1>รอเฉลยบนจอหลัก</h1>
          <div className="waiting-room-placeholder">
            <div className="waiting-block" />
            <div className="waiting-block waiting-block-wide" />
          </div>
        </section>
      ) : null}

      {view?.session.status === 'question_closed' ? (
        <section className="player-full-panel player-wait-panel">
          <span className="eyebrow">Next</span>
          <h1>รอคำถามถัดไป</h1>
          <div className="waiting-room-placeholder">
            <div className="waiting-block" />
            <div className="waiting-block waiting-block-wide" />
          </div>
        </section>
      ) : null}

      {view?.session.status === 'leaderboard' ? (
        <section className="player-full-panel player-score-panel">
          <span className="eyebrow">Rank</span>
          <h1>#{view.leaderboard.yourRank ?? '-'}</h1>
          <p>{view.participant.score} pts</p>
          <div className="mini-score-list">
            {view.leaderboard.topPlayers.slice(0, 3).map((player) => (
              <div className="mini-score-row" key={player.participantId}>
                <span>#{player.rank}</span>
                <strong>{player.displayName}</strong>
                <span>{player.score}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view?.session.status === 'finished' ? (
        <section className="player-full-panel player-score-panel">
          <span className="eyebrow">Finish</span>
          <h1>#{view.leaderboard.yourRank ?? '-'}</h1>
          <p>{view.participant.score} pts</p>
          <Link className="button button-secondary" to="/play">
            เล่นใหม่
          </Link>
        </section>
      ) : null}
    </main>
  )
}
