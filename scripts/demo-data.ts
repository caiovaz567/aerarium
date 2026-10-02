// Fills the demo account (development only) with fictitious data that looks
// like a real person's months: to show the app, take screenshots or import
// the screens into Figma without anyone's real numbers.
// The account is created by `npm run e2e:user`; this wipes and refills it.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_CATEGORIES } from '../src/domain/categories'

const EMAIL = 'aerarium.demo@example.test'

const development = JSON.parse(
  readFileSync('supabase/development.json', 'utf8'),
)
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter((match) => match !== null)
    .map((match) => [match[1], match[2]!.trim()]),
)
if (
  development.purpose !== 'development-only' ||
  !String(env.VITE_SUPABASE_URL).includes(development.projectRef)
)
  throw new Error('Operação recusada: só no ambiente de desenvolvimento.')

const db = createClient(
  env.VITE_SUPABASE_URL!,
  env.VITE_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
)
const login = await db.auth.signInWithPassword({
  email: EMAIL,
  password: env.E2E_PASSWORD!,
})
if (login.error || login.data.user?.email !== EMAIL)
  throw new Error('Sem a conta demo. Rode npm run e2e:user antes.')

async function ok(request: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await request
  if (error) throw new Error(error.message)
}
const id = (n: number) =>
  `de300000-0000-4000-8000-${String(n).padStart(12, '0')}`
const category = (name: string) =>
  id(40 + DEFAULT_CATEGORIES.findIndex((item) => item.name === name))
const money = (value: number) => value.toFixed(2)

for (const table of [
  'months',
  'cards',
  'installment_plans',
  'subscriptions',
  'categories',
])
  await ok(db.from(table).delete().not('id', 'is', null))

const cards = [
  { n: 1, name: 'Nubank', color: '#820AD1', closing: 28, due: 5 },
  { n: 2, name: 'Itaú Platinum', color: '#EC7000', closing: 2, due: 10 },
  { n: 3, name: 'Inter Gold', color: '#FF7A00', closing: 10, due: 17 },
]
await ok(
  db.from('cards').insert(
    cards.map((card) => ({
      id: id(card.n),
      name: card.name,
      color: card.color,
      closing_day: card.closing,
      due_day: card.due,
      sort_order: card.n,
    })),
  ),
)
await ok(
  db.from('categories').insert(
    DEFAULT_CATEGORIES.map((item, index) => ({
      id: id(40 + index),
      name: item.name,
      color: item.color,
      icon: item.icon,
      sort_order: index,
    })),
  ),
)

// Four months; the last one is the current month.
const months = ['2026-07', '2026-08', '2026-09', '2026-10']
const monthId = (index: number) => id(10 + index)
await ok(
  db
    .from('months')
    .insert(
      months.map((ref, index) => ({ id: monthId(index), ref: `${ref}-01` })),
    ),
)

await ok(
  db.from('installment_plans').insert(
    [
      ['Notebook', 1, 349.9, 10, '2026-06-01', 'Compras'],
      ['Geladeira', 2, 289.0, 12, '2026-03-01', 'Moradia'],
      ['Curso de inglês', 3, 199.0, 6, '2026-08-01', 'Educação'],
      ['Passagens aéreas', 1, 412.5, 4, '2026-09-01', 'Lazer'],
      ['Dentista', null, 150.0, 5, '2026-08-01', 'Saúde'],
    ].map(([description, card, amount, total, first, cat], index) => ({
      id: id(20 + index),
      card_id: card ? id(card as number) : null,
      description,
      installment_amount: money(amount as number),
      total_installments: total,
      first_month: first,
      category_id: category(cat as string),
    })),
  ),
)

await ok(
  db.from('subscriptions').insert(
    [
      ['Netflix', 1, 44.9, 8],
      ['Spotify', 1, 21.9, 12],
      ['iCloud 200 GB', 2, 14.9, 3],
      ['Academia', 3, 119.9, 15],
      ['Amazon Prime', 2, 19.9, 20],
    ].map(([name, card, amount, day]) => ({
      card_id: id(card as number),
      name,
      amount: money(amount as number),
      charge_day: day,
      category_id: category(name === 'Academia' ? 'Saúde' : 'Assinaturas'),
    })),
  ),
)

