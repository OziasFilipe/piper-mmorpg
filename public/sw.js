// Service worker do Piper: necessário para instalar o jogo no celular.
// O jogo é 100% online, então não guardamos nada em cache: tudo vem sempre do servidor.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#07060f;color:#ffd86a;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><h2>Sem conexão</h2><p style="color:#ccc">As Aventuras do Piper é um jogo online.<br>Conecte-se à internet e abra de novo.</p></div>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
