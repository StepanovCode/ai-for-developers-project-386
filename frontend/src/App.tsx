import { ArrowRight, CalendarDays, Clock3, PhoneCall, UserRoundCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { AdminNav, CreateEventPage, EventsPage } from './events'
import { SlotsPage } from './slots'
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
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname.replace(/\/$/, '') || '/')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    document.querySelector<HTMLElement>('main h1')?.focus()
  }, [path])
  const type = /^\/book\/([^/]+)$/.exec(path)
  let page
  if (path === '/') page = <HomePage />
  else if (path === '/book') page = <EventsPage />
  else if (type) page = <SlotsPage key={type[1]} id={type[1]} />
  else if (/^\/book\/[^/]+\/details$/.test(path))
    page = (
      <main className="page-surface">
        <section className="site-container catalog-page">
          <h1 tabIndex={-1}>Данные гостя</h1>
          <p>Форма бронирования появится в следующем этапе.</p>
          <a href={path.replace('/details', '') + window.location.search}>Назад к выбору времени</a>
        </section>
      </main>
    )
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
  else if (path === '/admin/meetings')
    page = (
      <main className="page-surface">
        <section className="site-container catalog-page">
          <AdminNav />
          <h1 tabIndex={-1}>Предстоящие встречи</h1>
          <p>Список встреч появится в следующем этапе.</p>
        </section>
      </main>
    )
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
    <>
      <SiteHeader />
      <ServiceStatus />
      {page}
    </>
  )
}

export default App
