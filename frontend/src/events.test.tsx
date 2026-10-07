import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, test, expect, vi } from 'vitest'
import App from './App'
const owner = { id: 'default', name: 'Дмитрий Степанов' }
const event = {
  id: 'b89ff958-472f-4cb3-af6b-5bc9a5277b88',
  name: 'Разговор',
  description: 'Первая\nВторая',
  durationMinutes: 45,
}
function mock(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (r: Request) =>
        new Response(
          JSON.stringify(new URL(r.url).pathname === '/api/health' ? { status: 'ok' } : body),
          { status, headers: { 'Content-Type': 'application/json' } },
        ),
    ),
  )
}
afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})
test('catalog loads SDK data and links full card to a direct type page', async () => {
  window.history.replaceState({}, '', '/book')
  mock({ owner, items: [event] })
  render(<App />)
  expect(await screen.findByText('Дмитрий Степанов')).toBeVisible()
  expect(screen.getByRole('link', { name: /Разговор/ })).toHaveAttribute(
    'href',
    `/book/${event.id}`,
  )
  expect(screen.getByText('45 минут')).toBeVisible()
})
test('empty catalog is distinct from errors and retry reloads', async () => {
  window.history.replaceState({}, '', '/book')
  mock({ owner, items: [] })
  render(<App />)
  expect(await screen.findByText('Пока нет доступных типов событий')).toBeVisible()
})
test('direct type shows full plain description', async () => {
  window.history.replaceState({}, '', `/book/${event.id}`)
  mock({ owner, eventType: event })
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Разговор' })).toBeVisible()
  expect(screen.getByText('Первая Вторая')).toBeVisible()
})
test('form keeps inputs and focuses first invalid field', async () => {
  window.history.replaceState({}, '', '/admin/event-types/new')
  mock(
    {
      code: 'VALIDATION_ERROR',
      message: 'Ошибка',
      fieldErrors: { name: ['Название обязательно'] },
    },
    422,
  )
  render(<App />)
  const name = screen.getByLabelText('Название')
  fireEvent.change(name, { target: { value: 'Разговор' } })
  fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Текст' } })
  fireEvent.click(screen.getByRole('button', { name: 'Создать тип' }))
  expect(await screen.findByText('Название обязательно')).toBeVisible()
  expect(name).toHaveValue('Разговор')
  expect(name).toHaveFocus()
})

test('catalog retry replaces error with loaded cards', async () => {
  window.history.replaceState({}, '', '/book')
  let failed = true
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      if (new URL(request.url).pathname === '/api/health')
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      if (failed) {
        failed = false
        throw new TypeError('offline')
      }
      return new Response(JSON.stringify({ owner, items: [event] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  render(<App />)
  expect(await screen.findByText('Не удалось загрузить типы событий')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
  expect(await screen.findByRole('link', { name: /Разговор/ })).toBeVisible()
  expect(screen.queryByText('Пока нет доступных типов событий')).not.toBeInTheDocument()
})

test('creation returns to admin with success and newly loaded type', async () => {
  window.history.replaceState({}, '', '/admin/event-types/new')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname
      if (path === '/api/health')
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      if (request.method === 'POST') {
        const body = await request.json()
        expect(body).toEqual({ name: 'Разговор', description: 'Описание', durationMinutes: 480 })
        return new Response(JSON.stringify(event), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ owner, items: [event] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  render(<App />)
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Разговор' } })
  fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Описание' } })
  fireEvent.change(screen.getByLabelText('Длительность в минутах'), { target: { value: '480' } })
  fireEvent.click(screen.getByRole('button', { name: 'Создать тип' }))
  expect(await screen.findByText('Тип события создан')).toBeVisible()
  expect(await screen.findByRole('link', { name: /Разговор/ })).toBeVisible()
  expect(window.location.pathname).toBe('/admin')
  expect(screen.getByRole('heading', { name: 'Типы событий' })).toHaveFocus()
})

test('unknown type has a catalog return link', async () => {
  window.history.replaceState({}, '', `/book/${event.id}`)
  mock({ code: 'NOT_FOUND', message: 'Тип события не найден' }, 404)
  render(<App />)
  expect(await screen.findByText('Тип события не найден')).toBeVisible()
  expect(screen.getByRole('link', { name: 'К каталогу' })).toHaveAttribute('href', '/book')
})

test('home heading receives focus on direct navigation', () => {
  mock({ owner, items: [] })
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Meetly' })).toHaveFocus()
})

test('late create success keeps the catalog chosen while request was pending', async () => {
  window.history.replaceState({}, '', '/admin/event-types/new')
  let complete!: (response: Response) => void
  const delayed = new Promise<Response>((resolve) => {
    complete = resolve
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      if (request.method === 'POST') return delayed
      return new Response(
        JSON.stringify(
          new URL(request.url).pathname === '/api/health' ? { status: 'ok' } : { owner, items: [] },
        ),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }),
  )
  render(<App />)
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Разговор' } })
  fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Описание' } })
  fireEvent.click(screen.getByRole('button', { name: 'Создать тип' }))
  expect(screen.getByRole('button', { name: 'Создание…' })).toBeDisabled()
  fireEvent.click(screen.getByRole('link', { name: 'Записаться' }))
  expect(await screen.findByText('Пока нет доступных типов событий')).toBeVisible()
  await act(async () => {
    complete(
      new Response(JSON.stringify(event), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })
  expect(window.location.pathname).toBe('/book')
  expect(screen.getByRole('heading', { name: 'Выберите тип события' })).toBeVisible()
  expect(screen.queryByText('Тип события создан')).not.toBeInTheDocument()
})

test('pending create ignores a second form submit', async () => {
  window.history.replaceState({}, '', '/admin/event-types/new')
  let complete!: (response: Response) => void
  let writes = 0
  const delayed = new Promise<Response>((resolve) => {
    complete = resolve
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      if (request.method === 'POST') {
        writes += 1
        return delayed
      }
      return new Response(
        JSON.stringify(
          new URL(request.url).pathname === '/api/health'
            ? { status: 'ok' }
            : { owner, items: [event] },
        ),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }),
  )
  render(<App />)
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Разговор' } })
  fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Описание' } })
  const form = screen.getByRole('button', { name: 'Создать тип' }).closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  await act(async () => {
    complete(
      new Response(JSON.stringify(event), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })
  expect(await screen.findByText('Тип события создан')).toBeVisible()
  expect(writes).toBe(1)
})
