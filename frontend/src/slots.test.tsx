import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, test, expect, vi } from 'vitest'
import App from './App'
const id = 'b89ff958-472f-4cb3-af6b-5bc9a5277b88'
const details = {
  owner: { id: 'default', name: 'Владелец' },
  eventType: { id, name: 'Разговор', description: 'Полное описание', durationMinutes: 30 },
}
const available = {
  startsAt: '2026-10-30T06:00:00Z',
  endsAt: '2026-10-30T06:30:00Z',
  status: 'available',
}
const busy = { startsAt: '2026-10-30T06:15:00Z', endsAt: '2026-10-30T06:45:00Z', status: 'busy' }
function setup({ empty = false, error = false, date = '' } = {}) {
  window.history.replaceState({}, '', `/book/${id}${date ? '?date=' + date : ''}`)
  let failed = error
  vi.stubGlobal(
    'fetch',
    vi.fn(async (r: Request) => {
      const path = new URL(r.url).pathname
      if (path.endsWith('/slots')) {
        if (failed) {
          failed = false
          throw new TypeError('offline')
        }
        return response({
          windowStart: '2026-10-30',
          windowEnd: '2026-11-12',
          timeZone: 'Europe/Moscow',
          days: Array.from({ length: 14 }, (_, i) => ({
            date: new Date(Date.UTC(2026, 9, 30 + i)).toISOString().slice(0, 10),
            slots: !empty && i === 0 ? [available, busy] : [],
          })),
        })
      }
      return response(path === '/api/health' ? { status: 'ok' } : details)
    }),
  )
}
function response(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}
afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})
test('calendar uses server dates, explicit selection and text busy status', async () => {
  setup()
  render(<App />)
  expect(
    await screen.findByRole('button', { name: '30-10-2026, свободных слотов: 1' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '09:15–09:45 — Занято' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '09:00–09:30 — Свободно' }))
  expect(screen.getByRole('button', { name: 'Продолжить' })).toBeEnabled()
  expect(screen.getByText('Europe/Moscow')).toBeVisible()
})
test('date link restores empty day in another month and navigation is bounded', async () => {
  setup({ date: '2026-11-01' })
  render(<App />)
  expect(
    await screen.findByRole('button', { name: '01-11-2026, свободных слотов: 0' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('На эту дату нет свободного времени')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Следующий месяц' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Предыдущий месяц' }))
  expect(screen.getByRole('button', { name: 'Предыдущий месяц' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '31-10-2026, свободных слотов: 0' }))
  expect(window.location.search).toBe('?date=2026-10-31')
})
test('empty whole window differs from empty date', async () => {
  setup({ empty: true })
  render(<App />)
  expect(await screen.findByText('Нет доступного времени в ближайшие 14 дней')).toBeVisible()
})
test('slots retry recovers a transport error and focuses heading', async () => {
  setup({ error: true })
  render(<App />)
  expect(await screen.findByText('Не удалось загрузить доступное время')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
  expect(await screen.findByRole('button', { name: '09:00–09:30 — Свободно' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Разговор' })).toHaveFocus()
})

test('continue rechecks exact selected start and refuses a now-busy slot', async () => {
  setup()
  const original = globalThis.fetch
  let reads = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (r: Request) => {
      if (new URL(r.url).pathname.endsWith('/slots') && ++reads > 1)
        return response({
          windowStart: '2026-10-30',
          windowEnd: '2026-11-12',
          timeZone: 'Europe/Moscow',
          days: Array.from({ length: 14 }, (_, i) => ({
            date: new Date(Date.UTC(2026, 9, 30 + i)).toISOString().slice(0, 10),
            slots: i === 0 ? [{ ...available, status: 'busy' }, busy] : [],
          })),
        })
      return original(r)
    }),
  )
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '09:00–09:30 — Свободно' }))
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }))
  expect(await screen.findByText('Это время уже занято. Выберите другой слот')).toBeVisible()
  expect(window.location.pathname).toBe(`/book/${id}`)
  expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled()
  expect(screen.getByRole('heading', { name: 'Время на 30-10-2026' })).toHaveFocus()
})

test('continue checks fresh availability and enters separate details route', async () => {
  setup()
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '09:00–09:30 — Свободно' }))
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }))
  expect(await screen.findByRole('heading', { name: 'Данные гостя' })).toHaveFocus()
  expect(window.location.pathname).toBe(`/book/${id}/details`)
  const params = new URLSearchParams(window.location.search)
  expect(params.get('date')).toBe('2026-10-30')
  expect(params.get('slot')).toBe('2026-10-30T06:00:00Z')
})

