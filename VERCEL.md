# Jogo na Vercel — As Aventuras do Piper

## Como fica

- **Vercel:** publica a parte do jogo que roda no navegador (a pasta `public`: telas, imagens, músicas, botão de instalar e o painel `/admin`). Fica num endereço `https://….vercel.app`, rápido e com HTTPS.
- **VPS (Docker):** continua rodando o **servidor do jogo** (`server.js`), que guarda os personagens e controla o mundo. O jogo aberto pela Vercel conecta nele.

### Por que o servidor não roda na Vercel?

A Vercel aceita conexões em tempo real (WebSocket) só em teste (beta) e com limites que quebram um MMORPG:

- cada conexão cai depois de no máximo **5 minutos** no plano grátis (13 min no Pro);
- os jogadores podem cair em **cópias diferentes** do servidor e não se enxergar no mapa;
- não há disco para salvar os personagens (o banco SQLite some).

Por isso o servidor fica na VPS, e a Vercel serve o jogo para o navegador.

## Passo a passo

1. **Servidor na VPS funcionando com HTTPS** (veja `DOCKER.md`). Exemplo: `https://jogo.seudominio.com.br`.
   Na Vercel o site é `https`, então o servidor também precisa ser `https` (o Caddy do Docker já faz isso).
2. Na Vercel: **Add New… → Project → Import** o repositório do GitHub.
3. Em **Environment Variables**, crie:
   - `PIPER_SERVER` = `https://jogo.seudominio.com.br` (o endereço do servidor da VPS, sem barra no fim).
4. Clique em **Deploy**. O `vercel.json` já diz o que fazer: não instala nada, só grava o endereço do servidor em `public/config.js` e publica a pasta `public`.
5. Abra o endereço da Vercel no celular: o jogo carrega, conecta na VPS e mostra o convite de instalação.

O painel admin também funciona pela Vercel: `https://SEU-PROJETO.vercel.app/admin` (a senha é a mesma do servidor).

## Opcional: só o seu site pode conectar

Na VPS, no arquivo `.env`, acrescente os endereços que podem abrir o jogo e rode `docker compose up -d`:

```
ALLOWED_ORIGINS=https://SEU-PROJETO.vercel.app,https://jogo.seudominio.com.br
```

Sem essa linha, qualquer site pode conectar no servidor (é o padrão).

## Atualizar

Todo **Push** no GitHub publica a nova versão na Vercel sozinho. Se mudou algo no `server.js`, atualize também a VPS (`git pull && docker compose up -d --build`).
