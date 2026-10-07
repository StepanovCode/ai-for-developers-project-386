import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'

const healthResponse = () =>
  new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => healthResponse()),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

test('приложение вызывает настоящий SDK и позволяет повторить health после ошибки', async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('offline'))
    .mockImplementation(async () => healthResponse())
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Сервис временно недоступен')
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  const request: Request = fetchMock.mock.calls[0][0]
  expect(new URL(request.url).pathname).toBe('/api/health')
})

test('главная показывает сервис и ссылку на запись', () => {
  window.history.replaceState({}, '', '/')
  render(<App />)

  expect(screen.getByRole('heading', { level: 1, name: 'Meetly' })).toBeVisible()

  const bookingLinks = screen.getAllByRole('link', { name: 'Записаться' })
  expect(bookingLinks).toHaveLength(1)
  bookingLinks.forEach((link) => expect(link).toHaveAttribute('href', '/book'))
})

test('неизвестный маршрут показывает отдельное состояние', () => {
  window.history.replaceState({}, '', '/unknown')
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible()
})
