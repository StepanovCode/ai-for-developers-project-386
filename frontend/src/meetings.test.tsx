import { fireEvent, render, screen, act } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { MeetingsPage } from './meetings'
const start = Date.parse('2026-10-08T06:00:00Z')
const meeting = {
  id: 'one',
  eventTypeId: 'type',
  eventTypeName: 'Разговор',
  durationMinutes: 30,
  startsAt: new Date(start).toISOString(),
  endsAt: new Date(start + 1800000).toISOString(),
  guestName: 'Гость',
  guestEmail: 'guest@example.com',
  timeZone: 'Europe/Moscow',
  owner: { id: 'default', name: 'Owner' },
}
function transport(items = [meeting], status = 200) {
  const fetch = vi.fn(async (request: Request) => {
    expect(request.method).toBe('GET')
    return new Response(
      JSON.stringify(
        status === 200
          ? { items, timeZone: 'Europe/Moscow' }
          : { message: 'Error', code: 'INTERNAL_ERROR' },
      ),
      {
        status,
        headers: { 'Content-Type': 'application/json', Date: new Date(Date.now()).toUTCString() },
      },
    )
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
test('loads contacts in Moscow and refreshes manually and on tab return', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(start - 60000)
  const fetch = transport()
  render(<MeetingsPage />)
  expect(screen.getByRole('status')).toHaveTextContent('Загрузка')
  expect(await screen.findByText('guest@example.com')).toBeVisible()
  expect(screen.getByText('08-10-2026')).toBeVisible()
  expect(screen.getByText(/09:00.*09:30/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
  await screen.findByText('guest@example.com')
  expect(fetch).toHaveBeenCalledTimes(2)
  fireEvent(document, new Event('visibilitychange'))
  await screen.findByText('guest@example.com')
  expect(fetch).toHaveBeenCalledTimes(3)
})
test('error is distinct from empty and retry loads empty response', async () => {
  const fetch = transport([], 500)
  render(<MeetingsPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить встречи')
  expect(screen.queryByText('Предстоящих встреч пока нет')).not.toBeInTheDocument()
  fetch.mockResolvedValue(
    new Response(JSON.stringify({ items: [], timeZone: 'Europe/Moscow' }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
  expect(await screen.findByText('Предстоящих встреч пока нет')).toBeVisible()
})
test('removes at exact start without polling; distant timers stay bounded', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(start - 60000)
  const fetch = transport()
  render(<MeetingsPage />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(screen.getByText('Гость')).toBeVisible()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000)
  })
  expect(screen.getByText('Предстоящих встреч пока нет')).toBeVisible()
  expect(fetch).toHaveBeenCalledTimes(1)
})
test('distant meeting survives bounded timer and disappears only at its start', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(start - 3000000000)
  const fetch = transport()
  render(<MeetingsPage />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2147483647)
  })
  expect(screen.getByText('Гость')).toBeVisible()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000000000 - 2147483647)
  })
  expect(screen.getByText('Предстоящих встреч пока нет')).toBeVisible()
  expect(fetch).toHaveBeenCalledTimes(1)
})
test('latest refresh wins and unmount aborts pending request', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(start - 60000)
  let resolveOld!: (response: Response) => void
  const fetch = transport([])
  fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        resolveOld = resolve
      }),
  )
  const view = render(<MeetingsPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
  expect(await screen.findByText('Предстоящих встреч пока нет')).toBeVisible()
  await act(async () => {
    resolveOld(
      new Response(JSON.stringify({ items: [meeting], timeZone: 'Europe/Moscow' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })
  expect(screen.queryByText('Гость')).not.toBeInTheDocument()
  let request!: Request
  fetch.mockImplementationOnce(async (r: Request) => {
    request = r
    return new Promise<Response>(() => {})
  })
  fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
  await act(async () => {})
  view.unmount()
  expect(request.signal.aborted).toBe(true)
})
test.each([600000, -600000])(
  'server clock controls initial visibility and expiry despite client skew %d',
  async (skew) => {
    vi.useFakeTimers()
    vi.setSystemTime(start - 300000 + skew)
    const fetch = transport()
    fetch.mockResolvedValue(
      new Response(JSON.stringify({ items: [meeting], timeZone: 'Europe/Moscow' }), {
        headers: {
          'Content-Type': 'application/json',
          Date: new Date(start - 300000).toUTCString(),
        },
      }),
    )
    render(<MeetingsPage />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText('Гость')).toBeVisible()
    // Changing the operating-system wall clock must not move the server anchor.
    vi.setSystemTime(start + 86400000)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299999)
    })
    expect(screen.getByText('Гость')).toBeVisible()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.getByText('Предстоящих встреч пока нет')).toBeVisible()
    expect(fetch).toHaveBeenCalledTimes(1)
  },
)
test.each([undefined, 'invalid date'])(
  'missing or invalid server Date keeps authoritative returned rows',
  async (date) => {
    vi.useFakeTimers()
    vi.setSystemTime(start + 600000)
    const fetch = transport()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (date) headers.Date = date
    fetch.mockResolvedValue(
      new Response(JSON.stringify({ items: [meeting], timeZone: 'Europe/Moscow' }), { headers }),
    )
    render(<MeetingsPage />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText('Гость')).toBeVisible()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600000)
    })
    expect(screen.getByText('Гость')).toBeVisible()
    expect(fetch).toHaveBeenCalledTimes(1)
  },
)
test('precise server header takes priority over whole-second Date', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(start + 600000)
  const fetch = transport()
  fetch.mockResolvedValue(
    new Response(JSON.stringify({ items: [meeting], timeZone: 'Europe/Moscow' }), {
      headers: {
        'Content-Type': 'application/json',
        Date: new Date(start - 1000).toUTCString(),
        'X-Server-Time': new Date(start - 500).toISOString(),
      },
    }),
  )
  render(<MeetingsPage />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(499)
  })
  expect(screen.getByText('Гость')).toBeVisible()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
  expect(screen.getByText('Предстоящих встреч пока нет')).toBeVisible()
})
