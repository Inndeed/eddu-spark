import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { BrandLogo } from '../components/BrandLogo'
import { ChoiceGlyph } from '../components/ChoiceGlyph'
import { fetchPlayerSession, submitAnswer } from '../lib/api'
import { toLocalizedError } from '../lib/errors'
import { normalizeJoinCode } from '../lib/join-code'
import { useSessionChannel } from '../lib/live'
import { getPlayerRecord, setPlayerRecord } from '../lib/storage'
import type { PlayerSessionView } from '../lib/types'

const answerClassNames = ['answer-red', 'answer-orange', 'answer-yellow', 'answer-green'] as const

export function PlayerSessionPage() {
  const { joinCode } = useParams()
  const normalizedJoinCode = normalizeJoinCode(joinCode ?? '')
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const queryParticipantId = query.get('participantId')
  const rememberedParticipantId = normalizedJoinCode ? getPlayerRecord(normalizedJoinCode)?.participantId : null
  const participantId = queryParticipantId ?? rememberedParticipantId

  const [view, setView] = useState<PlayerSessionView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [knownQuestionTotal, setKnownQuestionTotal] = useState(0)
  const [submittingChoiceId, setSubmittingChoiceId] = useState<string | null>(null)
  const [optimisticSubmission, setOptimisticSubmission] = useState<{
    questionId: string
    choiceId: string
  } | null>(null)
  const [lockPreview, setLockPreview] = useState<{
    questionId: string
    choiceId: string
  } | null>(null)
  const lockTimeoutRef = useRef<number | null>(null)

  const loadSession = useCallback(async () => {
    if (!normalizedJoinCode || !participantId) {
      setLoading(false)
      return
    }

    try {
      const payload = await fetchPlayerSession(normalizedJoinCode, participantId)
      setView(payload)
      if (payload.currentQuestion?.totalQuestions) {
        setKnownQuestionTotal(payload.currentQuestion.totalQuestions)
      }
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
      if (payload.session.status !== 'question_open' || !payload.currentQuestion?.submittedChoiceId) {
        setLockPreview(null)
      }
      setPlayerRecord({
        joinCode: normalizedJoinCode,
        participantId,
        displayName: payload.participant.displayName,
      })
      setError(null)
    } catch (loadError) {
      setError(toLocalizedError(loadError, 'โหลดห้องไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }, [normalizedJoinCode, participantId])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  useEffect(() => {
    return () => {
      if (lockTimeoutRef.current) {
        window.clearTimeout(lockTimeoutRef.current)
      }
    }
  }, [])

  useSessionChannel(normalizedJoinCode, loadSession)

  const handleSubmit = async (choiceId: string) => {
    if (!normalizedJoinCode || !participantId || !view?.currentQuestion) {
      return
    }

    setSubmittingChoiceId(choiceId)
    setError(null)
    if (lockTimeoutRef.current) {
      window.clearTimeout(lockTimeoutRef.current)
    }
    setLockPreview({
      questionId: view.currentQuestion.id,
      choiceId,
    })
    setOptimisticSubmission({
      questionId: view.currentQuestion.id,
      choiceId,
    })
    lockTimeoutRef.current = window.setTimeout(() => {
      setLockPreview((current) =>
        current && current.questionId === view.currentQuestion?.id && current.choiceId === choiceId
          ? null
          : current,
      )
      lockTimeoutRef.current = null
    }, 260)

    try {
      await submitAnswer(normalizedJoinCode, participantId, choiceId)
      void loadSession()
    } catch (submitError) {
      setOptimisticSubmission(null)
      setLockPreview(null)
      setError(toLocalizedError(submitError, 'ส่งคำตอบไม่สำเร็จ'))
    } finally {
      setSubmittingChoiceId(null)
    }
  }

  if (!participantId || !normalizedJoinCode) {
    return (
      <main className="player-live-shell">
        <section className="player-full-panel">
          <BrandLogo compact className="player-brand-mark" />
          <h1>ยังไม่พบผู้เล่น</h1>
          <Link className="button button-primary" to="/play">
            เข้าใหม่
          </Link>
        </section>
      </main>
    )
  }

  if (loading && !view) {
    return (
      <main className="player-live-shell">
        <section className="player-full-panel">
          <BrandLogo compact className="player-brand-mark" />
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
  const selectedPreviewChoiceId =
    lockPreview && lockPreview.questionId === view?.currentQuestion?.id ? lockPreview.choiceId : null
  const selectedChoiceId = selectedPreviewChoiceId ?? submittedChoiceId
  const selectedChoiceIndex = selectedChoiceId
    ? view?.currentQuestion?.choiceIds.findIndex((choiceId) => choiceId === selectedChoiceId) ?? -1
    : -1
  const codeCells = Array.from({ length: 6 }, (_, index) => normalizedJoinCode[index] ?? '')
  const totalQuestions = knownQuestionTotal
  const completedQuestions =
    view?.session.status === 'finished'
      ? totalQuestions
      : view?.session.status === 'question_open'
        ? Math.max((view.currentQuestion?.questionNumber ?? 1) - 1, 0)
        : Math.max((view?.session.lastClosedQuestionIndex ?? -1) + 1, 0)
  const remainingQuestions = Math.max(totalQuestions - completedQuestions, 0)
  const isLiveQuestion =
    view?.session.status === 'question_open' &&
    !!view?.currentQuestion &&
    (!submittedChoiceId || !!selectedPreviewChoiceId)
  const isWaitingDuringQuestion =
    view?.session.status === 'question_open' &&
    !!view?.currentQuestion &&
    !!submittedChoiceId &&
    !selectedPreviewChoiceId

  return (
    <main className="player-live-shell">
      {error ? <p className="error-banner">{error}</p> : null}

      {view?.session.status === 'lobby' ? (
        <section className="player-full-panel player-wait-panel player-lobby-panel">
          <BrandLogo compact className="player-brand-mark" />
          <div className="entry-pin-preview entry-pin-preview-tight" aria-hidden="true">
            {codeCells.map((cell, index) => (
              <span className="entry-pin-cell is-filled" key={index}>
                {cell}
              </span>
            ))}
          </div>
          <div className="player-identity-badge">
            <span className="eyebrow">ผู้เล่น</span>
            <h1>{view.participant.displayName}</h1>
          </div>
          <p>{view.playerCount} คน</p>
          <div className="player-status-glyphs" aria-hidden="true">
            {answerClassNames.map((_, index) => (
              <ChoiceGlyph className="choice-glyph-small" index={index} key={index} />
            ))}
          </div>
        </section>
      ) : null}

      {isLiveQuestion ? (
        <section className={`player-answer-stage ${selectedPreviewChoiceId ? 'is-locking' : ''}`.trim()}>
          {selectedChoiceIndex >= 0 && selectedPreviewChoiceId ? (
            <div className="player-lock-overlay" aria-hidden="true">
              <div className={`player-lock-burst ${answerClassNames[selectedChoiceIndex]}`}>
                <ChoiceGlyph index={selectedChoiceIndex} />
              </div>
            </div>
          ) : null}
          <div className={`player-answer-grid ${selectedPreviewChoiceId ? 'is-locked' : ''}`.trim()}>
            {view?.currentQuestion?.choiceIds.map((choiceId, index) => (
              <button
                className={`player-answer-button ${answerClassNames[index]} ${
                  selectedPreviewChoiceId === choiceId ? 'is-submitting is-selected' : ''
                } ${
                  selectedPreviewChoiceId && selectedPreviewChoiceId !== choiceId ? 'is-dimmed' : ''
                }`.trim()}
                disabled={submittingChoiceId !== null || !!submittedChoiceId}
                key={choiceId}
                onClick={() => handleSubmit(choiceId)}
                type="button"
                aria-label={`choice ${index + 1}`}
              >
                <ChoiceGlyph index={index} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {isWaitingDuringQuestion ? (
        <section className="player-full-panel player-wait-panel player-wait-panel-compact">
          <BrandLogo compact className="player-brand-mark" />
          <span className="eyebrow">ตอบแล้ว</span>
          <h1>รอเฉลย</h1>
          {selectedChoiceIndex >= 0 ? (
            <div className={`waiting-choice-chip ${answerClassNames[selectedChoiceIndex]}`}>
              <ChoiceGlyph index={selectedChoiceIndex} />
            </div>
          ) : null}
          {totalQuestions > 0 ? (
            <div className="question-progress-dots" aria-label={`completed ${completedQuestions} of ${totalQuestions}`}>
              {Array.from({ length: totalQuestions }, (_, index) => (
                <span className={index < completedQuestions ? 'is-complete' : ''} key={index} />
              ))}
            </div>
          ) : null}
          <div className="player-wait-meta">
            <span>{remainingQuestions > 0 ? `เหลือ ${remainingQuestions} ข้อ` : 'ข้อสุดท้าย'}</span>
          </div>
          <div className="waiting-room-placeholder">
            <div className="waiting-block" />
            <div className="waiting-block waiting-block-wide" />
          </div>
        </section>
      ) : null}

      {view?.session.status === 'question_closed' ? (
        <section className="player-full-panel player-wait-panel player-wait-panel-compact">
          <BrandLogo compact className="player-brand-mark" />
          <span className="eyebrow">รอ</span>
          <h1>เตรียมข้อถัดไป</h1>
          {totalQuestions > 0 ? (
            <div className="question-progress-dots" aria-label={`completed ${completedQuestions} of ${totalQuestions}`}>
              {Array.from({ length: totalQuestions }, (_, index) => (
                <span className={index < completedQuestions ? 'is-complete' : ''} key={index} />
              ))}
            </div>
          ) : null}
          <div className="player-wait-meta">
            <span>{remainingQuestions > 0 ? `เหลือ ${remainingQuestions} ข้อ` : 'กำลังสรุปผล'}</span>
          </div>
          <div className="waiting-room-placeholder">
            <div className="waiting-block" />
            <div className="waiting-block waiting-block-wide" />
          </div>
        </section>
      ) : null}

      {view?.session.status === 'leaderboard' ? (
        <section className="player-full-panel player-score-panel player-score-panel-compact">
          <BrandLogo compact className="player-brand-mark" />
          <span className="eyebrow">อันดับ</span>
          <div className="player-rank-hero">
            <h1>#{view.leaderboard.yourRank ?? '-'}</h1>
            <p>{view.participant.score} คะแนน</p>
          </div>
          <div className="mini-score-list">
            {view.leaderboard.topPlayers.slice(0, 5).map((player, index) => (
              <div
                className="mini-score-row mini-score-row-enter"
                key={player.participantId}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <span>#{player.rank}</span>
                <strong>{player.displayName}</strong>
                <span>{player.score}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view?.session.status === 'finished' ? (
        <section className="player-full-panel player-score-panel player-score-panel-compact">
          <BrandLogo compact className="player-brand-mark" />
          <span className="eyebrow">จบเกม</span>
          <div className="player-rank-hero">
            <h1>#{view.leaderboard.yourRank ?? '-'}</h1>
            <p>{view.participant.score} คะแนน</p>
          </div>
          <Link className="button button-secondary" to="/play">
            เล่นอีกครั้ง
          </Link>
        </section>
      ) : null}
    </main>
  )
}
