// Vercel: o servidor do jogo inteiro (mundo, WebSocket, painel admin) roda como uma função.
// O jogo no navegador conecta em wss://SEU-SITE.vercel.app/api/server
module.exports = require('../server.js');
