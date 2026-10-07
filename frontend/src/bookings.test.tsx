import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, test, expect, vi } from 'vitest'
import App from './App'
import { StrictMode } from 'react'
const id = '00000000-0000-4000-8000-000000000001'
const confirmation = {
  id: '00000000-0000-4000-8000-000000000002',
  eventTypeId: id,
  eventTypeName: 'Разговор',
  durationMinutes: 30,
  startsAt: '2026-10-08T06:00:00Z',
  endsAt: '2026-10-08T06:30:00Z',
  timeZone: 'Europe/Moscow',
  owner: { id: 'default', name: 'Owner' },
}
function transport(status = 201) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (r: Request) => {
      const path = new URL(r.url).pathname
      return new Response(
        JSON.stringify(
          path === '/api/health'
            ? { status: 'ok' }
            : path.startsWith('/api/event-types')
              ? {
                  owner: confirmation.owner,
                  eventType: { id, name: 'Разговор', description: 'Описание', durationMinutes: 30 },
                }
              : r.method === 'POST' && status === 422
                ? {
                    code: 'VALIDATION_ERROR',
                    message: 'Ошибка',
                    fieldErrors: { guestEmail: ['Некорректный email'] },
                  }
                : confirmation,
        ),
        {
          status: r.method === 'POST' ? status : 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }),
  )
}
afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})
test('booking form sends guest data and opens server-backed confirmation', async () => {
  window.history.replaceState(
    {},
    '',
    `/book/${id}/details?date=2026-10-08&slot=2026-10-08T06%3A00%3A00Z`,
  )
  transport()
  render(<App />)
  fireEvent.change(await screen.findByLabelText('Имя'), { target: { value: 'Гость' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'guest@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Забронировать' }))
  expect(await screen.findByRole('heading', { name: 'Бронирование подтверждено' })).toBeVisible()
  expect(window.location.pathname).toBe(`/bookings/${confirmation.id}`)
  expect(screen.queryByText('guest@example.com')).not.toBeInTheDocument()
})
test('422 preserves guest inputs and focuses first field error', async () => {
  window.history.replaceState({}, '', `/book/${id}/details?slot=2026-10-08T06%3A00%3A00Z`)
  transport(422)
  render(<App />)
  fireEvent.change(await screen.findByLabelText('Имя'), { target: { value: 'Гость' } })
  const email = screen.getByLabelText('Email')
  fireEvent.change(email, { target: { value: 'guest@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Забронировать' }))
  expect(await screen.findByText('Некорректный email')).toBeVisible()
  await waitFor(() => expect(email).toHaveFocus())
  expect(email).toHaveValue('guest@example.com')
})

test('direct confirmation reload loads public server result without guest fields', async () => {
  window.history.replaceState({}, '', `/bookings/${confirmation.id}`)
  transport()
  const { unmount } = render(<App />)
  expect(await screen.findByText(`Номер бронирования: ${confirmation.id}`)).toBeVisible()
  unmount()
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Бронирование подтверждено' })).toHaveFocus()
  expect(screen.getByText('Europe/Moscow')).toBeVisible()
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
})

test('draft survives leaving details and SPA return', async () => {
  const details = `/book/${id}/details?date=2026-10-08&slot=2026-10-08T06%3A00%3A00Z`
  window.history.replaceState({}, '', details)
  transport()
  render(<App />)
  fireEvent.change(await screen.findByLabelText('Имя'), { target: { value: 'Сохранён' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'keep@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Назад' }))
  window.history.pushState({}, '', details)
  fireEvent(window, new PopStateEvent('popstate'))
  expect(await screen.findByLabelText('Имя')).toHaveValue('Сохранён')
  expect(screen.getByLabelText('Email')).toHaveValue('keep@example.com')
  expect(window.location.search).not.toContain('keep')
})

test('StrictMode cancelled first load never displays an error beside successful form data', async () => {
  window.history.replaceState({}, '', `/book/${id}/details?slot=2026-10-08T06%3A00%3A00Z`)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (r: Request) => {
      await Promise.resolve()
      if (r.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      return new Response(
        JSON.stringify(
          new URL(r.url).pathname === '/api/health'
            ? { status: 'ok' }
            : {
                owner: confirmation.owner,
                eventType: { id, name: 'Разговор', description: 'Описание', durationMinutes: 30 },
              },
        ),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }),
  )
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  await waitFor(() => expect(screen.getByRole('button', { name: 'Забронировать' })).toBeEnabled())
  expect(screen.queryByText('Не удалось загрузить тип события')).not.toBeInTheDocument()
})
