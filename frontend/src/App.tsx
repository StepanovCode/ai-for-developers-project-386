import { ArrowRight, CalendarDays, Clock3, PhoneCall, UserRoundCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { CreateEventPage, EventsPage } from './events'
import { MeetingsPage } from './meetings'
import { SlotsPage } from './slots'
import { BookingForm, ConfirmationPage, type GuestDraft } from './bookings'
import { ServiceStatus } from '@/components/service-status'

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-container header-content">
        <a className="brand" href="/" aria-label="На связи — на главную">
          <span className="brand-mark" aria-hidden="true">
            <PhoneCall size={20} strokeWidth={2.2} />
          </span>
          <span>На связи</span>
        </a>
        <a className="header-link" href="/book">
          Записаться <ArrowRight size={17} aria-hidden="true" />
        </a>
        <a className="header-link" href="/admin">
          Админка
        </a>
      </div>
    </header>
  )
}

function HomePage() {
  return (
    <main className="page-surface home-surface">
      <div className="site-container hero-layout">
        <section className="hero-copy" aria-labelledby="home-title">
          <p className="eyebrow">Быстрая запись на звонок</p>
          <h1 id="home-title" tabIndex={-1}>
            На связи
          </h1>
          <p className="hero-description">
            Выберите тип встречи и удобное время. Забронируйте встречу без регистрации и лишней
            переписки.
          </p>
          <a className="primary-link" href="/book">
            Записаться <ArrowRight size={20} aria-hidden="true" />
          </a>
        </section>

        <Card className="features-card">
          <CardHeader>
            <CardTitle className="features-title">Возможности</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="feature-list">
              <li>
                <span className="feature-icon" aria-hidden="true">
                  <CalendarDays size={22} strokeWidth={1.9} />
                </span>
                <span>Выбор свободного времени</span>
              </li>
              <li>
                <span className="feature-icon" aria-hidden="true">
                  <Clock3 size={22} strokeWidth={1.9} />
                </span>
                <span>Выбор типа встречи</span>
              </li>
              <li>
                <span className="feature-icon" aria-hidden="true">
                  <UserRoundCheck size={22} strokeWidth={1.9} />
                </span>
                <span>Бронирование без регистрации</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function App() {
  const [path, setPath] = useState(window.location.pathname.replace(/\/$/, '') || '/')
  const [search, setSearch] = useState(window.location.search)
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState<GuestDraft>({ name: '', email: '' })
  useEffect(() => {
    const onPop = () => {
      setPath(window.location.pathname.replace(/\/$/, '') || '/')
      setSearch(window.location.search)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    document.querySelector<HTMLElement>('main h1')?.focus()
  }, [path, search])
  const type = /^\/book\/([^/]+)$/.exec(path)
  let page
  if (path === '/') page = <HomePage />
  else if (path === '/book') page = <EventsPage />
  else if (type) page = <SlotsPage key={type[1]} id={type[1]} />
  else if (/^\/book\/[^/]+\/details$/.test(path))
    page = (
      <BookingForm
        key={path + search}
        id={path.split('/')[2]}
        draft={draft}
        onDraft={setDraft}
        onSuccess={() => setDraft({ name: '', email: '' })}
      />
    )
  else if (/^\/bookings\/[^/]+$/.test(path))
    page = <ConfirmationPage key={path} id={path.split('/')[2]} />
  else if (path === '/admin' || path === '/admin/event-types')
    page = <EventsPage admin notice={notice} />
  else if (path === '/admin/event-types/new')
    page = (
      <CreateEventPage
        onCreated={() => {
          window.history.pushState({}, '', '/admin')
          setNotice('Тип события создан')
          setPath('/admin')
        }}
      />
    )
  else if (path === '/admin/meetings') page = <MeetingsPage />
  else
    page = (
      <main className="page-surface">
        <section className="site-container catalog-page">
          <h1 tabIndex={-1}>Страница не найдена</h1>
          <a href="/">На главную</a>
        </section>
      </main>
    )
  return (
    <div
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return
        const link = (event.target as HTMLElement).closest('a')
        if (!link || link.target || link.hasAttribute('download')) return
        const url = new URL(link.href, window.location.origin)
        if (url.origin !== window.location.origin || !/^\/book(?:ings)?(?:\/|$)/.test(url.pathname))
          return
        event.preventDefault()
        window.history.pushState({}, '', url)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }}
    >
      <SiteHeader />
      <ServiceStatus />
      {page}
    </div>
  )
}

export default App
