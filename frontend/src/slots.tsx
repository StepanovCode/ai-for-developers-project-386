import { bookingDetailsUrl } from './booking-navigation'
import { useEffect, useRef, useState } from 'react'
import { getEventType, getSlots } from './api/generated/sdk.gen'
import type { EventTypeDetails, SlotWindow } from './api/generated/types.gen'

function displayDate(date: string) {
  return date.split('-').reverse().join('-')
}
const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
})
function displayTime(instant: string) {
  return timeFormat.format(new Date(instant))
}
function requestedDate() {
  return new URLSearchParams(window.location.search).get('date') ?? ''
}
function chooseDate(window: SlotWindow, requested: string) {
  return (
    window.days.find((day) => day.date === requested)?.date ??
    window.days.find((day) => day.slots.some((slot) => slot.status === 'available'))?.date ??
    window.windowStart
  )
}
export function SlotsPage({ id }: { id: string }) {
  const [details, setDetails] = useState<EventTypeDetails>()
  const [windowData, setWindowData] = useState<SlotWindow>()
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [date, setDate] = useState(requestedDate)
  const [month, setMonth] = useState('')
  const [selected, setSelected] = useState('')
  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const timesHeading = useRef<HTMLHeadingElement>(null)
  const availabilityCheck = useRef<AbortController | null>(null)
  useEffect(() => {
    return () => {
      availabilityCheck.current?.abort()
      availabilityCheck.current = null
    }
  }, [id])
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const options = { baseUrl: window.location.origin, path: { id }, signal: controller.signal }
    async function load() {
      try {
        const type = await getEventType(options)
        if (!active) return
        if (!type.data) {
          setStatus(type.response?.status === 404 ? 'missing' : 'error')
          return
        }
        setDetails(type.data)
        heading.current?.focus()
        const slots = await getSlots(options)
        if (!active) return
        if (!slots.data || !Array.isArray(slots.data.days)) {
          setStatus(slots.response?.status === 404 ? 'missing' : 'error')
          return
        }
        const chosen = chooseDate(slots.data, requestedDate())
        setWindowData(slots.data)
        setDate(chosen)
        setMonth(chosen.slice(0, 7))
        setSelected('')
        setStatus('ready')
        const url = new URL(window.location.href)
        url.searchParams.set('date', chosen)
        url.searchParams.delete('slot')
        window.history.replaceState({}, '', url)
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
  useEffect(() => {
    const restore = () => {
      availabilityCheck.current?.abort()
      availabilityCheck.current = null
      setChecking(false)
      if (!windowData) return
      const chosen = chooseDate(windowData, requestedDate())
      setDate(chosen)
      setMonth(chosen.slice(0, 7))
      setSelected('')
      setNotice('')
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [windowData])
  function selectDate(next: string) {
    availabilityCheck.current?.abort()
    availabilityCheck.current = null
    setChecking(false)
    setDate(next)
    setMonth(next.slice(0, 7))
    setSelected('')
    setNotice('')
    const url = new URL(window.location.href)
    url.searchParams.set('date', next)
    url.searchParams.delete('slot')
    window.history.pushState({}, '', url)
    timesHeading.current?.focus()
  }
  async function continueBooking() {
    if (!selected || availabilityCheck.current) return
    const controller = new AbortController()
    availabilityCheck.current = controller
    setChecking(true)
    setNotice('')
    try {
      const result = await getSlots({
        baseUrl: window.location.origin,
        path: { id },
        signal: controller.signal,
      })
      if (controller.signal.aborted || availabilityCheck.current !== controller) return
      if (!result.data) throw new Error('availability failed')
      const fresh = result.data
      const available = fresh.days
        .find((day) => day.date === date)
        ?.slots.some((slot) => slot.startsAt === selected && slot.status === 'available')
      setWindowData(fresh)
      if (!available) {
        setSelected('')
        setNotice('Это время уже занято. Выберите другой слот')
        const chosen = chooseDate(fresh, date)
        setDate(chosen)
        setMonth(chosen.slice(0, 7))
        const url = new URL(window.location.href)
        url.searchParams.set('date', chosen)
        window.history.replaceState({}, '', url)
        timesHeading.current?.focus()
        return
      }
      window.history.pushState({}, '', bookingDetailsUrl(id, date, selected))
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch {
      if (!controller.signal.aborted && availabilityCheck.current === controller)
        setNotice('Не удалось проверить доступность. Повторите попытку')
    } finally {
      if (availabilityCheck.current === controller) {
        availabilityCheck.current = null
        setChecking(false)
      }
    }
  }
  const day = windowData?.days.find((day) => day.date === date)
  const anyFree = windowData?.days.some((day) =>
    day.slots.some((slot) => slot.status === 'available'),
  )
  const months = windowData ? [...new Set(windowData.days.map((day) => day.date.slice(0, 7)))] : []
  const monthIndex = months.indexOf(month)
  const monthDate = month ? new Date(`${month}-01T12:00:00Z`) : undefined
  const firstWeekday = monthDate ? (monthDate.getUTCDay() + 6) % 7 : 0
  const numberOfDays = monthDate
    ? new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate()
    : 0
  return (
    <main className="page-surface">
      <section className="site-container catalog-page">
        <div className="booking-layout">
          <section className="meeting-summary" aria-label="Сведения о встрече">
            <h1 tabIndex={-1} ref={heading}>
              {details?.eventType.name ?? 'Выберите время'}
            </h1>
            {details && (
              <>
                <p>{details.owner.name}</p>
                <p>{details.eventType.durationMinutes} минут</p>
                <p className="event-description">{details.eventType.description}</p>
              </>
            )}
            <p>
              Часовой пояс: <span>Europe/Moscow</span>
            </p>
            {date && windowData && <p>Дата: {displayDate(date)}</p>}
            {selected && <p role="status">Выбрано: {displayTime(selected)}</p>}
            <a href="/book">К каталогу</a>
          </section>
          {status === 'loading' && <p role="status">Загрузка доступного времени…</p>}
          {status === 'missing' && <p role="alert">Тип события не найден</p>}
          {status === 'error' && (
            <div role="alert">
              <p>Не удалось загрузить доступное время</p>
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
          {status === 'ready' && windowData && (
            <>
              <section className="calendar-panel" aria-label="Календарь">
                <h2>Выберите дату</h2>
                <p className="window-caption">
                  {displayDate(windowData.windowStart)} — {displayDate(windowData.windowEnd)}
                </p>
                <div className="month-navigation">
                  <button
                    aria-label="Предыдущий месяц"
                    disabled={monthIndex <= 0 || checking}
                    onClick={() => setMonth(months[monthIndex - 1])}
                  >
                    ←
                  </button>
                  <h3 aria-live="polite">
                    {monthDate?.toLocaleDateString('ru-RU', {
                      timeZone: 'UTC',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h3>
                  <button
                    aria-label="Следующий месяц"
                    disabled={monthIndex === months.length - 1 || checking}
                    onClick={() => setMonth(months[monthIndex + 1])}
                  >
                    →
                  </button>
                </div>
                <div className="month-grid" role="group" aria-label="Даты месяца">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label) => (
                    <span className="weekday" key={label} aria-hidden="true">
                      {label}
                    </span>
                  ))}
                  {Array.from({ length: firstWeekday }, (_, i) => (
                    <span key={`pad-${i}`} />
                  ))}
                  {Array.from({ length: numberOfDays }, (_, i) => {
                    const value = `${month}-${String(i + 1).padStart(2, '0')}`
                    const calendarDay = windowData.days.find((d) => d.date === value)
                    const free =
                      calendarDay?.slots.filter((slot) => slot.status === 'available').length ?? 0
                    return (
                      <button
                        key={value}
                        className="calendar-day"
                        disabled={!calendarDay || checking}
                        aria-pressed={value === date}
                        aria-label={
                          calendarDay
                            ? `${displayDate(value)}, свободных слотов: ${free}`
                            : `${displayDate(value)}, вне окна записи`
                        }
                        onClick={() => selectDate(value)}
                      >
                        <span>{i + 1}</span>
                        {calendarDay && <small>{free} своб.</small>}
                      </button>
                    )
                  })}
                </div>
                {!anyFree && <p role="status">Нет доступного времени в ближайшие 14 дней</p>}
              </section>
              <section className="times-panel" aria-label="Выбор времени">
                <h2 ref={timesHeading} tabIndex={-1}>
                  Время на {displayDate(date)}
                </h2>
                {day && !day.slots.some((slot) => slot.status === 'available') && (
                  <p role="status">На эту дату нет свободного времени</p>
                )}
                <div className="slot-list">
                  {day?.slots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      disabled={slot.status === 'busy' || checking}
                      aria-pressed={slot.startsAt === selected}
                      onClick={() => {
                        setSelected(slot.startsAt)
                        setNotice('')
                      }}
                    >
                      {displayTime(slot.startsAt)}–{displayTime(slot.endsAt)} —{' '}
                      {slot.status === 'busy' ? 'Занято' : 'Свободно'}
                    </button>
                  ))}
                </div>
                {notice && <p role="alert">{notice}</p>}
                <div className="booking-actions">
                  <a href="/book">Назад</a>
                  <button disabled={!selected || checking} onClick={() => void continueBooking()}>
                    {checking ? 'Проверка…' : 'Продолжить'}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
