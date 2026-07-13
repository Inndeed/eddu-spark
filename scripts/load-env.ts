import { existsSync } from 'node:fs'

type LoadableProcess = typeof process & {
  loadEnvFile?: (path?: string) => void
}

const loadEnvFile = (path: string) => {
  if (!existsSync(path)) {
    return
  }

  ;(process as LoadableProcess).loadEnvFile?.(path)
}

loadEnvFile('.env')
loadEnvFile('.env.local')
