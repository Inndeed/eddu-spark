import { createServerSupabaseClient } from '../server/supabase.js'

const parseFlag = (flag: string) => {
  const index = process.argv.indexOf(flag)
  if (index < 0) {
    return null
  }

  return process.argv[index + 1] ?? null
}

const email = parseFlag('--email')
const password = parseFlag('--password')
const displayName = parseFlag('--name') ?? null
const role = parseFlag('--role') ?? 'host'

if (!email || !password) {
  console.error(
    'Usage: npm run host:create -- --email host@example.com --password your-password [--name "Host Name"] [--role host|admin]',
  )
  process.exit(1)
}

const main = async () => {
  const supabase = createServerSupabaseClient()

  const { data: existingUsers, error: listError } =
    await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

  if (listError) {
    throw listError
  }

  const existingUser = existingUsers.users.find((user) => user.email === email)

  const user =
    existingUser ??
    (
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
        },
      })
    ).data.user

  if (!user) {
    throw new Error('Unable to create or load host user')
  }

  const { error: upsertError } = await supabase.from('host_users').upsert(
    {
      id: user.id,
      email,
      display_name: displayName,
      role,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'id',
    },
  )

  if (upsertError) {
    throw upsertError
  }

  console.log(`Host user is ready: ${email} (${role})`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
