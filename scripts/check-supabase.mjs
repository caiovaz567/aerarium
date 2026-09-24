import { pathToFileURL } from 'node:url'

export async function checkSupabase(env, request = fetch) {
  const rawUrl = env.VITE_SUPABASE_URL?.trim() ?? ''
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  if (
    !rawUrl ||
    !key ||
    rawUrl.includes('SEU_PROJECT_REF') ||
    key.includes('SUA_CHAVE_PUBLICA')
  ) {
    throw new Error(
      'Preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em .env.local. Veja docs/SUPABASE_NUVEM.md.',
    )
  }

  // Restringe o destino antes de enviar a chave. Esta verificação é para Supabase hospedado.
  if (!/^https:\/\/[a-z]{20}\.supabase\.co\/?$/.test(rawUrl)) {
    throw new Error(
      'Use a Project URL HTTPS original do painel Supabase, sem caminho nem parâmetros.',
    )
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error(
      'Use a chave pública sb_publishable_. Chaves secret, service_role e tokens pessoais não são aceitos.',
    )
  }

  let response
  try {
    response = await request(`${rawUrl.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new Error(
      'Não foi possível acessar o Supabase. Confira a internet e se o projeto está ativo.',
    )
  }
  if (!response.ok) {
    throw new Error(
      `O Supabase respondeu HTTP ${response.status}. Confira a URL, a chave pública e o estado do projeto.`,
    )
  }
  let settings
  try {
    settings = await response.json()
  } catch {
    throw new Error('O endpoint de autenticação não retornou JSON válido.')
  }
  if (
    !settings ||
    typeof settings.external !== 'object' ||
    settings.external === null
  ) {
    throw new Error(
      'A resposta não corresponde às configurações públicas do Supabase Auth.',
    )
  }
  return 'Supabase acessível com a chave pública. Esta checagem não valida tabelas, RLS nem login Google.'
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(await checkSupabase(process.env))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
