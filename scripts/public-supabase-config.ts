type PublicSupabaseConfig = {
  anonKey: string
  source: 'deployed_asset'
  url: string
}

const readText = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`)
  }

  return response.text()
}

const decodeJwtPayload = (token: string) => {
  const payload = token.split('.')[1]
  if (!payload) {
    return null
  }

  const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalizedPayload.length % 4)) % 4)

  try {
    return JSON.parse(Buffer.from(`${normalizedPayload}${padding}`, 'base64').toString('utf8')) as {
      ref?: unknown
      role?: unknown
    }
  } catch {
    return null
  }
}

export const discoverPublicSupabaseConfig = async (baseUrl: string): Promise<PublicSupabaseConfig> => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
  const html = await readText(normalizedBaseUrl)
  const jsAssets = [...new Set(html.match(/assets\/index-[\w-]+\.js/g) ?? [])]

  if (jsAssets.length === 0) {
    throw new Error('landing page did not reference a built JS asset')
  }

  for (const asset of jsAssets) {
    const assetText = await readText(`${normalizedBaseUrl}/${asset}`)
    const supabaseUrls = [...new Set(assetText.match(/https:\/\/[a-z0-9-]+\.supabase\.co/g) ?? [])]
    const jwtTokens = [...new Set(assetText.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g) ?? [])]

    for (const url of supabaseUrls) {
      const projectRef = new URL(url).hostname.split('.')[0]
      const anonKey = jwtTokens.find((token) => {
        const payload = decodeJwtPayload(token)
        return payload?.role === 'anon' && payload.ref === projectRef
      })

      if (anonKey) {
        return {
          anonKey,
          source: 'deployed_asset',
          url,
        }
      }
    }
  }

  throw new Error('deployed assets did not include a matching Supabase anon config')
}
