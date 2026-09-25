# Fase 4: login e esqueleto

**Status: código concluído. Falta o usuário ligar o Google no painel** (passos abaixo). Login com e-mail e senha já funciona no projeto de desenvolvimento.

## Entrega

- **Login** (`src/features/login`): entrar com Google, entrar ou criar conta com e-mail e senha, "Esqueci a senha" e a página `/redefinir-senha`, que recebe o link do e-mail. Mensagens de erro do Supabase traduzidas (`src/data/auth.ts`). Depois de entrar, vai pro mês atual (ou pra tela que a pessoa tentou abrir).
- **Rotas protegidas** (`src/app/routes.tsx`): `/meses/:ym`, `/cartoes`, `/cartoes/:id`, `/assinaturas`, `/config`. Sem sessão, tudo leva a `/login`. Mês inválido volta pro mês atual.
- **Sessão** (`src/app/AuthProvider.tsx`): cliente Supabase com PKCE e só a chave pública (`src/data/supabase.ts`, que recusa outra chave). Ao sair, o cache de dados é apagado para não aparecer nada da conta anterior.
- **Cabeçalho**: marca e estado "Salvo / Salvando… / Não salvou". No computador, também a engrenagem de Ajustes.
- **Abas**: no celular, barra embaixo com cinco espaços iguais: Meses, Cartões, + (no meio, levantado), Assinaturas e Ajustes. A partir de 760px, pílula abaixo do cabeçalho.
- **Botão de lançar**: no meio da barra no celular, "+ Lançar" ao lado das abas no computador. Por enquanto abre um modal avisando que o lançamento chega na Fase 7.
- **Componentes** (`src/ui`): `Modal` (centro, fundo escurecido e desfocado, pop, Esc, foco preso e devolvido, sobe pro topo em tela baixa), aviso com Desfazer (`useToast`, 6 s com ação e 2,2 s sem, como a v1), `StickyBar` (gruda abaixo do cabeçalho, com sombra; a do cabeçalho some), `EmptyState`, ícones SVG.
- **TanStack Query** (`src/data/queryClient.ts`): cliente configurado, rastreador do estado de sincronização e o helper `optimistic` (aplica na hora, desfaz se o servidor falhar, recarrega no fim).
- **Configurações**: mostra a conta e o botão Sair (só este aparelho). Baixar dados e apagar conta ficam na Fase 10.
- **Meses** já tem a barra do mês (anterior e próximo). Lista de meses e "+" pra criar mês ficam na Fase 5.

## Decisões

- Login com e-mail e senha além do Google, por decisão do usuário (plano atualizado na Fase 3).
- Ajustes (a tela `/config`): na barra de baixo no celular, com o + no meio, a pedido do usuário depois de ver a primeira versão (antes, a engrenagem ficava no cabeçalho e o + flutuava no canto). No computador, engrenagem no cabeçalho. O nome curto "Ajustes" cabe nos cinco espaços.
- "Sair" encerra só a sessão deste aparelho (`scope: 'local'`).
- Senha com pelo menos 6 caracteres, o mínimo padrão do Supabase.
- React Router 8 no modo declarativo (`BrowserRouter` + `Routes`).

## Testes

- `npm run check`: 174 testes Vitest (rotas, esqueleto, login sem servidor, modal, aviso, sincronização, atualização otimista, mensagens), lint, formatação e build.
- `npm run e2e`: 43 verificações em iPhone (WebKit, 390×844) e computador (Chromium, 1280×800), claro e escuro. Login errado, login certo e sair, redirecionamento sem sessão, abas, posição do botão +, modal no centro, barra grudada, nenhuma rolagem lateral em nenhuma tela. 6 verificações são puladas de propósito (layout de celular no computador e vice-versa).
- Capturas conferidas em 390×844 e 1280×800, nos dois temas.

### Conta de teste do Playwright

`npm run e2e:user` cria (ou reinicia) a conta fictícia `aerarium.e2e@example.test` no projeto de desenvolvimento, já confirmada. A senha é gerada e fica em `.env.local` (`E2E_EMAIL`, `E2E_PASSWORD`), fora do Git. Sem essas variáveis, os testes que precisam de login são pulados. O script recusa rodar fora do projeto registrado em `supabase/development.json`.

Conferido: essa conta entra, recusa senha errada e não enxerga nenhuma linha de outras contas (0 meses visíveis).

## O que o usuário precisa fazer

### 1. Endereços permitidos (para os links de e-mail)

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `http://127.0.0.1:5173`
- **Redirect URLs:** `http://127.0.0.1:5173/**` e `http://localhost:5173/**`

Sem isso, os links de "Esqueci a senha" e de confirmação de conta levam pra um endereço errado. Na Fase 9, entra também o endereço da Vercel.

### 2. Ligar o Google

No [Google Cloud Console](https://console.cloud.google.com/):

1. Crie um projeto (por exemplo, "Aerarium").
2. **APIs e serviços → Tela de consentimento OAuth**: tipo externo, nome "Aerarium", seu e-mail de suporte.
3. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
   - Origens JavaScript autorizadas: `http://127.0.0.1:5173` e `http://localhost:5173`.
   - URI de redirecionamento autorizado: `https://idvbrfbudoxvubxpqdzs.supabase.co/auth/v1/callback`.
4. Copie o **ID do cliente** e a **chave secreta do cliente**.

No Supabase → **Authentication → Sign In / Providers → Google**: ligue, cole o ID e a chave secreta, salve.

A chave secreta do Google fica só no painel do Supabase. Não vai pro `.env.local`, pro Git nem pro app.

Enquanto o Google estiver desligado, o botão "Entrar com Google" mostra "Entrar com Google ainda não está ligado."

### 3. Testar no celular

`npm run dev -- --host` mostra um endereço da rede (por exemplo, `http://192.168.0.10:5173`). Abra no Safari do iPhone, na mesma rede Wi-Fi. Entrar com e-mail e senha funciona assim. O Google precisa desse endereço nas listas acima; o mais simples é testar o Google no celular depois do deploy (Fase 9).

## Pontos para depois

- **E-mails para outras pessoas:** o serviço de e-mail padrão do Supabase é limitado (poucos envios por hora e, pelas regras atuais, só para membros da equipe do projeto). Para outras pessoas criarem conta com e-mail e senha, configurar um SMTP próprio antes da produção (Fase 9 ou 10).
- **Mesma pessoa, Google e senha:** se o e-mail do Google for o mesmo da conta com senha, o Supabase deve juntar as duas formas de login na mesma conta. Conferir quando o Google estiver ligado.
- Proteção contra senhas vazadas depende do plano Pro do Supabase (ver Fase 1).

## Próxima fase

A Fase 5 faz a aba Meses com os dados reais (seção 8.2 do plano). Aguardar confirmação antes de iniciá-la, conforme `CLAUDE.md`.
