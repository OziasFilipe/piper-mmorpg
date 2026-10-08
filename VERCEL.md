# Jogo na Vercel — As Aventuras do Piper

O jogo roda **inteiro na Vercel**: as telas e imagens (CDN) **e o servidor do jogo** (mundo, monstros, chat, amigos, painel admin), que vira uma função em `api/server.js`, na região **São Paulo (gru1)**.

## Onde os dados ficam salvos (sempre SQLite)

| Onde o jogo roda | Banco | Atualizar o jogo apaga os dados? |
| --- | --- | --- |
| Seu computador (`npm start` / `iniciar.bat`) | SQLite: `data/players.sqlite` | **Não** (a pasta `data` não vai para o GitHub) |
| VPS com Docker (`DOCKER.md`) | SQLite no volume `piper-dados` | **Não** (o volume fica fora da imagem) |
| **Vercel** | **Turso = SQLite na nuvem** | **Não** (o banco fica no Turso, fora da Vercel) |
| Render | SQLite com disco (plano pago) ou Turso | Não, com disco ou Turso |

No SQLite local o servidor também faz **cópia de segurança** sozinho em `data/backups/` toda vez que liga (ou seja, a cada atualização) e uma vez por dia, guardando as 14 mais novas.

A Vercel não tem disco: sem o Turso, os personagens ficariam só na memória e sumiriam a cada atualização. Por isso o passo 2 abaixo é obrigatório.

## Passo a passo na Vercel

1. **Importar:** na Vercel, *Add New… → Project → Import* o repositório `piper-mmorpg` (o `vercel.json` já configura tudo).
2. **Banco SQLite na nuvem (obrigatório):** no projeto → aba **Storage** → **Create Database** → **Turso** (plano grátis) → **Connect** ao projeto `piper-mmorpg`.
   Isso cria sozinho as variáveis `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`.
   *Sem Storage na sua conta? Crie o banco em turso.tech e cadastre as duas variáveis manualmente em Settings → Environment Variables.*
3. **Senha do painel admin:** *Settings → Environment Variables* → `ADMIN_PASSWORD` = uma senha forte.
4. **Não crie** `PIPER_SERVER` (se existir, apague): ela só serve para usar um servidor de fora.
5. **Deployments → ⋯ → Redeploy** (variáveis novas só valem numa publicação nova).
6. Confira `https://SEU-PROJETO.vercel.app/health` → `ok 0`. O log da função deve mostrar `[armazenamento] usando turso`.

Depois disso, cada Push no GitHub publica a atualização e **os personagens continuam lá**.

## Como o jogo se adapta à Vercel

- **Conexão renovada sozinha:** na Vercel cada conexão em tempo real dura no máximo 5 minutos (plano grátis). Perto disso o servidor pede ao celular para reconectar e o jogo volta no mesmo segundo, com o mesmo personagem, sem sair da tela.
- **Salvamento:** cada mudança vai para o Turso em lotes a cada 2 segundos, e o personagem é recarregado do banco ao entrar.

## Limites da Vercel (importante)

- O suporte da Vercel a conexões em tempo real ainda é **beta**.
- Com muitos jogadores ao mesmo tempo a Vercel pode abrir **mais de uma cópia** do servidor: os personagens continuam salvos, mas jogadores em cópias diferentes **não se veem** no mapa nem no chat.
- O plano grátis (Hobby) tem cota mensal de **4 horas de CPU** e **360 GB-hora de memória** (cerca de 180 horas por mês com gente conectada). Acompanhe em *Usage*.

Para muitos jogadores o dia inteiro, a VPS com Docker (`DOCKER.md`) é mais barata e sem esses limites.

## Opcional: usar um servidor de fora (VPS)

Crie `PIPER_SERVER` = `https://jogo.seudominio.com.br` e faça Redeploy: a Vercel serve só as telas e o jogo conecta na sua VPS.
