import { useEffect, useState } from 'react'
import { checkHealth } from '@/api/health'

export function ServiceStatus() {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const abort = new AbortController()
    checkHealth(abort.signal).catch(() => {
      if (!abort.signal.aborted) setFailed(true)
    })
    return () => abort.abort()
  }, [attempt])

  if (!failed) return null

  return (
    <div className="site-container py-3" role="alert">
      <p>Сервис временно недоступен.</p>
      <button
        type="button"
        className="header-link"
        onClick={() => {
          setFailed(false)
          setAttempt((value) => value + 1)
        }}
      >
        Повторить
      </button>
    </div>
  )
}