test('date changes clear selection and browser back restores previous date', async () => {
  setup()
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '09:00–09:30 — Свободно' }))
  fireEvent.click(screen.getByRole('button', { name: '31-10-2026, свободных слотов: 0' }))
  expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled()
  expect(screen.getByRole('heading', { name: 'Время на 31-10-2026' })).toHaveFocus()
  window.history.replaceState({}, '', `/book/${id}?date=2026-10-30`)
  fireEvent(window, new PopStateEvent('popstate'))
  expect(await screen.findByRole('button', { name: '09:00–09:30 — Свободно' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(screen.getByRole('button', { name: '30-10-2026, свободных слотов: 1' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('initial selection skips busy-only dates and invalid date links', async () => {
  setup({ date: '2099-12-31' })
  const original = globalThis.fetch
  vi.stubGlobal(
    'fetch',
    vi.fn(async (r: Request) => {
      if (!new URL(r.url).pathname.endsWith('/slots')) return original(r)
      return response({
        windowStart: '2026-10-30',
        windowEnd: '2026-11-12',
        timeZone: 'Europe/Moscow',
        days: Array.from({ length: 14 }, (_, i) => ({
          date: new Date(Date.UTC(2026, 9, 30 + i)).toISOString().slice(0, 10),
          slots:
            i === 0
              ? [busy]
              : i === 1
                ? [
                    {
                      ...available,
                      startsAt: '2026-10-31T06:00:00Z',
                      endsAt: '2026-10-31T06:30:00Z',
                    },
                  ]
                : [],
        })),
      })
    }),
  )
  render(<App />)
  expect(
    await screen.findByRole('button', { name: '31-10-2026, свободных слотов: 1' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '09:00–09:30 — Свободно' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(window.location.search).toBe('?date=2026-10-31')
})

test('loading is distinct from empty slots', () => {
  setup()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )
  render(<App />)
  expect(screen.getByText('Загрузка доступного времени…')).toBeVisible()
  expect(screen.queryByText('Нет доступного времени в ближайшие 14 дней')).not.toBeInTheDocument()
})

test.each([
  { label: 'leaving the page', target: '/' },
  { label: 'restoring another date', target: `/book/${id}?date=2026-10-31` },
])('pending continue cannot navigate after $label', async ({ target }) => {
  setup()
  const original = globalThis.fetch
  let resolveCheck!: (value: Response) => void
  let pendingRequest!: Request
  const pending = new Promise<Response>((resolve) => {
    resolveCheck = resolve
  })
  let reads = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      if (new URL(request.url).pathname.endsWith('/slots') && ++reads > 1) {
        pendingRequest = request
        // Deliberately ignore abort: a late success must also be guarded in the component.
        return pending
      }
      return original(request)
    }),
  )
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '09:00–09:30 — Свободно' }))
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }))
  expect(screen.getByRole('button', { name: 'Проверка…' })).toBeDisabled()
  await waitFor(() => expect(pendingRequest).toBeDefined())
  window.history.pushState({}, '', target)
  fireEvent(window, new PopStateEvent('popstate'))
  await act(async () => {
    resolveCheck(await original(pendingRequest))
  })
  expect(window.location.pathname + window.location.search).toBe(target)
  expect(screen.queryByRole('heading', { name: 'Данные гостя' })).not.toBeInTheDocument()
  if (target === '/') expect(screen.getByRole('heading', { name: 'На связи' })).toBeVisible()
  else {
    expect(screen.getByRole('heading', { name: 'Время на 31-10-2026' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled()
    expect(
      screen.queryByText('Не удалось проверить доступность. Повторите попытку'),
    ).not.toBeInTheDocument()
  }
})

test.each(['notice', 'window'])(
  'fresh check clears slot removed by %s expiry without choosing replacement',
  async (reason) => {
    setup()
    const original = globalThis.fetch
    let reads = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (r: Request) => {
        if (new URL(r.url).pathname.endsWith('/slots') && ++reads > 1)
          return response({
            windowStart: reason === 'window' ? '2026-10-31' : '2026-10-30',
            windowEnd: '2026-11-13',
            timeZone: 'Europe/Moscow',
            days:
              reason === 'window'
                ? [
                    {
                      date: '2026-10-31',
                      slots: [
                        {
                          ...available,
                          startsAt: '2026-10-31T06:00:00Z',
                          endsAt: '2026-10-31T06:30:00Z',
                        },
                      ],
                    },
                  ]
                : [
                    {
                      date: '2026-10-30',
                      slots: [
                        {
                          ...available,
                          startsAt: '2026-10-30T07:00:00Z',
                          endsAt: '2026-10-30T07:30:00Z',
                        },
                      ],
                    },
                  ],
          })
        return original(r)
      }),
    )
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '09:00–09:30 — Свободно' }))
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }))
    expect(await screen.findByText('Это время уже занято. Выберите другой слот')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled()
    expect(screen.queryByText(/^Выбрано:/)).not.toBeInTheDocument()
    expect(new URLSearchParams(window.location.search).get('date')).toBe(
      reason === 'window' ? '2026-10-31' : '2026-10-30',
    )
  },
)

test('availability transport failure retains explicit selection and repeat checks again', async () => {
  setup()
  const original = globalThis.fetch
  let reads = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (r: Request) => {
      if (new URL(r.url).pathname.endsWith('/slots') && ++reads === 2)
        throw new TypeError('offline')
      return original(r)
    }),
  )
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '09:00–09:30 — Свободно' }))
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }))
  expect(
    await screen.findByText('Не удалось проверить доступность. Повторите попытку'),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: '09:00–09:30 — Свободно' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.queryByText('На эту дату нет свободного времени')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }))
  expect(await screen.findByRole('heading', { name: 'Данные гостя' })).toHaveFocus()
  expect(reads).toBe(3)
})
