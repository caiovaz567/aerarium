// Creates (or resets) the fictitious accounts the Playwright tests sign in with:
// the main one, a disposable one that the "Apagar minha conta" test deletes,
// and one for Open Finance (the bank function answers only it, in development).
// Development project only. The password lives in .env.local, never in Git.
import { spawnSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'

const USER_ID = '10000000-0000-4000-8000-000000000e2e'
const EMAIL = 'aerarium.e2e@example.test'
const DISPOSABLE_ID = '10000000-0000-4000-8000-000000000de1'
const DISPOSABLE_EMAIL = 'aerarium.e2e.apagar@example.test'
// Open Finance tests: the only account the bank function answers in development.
const BANK_ID = '10000000-0000-4000-8000-000000000ba0'
const BANK_EMAIL = 'aerarium.e2e.banco@example.test'
// Not for tests: fictitious data to show the app (npm run demo fills it).
const DEMO_ID = '10000000-0000-4000-8000-0000000de300'
const DEMO_EMAIL = 'aerarium.demo@example.test'

const development = JSON.parse(
  readFileSync('supabase/development.json', 'utf8'),
)
const linked = readFileSync('supabase/.temp/project-ref', 'utf8').trim()
if (
  development.purpose !== 'development-only' ||
  linked !== development.projectRef
)
  throw new Error(
    'Operação recusada: o projeto vinculado não é o ambiente de desenvolvimento registrado.',
  )

const envFile = '.env.local'
const env = existsSync(envFile) ? readFileSync(envFile, 'utf8') : ''
let password = env.match(/^E2E_PASSWORD=(.+)$/m)?.[1]?.trim()
if (!password) {
  password = randomBytes(18).toString('base64url')
  appendFileSync(
    envFile,
    `${env.endsWith('\n') || !env ? '' : '\n'}E2E_EMAIL=${EMAIL}\nE2E_PASSWORD=${password}\n`,
  )
}
if (!/^[A-Za-z0-9_-]+$/.test(password))
  throw new Error('E2E_PASSWORD deve ter só letras, números, _ ou -.')

const account = (id, email) => `do $$ begin
  if exists (select 1 from auth.users where id = '${id}' and email is distinct from '${email}') then
    raise exception 'Reserved e2e user belongs to another account';
  end if;
end $$;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current, phone_change, phone_change_token,
  reauthentication_token)
values ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', '${email}',
  extensions.crypt('${password}', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"fixture":"aerarium-e2e"}', now(), now(), '', '', '', '', '', '', '', '')
on conflict (id) do update set encrypted_password = excluded.encrypted_password,
  email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()), updated_at = now();
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values ('${id}', '${id}', '{"sub":"${id}","email":"${email}","email_verified":true}', 'email', now(), now(), now())
on conflict (provider_id, provider) do nothing;
select email, email_confirmed_at is not null as confirmed from auth.users where id = '${id}';
`

const sql = `begin;
${account(USER_ID, EMAIL)}${account(DISPOSABLE_ID, DISPOSABLE_EMAIL)}${account(BANK_ID, BANK_EMAIL)}${account(DEMO_ID, DEMO_EMAIL)}commit;`

mkdirSync('.artifacts/db', { recursive: true })
const file = resolve('.artifacts/db', `${randomUUID()}.sql`)
try {
  writeFileSync(file, sql, { flag: 'wx' })
  const result = spawnSync(
    process.execPath,
    [
      resolve('node_modules/supabase/dist/supabase.js'),
      'db',
      'query',
      '--linked',
      '--file',
      file,
      // Force the CLI's JSON reply: without it, a person's terminal gets a table.
      '--agent',
      'yes',
    ],
    { encoding: 'utf8', timeout: 60_000 },
  )
  const output = JSON.parse(result.stdout || '{}')
  if (result.status !== 0 || output.error)
    throw new Error(output.error?.message || result.stderr || 'Falha no SQL.')
  console.log(
    `Contas de teste prontas: ${EMAIL}, ${DISPOSABLE_EMAIL}, ${BANK_EMAIL} e ${DEMO_EMAIL}. Senha em ${envFile}.`,
  )
} finally {
  unlinkSync(file)
}
