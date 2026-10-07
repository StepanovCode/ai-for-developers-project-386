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
  const fetch = vi.mocked(globalThis.fetch)
  render(<App />)
  fireEvent.change(await screen.findByLabelText('Имя'), { target: { value: 'Гость' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'guest@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Забронировать' }))
  expect(await screen.findByRole('heading', { name: 'Бронирование подтверждено' })).toBeVisible()
  expect(window.location.pathname).toBe(`/bookings/${confirmation.id}`)
  expect(screen.queryByText('guest@example.com')).not.toBeInTheDocument()
  const posted = fetch.mock.calls.find(([r]) => (r as Request).method === 'POST')?.[0] as Request
  expect(await posted.clone().json()).toEqual({
    eventTypeId: id,
    startsAt: confirmation.startsAt,
    guestName: 'Гость',
    guestEmail: 'guest@example.com',
  })
  window.history.pushState({}, '', `/book/${id}/details?slot=2026-10-08T06%3A00%3A00Z`)
  fireEvent(window, new PopStateEvent('popstate'))
  expect(await screen.findByLabelText('Имя')).toHaveValue('')
  expect(screen.getByLabelText('Email')).toHaveValue('')
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

function resilientTransport(post: (r: Request) => Promise<Response>, typeFailure = false) {
  const fetch = vi.fn(async (r: Request) => {
    const path = new URL(r.url).pathname
    if (r.method === 'POST') return post(r)
    if (path.endsWith('/slots'))
      return new Response(
        JSON.stringify({
          windowStart: '2026-10-08',
          windowEnd: '2026-10-21',
          timeZone: 'Europe/Moscow',
          days: [
            {
              date: '2026-10-08',
              slots: [
                { startsAt: confirmation.startsAt, endsAt: confirmation.endsAt, status: 'busy' },
                {
                  startsAt: '2026-10-08T07:00:00Z',
                  endsAt: '2026-10-08T07:30:00Z',
                  status: 'available',
                },
              ],
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    if (path === '/api/health') return new Response('{"status":"ok"}')
    if (typeFailure) throw new TypeError('offline')
    return new Response(
      JSON.stringify({
        owner: confirmation.owner,
        eventType: { id, name: 'Разговор', description: 'Описание', durationMinutes: 30 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
async function filledForm(ready = true) {
  window.history.replaceState(
    {},
    '',
    `/book/${id}/details?date=2026-10-08&slot=2026-10-08T06%3A00%3A00Z`,
  )
  render(<App />)
  fireEvent.change(await screen.findByLabelText('Имя'), { target: { value: 'Сохранён' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'keep@example.com' } })
  if (ready)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Забронировать' })).toBeEnabled())
}
const unavailable = () =>
  Promise.resolve(
    new Response(JSON.stringify({ code: 'SLOT_UNAVAILABLE', message: 'server text' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
test('400 clears stale slot, refreshes busy choices, and preserves contacts after explicit reselection', async () => {
  resilientTransport(unavailable)
  await filledForm()
  fireEvent.click(screen.getByRole('button', { name: 'Забронировать' }))
  expect(await screen.findByText('Это время уже занято. Выберите другой слот')).toBeVisible()
  expect(await screen.findByRole('button', { name: '09:00–09:30 — Занято' })).toBeDisabled()
  expect(window.location.pathname).toBe(`/book/${id}`)
  expect(window.location.search).not.toContain('slot')
  expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '10:00–10:30 — Свободно' }))
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }))
  expect(await screen.findByLabelText('Имя')).toHaveValue('Сохранён')
  expect(screen.getByLabelText('Email')).toHaveValue('keep@example.com')
})
test('lost response has no automatic retry; explicit repeat can return stale with contacts retained', async () => {
  let posts = 0
  const fetch = resilientTransport(async () => {
    posts++
    if (posts === 1) throw new TypeError('lost success')
    return unavailable()
  })
  await filledForm()
  fireEvent.click(screen.getByRole('button', { name: 'Забронировать' }))
  expect(await screen.findByText('Не удалось узнать результат. Повторите попытку')).toBeVisible()
  expect(posts).toBe(1)
  expect(screen.getByLabelText('Имя')).toHaveValue('Сохранён')
  fireEvent.click(screen.getByRole('button', { name: 'Забронировать' }))
  expect(await screen.findByText('Это время уже занято. Выберите другой слот')).toBeVisible()
  expect(posts).toBe(2)
  for (const [r] of fetch.mock.calls)
    if (r.method === 'POST') {
      expect(await r.clone().json()).toEqual({
        eventTypeId: id,
        startsAt: confirmation.startsAt,
        guestName: 'Сохранён',
        guestEmail: 'keep@example.com',
      })
    }
})
test('event details load failure is explicit and can retry without losing input', async () => {
  resilientTransport(unavailable, true)
  await filledForm(false)
  expect(await screen.findByText('Не удалось загрузить тип события')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Забронировать' })).toBeDisabled()
  resilientTransport(unavailable)
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Забронировать' })).toBeEnabled())
  expect(screen.getByLabelText('Имя')).toHaveValue('Сохранён')
})

test('booking links remain SPA navigation and preserve draft through catalog and type changes', async () => {
  const secondId = '00000000-0000-4000-8000-000000000003'
  const fetch = resilientTransport(unavailable)
  const implementation = fetch.getMockImplementation()!
  fetch.mockImplementation(async (r) =>
    new URL(r.url).pathname === '/api/event-types'
      ? new Response(
          JSON.stringify({
            owner: confirmation.owner,
            items: [
              { id: secondId, name: 'Другой тип', description: 'Описание', durationMinutes: 30 },
            ],
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      : new URL(r.url).pathname === `/api/event-types/${secondId}`
        ? new Response(
            JSON.stringify({
              owner: confirmation.owner,
              eventType: {
                id: secondId,
                name: 'Другой тип',
                description: 'Описание',
                durationMinutes: 30,
              },
            }),
            { headers: { 'Content-Type': 'application/json' } },
          )
        : implementation(r),
  )
  await filledForm()
  fireEvent.click(screen.getByRole('button', { name: 'Назад' }))
  fireEvent.click(await screen.findByRole('link', { name: 'К каталогу' }))
  expect(await screen.findByRole('heading', { name: 'Выберите тип события' })).toHaveFocus()
  fireEvent.click(await screen.findByRole('link', { name: /Другой тип/ }))
  fireEvent.click(await screen.findByRole('button', { name: '10:00–10:30 — Свободно' }))
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }))
  expect(await screen.findByLabelText('Имя')).toHaveValue('Сохранён')
  expect(screen.getByLabelText('Email')).toHaveValue('keep@example.com')
  expect(window.location.pathname).toBe(`/book/${secondId}/details`)
})
test('double submit sends one POST and late success cannot navigate after details URL changes', async () => {
  let resolve!: (r: Response) => void
  let posts = 0
  resilientTransport(async () => {
    posts++
    return new Promise<Response>((r) => {
      resolve = r
    })
  })
  await filledForm()
  fireEvent.submit(screen.getByRole('button', { name: 'Забронировать' }).closest('form')!)
  fireEvent.submit(screen.getByRole('button', { name: 'Сохраняем…' }).closest('form')!)
  await waitFor(() => expect(posts).toBe(1))
  const next = `/book/${id}/details?date=2026-10-09&slot=2026-10-09T07%3A00%3A00Z`
  window.history.pushState({}, '', next)
  fireEvent(window, new PopStateEvent('popstate'))
  resolve(
    new Response(JSON.stringify(confirmation), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  await waitFor(() => expect(screen.getByRole('button', { name: 'Забронировать' })).toBeEnabled())
  expect(window.location.pathname + window.location.search).toBe(next)
  expect(screen.getByLabelText('Имя')).toHaveValue('Сохранён')
  expect(screen.queryByText('Бронирование подтверждено')).not.toBeInTheDocument()
})

test('details reload restores type/date/slot summary but never persists contact draft', async () => {
  resilientTransport(unavailable)
  window.history.replaceState(
    {},
    '',
    `/book/${id}/details?date=2026-10-08&slot=2026-10-08T06%3A00%3A00Z`,
  )
  const { unmount } = render(<App />)
  fireEvent.change(await screen.findByLabelText('Имя'), { target: { value: 'Private' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'private@example.com' } })
  unmount()
  render(<App />)
  expect(await screen.findByLabelText('Имя')).toHaveValue('')
  expect(screen.getByLabelText('Email')).toHaveValue('')
  expect(await screen.findByText(/Разговор · 08-10-2026 · 09:00–09:30/)).toBeVisible()
  expect(window.location.search).not.toContain('Private')
  expect(window.location.search).not.toContain('private')
})
test('details loading is distinct from failure and prevents submitting', () => {
  window.history.replaceState({}, '', `/book/${id}/details?slot=2026-10-08T06%3A00%3A00Z`)
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )
  render(<App />)
  expect(screen.getByText('Загрузка типа события…')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Забронировать' })).toBeDisabled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
