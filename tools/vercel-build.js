// Usado só na Vercel: grava public/config.js com o endereço do servidor do jogo.
// Configure na Vercel: Settings > Environment Variables > PIPER_SERVER = https://jogo.seudominio.com.br
const fs = require('fs'), path = require('path');
const server = String(process.env.PIPER_SERVER || '').trim().replace(/\/$/, '');
if (!server) {
  console.error('\n[ERRO] Falta a variável PIPER_SERVER na Vercel (endereço https do servidor do jogo, ex.: https://jogo.seudominio.com.br).\n');
  process.exit(1);
}
if (!/^https:\/\//i.test(server)) console.warn('[AVISO] PIPER_SERVER deveria começar com https:// — o site da Vercel é https e o navegador bloqueia conexão sem segurança.');
fs.writeFileSync(path.join(__dirname, '..', 'public', 'config.js'),
  `// Gerado na Vercel por tools/vercel-build.js\nwindow.PIPER_SERVER = ${JSON.stringify(server)};\n`);
console.log('config.js -> servidor do jogo:', server);
