import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createEventType, getEventType, listEventTypes } from './api/generated/sdk.gen'
import type { EventTypeCatalog, EventTypeDetails } from './api/generated/types.gen'

export function AdminNav() {
  return (
    <nav aria-label="Админка">
      <a href="/admin">Типы событий</a>
      <a href="/admin/meetings">Предстоящие встречи</a>
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
        <h1 tabIndex={-1}>
          {admin
            ? 'Типы событий'
            : id && data && 'eventType' in data
              ? data.eventType.name
              : 'Выберите тип события'}
        </h1>
        {notice && <p role="status">{notice}</p>}
        {admin && (
          <a className="primary-link" href="/admin/event-types/new">
            Создать тип события
          </a>
        )}
        {status === 'loading' && <p role="status">Загрузка…</p>}
        {status === 'error' && (
          <div role="alert">
            <p>Не удалось загрузить типы событий</p>
            <button
              onClick={() => {
                setStatus('loading')
                setAttempt(attempt + 1)
              }}
            >
              Повторить
            </button>
          </div>
        )}
        {status === 'missing' && (
          <>
            <p>Тип события не найден</p>
            <a href="/book">К каталогу</a>
          </>
        )}
        {status === 'ready' && data && (
          <>
            <p>{data.owner.name}</p>
            {'items' in data ? (
              data.items.length === 0 ? (
                <p>Пока нет доступных типов событий</p>
              ) : (
                <div className="event-grid">
                  {data.items.map((event) => (
                    <a className="event-card" key={event.id} href={`/book/${event.id}`}>
                      <h2>{event.name}</h2>
                      <p>{event.durationMinutes} минут</p>
                      <p className="event-excerpt">{event.description}</p>
                    </a>
                  ))}
                </div>
              )
            ) : (
              <div>
                <p>{data.eventType.durationMinutes} минут</p>
                <p className="event-description">{data.eventType.description}</p>
                <a href="/book">К каталогу</a>
              </div>
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
  function showFields(errors: Record<string, string[]>) {
    setFields(errors)
    const first = ['name', 'description', 'durationMinutes'].find((key) => errors[key]?.length)
    if (first) (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus()
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
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
    setPending(true)
    try {
      const result = await createEventType({
        baseUrl: window.location.origin,
        body: { name, description, durationMinutes: number },
      })
      if (result.data) onCreated()
      else {
        setError(result.error?.message ?? 'Не удалось создать тип события')
        if (result.error && 'fieldErrors' in result.error && result.error.fieldErrors)
          showFields(result.error.fieldErrors)
      }
    } catch {
      setError('Не удалось создать тип события. Повторите попытку')
    } finally {
      setPending(false)
    }
  }
  return (
    <main className="page-surface">
      <section className="site-container catalog-page">
        <AdminNav />
        <h1 tabIndex={-1}>Создать тип события</h1>
        <form ref={formRef} onSubmit={submit} noValidate className="event-form">
          <label htmlFor="name">Название</label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!fields.name}
            aria-describedby={fields.name ? 'name-error' : undefined}
          />
          {fields.name && <p id="name-error">{fields.name.join('. ')}</p>}
          <label htmlFor="description">Описание</label>
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={!!fields.description}
            aria-describedby={fields.description ? 'description-error' : undefined}
          />
          {fields.description && <p id="description-error">{fields.description.join('. ')}</p>}
          <label htmlFor="duration">Длительность в минутах</label>
          <input
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
          {fields.durationMinutes && <p id="duration-error">{fields.durationMinutes.join('. ')}</p>}
          {error && <p role="alert">{error}</p>}
          <button disabled={pending} type="submit">
            {pending ? 'Создание…' : 'Создать тип'}
          </button>
          <a href="/admin">Отмена</a>
        </form>
      </section>
    </main>
  )
}
