import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'

export const useSessionChannel = (
  joinCode: string | null | undefined,
  onRefresh: () => void | Promise<void>,
) => {
  const refreshEvent = useEffectEvent(() => {
    startTransition(() => {
      void onRefresh()
    })
  })

  useEffect(() => {
    if (!joinCode) {
      return
    }

    let cancelled = false
    let socket: WebSocket | null = null
    let reconnectTimeout: number | null = null

    const connect = () => {
      socket = new WebSocket(`${window.location.origin.replace(/^http/, 'ws')}/ws`)

      socket.addEventListener('open', () => {
        socket?.send(
          JSON.stringify({
            type: 'subscribe',
            joinCode,
          }),
        )
      })

      socket.addEventListener('message', () => {
        refreshEvent()
      })

      socket.addEventListener('close', () => {
        if (!cancelled) {
          reconnectTimeout = window.setTimeout(connect, 1200)
        }
      })
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout)
      }
      socket?.close()
    }
  }, [joinCode])
}

export const useCountdown = (endsAt: string | null) => {
  const [now, setNow] = useState(() => Date.now())
  const endMs = useMemo(() => (endsAt ? Date.parse(endsAt) : null), [endsAt])

  useEffect(() => {
    if (!endMs) {
      return
    }

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 250)

    return () => {
      window.clearInterval(interval)
    }
  }, [endMs])

  if (!endMs) {
    return 0
  }

  return Math.max(0, Math.ceil((endMs - now) / 1000))
}

export const useMountedRef = () => {
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  return mountedRef
}
