// Usado só na Vercel: grava public/config.js dizendo onde está o servidor do jogo.
//  • Sem PIPER_SERVER (padrão): o servidor roda na própria Vercel, em /api/server.
//  • Com PIPER_SERVER=https://jogo.seudominio.com.br: o jogo usa o servidor da sua VPS.
const fs = require('fs'), path = require('path');
const server = String(process.env.PIPER_SERVER || '').trim().replace(/\/$/, '');
const file = path.join(__dirname, '..', 'public', 'config.js');
if (server) {
  if (!/^https:\/\//i.test(server)) console.warn('[AVISO] PIPER_SERVER deveria começar com https://');
  fs.writeFileSync(file, `// Gerado na Vercel: servidor externo\nwindow.PIPER_SERVER = ${JSON.stringify(server)};\n`);
  console.log('config.js -> servidor externo:', server);
} else {
  fs.writeFileSync(file, `// Gerado na Vercel: o servidor do jogo roda aqui mesmo (api/server.js)\nwindow.PIPER_SERVER = '';\nwindow.PIPER_API = '/api/server';\n`);
  console.log('config.js -> servidor do jogo na própria Vercel (/api/server)');
  const hasRedis = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) || (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!hasRedis) console.warn('[AVISO] Sem Redis (Upstash) conectado: os personagens ficam só na memória e somem quando o servidor reinicia. Veja VERCEL.md.');
  if (!process.env.ADMIN_PASSWORD) console.warn('[AVISO] ADMIN_PASSWORD não definida: o painel /admin fica desligado.');
}
