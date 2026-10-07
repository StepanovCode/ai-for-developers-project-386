import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, Clock3, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createEventType, getEventType, listEventTypes } from './api/generated/sdk.gen'
import type { EventTypeCatalog, EventTypeDetails } from './api/generated/types.gen'
import './pages.css'

export function AdminNav() {
  const meetings = window.location.pathname === '/admin/meetings'
  return (
    <nav className="admin-nav" aria-label="Админка">
      <a href="/admin" aria-current={!meetings ? 'page' : undefined}>
        Типы событий
      </a>
      <a href="/admin/meetings" aria-current={meetings ? 'page' : undefined}>
        Предстоящие встречи
      </a>
    </nav>
  )
}

export function EventsPage({
  id,
  admin = false,
  notice,
}: {
  id?: string
  admin?: boolean
  notice?: string
}) {
  const [data, setData] = useState<EventTypeCatalog | EventTypeDetails>()
  const [status, setStatus] = useState<'loading' | 'error' | 'missing' | 'ready'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const options = { baseUrl: window.location.origin, signal: controller.signal }
    let active = true
    async function load() {
      try {
        const result = id
          ? await getEventType({ ...options, path: { id } })
          : await listEventTypes(options)
        if (!active) return
        if (result.data) {
          setData(result.data)
          setStatus('ready')
        } else setStatus(id && result.response?.status === 404 ? 'missing' : 'error')
      } catch {
        if (active) setStatus('error')
      }
    }
    void load()
    return () => {
      active = false
      controller.abort()
    }
  }, [id, attempt])
  return (
    <main className="page-surface">
      <section className="site-container catalog-page">
        {admin && <AdminNav />}
        <div className="page-heading">
          <h1 tabIndex={-1}>
            {admin
              ? 'Типы событий'
              : id && data && 'eventType' in data
                ? data.eventType.name
                : 'Выберите тип события'}
          </h1>
          {admin && (
            <a className="primary-link page-create-link" href="/admin/event-types/new">
              <Plus size={18} aria-hidden="true" />
              Создать тип события
            </a>
          )}
        </div>
        {notice && (
          <p className="page-notice" role="status">
            {notice}
          </p>
        )}
        {status === 'loading' && (
          <p className="page-state" role="status">
            Загрузка…
          </p>
        )}
        {status === 'error' && (
          <div className="page-state page-error" role="alert">
            <p>Не удалось загрузить типы событий</p>
            <Button
              variant="outline"
              onClick={() => {
                setStatus('loading')
                setAttempt(attempt + 1)
              }}
            >
              Повторить
            </Button>
          </div>
        )}
        {status === 'missing' && (
          <div className="page-state">
            <p>Тип события не найден</p>
            <a className="page-text-link" href="/book">
              К каталогу <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        )}
        {status === 'ready' && data && (
          <>
            <p className="catalog-owner">{data.owner.name}</p>
            {'items' in data ? (
              data.items.length === 0 ? (
                <div className="page-state empty-state">
                  <CalendarDays size={30} aria-hidden="true" />
                  <p>Пока нет доступных типов событий</p>
                </div>
              ) : (
                <div className="event-grid">
                  {data.items.map((event) => (
                    <a className="event-card" key={event.id} href={`/book/${event.id}`}>
                      <Card className="event-card-surface">
                        <CardContent>
                          <div className="event-card-top">
                            <span className="page-icon">
                              <CalendarDays size={24} aria-hidden="true" />
                            </span>
                            <span className="duration-pill">
                              <Clock3 size={14} aria-hidden="true" />
                              {event.durationMinutes} минут
                            </span>
                          </div>
                          <h2>{event.name}</h2>
                          <p className="event-excerpt">{event.description}</p>
                          <span className="event-card-arrow" aria-hidden="true">
                            <ArrowRight size={20} />
                          </span>
                        </CardContent>
                      </Card>
                    </a>
                  ))}
                </div>
              )
            ) : (
              <Card className="event-detail-card">
                <CardContent>
                  <p className="duration-pill">
                    <Clock3 size={14} aria-hidden="true" />
                    {data.eventType.durationMinutes} минут
                  </p>
                  <p className="event-description">{data.eventType.description}</p>
                  <a className="page-text-link" href="/book">
                    К каталогу <ArrowRight size={16} aria-hidden="true" />
                  </a>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>
    </main>
  )
}

export function CreateEventPage({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('30')
  const [fields, setFields] = useState<Record<string, string[]>>({})
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      requestRef.current?.abort()
      requestRef.current = null
    },
    [],
  )
  function showFields(errors: Record<string, string[]>) {
    setFields(errors)
    const first = ['name', 'description', 'durationMinutes'].find((key) => errors[key]?.length)
    if (first) (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus()
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (requestRef.current) return
    const errors: Record<string, string[]> = {}
    const trimmedName = name.trim(),
      trimmedDescription = description.trim(),
      number = Number(duration)
    if (
      [...trimmedName].length < 1 ||
      [...trimmedName].length > 100 ||
      /[\r\n\u2028\u2029]/.test(trimmedName)
    )
      errors.name = ['Название: одна строка от 1 до 100 символов']
    if ([...trimmedDescription].length < 1 || [...trimmedDescription].length > 2000)
      errors.description = ['Описание: от 1 до 2000 символов']
    if (!Number.isInteger(number) || number < 1 || number > 480)
      errors.durationMinutes = ['Длительность: целое число от 1 до 480 минут']
    setError('')
    showFields(errors)
    if (Object.keys(errors).length) return
    const request = new AbortController()
    requestRef.current = request
    setPending(true)
    try {
      const result = await createEventType({
        baseUrl: window.location.origin,
        body: { name, description, durationMinutes: number },
        signal: request.signal,
      })
      if (requestRef.current !== request) return
      if (result.data) onCreated()
      else {
        setError(result.error?.message ?? 'Не удалось создать тип события')
        if (result.error && 'fieldErrors' in result.error && result.error.fieldErrors)
          showFields(result.error.fieldErrors)
      }
    } catch {
      if (requestRef.current === request)
        setError('Не удалось создать тип события. Повторите попытку')
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null
        setPending(false)
      }
    }
  }
  return (
    <main className="page-surface">
      <section className="site-container catalog-page">
        <AdminNav />
        <Card className="form-card">
          <div className="form-card-heading">
            <span className="page-icon">
              <Plus size={24} aria-hidden="true" />
            </span>
            <h1 tabIndex={-1}>Создать тип события</h1>
          </div>
          <CardContent>
            <form ref={formRef} onSubmit={submit} noValidate className="event-form">
              <label htmlFor="name">Название</label>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!fields.name}
                aria-describedby={fields.name ? 'name-error' : undefined}
              />
              {fields.name && <p id="name-error">{fields.name.join('. ')}</p>}
              <label htmlFor="description">Описание</label>
              <Textarea
                id="description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={!!fields.description}
                aria-describedby={fields.description ? 'description-error' : undefined}
              />
              {fields.description && <p id="description-error">{fields.description.join('. ')}</p>}
              <label htmlFor="duration">Длительность в минутах</label>
              <Input
                id="duration"
                name="durationMinutes"
                type="number"
                min="1"
                max="480"
                step="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                aria-invalid={!!fields.durationMinutes}
                aria-describedby={fields.durationMinutes ? 'duration-error' : undefined}
              />
              {fields.durationMinutes && (
                <p id="duration-error">{fields.durationMinutes.join('. ')}</p>
              )}
              {error && <p role="alert">{error}</p>}
              <Button className="form-submit" disabled={pending} type="submit">
                {pending ? 'Создание…' : 'Создать тип'}
              </Button>
              <a className="form-cancel" href="/admin">
                Отмена
              </a>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
