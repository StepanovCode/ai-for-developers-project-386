/// <reference types="node" />
// @vitest-environment node
import process from 'node:process'
import { expect, test } from 'vitest'
import { getHealth } from './generated/sdk.gen'

// Opt-in local smoke: the normal CI suite does not require running services.
test.runIf(process.env.API_SMOKE_URL)(
  'generated SDK calls the running backend through the frontend proxy',
  async () => {
    const { data, response } = await getHealth({
      baseUrl: process.env.API_SMOKE_URL,
      throwOnError: true,
    })
    expect(response.status).toBe(200)
    expect(data).toEqual({ status: 'ok' })
  },
)
