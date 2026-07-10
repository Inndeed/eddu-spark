import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import {
  getHostSession,
  hasSupabaseBrowserConfig,
  onHostAuthStateChange,
} from './supabase'

export const useHostSession = () => {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(() => !hasSupabaseBrowserConfig())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasSupabaseBrowserConfig()) {
      setError(
        'Supabase browser configuration is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      )
      return
    }

    let active = true

    void getHostSession()
      .then((nextSession) => {
        if (!active) {
          return
        }

        setSession(nextSession)
        setReady(true)
      })
      .catch((nextError) => {
        if (!active) {
          return
        }

        setError(nextError instanceof Error ? nextError.message : 'Unable to load host session')
        setReady(true)
      })

    const { data } = onHostAuthStateChange((nextSession) => {
      if (!active) {
        return
      }

      setSession(nextSession)
      setReady(true)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return {
    configured: hasSupabaseBrowserConfig(),
    session,
    ready,
    error,
  }
}
