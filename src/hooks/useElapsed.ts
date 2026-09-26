import { useEffect, useState } from 'react'

export function useElapsed(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (startedAt === null) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [startedAt])

  if (startedAt === null) return 0
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}
