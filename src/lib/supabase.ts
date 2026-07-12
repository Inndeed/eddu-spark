import { createClient, type Session } from '@supabase/supabase-js'
import { localizeErrorMessage } from './errors'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let browserSupabase:
  | ReturnType<typeof createClient>
  | null = null

export const hasSupabaseBrowserConfig = () =>
  Boolean(supabaseUrl && supabaseAnonKey)

export const getBrowserSupabase = () => {
  if (!hasSupabaseBrowserConfig()) {
    throw new Error(localizeErrorMessage('Supabase browser configuration is missing.'))
  }

  if (!browserSupabase) {
    browserSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }

  return browserSupabase
}

export const signInHostWithPassword = async (email: string, password: string) => {
  const { data, error } = await getBrowserSupabase().auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  return data.session
}

export const signOutHostSession = async () => {
  const { error } = await getBrowserSupabase().auth.signOut()

  if (error) {
    throw error
  }
}

export const getHostSession = async () => {
  const { data, error } = await getBrowserSupabase().auth.getSession()

  if (error) {
    throw error
  }

  return data.session
}

export const getHostAccessToken = async () => {
  const session = await getHostSession()
  return session?.access_token ?? null
}

export const onHostAuthStateChange = (
  callback: (session: Session | null) => void,
) => getBrowserSupabase().auth.onAuthStateChange((_event, session) => callback(session))
