// @vitest-environment node
import { expect, test, vi } from 'vitest'
import { checkSupabase } from './check-supabase.mjs'

const env = {
  VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
}

test('valida a conexão sem escrever dados nem usar credencial administrativa', async () => {
  const request = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ external: { google: false } })),
    )
  await expect(checkSupabase(env, request)).resolves.toContain(
    'não valida tabelas, RLS',
  )
  expect(request).toHaveBeenCalledWith(
    `${env.VITE_SUPABASE_URL}/auth/v1/settings`,
    expect.objectContaining({
      headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY },
      redirect: 'error',
    }),
  )
})

test.each([
  'http://abcdefghijklmnopqrst.supabase.co',
  'https://abcdefghijklmnopqrst.supabase.co.evil.test',
  'https://example.com',
  'https://abcdefghijklmnopqrst.supabase.co/path',
])('não envia chave para destino inválido: %s', async (url) => {
  const request = vi.fn()
  await expect(
    checkSupabase({ ...env, VITE_SUPABASE_URL: url }, request),
  ).rejects.toThrow('Project URL')
  expect(request).not.toHaveBeenCalled()
})

test.each([
  'sb_secret_fixture',
  'eyJ_service_role_fixture',
  'sbp_personal_fixture',
])('recusa credencial não pública: %s', async (key) => {
  const request = vi.fn()
  await expect(
    checkSupabase({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: key }, request),
  ).rejects.toThrow('chave pública')
  expect(request).not.toHaveBeenCalled()
})

test('informa configuração ausente sem fazer requisição', async () => {
  const request = vi.fn()
  await expect(checkSupabase({}, request)).rejects.toThrow('.env.local')
  expect(request).not.toHaveBeenCalled()
})

test('não inclui corpo de erro nem credenciais na mensagem', async () => {
  const request = vi
    .fn()
    .mockResolvedValue(new Response('conteúdo privado', { status: 401 }))
  await expect(checkSupabase(env, request)).rejects.toThrow('HTTP 401')
  await expect(checkSupabase(env, request)).rejects.not.toThrow(
    'conteúdo privado',
  )
})

test('informa falha de rede sem repetir detalhes potencialmente sensíveis', async () => {
  const request = vi.fn().mockRejectedValue(new Error('detalhes privados'))
  await expect(checkSupabase(env, request)).rejects.toThrow(
    'Confira a internet',
  )
})

test('não considera HTML ou resposta inesperada como conexão validada', async () => {
  await expect(
    checkSupabase(env, vi.fn().mockResolvedValue(new Response('<html/>'))),
  ).rejects.toThrow('JSON válido')
  await expect(
    checkSupabase(env, vi.fn().mockResolvedValue(new Response('{}'))),
  ).rejects.toThrow('configurações públicas')
})
