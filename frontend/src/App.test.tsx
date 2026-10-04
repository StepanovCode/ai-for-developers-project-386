import { render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import App from './App'

afterEach(() => {
  window.history.replaceState({}, '', '/')
})

test('главная показывает сервис и обе ссылки на запись', () => {
  window.history.replaceState({}, '', '/')
  render(<App />)

  expect(screen.getByRole('heading', { level: 1, name: 'На связи' })).toBeVisible()

  const bookingLinks = screen.getAllByRole('link', { name: 'Записаться' })
  expect(bookingLinks).toHaveLength(2)
  bookingLinks.forEach((link) => expect(link).toHaveAttribute('href', '/book'))
})

test.each(['/book', '/book/', '/book?from=home'])(
  'адрес %s показывает заглушку записи и возврат на главную',
  (path) => {
    window.history.replaceState({}, '', path)
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Онлайн-запись скоро появится' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/')
  },
)
