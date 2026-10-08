# Jogo na Vercel — As Aventuras do Piper

O jogo roda **inteiro na Vercel**: as telas e imagens (CDN) **e o servidor do jogo** (mundo, monstros, chat, amigos, painel admin), que vira uma função em `api/server.js`, na região **São Paulo (gru1)**.

O mesmo código também roda em qualquer outro lugar, sem mudar nada:

| Onde | Como ligar | Onde salva os personagens |
| --- | --- | --- |
| Seu computador | `npm install` e `npm start` (ou `iniciar.bat`) | arquivo `data/players.sqlite` |
| VPS com Docker | veja `DOCKER.md` | volume do Docker (SQLite) |
| Render | `render.yaml` | SQLite (com disco no plano pago) |
| **Vercel** | este guia | **Redis (Upstash)** |

O servidor escolhe sozinho onde salvar (arquivo `store.js`): Redis quando existe, senão SQLite, senão memória.

## Passo a passo na Vercel

1. **Importar:** na Vercel, *Add New… → Project → Import* o repositório `piper-mmorpg`. Não mexa em nada da configuração (o `vercel.json` já cuida de tudo).
2. **Banco para salvar os personagens (obrigatório):** abra o projeto → aba **Storage** → **Create Database** (ou *Marketplace*) → **Upstash for Redis** → plano grátis → **Connect** ao projeto `piper-mmorpg`.
   Isso cria sozinho as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
   *Sem esse passo o jogo funciona, mas os personagens somem sempre que o servidor reinicia.*
3. **Senha do painel admin:** *Settings → Environment Variables* → `ADMIN_PASSWORD` = uma senha forte.
4. **Não crie** `PIPER_SERVER` (se existir, apague): ela só serve para usar um servidor de fora (ver abaixo).
5. **Deployments → ⋯ → Redeploy** (variáveis novas só valem em uma publicação nova).
6. Abra `https://SEU-PROJETO.vercel.app` no celular. O painel fica em `https://SEU-PROJETO.vercel.app/admin`.

Para conferir: `https://SEU-PROJETO.vercel.app/health` deve mostrar `ok 0`.

## Como o jogo se adapta à Vercel

- **Conexão renovada sozinha:** na Vercel cada conexão em tempo real dura no máximo 5 minutos (plano grátis). Por volta dos 4,5 minutos o servidor pede ao celular para reconectar e o jogo volta no mesmo segundo, com o mesmo personagem, sem sair da tela. A mesma reconexão automática vale quando a internet do celular oscila (em qualquer lugar onde o jogo rode).
- **Salvamento:** cada mudança é gravada no Redis em lotes a cada 2 segundos, e o personagem é recarregado do Redis ao entrar.

## Limites da Vercel (importante)

- O suporte da Vercel a conexões em tempo real ainda é **beta**.
- Com muitos jogadores ao mesmo tempo a Vercel pode abrir **mais de uma cópia** do servidor. Os personagens continuam salvos, mas jogadores em cópias diferentes **não se veem** no mapa nem no chat. Com poucos jogadores isso quase não acontece.
- O plano grátis (Hobby) tem cota mensal: **4 horas de CPU** e **360 GB-hora de memória**. A memória conta o tempo todo em que há alguém conectado; com a função usando 2 GB, isso dá cerca de **180 horas de servidor ligado por mês** (umas 6 horas por dia). Passou disso, a Vercel pausa até o mês seguinte (ou cobra, no plano Pro). Acompanhe em *Usage*.
- O Redis grátis do Upstash também tem limite de comandos por mês (veja no painel do Upstash).

Para muitos jogadores o dia inteiro, a VPS com Docker (`DOCKER.md`) é mais barata e sem esses limites.

## Opcional: usar um servidor de fora (VPS)

Se quiser que a Vercel sirva só as telas e o jogo conecte na sua VPS, crie `PIPER_SERVER` = `https://jogo.seudominio.com.br` e faça Redeploy. Para testar outro servidor sem mexer na Vercel, abra o site com `?server=https://...` no fim do endereço.
