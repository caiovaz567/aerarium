# Preparar o ambiente local no Windows

O Aerarium usa Docker Desktop com contêineres Linux para executar o Supabase local. Não é necessário criar conta no Supabase nem configurar o Google para concluir esta etapa.

## Situação desta máquina

- Windows 11 Pro, com hipervisor ativo e Virtual Machine Platform habilitada.
- Docker Desktop instalado para o usuário atual. O executável fica em `%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe`.
- Docker CLI verificado: versão 29.8.0.
- A instalação do WSL pelo terminal comum retornou `0x80073d28`: requer administrador. A tentativa com elevação retornou que a operação foi cancelada. O WSL continua pendente.
- O Supabase local ainda precisa ser iniciado e validado.

## Concluir o WSL

A tentativa automática não concluiu. Para instalar manualmente:

1. Abra o menu Iniciar, procure **PowerShell** e escolha **Executar como administrador**.
2. Execute:

```powershell
winget install --id Microsoft.WSL --exact --source winget --silent --accept-source-agreements --accept-package-agreements
```

3. Quando a instalação terminar, confira:

```powershell
wsl --version
```

Se o instalador ou o Docker solicitar reinicialização, salve seu trabalho e reinicie o Windows. A reinicialização deve ser feita por você.

## Abrir o Docker

1. Procure **Docker Desktop** no menu Iniciar e abra.
2. Leia e aceite os termos, se concordar.
3. Conclua a introdução. Para o ambiente local deste projeto, pode pular o login na conta Docker se essa opção aparecer.
4. Aguarde o mecanismo de contêineres iniciar. Se houver escolha de backend, use **WSL 2** e contêineres **Linux**.
5. Reabra o terminal do VS Code para carregar o PATH atualizado e execute:

```powershell
docker info
```

O comando precisa exibir a seção **Server**, sem erro de conexão ao daemon. `docker --version` sozinho verifica apenas a instalação do cliente.

## Iniciar o Supabase

No terminal, dentro da pasta do Aerarium:

```powershell
npm run supabase:start
npm run supabase:status
```

Na primeira execução, o Supabase baixa as imagens dos serviços e pode demorar alguns minutos. Depois que iniciar, o Studio local fica em http://127.0.0.1:54323.

Copie `.env.example` para `.env.local` somente se ainda não existir. Use a URL local e a chave pública `anon` do status. Não coloque `service_role` em variável `VITE_*` e não compartilhe a saída completa de credenciais.

Para abrir a interface:

```powershell
npm run dev
```

Acesse http://127.0.0.1:5173. Para parar o banco preservando os dados locais, use `npm run supabase:stop`.

Quando Docker e Supabase estiverem funcionando, a Fase 0 poderá ser encerrada. A Fase 1 cria as tabelas, as regras de acesso por usuário, as views e os dados fictícios de teste.

## Referências

- [Docker Desktop no Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
- [Comandos do WSL](https://learn.microsoft.com/en-us/windows/wsl/basic-commands)
- [Supabase local](https://supabase.com/docs/guides/local-development/cli/getting-started)
