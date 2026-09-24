import {
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const mode = process.argv[2]
if (!['preflight', 'test', 'seed'].includes(mode)) {
  throw new Error('Use database.mjs preflight, test ou seed.')
}
const development = JSON.parse(
  readFileSync('supabase/development.json', 'utf8'),
)
const linked = readFileSync('supabase/.temp/project-ref', 'utf8').trim()
if (
  development.purpose !== 'development-only' ||
  linked !== development.projectRef
) {
  throw new Error(
    'Operação recusada: o projeto vinculado não é o ambiente de desenvolvimento registrado.',
  )
}

const sql = [
  'begin;',
  "select pg_advisory_xact_lock(hashtext('aerarium-phase1-fixtures'));",
  "set local statement_timeout = '30s';",
]
if (mode === 'preflight') {
  sql.push(
    "do $$ begin if to_regclass('public.cards') is not null then raise exception 'Preflight requires an empty development database'; end if; end $$;",
  )
  for (const name of readdirSync('supabase/migrations')
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort()) {
    sql.push(readFileSync(`supabase/migrations/${name}`, 'utf8'))
  }
}
sql.push(readFileSync('supabase/seed.sql', 'utf8'))
if (mode === 'seed') {
  sql.push(
    "select ref, incomes, outflows, available, unpaid from public.v_month_summary where user_id = '10000000-0000-4000-8000-000000000001' order by ref;",
    'commit;',
  )
} else {
  sql.push(readFileSync('supabase/tests/phase1.sql', 'utf8'), 'rollback;')
}

mkdirSync('.artifacts/db', { recursive: true })
const filename = resolve('.artifacts/db', `${randomUUID()}.sql`)
try {
  writeFileSync(filename, sql.join('\n'), { flag: 'wx' })
  const result = spawnSync(
    process.execPath,
    [
      resolve('node_modules/supabase/dist/supabase.js'),
      'db',
      'query',
      '--linked',
      '--file',
      filename,
    ],
    {
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    },
  )
  if (result.error)
    throw new Error('Não foi possível executar o Supabase CLI.', {
      cause: result.error,
    })
  let output
  try {
    output = JSON.parse(result.stdout)
  } catch {
    throw new Error(
      `O CLI não retornou JSON válido: ${result.stderr || result.stdout}`,
    )
  }
  if (result.status !== 0 || output.error || output._tag === 'Error') {
    throw new Error(
      output.error?.message || result.stderr || 'Falha na execução SQL.',
    )
  }
  const rows = output.rows?.filter((row) =>
    mode === 'seed' ? Object.hasOwn(row, 'ref') : Object.hasOwn(row, 'check'),
  )
  if (!rows?.length) throw new Error('Execução sem resultados de verificação.')
  if (mode !== 'seed' && rows.some((row) => row.status !== 'PASS'))
    throw new Error('Há verificações reprovadas.')
  console.table(rows)
  console.log(
    mode === 'seed'
      ? 'Seed fictício aplicado somente ao desenvolvimento.'
      : `${rows.length} verificações passaram; alterações dos testes revertidas por ROLLBACK.`,
  )
} finally {
  unlinkSync(filename)
}
