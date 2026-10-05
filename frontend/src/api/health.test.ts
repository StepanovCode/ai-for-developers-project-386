import { afterEach, expect, test, vi } from 'vitest'
import { checkHealth } from './health'

afterEach(() => vi.unstubAllGlobals())

test('health uses the generated SDK and passes cancellation to fetch', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
  const abort = new AbortController()
  await expect(checkHealth(abort.signal)).resolves.toEqual({ status: 'ok' })
  const request: Request = fetchMock.mock.calls[0][0]
  expect(new URL(request.url).pathname).toBe('/api/health')
  expect(request.method).toBe('GET')
  abort.abort()
  expect(request.signal.aborted).toBe(true)
})

test('HTTP errors remain errors instead of a successful health result', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'INTERNAL_ERROR', message: 'Ошибка сервера' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  await expect(checkHealth()).rejects.toMatchObject({ code: 'INTERNAL_ERROR' })
})

test('network failure rejects without an unhandled promise', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network unavailable')))
  await expect(checkHealth()).rejects.toThrow('network unavailable')
})
