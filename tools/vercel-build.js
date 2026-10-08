// Usado só na Vercel: grava public/config.js com o endereço do servidor do jogo.
// Configure na Vercel: Settings > Environment Variables > PIPER_SERVER = https://jogo.seudominio.com.br
// Sem a variável a publicação NÃO falha: o site sobe e, ao tentar entrar, avisa que falta configurar o servidor.
const fs = require('fs'), path = require('path');
const server = String(process.env.PIPER_SERVER || '').trim().replace(/\/$/, '');
const file = path.join(__dirname, '..', 'public', 'config.js');
if (!server) {
  console.warn('\n[AVISO] A variável PIPER_SERVER não foi definida na Vercel.');
  console.warn('        O site será publicado, mas o jogo só conecta depois que você criar PIPER_SERVER');
  console.warn('        (endereço https do servidor do jogo na VPS) e fizer um novo Deploy.\n');
  fs.writeFileSync(file, '// Gerado na Vercel por tools/vercel-build.js (PIPER_SERVER não definida)\nwindow.PIPER_SERVER = \'\';\nwindow.PIPER_NO_SERVER = true;\n');
  process.exit(0);
}
if (!/^https:\/\//i.test(server)) console.warn('[AVISO] PIPER_SERVER deveria começar com https:// — o site da Vercel é https e o navegador bloqueia conexão sem segurança.');
fs.writeFileSync(file, `// Gerado na Vercel por tools/vercel-build.js\nwindow.PIPER_SERVER = ${JSON.stringify(server)};\n`);
console.log('config.js -> servidor do jogo:', server);
