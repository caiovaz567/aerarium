// Fase 14.3, the daily email at 18h (Open Finance owner only). Pure: what goes
// in the email and its HTML. The Edge Function daily-email feeds it with the
// bank's transactions and the owner's cards, and sends it. No imports, so both
// Deno (the function) and Vitest (the tests) read it as is.

export interface EmailTransaction {
  readonly id: string
  readonly accountId: string
  readonly description: string
  /** Positive is a charge; zero or negative (payments, refunds) is left out. */
  readonly amount: number
  /** ISO instant from the bank. */
  readonly date: string
  readonly installmentNumber: number | null
  readonly totalInstallments: number | null
  readonly totalAmount: number | null
}

export interface EmailCard {
  readonly accountId: string
  readonly name: string
  /** Bank logo key (public/banks/KEY.png), or null. */
  readonly bank: string | null
}

export interface EmailCategory {
  readonly name: string
  readonly color: string
}

export interface EmailItem {
  readonly id: string
  readonly name: string
  readonly amount: number
  /** "dom 27 · 21:43", São Paulo time. */
  readonly when: string
  readonly category: EmailCategory | null
  /** "Parcela 1 de 3 · total R$ 389,70", or null. */
  readonly installment: string | null
}

export interface EmailGroup {
  readonly card: EmailCard
  readonly total: number
  readonly items: readonly EmailItem[]
}

/** A closed bill from the bank (reais). */
export interface EmailBankBill {
  readonly id: string
  readonly accountId: string
  /** "YYYY-MM-DD" */
  readonly dueDate: string
  readonly total: number
}

/** The app's invoice of a bill: its total and the owner's part (reais). */
export interface EmailInvoice {
  readonly total: number
  readonly mine: number
}

export interface EmailBill {
  readonly id: string
  readonly card: EmailCard
  /** "outubro" */
  readonly month: string
  readonly total: number
  /** With someone else using the cards and the invoice in the app. */
  readonly mine: number | null
  readonly other: number | null
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]
const MONTHS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

/** São Paulo is UTC−3 all year (no daylight saving since 2019). */
function saoPaulo(instant: string) {
  const date = new Date(Date.parse(instant) - 3 * 60 * 60 * 1000)
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
    weekday: date.getUTCDay(),
    time: date.toISOString().slice(11, 16),
    iso: date.toISOString().slice(0, 10),
  }
}

/**
 * "dom 27 · 21:43"; a bank date with no time (midnight in São Paulo, like
 * bankMoment in src/domain/bank.ts) shows only the day.
 */
export function whenText(instant: string): string {
  const local = saoPaulo(instant)
  const day = `${WEEKDAYS[local.weekday]} ${local.day}`
  return local.time === '00:00' ? day : `${day} · ${local.time}`
}

/** "R$ 1.234,56", with a non-breaking space. */
export function money(value: number): string {
  const cents = Math.round(Math.abs(value) * 100)
  const whole = String(Math.floor(cents / 100)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '.',
  )
  const sign = value < 0 ? '−' : ''
  const space = String.fromCharCode(160)
  return `${sign}R$${space}${whole},${String(cents % 100).padStart(2, '0')}`
}

/**
 * The purchases to tell about: new charges on a known card, from the start day
 * on, not told before. Grouped by card (the order of `cards`), newest first.
 * The bank also lists the next installments of old purchases, some dated in
 * the future: only the first one of a plan is a new purchase.
 */
