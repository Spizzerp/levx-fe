export type AppEnv = {
  APP_ENV: string
  APP_API_BASE_URL: string
}

export const env: AppEnv = {
  APP_ENV: import.meta.env.APP_ENV ?? 'local',
  APP_API_BASE_URL: import.meta.env.APP_API_BASE_URL ?? '',
}
