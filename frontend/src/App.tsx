import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  PhoneCall,
  UserRoundCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
          <h1 id="home-title">На связи</h1>
          <p className="hero-description">
            Выберите удобное время и запишитесь на 30-минутный звонок. Просто, без регистрации и
            лишней переписки.
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
                <span>Звонки по 30 минут</span>
              </li>
              <li>
                <span className="feature-icon" aria-hidden="true">
                  <UserRoundCheck size={22} strokeWidth={1.9} />
                </span>
                <span>Запись без регистрации</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function BookingPlaceholder() {
  return (
    <main className="page-surface placeholder-surface">
      <div className="site-container placeholder-layout">
        <Card className="placeholder-card">
          <CardHeader>
            <span className="placeholder-icon" aria-hidden="true">
              <CalendarDays size={28} strokeWidth={1.8} />
            </span>
            <CardTitle>
              <h1>Онлайн-запись скоро появится</h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Мы готовим удобный способ выбрать время для звонка. Загляните позже.</p>
            <a className="return-link" href="/">
              <ArrowLeft size={18} aria-hidden="true" /> На главную
            </a>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function App() {
  const isBookingPage =
    window.location.pathname === '/book' || window.location.pathname === '/book/'

  return (
    <>
      <SiteHeader />
      {isBookingPage ? <BookingPlaceholder /> : <HomePage />}
    </>
  )
}

export default App
