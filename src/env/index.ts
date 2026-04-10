import { env } from './env.config'

export function initEnv() {
  if (!env.APP_API_BASE_URL) {
    console.info('[env] APP_API_BASE_URL is not set. Relative API paths will be used.')
  }
}

export { env }
