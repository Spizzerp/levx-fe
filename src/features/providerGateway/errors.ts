import { env } from '@/env'

export function providerGatewayErrorMessage(error: unknown): string {
  const apiBaseUrl = env.APP_API_BASE_URL.trim()
  const detail = error instanceof Error ? error.message : ''

  if (!apiBaseUrl) {
    return 'Pipeline API base URL is not configured. Set APP_API_BASE_URL to the pipeline service.'
  }

  if (/not JSON/i.test(detail)) {
    return 'Pipeline API returned a non-JSON response. Verify APP_API_BASE_URL is not pointing at the frontend host.'
  }

  if (/API request failed before response|Failed to fetch|NetworkError/i.test(detail)) {
    return 'Could not reach the configured pipeline API. Check service health and CORS.'
  }

  if (/API request failed: 404/i.test(detail)) {
    return 'Pipeline API did not expose Provider Gateway endpoints. Verify APP_API_BASE_URL points at the pipeline service.'
  }

  return 'Provider Gateway API is unavailable. Check the pipeline /api/v1/status endpoint.'
}
