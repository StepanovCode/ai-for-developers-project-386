import { useEffect, useState } from 'react'
import { listMeetings, type Meeting } from './api/generated'
import { AdminNav } from './events'

const maxDelay = 2147483647
const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
})
export function MeetingsPage() {
  const [items, setItems] = useState<Meeting[]>([])
  const [clock, setClock] = useState<{ server: number; received: number }>()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    void listMeetings({ baseUrl: window.location.origin, signal: controller.signal })
      .then(({ data, response }) => {
        if (!active) return
        if (!data) {
          setStatus('error')
          return
        }
        const exact = Date.parse(response?.headers.get('X-Server-Time') ?? '')
        const dated = Date.parse(response?.headers.get('Date') ?? '')
        const server = Number.isFinite(exact) ? exact : dated
        // Missing clock metadata must never let client skew hide server-returned rows.
        setClock(Number.isFinite(server) ? { server, received: performance.now() } : undefined)
        setItems(data.items)
        setStatus('ready')
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [revision])
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setStatus('loading')
        setRevision((value) => value + 1)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  useEffect(() => {
    if (!items.length || !clock) return
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const now = clock.server + Math.max(0, performance.now() - clock.received)
      const nearest = items.reduce(
        (nearest, item) => Math.min(nearest, Date.parse(item.startsAt)),
        Infinity,
      )
      if (nearest <= now) {
        setItems((current) => current.filter((item) => Date.parse(item.startsAt) > now))
        return
      }
      timer = setTimeout(schedule, Math.min(nearest - now, maxDelay))
    }
    schedule()
    return () => clearTimeout(timer)
  }, [items, clock])
  return (
    <main className="page-surface">
      <section className="site-container catalog-page">
        <AdminNav />
        <h1 tabIndex={-1}>Предстоящие встречи</h1>
        <p>Часовой пояс: Europe/Moscow (Москва)</p>
        <button
          className="primary-link"
          onClick={() => {
            setStatus('loading')
            setRevision((value) => value + 1)
          }}
        >
          Обновить
        </button>
        {status === 'loading' && <p role="status">Загрузка встреч…</p>}
        {status === 'error' && (
          <div role="alert">
            <p>Не удалось загрузить встречи</p>
            <button
              onClick={() => {
                setStatus('loading')
                setRevision((value) => value + 1)
              }}
            >
              Повторить
            </button>
          </div>
        )}
        {status === 'ready' &&
          (items.length ? (
            <ul className="meeting-list">
              {items.map((item) => (
                <li key={item.id}>
                  <h2>{item.eventTypeName}</h2>
                  <p>{dateFormat.format(new Date(item.startsAt)).replaceAll('.', '-')}</p>
                  <p>
                    {timeFormat.format(new Date(item.startsAt))}–
                    {timeFormat.format(new Date(item.endsAt))} · {item.durationMinutes} мин.
                  </p>
                  <p>{item.guestName}</p>
                  <p>{item.guestEmail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>Предстоящих встреч пока нет</p>
          ))}
      </section>
    </main>
  )
}
