import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, Check, CircleAlert, Clock3, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createBooking, getBooking, getEventType } from './api/generated/sdk.gen'
import type { BookingConfirmation, EventTypeDetails } from './api/generated/types.gen'
import './pages.css'
export type GuestDraft = { name: string; email: string }
function navigate(url: string, state = {}) {
  window.history.pushState(state, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
function displayTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
function displayDate(value: string) {
  const date = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
  return date.replaceAll('.', '-')
}
export function BookingForm({
  id,
  draft,
  onDraft,
  onSuccess,
}: {
  id: string
  draft: GuestDraft
  onDraft: (draft: GuestDraft) => void
  onSuccess: () => void
}) {
  const [data, setData] = useState<EventTypeDetails>()
  const [message, setMessage] = useState('')
  const [fields, setFields] = useState<Record<string, string[]>>({})
  const [pending, setPending] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const submission = useRef<AbortController | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const active = useRef(true)
  const slot = new URLSearchParams(window.location.search).get('slot') ?? ''
  const validSlot = Number.isFinite(Date.parse(slot))
  const date = new URLSearchParams(window.location.search).get('date') ?? ''
  useEffect(() => {
    active.current = true
    let loadActive = true
    const controller = new AbortController()
    void getEventType({ baseUrl: window.location.origin, path: { id }, signal: controller.signal })
      .then((r) => {
        if (!loadActive || controller.signal.aborted) return
        if (r.data) {
          setData(r.data)
          setLoadError('')
        } else
          setLoadError(
            r.response?.status === 404
              ? 'Тип события не найден'
              : 'Не удалось загрузить тип события',
          )
      })
      .catch(() => {
        if (loadActive && !controller.signal.aborted)
          setLoadError('Не удалось загрузить тип события')
      })
      .finally(() => {
        if (loadActive && !controller.signal.aborted) setLoading(false)
      })
    return () => {
      submission.current?.abort()
      submission.current = null
      loadActive = false
      active.current = false
      controller.abort()
    }
  }, [id, attempt])
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submission.current || pending || loading || loadError || !data || !validSlot) return
    const controller = new AbortController()
    submission.current = controller
    setPending(true)
    setFields({})
    setMessage('')
    try {
      const r = await createBooking({
        baseUrl: window.location.origin,
        signal: controller.signal,
        body: { eventTypeId: id, startsAt: slot, guestName: draft.name, guestEmail: draft.email },
      })
      if (!active.current || controller.signal.aborted || submission.current !== controller) return
      if (r.data) {
        onSuccess()
        navigate(`/bookings/${r.data.id}`)
      } else {
        if (r.response?.status === 400 && r.error?.code === 'SLOT_UNAVAILABLE') {
          navigate(`/book/${id}?${new URLSearchParams({ date })}`, { slotUnavailable: true })
          return
        }
        if (r.error && 'fieldErrors' in r.error) {
          setFields(r.error.fieldErrors ?? {})
          const first = ['guestName', 'guestEmail'].find(
            (key) => r.error && 'fieldErrors' in r.error && r.error.fieldErrors?.[key],
          )
          requestAnimationFrame(() =>
            form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(),
          )
        }
        setMessage(
          r.response
            ? (r.error?.message ?? 'Не удалось узнать результат. Повторите попытку')
            : 'Не удалось узнать результат. Повторите попытку',
        )
      }
    } catch {
      if (active.current && !controller.signal.aborted)
        setMessage('Не удалось узнать результат. Повторите попытку')
    } finally {
      if (submission.current === controller) {
        submission.current = null
        if (active.current) setPending(false)
      }
    }
  }
  return (
    <main className="page-surface">
      <section className="site-container catalog-page">
        <Card className="form-card guest-form-card">
          <div className="form-card-heading">
            <span className="page-icon">
              <UserRound size={24} aria-hidden="true" />
            </span>
            <h1 tabIndex={-1}>Данные гостя</h1>
          </div>
          <CardContent>
            {data && validSlot && (
              <p className="booking-summary">
                {data.eventType.name} · {displayDate(slot)} · {displayTime(slot)}–
                {displayTime(
                  new Date(Date.parse(slot) + data.eventType.durationMinutes * 60000).toISOString(),
                )}{' '}
                · Europe/Moscow · {data.owner.name}
              </p>
            )}
            {loading && (
              <p className="page-state" role="status">
                Загрузка типа события…
              </p>
            )}
            {loadError && (
              <div className="page-state page-error" role="alert">
                <p>{loadError}</p>
                {loadError !== 'Тип события не найден' && (
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setLoading(true)
                      setLoadError('')
                      setAttempt(attempt + 1)
                    }}
                  >
                    Повторить
                  </Button>
                )}
              </div>
            )}
            {!validSlot && (
              <p className="page-notice page-error" role="alert">
                Выберите время встречи
              </p>
            )}
            {message && (
              <p className="page-notice page-error" role="alert">
                {message}
              </p>
            )}
            <form className="event-form" ref={form} onSubmit={submit} noValidate>
              <label htmlFor="guestName">Имя</label>
              <Input
                id="guestName"
                name="guestName"
                autoComplete="name"
                value={draft.name}
                aria-invalid={!!fields.guestName}
                aria-describedby={fields.guestName ? 'guestName-error' : undefined}
                onChange={(e) => onDraft({ ...draft, name: e.target.value })}
              />
              {fields.guestName && <p id="guestName-error">{fields.guestName.join(' ')}</p>}
              <label htmlFor="guestEmail">Email</label>
              <Input
                id="guestEmail"
                name="guestEmail"
                type="email"
                autoComplete="email"
                value={draft.email}
                aria-invalid={!!fields.guestEmail}
                aria-describedby={fields.guestEmail ? 'guestEmail-error' : undefined}
                onChange={(e) => onDraft({ ...draft, email: e.target.value })}
              />
              {fields.guestEmail && <p id="guestEmail-error">{fields.guestEmail.join(' ')}</p>}
              <div className="form-actions">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => navigate(`/book/${id}?${new URLSearchParams({ date, slot })}`)}
                >
                  Назад
                </Button>
                <Button
                  className="form-submit"
                  disabled={pending || loading || !!loadError || !data || !validSlot}
                  type="submit"
                >
                  {pending ? 'Сохраняем…' : 'Забронировать'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
export function ConfirmationPage({ id }: { id: string }) {
  const [data, setData] = useState<BookingConfirmation>()
  const [message, setMessage] = useState('Загружаем подтверждение…')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const c = new AbortController()
    let active = true
    void getBooking({ baseUrl: window.location.origin, path: { id }, signal: c.signal })
      .then((r) => {
        if (!active) return
        if (r.data) setData(r.data)
        else
          setMessage(
            r.response?.status === 404
              ? 'Бронирование не найдено'
              : 'Не удалось загрузить подтверждение',
          )
      })
      .catch(() => {
        if (active) setMessage('Не удалось загрузить подтверждение')
      })
    return () => {
      active = false
      c.abort()
    }
  }, [id, attempt])
  useEffect(() => {
    document.querySelector<HTMLElement>('main h1')?.focus()
  }, [data, message])
  return (
    <main className="page-surface">
      <section className="site-container catalog-page">
        <Card className="confirmation-card">
          <CardContent>
            <div className={`confirmation-icon ${data ? 'is-success' : ''}`} aria-hidden="true">
              {data ? (
                <Check size={32} />
              ) : message === 'Загружаем подтверждение…' ? (
                <CalendarDays size={32} />
              ) : (
                <CircleAlert size={32} />
              )}
            </div>
            <h1 tabIndex={-1}>{data ? 'Бронирование подтверждено' : message}</h1>
            {!data && message === 'Не удалось загрузить подтверждение' && (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setMessage('Загружаем подтверждение…')
                  setAttempt((value) => value + 1)
                }}
              >
                Повторить
              </Button>
            )}
            {data && (
              <div className="confirmation-details">
                <h2>{data.eventTypeName}</h2>
                <p className="confirmation-date">
                  <CalendarDays size={18} aria-hidden="true" />
                  {displayDate(data.startsAt)} · {displayTime(data.startsAt)}–
                  {displayTime(data.endsAt)}
                </p>
                <p>
                  <Clock3 size={18} aria-hidden="true" />
                  {data.timeZone}
                </p>
                <p>
                  <UserRound size={18} aria-hidden="true" />
                  {data.owner.name}
                </p>
                <p className="confirmation-number">Номер бронирования: {data.id}</p>
              </div>
            )}
            <a className="page-text-link" href="/book">
              Выбрать другую встречу <ArrowRight size={16} aria-hidden="true" />
            </a>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
