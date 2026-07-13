import { existsSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

type LoadableProcess = typeof process & {
  loadEnvFile?: (path?: string) => void
}

if (existsSync('.env')) {
  ;(process as LoadableProcess).loadEnvFile?.('.env')
}

const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

const missingEnv = requiredEnv.filter((key) => !process.env[key])

if (missingEnv.length > 0) {
  console.error(`FAIL missing Supabase env vars: ${missingEnv.join(', ')}`)
  process.exit(1)
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  },
)

const checks: Array<{
  label: string
  run: () => unknown
}> = [
  {
    label: 'host_users table',
    run: () => supabase.from('host_users').select('id,email,display_name,role,is_active').limit(1),
  },
  {
    label: 'quiz_sets table',
    run: () => supabase.from('quiz_sets').select('id,title,description,category,language,mode').limit(1),
  },
  {
    label: 'quiz_questions image columns',
    run: () => supabase.from('quiz_questions').select('id,image_path,image_alt').limit(1),
  },
  {
    label: 'live_sessions table',
    run: () => supabase.from('live_sessions').select('id,join_code,status,scoring_mode').limit(1),
  },
  {
    label: 'session_participants table',
    run: () => supabase.from('session_participants').select('id,session_id,display_name,score').limit(1),
  },
  {
    label: 'session_submissions table',
    run: () => supabase.from('session_submissions').select('id,session_id,question_id,participant_id').limit(1),
  },
]

for (const check of checks) {
  const result = (await check.run()) as { error: Error | null }

  if (result.error) {
    console.error(`FAIL ${check.label}: ${result.error.message}`)
    process.exit(1)
  }

  console.log(`OK ${check.label}`)
}

const { data: bucket, error: bucketError } = await supabase.storage.getBucket('question-images')

if (bucketError) {
  console.error(`FAIL question-images bucket: ${bucketError.message}`)
  process.exit(1)
}

if (!bucket.public) {
  console.error('FAIL question-images bucket is not public')
  process.exit(1)
}

console.log('OK question-images bucket is public')
console.log('OK Supabase schema and storage readiness checks passed')
