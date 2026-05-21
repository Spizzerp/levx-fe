import { env } from '@/env'

function responseExcerpt(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${env.APP_API_BASE_URL}${path}`
  let response: Response

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'network error'
    throw new Error(`API request failed before response (${url}): ${detail}`)
  }

  const text = await response.text()

  if (!response.ok) {
    const detail = responseExcerpt(text)
    throw new Error(
      `API request failed: ${response.status} ${response.statusText} (${url})${
        detail ? ` - ${detail}` : ''
      }`,
    )
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`API response was not JSON (${url})`)
  }
}
