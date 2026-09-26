import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_CATEGORIES } from '../../src/domain/categories'

// Fictitious data for the Playwright account only (same numbers as
// src/test/financeFixture.ts). September 2026: available R$ 4.226,83.

const id = (n: number) =>
  `e2e00000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const E2E = {
  card1: id(1),
  card2: id(2),
  aug: id(10),
  sep: id(11),
  plan1: id(20),
  plan2: id(21),
  invoiceAug1: id(30),
  invoiceAug2: id(31),
  invoiceSep1: id(32),
  invoiceSep2: id(33),
}
/** Default categories of the e2e account: id(40) is Alimentação, id(48) Outros. */
export const categoryE2E = (name: string) =>
  id(40 + DEFAULT_CATEGORIES.findIndex((item) => item.name === name))
export const LONG_CARD = 'Cartão com um nome bem comprido pra quebrar a linha'

async function ok(request: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await request
  if (error) throw new Error(error.message)
}

/** Signs in as the e2e account (RLS applies) and returns the client. */
export async function e2eClient(): Promise<SupabaseClient> {
  const client = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { error } = await client.auth.signInWithPassword({
    email: process.env.E2E_EMAIL!,
    password: process.env.E2E_PASSWORD!,
  })
  if (error) throw new Error(`Login da conta de teste: ${error.message}`)
  return client
}

/** Wipes the e2e account and loads the fixture again. */
export async function resetFixture(db: SupabaseClient) {
  const { data } = await db.auth.getUser()
  if (data.user?.email !== process.env.E2E_EMAIL)
    throw new Error('Recusado: só a conta de teste pode ser reiniciada.')
  for (const table of [
    'months',
    'cards',
    'installment_plans',
    'subscriptions',
    'categories',
  ])
    await ok(db.from(table).delete().not('id', 'is', null))

  await ok(
    db.from('cards').insert(
      [
        { id: E2E.card1, name: 'Nubank Teste', sort_order: 1 },
        { id: E2E.card2, name: LONG_CARD, color: '#3140C2', sort_order: 2 },
      ],
      { defaultToNull: false },
    ),
  )
  // With categories already there, the app does not create its own list.
  await ok(
    db.from('categories').insert(
      DEFAULT_CATEGORIES.map((item, index) => ({
        id: id(40 + index),
        name: item.name,
        color: item.color,
        sort_order: index,
      })),
    ),
  )
  await ok(
    db.from('installment_plans').insert(
      [
        {
          id: E2E.plan1,
          card_id: E2E.card1,
          description: 'Notebook',
          installment_amount: '120.00',
          total_installments: 10,
          first_month: '2026-08-01',
          category_id: categoryE2E('Compras'),
        },
        {
          id: E2E.plan2,
          description: 'Dentista',
          installment_amount: '150.00',
          total_installments: 4,
          first_month: '2026-08-01',
          note: 'aparelho',
          category_id: null,
        },
      ],
      { defaultToNull: false },
    ),
  )
  await ok(
    db.from('subscriptions').insert({
      card_id: E2E.card1,
      name: 'Streaming',
      amount: '39.90',
      charge_day: 10,
      category_id: categoryE2E('Assinaturas'),
    }),
  )
  await ok(
    db.from('months').insert(
      [
        { id: E2E.aug, ref: '2026-08-01' },
        { id: E2E.sep, ref: '2026-09-01' },
      ],
      { defaultToNull: false },
    ),
  )
  await ok(
    db.from('incomes').insert(
      [
        { month_id: E2E.aug, description: 'Salário', amount: '5000.00' },
        { month_id: E2E.sep, description: 'Salário', amount: '5000.00' },
        {
          month_id: E2E.sep,
          description: 'Sobrou do mês passado',
          amount: '100.00',
          kind: 'carryover',
          sort_order: 1,
        },
      ],
      { defaultToNull: false },
    ),
  )
  await ok(
    db.from('bills').insert(
      [
        {
          month_id: E2E.aug,
          description: 'Aluguel',
          amount: '1500.00',
          paid: true,
          paid_on: '2026-08-05',
        },
        {
          month_id: E2E.sep,
          description: 'Conta de luz',
          amount: '180.35',
          category_id: categoryE2E('Moradia'),
        },
        {
          month_id: E2E.sep,
          description: 'Internet',
          amount: '99.90',
          paid: true,
          paid_on: '2026-09-10',
          sort_order: 1,
        },
      ],
      { defaultToNull: false },
    ),
  )
  await ok(
    db.from('invoices').insert(
      [
        {
          id: E2E.invoiceAug1,
          card_id: E2E.card1,
          month_id: E2E.aug,
          other_amount: '200.00',
          estimated: false,
        },
        { id: E2E.invoiceAug2, card_id: E2E.card2, month_id: E2E.aug },
        {
          id: E2E.invoiceSep1,
          card_id: E2E.card1,
          month_id: E2E.sep,
          other_amount: '271.02',
          estimated: false,
          note: 'iPhone 2/12',
        },
        {
          id: E2E.invoiceSep2,
          card_id: E2E.card2,
          month_id: E2E.sep,
          note: `Fatura ${LONG_CARD}`,
        },
      ],
      { defaultToNull: false },
    ),
  )
  await ok(
    db.from('invoice_expenses').insert({
      invoice_id: E2E.invoiceSep1,
      description: 'Uber',
      amount: '12.00',
      spent_on: '2026-09-03',
      category_id: categoryE2E('Transporte'),
    }),
  )
  await ok(
    db.from('installment_payments').insert({
      plan_id: E2E.plan2,
      month: '2026-08-01',
      paid_on: '2026-08-12',
    }),
  )
  // Paid last, so the database freezes the total (R$ 359,90) and pays the Notebook.
  await ok(
    db
      .from('invoices')
      .update({ paid: true, paid_on: '2026-08-10' })
      .eq('id', E2E.invoiceAug1),
  )
}