const incomes = months.flatMap((_, index) => [
  { month_id: monthId(index), description: 'Salário', amount: '6800.00' },
  ...(index % 2
    ? [
        {
          month_id: monthId(index),
          description: 'Freela',
          amount: '900.00',
          sort_order: 1,
        },
      ]
    : []),
])
await ok(db.from('incomes').insert(incomes, { defaultToNull: false }))

const bills = [
  ['Aluguel', 1850, 'Moradia', 5],
  ['Condomínio', 420, 'Moradia', 8],
  ['Conta de luz', 186.4, 'Moradia', 12],
  ['Internet', 109.9, 'Moradia', 15],
  ['Plano de saúde', 389, 'Saúde', 10],
  ['Celular', 59.9, 'Outros', 20],
] as const
await ok(
  db.from('bills').insert(
    months.flatMap((ref, index) =>
      bills.map(([description, amount, cat, day], order) => {
        // Past months are paid; in the current one only what was due already.
        const paid = index < 3 || day <= 5
        return {
          month_id: monthId(index),
          description,
          amount: money(amount + (order === 2 ? index * 7.35 : 0)),
          category_id: category(cat),
          sort_order: order,
          paid,
          paid_on: paid ? `${ref}-${String(day).padStart(2, '0')}` : null,
        }
      }),
    ),
    { defaultToNull: false },
  ),
)

const invoiceId = (month: number, card: number) => id(100 + month * 10 + card)
await ok(
  db.from('invoices').insert(
    months.flatMap((_, index) =>
      cards.map((card) => ({
        id: invoiceId(index, card.n),
        card_id: id(card.n),
        month_id: monthId(index),
      })),
    ),
    { defaultToNull: false },
  ),
)

// Purchases: the same shops come back every month, on other days and values.
const shops = [
  ['Mercado Pão de Açúcar', 'Alimentação', 212.4],
  ['iFood', 'Alimentação', 48.9],
  ['Uber', 'Transporte', 23.7],
  ['Posto Shell', 'Transporte', 180],
  ['Farmácia Drogasil', 'Saúde', 67.35],
  ['Padaria Real', 'Alimentação', 18.5],
  ['Cinema', 'Lazer', 56],
  ['Amazon', 'Compras', 129.9],
  ['Restaurante Madero', 'Alimentação', 142.8],
  ['Livraria', 'Educação', 74.9],
  ['Renner', 'Compras', 219.9],
  ['99', 'Transporte', 17.4],
  ['Hortifruti', 'Alimentação', 86.15],
  ['Petshop', 'Outros', 95],
] as const
const expenses = months.flatMap((ref, index) => {
  const [year, month] = ref.split('-').map(Number) as [number, number]
  // What an invoice charges was bought the month before.
  const before = new Date(Date.UTC(year, month - 2, 1))
  // The current month's invoices are still filling: fewer purchases.
  const count = index === 3 ? 16 : 22
  return Array.from({ length: count }, (_, turn) => {
    const [description, cat, base] = shops[(turn * 5 + index) % shops.length]!
    const day = 1 + ((turn * 7 + index * 3) % 27)
    const spent = new Date(before)
    spent.setUTCDate(day)
    const hour = 8 + ((turn * 5) % 13)
    return {
      invoice_id: invoiceId(index, 1 + (turn % 3)),
      description,
      amount: money(base * (0.8 + ((turn + index) % 5) * 0.1)),
      spent_on: spent.toISOString().slice(0, 10),
      occurred_at: `${spent.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:${String((turn * 17) % 60).padStart(2, '0')}:00-03:00`,
      category_id: category(cat),
    }
  })
})
await ok(db.from('invoice_expenses').insert(expenses))

// Paid last, so the database freezes each total and pays its installments.
for (const index of [0, 1, 2])
  for (const card of cards)
    await ok(
      db
        .from('invoices')
        .update({
          paid: true,
          paid_on: `${months[index]}-${String(card.due).padStart(2, '0')}`,
        })
        .eq('id', invoiceId(index, card.n)),
    )
await ok(
  db.from('installment_payments').insert(
    ['2026-08-01', '2026-09-01'].map((month) => ({
      plan_id: id(24),
      month,
      paid_on: month.replace('-01', '-12'),
    })),
  ),
)

console.log(
  `Conta demo pronta: ${EMAIL} (senha: E2E_PASSWORD em .env.local). ${expenses.length} compras em ${months.length} meses.`,
)
