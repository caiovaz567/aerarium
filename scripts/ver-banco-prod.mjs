// node scripts/ver-banco-prod.mjs
//
// Read only: asks the bank function, as the owner, whether this account is
// the bank owner, and prints the answer or the error. Nothing is written.
// Login: scripts/login.mjs (asked once, then kept).
import { PROD_URL, prodKey, signedIn } from './login.mjs'

const { client } = await signedIn({
  url: PROD_URL,
  key: await prodKey(),
  label: 'da produção',
  name: 'prod',
})
const { data, error } = await client.functions.invoke('bank', {
  body: { action: 'status' },
})
console.log('Resposta do banco:', JSON.stringify(data ?? null))
if (error) {
  console.log('Erro:', error.name, error.context?.status ?? '')
  const body = await error.context?.text?.().catch(() => '')
  if (body) console.log('Detalhe:', body.slice(0, 300))
}