export function emailGroups(input: {
  readonly transactions: readonly EmailTransaction[]
  readonly cards: readonly EmailCard[]
  /** Already in an email. */
  readonly sent: ReadonlySet<string>
  /** "YYYY-MM-DD": nothing from before (the Open Finance start, or a week ago). */
  readonly from: string
  /** ISO instant: nothing dated after it. */
  readonly now: string
  /** Category by the purchase's name in lower case (the last one chosen). */
  readonly categories: ReadonlyMap<string, EmailCategory>
}): EmailGroup[] {
  const fresh = input.transactions.filter(
    (item) =>
      item.amount > 0 &&
      (item.installmentNumber ?? 1) <= 1 &&
      !input.sent.has(item.id) &&
      saoPaulo(item.date).iso >= input.from &&
      Date.parse(item.date) <= Date.parse(input.now),
  )
  return input.cards.flatMap((card) => {
    const items = fresh
      .filter((item) => item.accountId === card.accountId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((item): EmailItem => ({
        id: item.id,
        name: item.description.trim(),
        amount: item.amount,
        when: whenText(item.date),
        category:
          input.categories.get(item.description.trim().toLowerCase()) ?? null,
        installment:
          item.installmentNumber && item.totalInstallments
            ? `Parcela ${item.installmentNumber} de ${item.totalInstallments}${
                item.totalAmount ? ` · total ${money(item.totalAmount)}` : ''
              }`
            : null,
      }))
    if (!items.length) return []
    const total = items.reduce((sum, item) => sum + item.amount, 0)
    return [{ card, total: Math.round(total * 100) / 100, items }]
  })
}

/**
 * The app's month of a bill due on `dueDate` ("YYYY-MM"): its own month, or
 * the one before with the owner's convention (billMonth in src/domain/bank.ts).
 */
export function billMonthOf(dueDate: string, nextMonth: boolean): string {
  const year = Number(dueDate.slice(0, 4))
  const index = Number(dueDate.slice(5, 7)) - 1 - (nextMonth ? 1 : 0)
  return new Date(Date.UTC(year, index, 1)).toISOString().slice(0, 7)
}

/**
 * The bills the bank closed and no email told yet (asked by the owner on
 * 28/10/2026). Only the ones not due yet: older ones were paid long ago. The
 * other person's part is the rest of the bank's total, as in the app.
 */
export function emailBills(input: {
  readonly bills: readonly EmailBankBill[]
  readonly cards: readonly EmailCard[]
  /** Already in an email, as "bill:ID". */
  readonly sent: ReadonlySet<string>
  /** "YYYY-MM-DD" in São Paulo. */
  readonly today: string
  readonly nextMonth: boolean
  readonly otherPerson: boolean
  /** The app's invoices by "accountId YYYY-MM". */
  readonly invoices: ReadonlyMap<string, EmailInvoice>
}): EmailBill[] {
  return input.cards.flatMap((card) =>
    input.bills
      .filter(
        (bill) =>
          bill.accountId === card.accountId &&
          bill.total > 0 &&
          bill.dueDate >= input.today &&
          !input.sent.has(`bill:${bill.id}`),
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((bill): EmailBill => {
        const month = billMonthOf(bill.dueDate, input.nextMonth)
        const app = input.otherPerson
          ? input.invoices.get(`${card.accountId} ${month}`)
          : undefined
        const round = (value: number) => Math.round(value * 100) / 100
        return {
          id: bill.id,
          card,
          month: MONTH_NAMES[Number(month.slice(5, 7)) - 1]!,
          total: bill.total,
          mine: app ? round(app.mine) : null,
          other: app
            ? round(Math.max(0, Math.max(app.total, bill.total) - app.mine))
            : null,
        }
      }),
  )
}

/** "29 set", the day the email goes out. */
export function dayText(instant: string): string {
  const local = saoPaulo(instant)
  return `${local.day} ${MONTHS[local.month]}`
}

const escape = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const FONT =
  "font-family:'Figtree',-apple-system,'Segoe UI',system-ui,sans-serif;"
const DISPLAY =
  "font-family:'Bricolage Grotesque','Segoe UI',system-ui,sans-serif;"

function itemRow(item: EmailItem): string {
  const dot = item.category
    ? `<span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${escape(item.category.color)};margin-right:6px;vertical-align:middle;"></span>`
    : ''
  const detail = [item.category?.name, item.when].filter(Boolean).join(' · ')
  return `
      <tr>
        <td valign="middle" style="padding:10px 12px 10px 0;border-top:1px solid #eef0f5;${FONT}">
          <div style="color:#161a26;font-size:14.5px;font-weight:600;line-height:1.3;">${escape(item.name)}</div>
          <div style="color:#62697e;font-size:12.5px;line-height:1.35;">${dot}${escape(detail)}</div>${
            item.installment
              ? `<div style="color:#62697e;font-size:12.5px;line-height:1.35;">${escape(item.installment)}</div>`
              : ''
          }
        </td>
        <td align="right" valign="middle" style="padding:10px 0;border-top:1px solid #eef0f5;white-space:nowrap;${FONT}">
          <div style="color:#161a26;font-size:15px;font-weight:700;">${money(item.amount)}</div>
        </td>
      </tr>`
}

function logoCell(card: EmailCard, appUrl: string): string {
  return card.bank
    ? `<td valign="middle" style="padding-right:10px;"><img src="${escape(appUrl)}/banks/${escape(card.bank)}.png" width="28" height="28" alt="" style="display:block;width:28px;height:28px;border-radius:8px;"></td>`
    : ''
}

function partRow(label: string, amount: number): string {
  return `
      <tr>
        <td valign="middle" style="padding:10px 12px 10px 0;border-top:1px solid #eef0f5;color:#62697e;font-size:14px;${FONT}">${escape(label)}</td>
        <td align="right" valign="middle" style="padding:10px 0;border-top:1px solid #eef0f5;white-space:nowrap;color:#161a26;font-size:15px;font-weight:700;${FONT}">${money(amount)}</td>
      </tr>`
}

function billBlock(
  bill: EmailBill,
  appUrl: string,
  otherPerson: string | null,
): string {
  const parts =
    bill.mine !== null && bill.other !== null && otherPerson
      ? partRow('Sua parte', bill.mine) +
        partRow(`Parte do ${otherPerson}`, bill.other)
      : ''
  return `
  <tr><td style="height:12px;"></td></tr>
  <tr><td style="background:#fff;border-radius:18px;padding:4px 18px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td valign="middle" style="padding:12px 0 10px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            ${logoCell(bill.card, appUrl)}<td valign="middle">
              <div style="color:#161a26;font-size:16px;font-weight:800;${DISPLAY}">${escape(bill.card.name)}</div>
              <div style="color:#62697e;font-size:12.5px;${FONT}">Fatura de ${escape(bill.month)} fechou</div>
            </td>
          </tr></table>
        </td>
        <td align="right" valign="middle" style="padding:12px 0 10px;color:#161a26;font-size:15px;font-weight:700;white-space:nowrap;${FONT}">${money(bill.total)}</td>
      </tr>${parts}
    </table>
  </td></tr>`
}

function cardBlock(group: EmailGroup, appUrl: string): string {
  const logo = logoCell(group.card, appUrl)
  return `
  <tr><td style="height:12px;"></td></tr>
  <tr><td style="background:#fff;border-radius:18px;padding:4px 18px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td valign="middle" style="padding:12px 0 10px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            ${logo}<td valign="middle" style="color:#161a26;font-size:16px;font-weight:800;${DISPLAY}">${escape(group.card.name)}</td>
          </tr></table>
        </td>
        <td align="right" valign="middle" style="padding:12px 0 10px;color:#161a26;font-size:15px;font-weight:700;white-space:nowrap;${FONT}">${money(group.total)}</td>
      </tr>${group.items.map(itemRow).join('')}
    </table>
  </td></tr>`
}

/** Subject and HTML of the email. */
export function renderEmail(input: {
  readonly groups: readonly EmailGroup[]
  /** Bills the bank closed, above the purchases. */
  readonly bills?: readonly EmailBill[]
  /** When it goes out (ISO instant). */
  readonly now: string
  readonly appUrl: string
  /** The first one, sent when the switch is turned on. */
  readonly test?: boolean
  /** Who else uses the cards ("Pai"): the email asks to mark each purchase. */
  readonly otherPerson?: string | null
}): { subject: string; html: string } {
  const items = input.groups.flatMap((group) => group.items)
  const total = input.groups.reduce((sum, group) => sum + group.total, 0)
  const count = `${items.length} ${items.length === 1 ? 'compra' : 'compras'}`
  const cards = `${input.groups.length} ${input.groups.length === 1 ? 'cartão' : 'cartões'}`
  const bills = input.bills ?? []
  const closed =
    bills.length === 1
      ? `fatura do ${bills[0]!.card.name} fechou, ${money(bills[0]!.total)}`
      : `${bills.length} faturas fecharam`
  const subject = input.test
    ? 'Aerarium: resumo por e-mail ligado'
    : bills.length
      ? `Aerarium: ${closed}${items.length ? `, e ${count} no cartão` : ''}`
      : `Aerarium: ${count} no cartão, ${money(total)}`
  // With only closed bills, the purchases' summary would say zero.
  const hero = items.length > 0 || bills.length === 0
  const mark = Boolean(input.otherPerson) && items.length > 0
  const intro = input.test
    ? `<tr><td style="padding:0 4px 12px;color:#161a26;font-size:14px;line-height:1.5;${FONT}">Pronto! Todo dia às 18h chega aqui o que o banco mostrou de novo.${
        items.length
          ? ' Abaixo, as compras dos últimos dias.'
          : ' Nos últimos dias não chegou nenhuma compra.'
      }</td></tr>`
    : ''
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escape(subject)}</title>
</head>
<body style="margin:0;background:#f1f2f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f2f6;">
<tr><td align="center" style="padding:20px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
  ${intro}
  ${bills.map((bill) => billBlock(bill, input.appUrl, input.otherPerson ?? null)).join('')}
  ${
    hero
      ? `${bills.length ? '<tr><td style="height:12px;"></td></tr>' : ''}
  <tr><td style="background:#2b39b3;border-radius:18px;padding:18px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" style="color:#d5d9f4;font-size:13px;font-weight:600;${FONT}">Aerarium · chegou do banco</td>
      <td align="right" valign="middle" style="color:#d5d9f4;font-size:13px;${FONT}">${dayText(input.now)}</td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr>
      <td valign="bottom" style="color:#fff;font-size:30px;font-weight:800;line-height:1;${DISPLAY}">${money(total)}</td>
      <td align="right" valign="bottom" style="color:#fff;font-size:14px;${FONT}">${items.length ? `${count} em ${cards}` : 'nada novo'}</td>
    </tr></table>
  </td></tr>`
      : ''
  }
  ${input.groups.map((group) => cardBlock(group, input.appUrl)).join('')}
  ${
    mark
      ? `<tr><td align="center" style="padding:18px 20px 0;color:#62697e;font-size:14px;line-height:1.5;${FONT}">Abra o Aerarium e marque o que é seu e o que é do ${escape(input.otherPerson!)}.</td></tr>`
      : ''
  }
  <tr><td align="center" style="padding:${mark ? 12 : 20}px 0 6px;">
    <a href="${escape(input.appUrl)}" style="display:inline-block;padding:12px 24px;border-radius:12px;background:#3140c2;color:#fff;font-size:15px;font-weight:700;text-decoration:none;${FONT}">${mark ? 'Marcar no Aerarium' : 'Abrir o Aerarium'}</a>
  </td></tr>
  <tr><td align="center" style="padding:8px 20px;color:#8a90a3;font-size:12px;line-height:1.5;${FONT}">
    Chega às 18h, só nos dias com compra nova ou fatura fechada. Pra parar, desligue em Ajustes, Bancos conectados.
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
  return { subject, html }
}
