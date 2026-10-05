import { getHealth } from './generated/sdk.gen'

export async function checkHealth(signal?: AbortSignal) {
  const { data } = await getHealth({
    baseUrl: window.location.origin,
    signal,
    throwOnError: true,
  })
  return data
}
