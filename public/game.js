// Cliente — As Aventuras do Piper (mobile, paisagem, online)
// Toque: o clique dispara ao soltar o dedo. Assim os botões funcionam mesmo com outro dedo
// na tela (ex.: segurando o joystick), quando o navegador do celular cancela o "click" normal.
(function () {
  const down = new Map(); let synth = 0;
  document.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') down.set(e.pointerId, { t: e.target, x: e.clientX, y: e.clientY }); }, true);
  document.addEventListener('pointercancel', e => down.delete(e.pointerId), true);
  document.addEventListener('pointerup', e => {
    const d = down.get(e.pointerId); down.delete(e.pointerId);
    if (!d || e.pointerType === 'mouse' || !d.t.isConnected) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 26) return;          // foi arrasto, não toque
    const el = document.elementFromPoint(e.clientX, e.clientY) || e.target, t = d.t;
    if (!(t === el || t.contains(el) || el.contains(t))) return;
    if (t.closest('input,textarea,select,#joy,#view')) return;              // campos de texto e joystick seguem normais
    synth = performance.now();
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }, true);
  // descarta o click nativo que o navegador ainda mandaria (evita clique duplo)
  document.addEventListener('click', e => { if (e.isTrusted && performance.now() - synth < 700) { e.stopPropagation(); e.preventDefault(); } }, true);
})();
(function () {
  const D = DEFS, T = D.T, TS = 32;
  const $ = id => document.getElementById(id);
  const cv = $('view'), ctx = cv.getContext('2d');
  let ws, myId = 0, tiles = null, MW = 160, MH = 160, CX = 80, CY = 80, inGame = false;
  let RX = 0, REG = D.REGIONS[0];   // região carregada (x inicial no mundo) e seus dados
  let me = {}, inv = [], eq = {}, stats = {}, task = null, myLook = '';
  const ents = new Map(); let fxs = []; const speech = new Map();
  let friends = [], frSig = '', frReqs = [];   // amigos: [nome, online, região, x, y, nível]
  const isFriend = n => friends.some(f => f[0].toLowerCase() === String(n || '').toLowerCase());
  let miniImg = null, shopData = null, shopTab = 'buy', selSpell = 0, selItem = null;
  let K = 1, UI = 1, LWW = 0, LHH = 0, mobileMode = false; // escala mundo->dispositivo, fator de texto, tamanho lógico da tela
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
  const townShops = [
    { dx: -8, dy: -8, kind: 'forge' }, { dx: 5, dy: -8, kind: 'potion' },
    { dx: -8, dy: 5, kind: 'guild' }, { dx: 5, dy: 5, kind: 'travel' }
  ];

  // ======================================================== ABERTURA
  const show = (id, on) => $(id).style.display = on ? (id === 'game' || id === 'title' ? 'block' : 'flex') : 'none';
  let loaded = false, titleShown = false;
  // Personagens e cenário carregam juntos: nada do mapa aparece com arte
  // temporária, mas o renderer ainda possui fallback para conexões instáveis.
  // Só o essencial segura a tela de título; os inimigos carregam em segundo plano.
  // .catch: se algum arquivo falhar (internet ruim), o jogo continua com a arte reserva
  Promise.all([
    CHARS.load(p => $('loadbar').firstElementChild.style.width = Math.round(p * 75) + '%').catch(e => console.warn('chars', e)),
    WORLD.load(p => $('loadbar').firstElementChild.style.width = (75 + Math.round(p * 25)) + '%').catch(e => console.warn('world', e))
  ]).then(() => { loaded = true; onLoaded(); ENEMIES.load(); });
  fetch('health', { cache: 'no-store' }).catch(() => { });   // já acorda o servidor enquanto a abertura passa
  const timers = [];
  timers.push(setTimeout(() => $('sA').classList.add('on'), 300));
  timers.push(setTimeout(() => $('sA').classList.remove('on'), 2700));
  timers.push(setTimeout(() => $('sB').classList.add('on'), 3600));
  timers.push(setTimeout(() => $('sB').classList.remove('on'), 5600));
  timers.push(setTimeout(showTitle, 6500));
  $('splash').onclick = showTitle;
  function showTitle() {
    if (titleShown) return; titleShown = true; timers.forEach(clearTimeout);
    show('splash', false); show('title', true); onLoaded(); playMusic('title');
  }
  function onLoaded() {
    if (!titleShown) return;
    $('loadbar').style.display = loaded ? 'none' : 'block';
    $('tap').style.display = loaded ? 'block' : 'none';
    if (loaded) initCreator();
  }
  $('title').addEventListener('pointerdown', e => {
    if (!loaded || $('title').classList.contains('form')) return;
    goFull();
    $('title').classList.add('form'); $('tap').style.display = 'none'; $('auth').style.display = 'flex';
    const saved = LS.get('piper_name'); if (saved) { $('lname').value = saved; setTab('login'); } else setTab('create');
  });
  function goFull() {
    const el = document.documentElement;
    try { (el.requestFullscreen || el.webkitRequestFullscreen).call(el).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { }); } catch (e) { }
  }
  function setTab(t) {
    $('tLogin').classList.toggle('on', t === 'login'); $('tCreate').classList.toggle('on', t === 'create');
    $('loginForm').style.display = t === 'login' ? 'flex' : 'none'; $('createForm').style.display = t === 'create' ? 'flex' : 'none';
  }
  $('tLogin').onclick = () => setTab('login'); $('tCreate').onclick = () => setTab('create');

  // ======================================================== CRIAÇÃO DE PERSONAGEM
  const app = { skin: 0, hs: 'curto', hc: 'castanho' }; let voc = 'warrior';
  let pDir = 0, pWalk = true, pAuto = true, creatorInit = false;
  const starter = v => v === 'warrior' ? { armor: 'a_cloth', weapon: 'w_dagger', shield: 's_wood' } : { armor: 'a_cloth', weapon: 'm_wand' };
  function initCreator() {
    if (creatorInit) return; creatorInit = true;
    D.SKINS.forEach((c, i) => { const b = document.createElement('button'); b.style.background = c; b.onclick = () => { app.skin = i; refreshCreator(); }; $('swSkin').appendChild(b); });
    for (const k in D.HAIR_STYLES) { const b = document.createElement('button'); b.textContent = D.HAIR_STYLES[k]; b.dataset.k = k; b.onclick = () => { app.hs = k; refreshCreator(); }; $('chStyle').appendChild(b); }
    for (const k in D.HAIR_COLORS) { const b = document.createElement('button'); b.style.background = D.HAIR_COLORS[k]; b.dataset.k = k; b.onclick = () => { app.hc = k; refreshCreator(); }; $('swHair').appendChild(b); }
    document.querySelectorAll('.voc').forEach(el => el.onclick = () => { voc = el.dataset.v; refreshCreator(); });
    $('rotL').onclick = () => { pAuto = false; pDir = [3, 0, 1, 2][pDir]; }; $('rotR').onclick = () => { pAuto = false; pDir = [1, 2, 3, 0][pDir]; };
    $('rotW').onclick = () => { pWalk = !pWalk; $('rotW').textContent = pWalk ? '❚❚' : '▶'; };
    $('rotW').textContent = '❚❚';
    refreshCreator(); requestAnimationFrame(animPreview);
  }
  function refreshCreator() {
    [...$('swSkin').children].forEach((b, i) => b.classList.toggle('on', i === app.skin));
    [...$('chStyle').children].forEach(b => b.classList.toggle('on', b.dataset.k === app.hs));
    [...$('swHair').children].forEach(b => b.classList.toggle('on', b.dataset.k === app.hc));
    document.querySelectorAll('.voc').forEach(el => {
      el.classList.toggle('sel', el.dataset.v === voc);
      const g = el.querySelector('canvas').getContext('2d'); g.clearRect(0, 0, 88, 88);
      const look = CHARS.lookOf(el.dataset.v, starter(el.dataset.v), app);
      g.drawImage(CHARS.portrait(look, 88), 0, 0);
    });
  }
  let pT = 0;
  function animPreview(t) {
    requestAnimationFrame(animPreview);
    if ($('createForm').style.display === 'none' || !titleShown) return;
    if (pAuto && t - pT > 2200) { pT = t; pDir = [1, 2, 3, 0][pDir]; }
    const frame = pWalk ? [1, 0, 2, 0][Math.floor(t / 170) % 4] : 0;
    const c = $('prevCv'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high';
    const look = CHARS.lookOf(voc, starter(voc), app);
    g.drawImage(CHARS.sprite(look, pDir, frame), 0, 0, c.width, c.height);
  }

  // ======================================================== CONEXÃO
  $('loginBtn').onclick = () => connect(false);
  $('createBtn').onclick = () => connect(true);
  $('lpass').onkeydown = e => { if (e.key === 'Enter') connect(false); };
  let connecting = false, errEl = null, connTimer = null;
  // Conexão robusta: primeiro "acorda" o servidor (no plano grátis do Render ele dorme
  // e leva até ~1 min para voltar), depois abre o WebSocket com tempo-limite e novas tentativas.
  // Endereço do servidor do jogo. Vazio = o mesmo site (VPS/Docker/Render).
  // Na Vercel, o config.js aponta para o servidor da VPS (ex.: https://jogo.seudominio.com.br).
  // Também aceita ?server=https://... no endereço (fica salvo no aparelho) — útil para testar outro servidor.
  const qsServer = (() => { try { const v = new URLSearchParams(location.search).get('server'); if (v) LS.set('piper_server', v); return v; } catch (e) { return null; } })();
  const SERVER = String(window.PIPER_SERVER || qsServer || LS.get('piper_server') || '').trim().replace(/\/$/, '');
  const NO_SERVER = !!window.PIPER_NO_SERVER && !SERVER;   // publicado na Vercel sem PIPER_SERVER
  const HTTP_BASE = SERVER ? SERVER + '/' : '';
  const WS_URL = SERVER ? SERVER.replace(/^http/i, 'ws') : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  let lastErr = '';   // motivo da desconexão (ex.: expulso pelo administrador)
  async function wakeServer(onWait) {
    const t0 = Date.now();
    for (let i = 0; Date.now() - t0 < 90000; i++) {
      try { const r = await fetch(HTTP_BASE + 'health?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) return true; } catch (e) { }
      onWait(Math.round((Date.now() - t0) / 1000));
      await new Promise(r => setTimeout(r, 2000));
    }
    return false;
  }
  async function connect(create, attempt = 0) {
    if (connecting && attempt === 0) return; connecting = true;
    errEl = create ? $('authErr2') : $('authErr'); errEl.textContent = 'Conectando...';
    const name = create ? $('cname').value : $('lname').value, pass = create ? $('cpass').value : $('lpass').value;
    LS.set('piper_name', name);
    if (NO_SERVER) { connecting = false; errEl.textContent = 'O servidor do jogo ainda não foi configurado neste site. (Administrador: crie a variável PIPER_SERVER na Vercel e publique de novo.)'; return; }
    const ok = await wakeServer(s => { errEl.textContent = `Acordando o servidor... ${s}s (pode levar até 1 minuto)`; });
    if (!ok) { connecting = false; errEl.textContent = 'Servidor fora do ar. Tente novamente em instantes.'; return; }
    errEl.textContent = 'Conectando...';
    if (ws) try { ws.onclose = null; ws.close(); } catch (e) { }
    const sock = ws = new WebSocket(WS_URL);
    clearTimeout(connTimer);
    connTimer = setTimeout(() => { if (sock.readyState !== 1 && !inGame) { sock.onclose = null; try { sock.close(); } catch (e) { }
      if (attempt < 3) { errEl.textContent = 'Tentando de novo...'; connect(create, attempt + 1); } else { connecting = false; errEl.textContent = 'Não foi possível conectar. Verifique sua internet.'; } } }, 12000);
    sock.onopen = () => { clearTimeout(connTimer); sock.send(JSON.stringify({ t: 'login', create, name, pass, voc, app })); };
    sock.onmessage = ev => onMsg(JSON.parse(ev.data));
    sock.onerror = () => { };
    sock.onclose = () => {
      clearTimeout(connTimer); connecting = false;
      if (inGame) { inGame = false; playMusic('title'); show('game', false); show('title', true); $('authErr').textContent = lastErr || 'Conexão perdida. Entre novamente.'; lastErr = ''; setTab('login'); }
      else if (errEl && /Conectando/.test(errEl.textContent)) errEl.textContent = 'Não foi possível conectar ao servidor.';
    };
  }
  const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

  function onMsg(m) {
    switch (m.t) {
      case 'err': if (!inGame) { errEl.textContent = m.m; connecting = false; } else { addLog(m.m, '#ff8a8a'); lastErr = m.m; } break;
      case 'welcome': {
        myId = m.id; loadRegion(m); inGame = true; connecting = false; ents.clear(); fxs = []; $('feed').innerHTML = ''; $('chatLog').innerHTML = '';
        show('title', false); show('game', true); resize(); break;
      }
      case 'loading': showLoading(m.to); sfx('portal', 500); break;
      case 'region': closeModals(); loadRegion(m); finishLoading(); break;
      case 'travel': openMap('world', m); break;
      case 's': onState(m); break;
      case 'msg': addLog(m.m, m.c); if ($('mPanel').style.display === 'flex' && curTab === 'friends') renderFriends(true); break;
      case 'fr': friends = m.l || []; updFriendBadge(); if ($('mPanel').style.display === 'flex' && curTab === 'friends') renderFriends(); break;
      case 'freq': if (!frReqs.some(r => r.from === m.from)) frReqs.push(m); showFriendReq(); sfx('friend', 500); break;
      case 'chat': addLog(`${m.name} [${m.lv}]: ${m.m}`, '#ffe14a'); speech.set(m.id, { text: m.m, t0: performance.now() }); break;
      case 'shop': shopData = m; shopTab = 'buy'; openShop(); break;
      case 'dialog': openDialog(m.name, m.text); break;
      case 'dead': $('deathMsg').style.display = 'flex'; setTimeout(() => $('deathMsg').style.display = 'none', 2500); break;
    }
  }

  // ======================================================== ESTADO
  // O servidor anda em "ticks" de 100 ms: um passo de 258 ms na prática acontece a cada 300 ms.
  // Animar exatamente nesse ritmo deixa o movimento contínuo, sem parar e arrancar a cada quadrado.
  const SRV_TICK = 100, cadence = ms => Math.ceil(ms / SRV_TICK) * SRV_TICK;
  function moveDur(e) {
    // +40 ms de folga: se o próximo passo chegar um pouco atrasado pela internet, ele ainda está andando (não para).
    if (e.kind === 'p') return cadence(Math.max(150, 260 - (e.lv || 1) * 2)) + 40;
    if (e.kind === 'm' && D.MON[e.look]) return Math.min(450, D.MON[e.look].spd * 0.6);
    return 250;
  }
  function onState(m) {
    const now = performance.now();
    if (m.me.inv) { inv = m.me.inv; eq = m.me.eq; stats = m.me.st; task = m.me.task; }
    Object.assign(me, m.me);
    // música: cidade, campo ou batalha (fica em batalha até 5 s depois do último golpe)
    if (me.hp < lastHp) lastCombat = now; lastHp = me.hp;
    if (me.tg) { const t = ents.get(me.tg); if (t && t.kind === 'm') lastCombat = now; }
    if (!loadingOn) playMusic(me.town ? 'town' : now - lastCombat < 5000 ? 'battle' : 'field');
    const seen = new Set();
    for (const a of m.e) {
      const [id, kind, x, y, dir, look, name, hp, flags, lv, attackMs] = a; seen.add(id);
      let e = ents.get(id);
      if (!e) { e = { id, kind, x, y, fx: x, fy: y, t0: 0, dur: 1, walk: 0, faceLeft: true }; ents.set(id, e); }
      else if (e.x !== x || e.y !== y) {
        if (Math.abs(e.x - x) + Math.abs(e.y - y) > 2) { e.fx = x; e.fy = y; e.t0 = 0; }
        else { const p = rpos(e, now); e.fx = p.x; e.fy = p.y; e.t0 = now; e.walk++; }
        e.x = x; e.y = y;
      }
      Object.assign(e, { dir, hp, flags, lv }); if (look) e.look = look; if (name) e.name = name;   // 0 = não mudou
      if (attackMs) e.attackUntil = now + attackMs;
      e.dur = moveDur(e);
      if (dir === 1) e.faceLeft = true; else if (dir === 3) e.faceLeft = false;
      if (id === myId && e.look && e.look !== myLook) {
        myLook = e.look; const pc = $('portrait'); const g = pc.getContext('2d'); g.clearRect(0, 0, pc.width, pc.height);
        drawPortrait(g, e.look, pc.width);
      }
    }
    for (const id of ents.keys()) if (!seen.has(id)) ents.delete(id);
    for (const f of m.fx) {
      f.t0 = now; fxs.push(f); fxSound(f);
      if (f.k === 'hit' && f.id) { const target = ents.get(f.id); if (target) target.hitUntil = now + 170; }
    }
    if (m.me.inv) renderPanels();
    updateHud();
  }
  // Retrato: acha onde o personagem está desenhado na folha e enquadra o rosto/busto
  function drawPortrait(g, look, size) {
    const spr = CHARS.sprite(look, 0, 0); if (!spr) return;
    let x0 = spr.width, y0 = spr.height, x1 = 0, y1 = 0;
    try {
      const d = spr.getContext('2d').getImageData(0, 0, spr.width, spr.height).data;
      for (let y = 0; y < spr.height; y++) for (let x = 0; x < spr.width; x++) if (d[(y * spr.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    } catch (e) { }
    if (x1 <= x0) { x0 = 0; y0 = 0; x1 = spr.width; y1 = spr.height; }
    const side = Math.max(x1 - x0, (y1 - y0) * 0.62), cx = (x0 + x1) / 2;
    g.imageSmoothingQuality = 'high';
    g.drawImage(spr, cx - side / 2, y0 - side * 0.06, side, side, size * 0.06, size * 0.08, size * 0.88, size * 0.88);
  }
  function rpos(e, now) {
    const raw = e.t0 ? Math.min(1, (now - e.t0) / e.dur) : 1;
    // Velocidade constante (linear): andando sem parar, um quadrado emenda no outro sem "tranco".
    const k = raw;
    return { x: e.fx + (e.x - e.fx) * k, y: e.fy + (e.y - e.fy) * k, moving: raw < 1, progress: raw };
  }

  // ======================================================== MAPA
  const tileAt = (x, y) => { x -= RX; return (x < 0 || y < 0 || x >= MW || y >= MH) ? T.WATER : tiles[y * MW + x]; };
  const inCave = (x, y) => REG.biome === 'green' && x > CX + 28 && y > CY + 28;
  // Carrega SÓ a região onde o jogador está (as outras não pesam no celular)
  function loadRegion(m) {
    MW = m.W; MH = m.H; RX = m.ox || 0; CX = RX + (MW >> 1); CY = MH >> 1; REG = D.REGIONS[m.r] || D.REGIONS[0];
    const bin = atob(m.tiles); tiles = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) tiles[i] = bin.charCodeAt(i);
    buildMini(); ents.clear(); fxs = []; if (SPR.resetGround) SPR.resetGround();
    const b = $('regionBanner'); if (b && !loadingOn) { b.innerHTML = `<small>${REG.town}</small>${REG.name}`; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
  }
  const MINI_COL = ['#4b8d3b', '#2a5f2a', '#2b5fae', '#d8c07c', '#8f877a', '#555555', '#3f3228', '#9b7b4f', '#8a8178', '#5c9f46', '#8b5e34', '#1a1410', '#e8eef5', '#9aa3ad'];
  // ---- Música e efeitos sonoros (music.js)
  let lastHp = 1e9, lastCombat = -1e9; const sfxAt = {};
  function playMusic(name) { if (window.MUSIC) MUSIC.play(name, REG ? REG.id : 0); }
  function sfx(name, gap) { if (!window.MUSIC) return; const t = performance.now(); if (t - (sfxAt[name] || 0) < (gap || 70)) return; sfxAt[name] = t; MUSIC.sfx(name); }
  function fxSound(f) {
    const meE = ents.get(myId); if (!meE || Math.abs(f.x - meE.x) > 9 || Math.abs(f.y - meE.y) > 7) return;   // só o que está na tela
    if (f.k === 'hit') sfx('hit', 90); else if (f.k === 'swing') sfx('swing', 90); else if (f.k === 'proj') sfx('spell', 120);
    else if (f.k === 'heal') sfx('heal', 300); else if (f.k === 'level' && f.x === meE.x && f.y === meE.y && !loadingOn) sfx('level', 1500);
  }
  function updSoundBtns() { const on = !(window.MUSIC && MUSIC.muted); document.querySelectorAll('.sndBtn').forEach(b => b.classList.toggle('off', !on)); }
  document.querySelectorAll('.sndBtn').forEach(b => {
    b.addEventListener('pointerdown', e => e.stopPropagation());
    b.onclick = e => { e.stopPropagation(); if (window.MUSIC) { MUSIC.unlock(); MUSIC.setMuted(!MUSIC.muted); } updSoundBtns(); };
  });
  updSoundBtns();
  // ---- Tela de carregamento ao trocar de terra
  let loadingOn = false, loadT0 = 0;
  const TIPS = ['Dica: o portal do leste leva à próxima terra; o do oeste volta para a anterior.',
    'Dica: toque no botão de amigos para ver quem está online e onde.', 'Dica: poções de vida e mana ficam nos botões vermelho e azul.',
    'Dica: dentro da cidade os monstros não atacam e a vida volta mais rápido.', 'Dica: cada nível dá pontos de atributo. Use-os em Personagem.'];
  function showLoading(to) {
    const r = D.REGIONS[to] || D.REGIONS[0], L = $('loading');
    loadingOn = true; loadT0 = performance.now(); setWalk(-1); closeModals();
    $('ldName').textContent = r.name; $('ldTown').textContent = `${r.town} · Nível recomendado ${r.lvl}+`;
    $('ldTip').textContent = TIPS[Math.random() * TIPS.length | 0];
    $('ldBar').style.transition = 'none'; $('ldBar').style.width = '0'; L.style.display = 'flex'; void L.offsetWidth;
    L.classList.add('on'); $('ldBar').style.transition = ''; $('ldBar').style.width = '65%';
  }
  function finishLoading() {
    if (!loadingOn) return;
    $('ldBar').style.width = '100%';
    // espera o mapa novo ser desenhado (2 quadros) e um tempo mínimo para não "piscar"
    const wait = Math.max(0, 1300 - (performance.now() - loadT0));
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
      const L = $('loading'); L.classList.remove('on'); loadingOn = false;
      setTimeout(() => { if (!loadingOn) L.style.display = 'none'; }, 380);
      const b = $('regionBanner'); if (b) { b.innerHTML = `<small>${REG.town}</small>${REG.name}`; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
    }, wait)));
  }
  function buildMini() {
    miniImg = SPR.mk(MW, MH); const g = miniImg.getContext('2d'); const id = g.createImageData(MW, MH);
    for (let i = 0; i < MW * MH; i++) { const c = parseInt(MINI_COL[tiles[i]].slice(1), 16); id.data.set([c >> 16, (c >> 8) & 255, c & 255, 255], i * 4); }
    g.putImageData(id, 0, 0);
  }

  // ======================================================== RENDER
  const FXC = { fire: '#ff8a2a', ice: '#8ef0ff', arcane: '#d08aff', energy: '#fff35a' };
  // A câmera acompanha a posição interpolada em vez de pular a cada pacote.
  // Teleportes continuam instantâneos, mas os passos ganham uma inércia leve.
  let cam = { ox: 0, oy: 0, x: null, y: null, t: 0 };
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = innerWidth, h = innerHeight;
    // Não usamos apenas a largura: um notebook estreito continua com controles
    // de teclado e arte no tamanho padrão. O aumento é exclusivo de toque real.
    mobileMode = document.documentElement.classList.contains('touch');   // mesma regra do index.html (celular x computador)
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const Z = Math.max(h / 11, w / 22);       // px CSS por tile
    K = Z * dpr / TS; UI = TS / Z;            // UI: px de mundo por px CSS
    LWW = cv.width / K; LHH = cv.height / K;
  }
  window.addEventListener('resize', resize);

  function render() {
    requestAnimationFrame(render);
    if (!inGame || !tiles) return;
    const now = performance.now();
    const meE = ents.get(myId); if (!meE) return;
    const mp = rpos(meE, now);
    // Câmera presa ao personagem: como ele anda em velocidade constante, a tela desliza junto,
    // sem atraso nem "puxão". Só uma suavização mínima para absorver pequenas correções da rede.
    const targetX = mp.x + 0.5 - LWW / TS / 2, targetY = mp.y + 0.2 - LHH / TS / 2;
    if (cam.x == null || Math.abs(targetX - cam.x) > 2 || Math.abs(targetY - cam.y) > 2) { cam.x = targetX; cam.y = targetY; }
    else {
      const dt = Math.min(50, Math.max(1, now - (cam.t || now))), follow = 1 - Math.exp(-dt / 18);
      cam.x += (targetX - cam.x) * follow; cam.y += (targetY - cam.y) * follow;
    }
    cam.t = now;
    const camX = cam.x, camY = cam.y;
    const ox = Math.round(-camX * TS * K) / K, oy = Math.round(-camY * TS * K) / K; cam.ox = ox; cam.oy = oy;   // pixel inteiro do aparelho: sem tremido
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(K, 0, 0, K, 0, 0); ctx.imageSmoothingEnabled = false;
    const x0 = Math.floor(camX) - 1, y0 = Math.floor(camY) - 1, x1 = x0 + Math.ceil(LWW / TS) + 2, y1 = y0 + Math.ceil(LHH / TS) + 3;
    const wf = Math.floor(now / 350) % 7;
    SPR.drawGround(ctx, x0, y0, x1, y1, ox, oy, now, tileAt, K);
    for (const pt of D.portalsOf(REG.id)) { const wx = RX + pt.x; if (wx >= x0 - 2 && wx <= x1 + 2 && pt.y >= y0 - 3 && pt.y <= y1 + 3) drawPortal(pt, wx, now, ox, oy); }
    for (const f of fxs) {
      const age = now - f.t0, sx = f.x * TS + ox, sy = f.y * TS + oy;
      if (f.k === 'blood' && age < 1500) { ctx.globalAlpha = 1 - age / 1500; ctx.fillStyle = '#9a0a0a'; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 24, 7, 3, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      if (f.k === 'corpse' && age < 12000) drawCorpse(f, sx, sy, age);
    }
    // alvo (no chão)
    if (me.tg && ents.has(me.tg)) {
      const e = ents.get(me.tg), p = rpos(e, now), cx = p.x * TS + ox + 16, cy = p.y * TS + oy + 27;
      ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 150);
      ctx.beginPath(); ctx.ellipse(cx, cy, 14, 6, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
    const rows = new Map();
    for (const e of ents.values()) { const p = rpos(e, now); const ry = Math.round(p.y); if (!rows.has(ry)) rows.set(ry, []); rows.get(ry).push([e, p]); }
    for (let y = y0; y <= y1 + 1; y++) {
      // As fachadas entram na mesma ordenação vertical de árvores e entidades:
      // o herói não aparece por cima de um prédio quando está atrás dele.
      for (const shop of townShops) if (y === CY + shop.dy + 2) {
        const img = SPR.townShop(shop.kind);
        ctx.drawImage(img, (CX + shop.dx) * TS + ox, (CY + shop.dy) * TS + oy - 16);
      }
      if (y === CY + 1) {
        const fountain = SPR.townFountain();
        ctx.drawImage(fountain, CX * TS + ox, CY * TS + oy - 8);
      }
      for (let x = x0; x <= x1; x++) {
        const t = tileAt(x, y);
        if (t === T.TREE) {
          const pine = WORLD.pine && SPR.hash(x, y, 41) > .68;
          if (WORLD.oak || pine) {
            const variant = SPR.hash(x, y, 3);
            const w = pine ? 43 + (variant * 5 | 0) : 50 + (variant * 7 | 0);
            const h = pine ? 72 + (variant * 8 | 0) : 65 + (variant * 8 | 0);
            ctx.drawImage(pine ? WORLD.pine : WORLD.oak, x * TS + ox + 16 - w / 2, y * TS + oy + TS - h, w, h);
          } else ctx.drawImage(SPR.treeObj(SPR.hash(x, y, 3) * 6 | 0), x * TS + ox - 8, y * TS + oy - 26);
        }
        else if (t === T.ROCK || t === T.SNOWROCK) {
          const mossy = t === T.ROCK && WORLD.mossRock && SPR.hash(x, y, 59) > .52;
          if (WORLD.rock || mossy) {
            const size = mossy ? 48 : 40;
            ctx.drawImage(mossy ? WORLD.mossRock : WORLD.rock, x * TS + ox + 16 - size / 2, y * TS + oy + TS - size, size, size);
          }
          else ctx.drawImage(SPR.rockObj(0), x * TS + ox, y * TS + oy);
        }
      }
      const list = rows.get(y); if (list) { list.sort((a, b) => a[1].x - b[1].x); for (const [e, p] of list) drawEnt(e, p, now, ox, oy); }
    }
    if (inCave(meE.x, meE.y)) {
      const cx = mp.x * TS + ox + 16, cy = mp.y * TS + oy + 16;
      const gr = ctx.createRadialGradient(cx, cy, 60, cx, cy, 240); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.9)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, LWW, LHH);
    }
    // nomes e barras
    ctx.textAlign = 'center';
    for (const e of ents.values()) {
      const p = rpos(e, now), sx = p.x * TS + ox + 16, isC = e.kind === 'p' || (typeof e.look === 'string' && e.look[0] === 'c');
      const top = isC ? (mobileMode ? 34 : 24) : (e.look === 'dragon' || e.look === 'troll' || e.look === 'bear' ? (mobileMode ? 22 : 14) : (mobileMode ? 12 : 4));
      const sy = p.y * TS + oy - top;
      const pct = e.hp / 100, hc = pct > 0.6 ? '#3fd35a' : pct > 0.3 ? '#f2c14e' : '#ef4444';
      const nc = e.kind === 'n' ? '#9fd8ff' : e.kind === 'p' ? ((e.flags & 1) ? '#ff6b6b' : e.id !== myId && isFriend(e.name) ? '#5cf08a' : '#ffffff') : hc;
      ctx.font = `700 ${11 * UI}px Poppins, sans-serif`;
      txt(e.name + (e.kind === 'p' && (e.flags & 1) ? ' ☠' : ''), sx, sy - 5 * UI, nc);
      if (e.kind !== 'n') { const bw = 26, bh = Math.max(2, 3.5 * UI); ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(sx - bw / 2 - 0.5, sy - 1, bw + 1, bh + 1); ctx.fillStyle = hc; ctx.fillRect(sx - bw / 2, sy - 0.5, bw * pct, bh); }
      const sp = speech.get(e.id);
      if (sp) { const age = now - sp.t0; if (age > 4500) speech.delete(e.id); else { ctx.font = `600 ${11 * UI}px Poppins, sans-serif`; wrapTxt(sp.text, sx, sy - 20 * UI, '#ffe14a'); } }
    }
    fxs = fxs.filter(f => drawFx(f, now, ox, oy));
    drawMini(meE);
  }
  // Portal mágico: anel de pedra com redemoinho animado e faíscas subindo.
  function drawPortal(pt, wx, now, ox, oy) {
    const cx = (wx + 0.5) * TS + ox, cy = (pt.y + 1) * TS + oy - 6, rx = TS * 0.78, ry = TS * 1.22, t = now / 1000;
    const dest = D.REGIONS[pt.to], locked = me.lv < dest.lvl;
    const c1 = locked ? '#7a7a8a' : pt.back ? '#ffb347' : '#b36bff', c2 = locked ? '#3a3a48' : pt.back ? '#ff6a1a' : '#4fd1ff';
    ctx.save();
    // brilho no chão
    const glow = ctx.createRadialGradient(cx, cy + ry * 0.85, 2, cx, cy + ry * 0.85, rx * 1.8);
    glow.addColorStop(0, c1 + '88'); glow.addColorStop(1, c1 + '00');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.85, rx * 1.8, rx * 0.7, 0, 0, 7); ctx.fill();
    // arco de pedra
    ctx.lineWidth = 7; ctx.strokeStyle = '#3d3a44'; ctx.beginPath(); ctx.ellipse(cx, cy, rx + 4, ry + 4, 0, 0, 7); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#8b8698'; ctx.beginPath(); ctx.ellipse(cx, cy, rx + 4, ry + 4, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.fillStyle = i % 2 ? '#5b5766' : '#6c6878'; ctx.fillRect(cx + Math.cos(a) * (rx + 4) - 2.5, cy + Math.sin(a) * (ry + 4) - 2.5, 5, 5); }
    // redemoinho
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.clip();
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, ry); g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, c2); g.addColorStop(0.75, c1); g.addColorStop(1, '#14082a');
    ctx.fillStyle = g; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2.2;
    for (let k = 0; k < 5; k++) {
      const a0 = t * (locked ? 0.6 : 2.4) + k * 1.2566; ctx.strokeStyle = `rgba(255,255,255,${0.18 + k * 0.05})`;
      ctx.beginPath(); for (let i = 0; i <= 18; i++) { const a = a0 + i * 0.22, rr = (1 - i / 18) * 0.95; const x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    }
    ctx.restore();
    // faíscas subindo
    if (!locked) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 7; i++) { const ph = (t * 0.7 + i / 7) % 1, x = cx + Math.sin(i * 2.1 + t * 2) * rx * 0.9, y = cy + ry - ph * ry * 2.4; ctx.globalAlpha = 1 - ph; ctx.fillStyle = i % 2 ? c1 : '#fff'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); } ctx.restore(); }
    // placa com o destino
    ctx.font = `700 ${10.5 * UI}px Poppins, sans-serif`; ctx.textAlign = 'center';
    txt((pt.back ? '◂ ' : '') + dest.name + (pt.back ? '' : ' ▸'), cx, cy - ry - 12, locked ? '#ff9a9a' : '#f1dcff');
    ctx.font = `600 ${9 * UI}px Poppins, sans-serif`;
    txt(locked ? `Nível ${dest.lvl} necessário` : 'Portal', cx, cy - ry - 1, locked ? '#ffb3b3' : '#cfe9ff');
  }
  function txt(s, x, y, c) { ctx.lineWidth = 3 * UI; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); ctx.fillStyle = c; ctx.fillText(s, x, y); }
  function wrapTxt(s, x, y, c) {
    const words = s.split(' '), lines = []; let cur = '';
    for (const w of words) { if ((cur + ' ' + w).length > 26) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    lines.push(cur); lines.forEach((l, i) => txt(l, x, y - (lines.length - 1 - i) * 13 * UI, c));
  }
  function drawEnt(e, p, now, ox, oy) {
    const sx = p.x * TS + ox, sy = p.y * TS + oy;
    const attackLeft = Math.max(0, (e.attackUntil || 0) - now);
    let frame = 0;
    const attackPhase = attackLeft ? 1 - Math.min(1, attackLeft / 300) : 0;
    if (attackLeft) frame = attackPhase < .26 ? 5 : attackPhase < .62 ? 6 : 7;
    else if (p.moving) frame = 1 + (Math.floor(now / (e.kind === 'm' ? 72 : 76) + e.id * 1.7) % 4);
    else if (e.kind === 'm' && Math.floor(now / 440 + e.id) % 5 === 0) frame = 1;
    const attackStep = attackLeft ? Math.sin((1 - attackLeft / 300) * Math.PI) * (e.kind === 'p' ? 5.8 : 4.5) : 0;
    const dir = [[0, 1], [-1, 0], [0, -1], [1, 0]][e.dir] || [0, 0];
    const isPlayer = e.kind === 'p';
    const characterLook = typeof e.look === 'string' && e.look[0] === 'c'
      ? e.look
      : ['c', isPlayer && e.id === myId && me.voc === 'wizard' ? 'wizard' : 'warrior', '', '', '', '', '0', 'curto', 'castanho', ''].join('|');
    if (isPlayer || (typeof e.look === 'string' && e.look[0] === 'c')) {
      const scale = mobileMode ? 1.2 : 1;
      const stepWave = p.moving ? Math.sin(now / 76 + e.id * 1.7) : 0;
      const shadowW = p.moving ? 9 + Math.abs(stepWave) * 2.2 : 10;
      ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 28.7, shadowW * scale, (3.2 + Math.abs(stepWave) * .6) * scale, 0, 0, 7); ctx.fill();
      if (e.flags & 2) { ctx.fillStyle = 'rgba(255,80,20,.28)'; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 22, 17, 12, 0, 0, 7); ctx.fill(); }
      const img = CHARS.sprite(characterLook, e.dir, frame);
      const sway = p.moving ? stepWave * .55 : Math.sin(now / 650 + e.id * 1.7) * .35;
      const hurt = (e.hitUntil || 0) > now;
      ctx.save(); ctx.translate(dir[0] * attackStep, dir[1] * attackStep * .45);
      ctx.imageSmoothingEnabled = false;
      if (hurt) ctx.globalAlpha = 0.6;
      // As folhas novas têm os pés na linha 185/192. Mantemos essa linha
      // exatamente no chão do tile, inclusive nas poses de corrida/ataque.
      const squash = p.moving ? Math.abs(stepWave) * .018 : 0;
      const charW = 42 * scale * (1 + squash), charH = 63 * scale * (1 - squash);
      const groundY = sy + 29, footRatio = 185 / 192;
      ctx.drawImage(img, sx + 16 - charW / 2 + sway, groundY - charH * footRatio, charW, charH);
      ctx.restore(); ctx.imageSmoothingEnabled = false;
      return;
    }
    const enemySprite = e.kind === 'm' && ENEMIES.sprite(e.look, frame, e.dir === 1);
    const img = enemySprite || SPR.entity(e.kind, e.look, e.dir, frame, e.faceLeft);
    const elite = e.look === 'bear' || e.look === 'troll' || e.look === 'dragon';
    const scale = mobileMode ? 1.15 : 1;
    // O coelho tem silhueta leve e orelhas altas; uma caixa um pouco maior
    // preserva sua leitura no chão sem transformá-lo em um inimigo grande.
    const enemySize = e.look === 'dragon' ? 70 : elite ? 51 : e.look === 'rabbit' ? 50 : 43;
    const iw = (enemySprite ? enemySize : img.width) * scale;
    const ih = (enemySprite ? enemySize : img.height) * scale;
    const idleBob = enemySprite && !p.moving ? Math.sin(now / 300 + e.id) * .8 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 29, iw > 40 ? 16 : 10, 4, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(dir[0] * attackStep, dir[1] * attackStep * .45);
    if ((e.hitUntil || 0) > now) ctx.globalAlpha = 0.6;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(sx + (TS - iw) / 2), Math.round(sy + TS - ih - 1 + idleBob), iw, ih);
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
  }
  function drawCorpse(f, sx, sy, age) {
    ctx.globalAlpha = age > 10000 ? 1 - (age - 10000) / 2000 : 1;
    ctx.fillStyle = '#6a0808'; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 24, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (f.look !== 'player') {
      // Mantém o mesmo monstro desenhado no mapa também após a derrota;
      // sem isso o corpo reaparecia como o antigo sprite procedural.
      const enemy = ENEMIES.sprite(f.look, 0);
      const img = enemy || SPR.entity('m', f.look, 0, 0, true);
      const size = enemy ? (f.look === 'dragon' ? 54 : (f.look === 'bear' || f.look === 'troll') ? 42 : 34) : img.width;
      ctx.save(); ctx.translate(sx + 16, sy + 20); ctx.rotate(Math.PI / 2); ctx.globalAlpha = 0.6;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -size / 2, -size / 2 - 2, size * 0.9, size * 0.9); ctx.restore();
      ctx.imageSmoothingEnabled = false;
    } else { ctx.fillStyle = '#ddd'; ctx.fillRect(sx + 10, sy + 20, 12, 3); ctx.fillRect(sx + 13, sy + 16, 6, 6); }
    ctx.globalAlpha = 1;
  }
  function drawFx(f, now, ox, oy) {
    const age = now - f.t0, sx = f.x * TS + ox, sy = f.y * TS + oy;
    switch (f.k) {
      case 'dmg': { if (age > 1100) return false; const k = age / 1100; ctx.globalAlpha = 1 - k * k; ctx.font = `800 ${(f.xp ? 11 : 14) * UI}px Poppins, sans-serif`; txt(String(f.v), sx + 16 + (f.xp ? 10 : 0), sy - 2 - k * 26 - (f.xp ? 10 : 0), f.c); ctx.globalAlpha = 1; return true; }
      case 'swing': {
        if (age > 260) return false;
        const k = age / 260, dx = (f.tx ?? f.x) - f.x, dy = (f.ty ?? f.y) - f.y, ang = Math.atan2(dy, dx);
        ctx.save(); ctx.translate(sx + 16, sy + 15); ctx.rotate(ang - 1.15 + k * 2.3);
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.c || '#fff'; ctx.shadowColor = f.c || '#fff'; ctx.shadowBlur = 10 * K;
        ctx.lineWidth = 2.6 * K; ctx.beginPath(); ctx.arc(0, 0, 12 + k * 6, -.62, .98); ctx.stroke();
        ctx.globalAlpha = (1 - k) * .45; ctx.lineWidth = 1.1 * K; ctx.beginPath(); ctx.arc(0, 0, 17 + k * 7, -.48, .75); ctx.stroke();
        ctx.restore(); return true;
      }
      case 'hit': {
        if (age > 280) return false;
        const k = age / 280, c = f.c || '#fff'; ctx.save(); ctx.translate(sx + 16, sy + 15); ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 9 * K; ctx.lineWidth = 1.7 * K;
        for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + .3; const r = 4 + k * 13; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4)); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
        ctx.restore(); return true;
      }
      case 'puff': { if (age > 400) return false; ctx.strokeStyle = 'rgba(140,190,255,' + (1 - age / 400) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 4 + age / 30, 0, 7); ctx.stroke(); return true; }
      case 'slash': { if (age > 220) return false; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 11, -2.4 + age / 120, -0.6 + age / 120); ctx.stroke(); return true; }
      case 'proj': {
        const dur = 260; if (age > dur) return false; const k = age / dur, px = (f.x + (f.tx - f.x) * k) * TS + ox + 16, py = (f.y + (f.ty - f.y) * k) * TS + oy + 10;
        const c = FXC[f.fx] || '#fff', prev = Math.max(0, k - .24), lx = (f.x + (f.tx - f.x) * prev) * TS + ox + 16, ly = (f.y + (f.ty - f.y) * prev) * TS + oy + 10;
        ctx.strokeStyle = c; ctx.globalAlpha = .55 * (1 - k); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(px, py); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 13 * K; ctx.beginPath(); ctx.arc(px, py, f.fx === 'arcane' ? 3.5 : 5.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 1.5, 0, 7); ctx.fill(); return true;
      }
      case 'area': {
        if (age > 550) return false; const a = 1 - age / 550;
        if (f.fx === 'strike') { ctx.strokeStyle = `rgba(255,60,60,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx + 6, sy + 6); ctx.lineTo(sx + 26, sy + 26); ctx.moveTo(sx + 26, sy + 6); ctx.lineTo(sx + 6, sy + 26); ctx.stroke(); return true; }
        if (f.fx === 'berserk') { ctx.strokeStyle = `rgba(255,90,20,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 8 + age / 15, 0, 7); ctx.stroke(); return true; }
        const col = f.fx === 'energy' ? [200, 120, 255] : f.fx === 'whirl' ? [220, 220, 230] : [255, 140, 40];
        const g = ctx.createRadialGradient(sx + 16, sy + 16, 2, sx + 16, sy + 16, 20); g.addColorStop(0, `rgba(${col},${a * 0.7})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(sx - 4, sy - 4, TS + 8, TS + 8);
        ctx.fillStyle = `rgba(255,255,220,${a})`;
        for (let i = 0; i < 4; i++) ctx.fillRect(sx + SPR.hash(i, f.x, f.y + (age / 90 | 0)) * 28, sy + SPR.hash(f.x, i, f.y + (age / 90 | 0)) * 28, 2, 2);
        return true;
      }
      case 'heal': { if (age > 800) return false; ctx.fillStyle = `rgba(140,220,255,${1 - age / 800})`; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(sx + 4 + SPR.hash(i, 3, f.x) * 24, sy + 22 - age / 25 - SPR.hash(i, 5, f.y) * 14, 1.6, 0, 7); ctx.fill(); } return true; }
      case 'level': { if (age > 1800) return false; const a = 1 - age / 1800; ctx.fillStyle = `rgba(255,220,60,${a})`; for (let i = 0; i < 14; i++) { const ang = i / 14 * 6.28 + age / 300, rr = 10 + age / 40; ctx.beginPath(); ctx.arc(sx + 16 + Math.cos(ang) * rr, sy + 16 + Math.sin(ang) * rr * 0.6, 1.8, 0, 7); ctx.fill(); } ctx.globalAlpha = a; ctx.font = `800 ${16 * UI}px Lora, serif`; txt('LEVEL UP!', sx + 16, sy - 24 - age / 60, '#ffd84a'); ctx.globalAlpha = 1; return true; }
      case 'blood': return age < 1500;
      case 'corpse': return age < 12000;
    }
    return false;
  }
  function drawMini(meE) {
    const c = $('mini'), g = c.getContext('2d'), S = 4, R = 32;
    g.imageSmoothingEnabled = false; g.fillStyle = '#000'; g.fillRect(0, 0, 260, 260);
    g.drawImage(miniImg, meE.x - RX - R, meE.y - R, R * 2, R * 2, 2, 2, 256, 256);
    for (const e of ents.values()) { if (e.id === myId) continue; g.fillStyle = e.kind === 'm' ? '#ff4d4d' : e.kind === 'n' ? '#4dd2ff' : '#fff'; g.fillRect(2 + (e.x - meE.x + R) * S, 2 + (e.y - meE.y + R) * S, 5, 5); }
    for (const pt of D.portalsOf(REG.id)) { const dx = (pt.x - (meE.x - RX)) * S, dy = (pt.y + 0.5 - meE.y) * S; if (Math.abs(dx) < 126 && Math.abs(dy) < 126) { g.fillStyle = '#000'; g.beginPath(); g.ellipse(130 + dx, 130 + dy, 7, 10, 0, 0, 7); g.fill(); g.fillStyle = pt.back ? '#ffb347' : '#c084ff'; g.beginPath(); g.ellipse(130 + dx, 130 + dy, 5, 8, 0, 0, 7); g.fill(); } }
    // amigos na mesma região: ponto verde (se estiver longe, fica na borda apontando a direção)
    for (const f of friends) {
      if (!f[1] || f[2] !== REG.id || f[0] === me.name) continue;
      let dx = (f[3] - (meE.x - RX)) * S, dy = (f[4] - meE.y) * S; const d = Math.hypot(dx, dy), lim = 112;
      const far = d > lim; if (far) { dx = dx / d * lim; dy = dy / d * lim; }
      greenDot(g, 130 + dx, 130 + dy, far ? 7 : 9);
    }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(130, 130, 5, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke();
  }
  function greenDot(g, x, y, r) {
    g.beginPath(); g.arc(x, y, r + 2.5, 0, 7); g.fillStyle = 'rgba(0,0,0,.75)'; g.fill();
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = '#35e06b'; g.fill();
    g.beginPath(); g.arc(x - r * .3, y - r * .3, r * .38, 0, 7); g.fillStyle = 'rgba(255,255,255,.75)'; g.fill();
  }
  requestAnimationFrame(render);

  // ======================================================== HUD
  function addLog(s, c) {
    const d = document.createElement('div'); d.textContent = s; d.style.color = c || '#fff';
    const f = $('feed'); f.appendChild(d); while (f.children.length > 6) f.removeChild(f.firstChild);
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 1000); }, 7000);
    const l = $('chatLog'), d2 = d.cloneNode(true); l.appendChild(d2); while (l.children.length > 200) l.removeChild(l.firstChild); l.scrollTop = l.scrollHeight;
  }
  function bar(id, v, max, label) {
    const b = $(id), w = Math.max(0, Math.min(100, 100 * v / max)) + '%';
    b.querySelector('i').style.width = w; const gh = b.querySelector('.ghost'); if (gh) gh.style.width = w;   // a faixa clara "segue" o dano
    const s = b.querySelector('span'); if (s && label !== undefined && s.textContent !== label) s.textContent = label;
  }
  const spells = () => D.SPELLS[me.voc] || [];
  let spellsBuilt = '';
  function updateHud() {
    bar('hpB', me.hp, me.mhp, `${me.hp} / ${me.mhp}`);
    bar('mpB', me.mp, me.mmp, `${me.mp} / ${me.mmp}`);
    bar('xpB', me.xp - me.xpa, me.xpb - me.xpa);
    $('hudTL').classList.toggle('low', me.hp / me.mhp < 0.25);
    $('plv').textContent = me.lv; $('gold').textContent = me.gold + ' ouro';
    if ($('mShop').style.display === 'flex') $('shopGold').textContent = me.gold + ' ouro';
    if (me.name) $('pname').textContent = me.name;
    // magias
    const list = spells();
    if (spellsBuilt !== me.voc) {
      spellsBuilt = me.voc;
      document.querySelectorAll('#acts .sp').forEach(b => { const s = list[+b.dataset.i]; drawIcon(b.querySelector('canvas'), SPR.spellIcon(s.id)); b.querySelector('.lk').textContent = 'Nv ' + s.lvl; });
      drawIcon($('potHp').querySelector('canvas'), SPR.itemIcon('pot_hp')); drawIcon($('potMp').querySelector('canvas'), SPR.itemIcon('pot_mp'));
      setSel(selSpell);
    }
    document.querySelectorAll('#acts .sp').forEach(b => {
      const s = list[+b.dataset.i]; b.classList.toggle('lock', me.lv < s.lvl);
      b.querySelector('.cd').style.height = (me.cds && me.cds[s.id] ? 100 * me.cds[s.id] / s.cd : 0) + '%';
    });
    const s = list[selSpell]; if (s) $('cast').querySelector('.cd').style.height = (me.cds && me.cds[s.id] ? 100 * me.cds[s.id] / s.cd : 0) + '%';
    // alvo
    const t = me.tg && ents.get(me.tg);
    if (t) { $('tgtInfo').style.display = 'block'; $('tgtName').textContent = t.name; $('tgtHp').style.width = t.hp + '%'; } else $('tgtInfo').style.display = 'none';
    $('ptsDot').style.display = me.pts ? 'block' : 'none';
  }
  function drawIcon(c, src) { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height); }
  function setSel(i) {
    const s = spells()[i]; if (!s) return;
    selSpell = i;
    document.querySelectorAll('#acts .sp').forEach(b => b.classList.toggle('sel', +b.dataset.i === i));
    drawIcon($('cast').querySelector('canvas'), SPR.spellIcon(s.id));
  }
  const cast = () => { const s = spells()[selSpell]; if (s) send({ t: 'spell', s: s.id }); };
  document.querySelectorAll('#acts .sp').forEach(b => b.addEventListener('pointerdown', e => {
    e.preventDefault(); setSel(+b.dataset.i);
    // No PC, cada slot funciona como uma hotbar: clique seleciona e lança.
    // No toque, preserva-se a seleção antes do botão grande de lançar.
    if (!mobileMode) cast();
  }));
  $('cast').addEventListener('pointerdown', e => { e.preventDefault(); cast(); });
  $('potHp').addEventListener('pointerdown', e => { e.preventDefault(); send({ t: 'quick', k: 'hp' }); });
  $('potMp').addEventListener('pointerdown', e => { e.preventDefault(); send({ t: 'quick', k: 'mp' }); });

  // ======================================================== PAINÉIS
  const modals = ['mPanel', 'mShop', 'mDialog', 'mChat', 'mMap'];
  const closeModals = () => modals.forEach(m => $(m).style.display = 'none');
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModals);
  modals.forEach(m => $(m).addEventListener('pointerdown', e => { if (e.target.id === m) closeModals(); }));
  document.querySelectorAll('.ib[data-open]').forEach(b => b.onclick = () => { const k = b.dataset.open; if (k === 'map') return openMap('region'); if (k === 'chat') { closeModals(); $('mChat').style.display = 'flex'; $('chatLog').scrollTop = 1e9; } else openPanel(k); });
  $('portrait').onclick = () => openPanel('stats');
  document.querySelectorAll('.tabs2 [data-tab]').forEach(b => b.onclick = () => openPanel(b.dataset.tab));
  let curTab = 'inv';

  // ======================================================== MAPA (região e mundo) + VIAGEM
  let mapMode = 'region', travelInfo = null;
  function openMap(mode, travel) {
    closeModals(); mapMode = mode; travelInfo = travel || null;
    $('mMap').style.display = 'flex'; drawMap();
  }
  $('mapTabR').onclick = () => { mapMode = 'region'; drawMap(); };
  $('mapTabW').onclick = () => { mapMode = 'world'; drawMap(); };
  function islandPath(g, cx, cy, rad, seed) {
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = i / 40 * Math.PI * 2, k = 1 + 0.18 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 5 + seed * 2.3);
      const x = cx + Math.cos(a) * rad * k * 1.25, y = cy + Math.sin(a) * rad * k;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
  }
  const BIOME_COL = { green: '#4f9a40', island: '#5aa84a', snow: '#e8eef5', dark: '#3f3228' };
  function drawMap() {
    const c = $('mapCv'), g = c.getContext('2d'), Wc = c.width, Hc = c.height;
    $('mapTabR').classList.toggle('on', mapMode === 'region'); $('mapTabW').classList.toggle('on', mapMode === 'world');
    g.clearRect(0, 0, Wc, Hc);
    const meE = ents.get(myId), info = $('mapInfo');
    if (mapMode === 'region') {
      $('mapTitle').textContent = 'Mapa — ' + REG.name;
      const S = Math.min(Wc, Hc) - 20, x0 = (Wc - S) / 2, y0 = 10, k = S / MW;
      g.fillStyle = '#0b1530'; g.fillRect(0, 0, Wc, Hc);
      g.imageSmoothingEnabled = false; g.drawImage(miniImg, x0, y0, S, S);
      g.strokeStyle = 'rgba(242,193,78,.8)'; g.lineWidth = 3; g.strokeRect(x0, y0, S, S);
      g.textAlign = 'center'; g.font = '700 15px Poppins, sans-serif';
      for (const l of REG.labels || []) { const lx = x0 + l.x * k, ly = y0 + l.y * k; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(l.t, lx, ly); g.fillStyle = '#ffe9b0'; g.fillText(l.t, lx, ly); }
      for (const e of ents.values()) { if (e.id === myId) continue; g.fillStyle = e.kind === 'm' ? '#ff4d4d' : e.kind === 'n' ? '#4dd2ff' : '#ffffff'; g.fillRect(x0 + (e.x - RX) * k - 2, y0 + e.y * k - 2, 4, 4); }
      g.font = '700 13px Poppins, sans-serif'; g.textAlign = 'center';
      for (const pt of D.portalsOf(REG.id)) {
        const px = x0 + (pt.x + 0.5) * k, py = y0 + (pt.y + 1) * k, d = D.REGIONS[pt.to];
        g.fillStyle = '#000'; g.beginPath(); g.ellipse(px, py, 8, 11, 0, 0, 7); g.fill(); g.fillStyle = pt.back ? '#ffb347' : '#c084ff'; g.beginPath(); g.ellipse(px, py, 6, 9, 0, 0, 7); g.fill();
        const lbl = 'Portal: ' + d.name + (me.lv < d.lvl ? ` (Nv ${d.lvl})` : ''); g.textAlign = pt.back ? 'left' : 'right';
        g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(lbl, px + (pt.back ? 12 : -12), py - 12); g.fillStyle = '#e9d5ff'; g.fillText(lbl, px + (pt.back ? 12 : -12), py - 12);
      }
      g.textAlign = 'center';
      for (const f of friends) if (f[1] && f[2] === REG.id) {
        const fx = x0 + f[3] * k, fy = y0 + f[4] * k; greenDot(g, fx, fy, 7);
        g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(f[0], fx, fy - 13); g.fillStyle = '#7dffa6'; g.fillText(f[0], fx, fy - 13);
      }
      if (meE) { const px = x0 + (meE.x - RX) * k, py = y0 + meE.y * k; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 6, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(px, py, 3, 0, 7); g.fill(); }
      info.innerHTML = `<b style="color:var(--gold)">${REG.name}</b> · Cidade: ${REG.town} · Nível recomendado: ${REG.lvl}+<br>${REG.desc}<br>Para ir a outras terras, siga a estrada até o <b>portal</b> no fim do mapa (leste: próxima terra, oeste: terra anterior) ou pague o <b>Guardião do Portal</b> na cidade.`;
      return;
    }
    // mundo
    $('mapTitle').textContent = travelInfo ? 'Portal — escolha o destino' : 'Mapa do Mundo';
    const sea = g.createLinearGradient(0, 0, 0, Hc); sea.addColorStop(0, '#123a6b'); sea.addColorStop(1, '#0b2547'); g.fillStyle = sea; g.fillRect(0, 0, Wc, Hc);
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(Wc * ((i * 37) % 100) / 100, Hc * ((i * 61) % 100) / 100, 20 + i % 5 * 6, 0, 3); g.stroke(); }
    const here = travelInfo ? travelInfo.here : REG.id;
    g.setLineDash([6, 6]); g.strokeStyle = 'rgba(255,233,176,.35)'; g.lineWidth = 2;
    for (const r of D.REGIONS) if (r.id !== here) { const a = D.REGIONS[here]; g.beginPath(); g.moveTo(a.wx / 100 * Wc, a.wy / 100 * Hc); g.lineTo(r.wx / 100 * Wc, r.wy / 100 * Hc); g.stroke(); }
    g.setLineDash([]);
    for (const r of D.REGIONS) {
      const cx = r.wx / 100 * Wc, cy = r.wy / 100 * Hc, rad = Math.min(Wc, Hc) * 0.11;
      islandPath(g, cx, cy, rad + 8, r.id * 1.7); g.fillStyle = '#d9c283'; g.fill();
      islandPath(g, cx, cy, rad, r.id * 1.7); g.fillStyle = BIOME_COL[r.biome]; g.fill();
      if (r.id === REG.id && miniImg) { g.save(); islandPath(g, cx, cy, rad, r.id * 1.7); g.clip(); g.globalAlpha = .55; g.drawImage(miniImg, cx - rad * 1.3, cy - rad * 1.1, rad * 2.6, rad * 2.2); g.restore(); }
      g.fillStyle = '#8f877a'; g.fillRect(cx - 7, cy - 7, 14, 14); g.strokeStyle = '#3a342c'; g.lineWidth = 2; g.strokeRect(cx - 7, cy - 7, 14, 14);
      g.textAlign = 'center'; g.font = '700 17px Lora, serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.85)';
      g.strokeText(r.name, cx, cy + rad + 26); g.fillStyle = '#ffe9b0'; g.fillText(r.name, cx, cy + rad + 26);
      g.font = '600 12px Poppins, sans-serif'; const sub = `${r.town} · Nv ${r.lvl}+`;
      g.strokeText(sub, cx, cy + rad + 42); g.fillStyle = '#cfd8e6'; g.fillText(sub, cx, cy + rad + 42);
      const fr = friends.filter(f => f[1] && f[2] === r.id);
      fr.forEach((f, i) => { const a = i * 2.39996, rr = rad * 0.25 + 6 * Math.sqrt(i); greenDot(g, cx + Math.cos(a) * rr * 1.5 + 22, cy + Math.sin(a) * rr, 6); });
      if (fr.length) { g.font = '700 12px Poppins'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.85)'; const t = fr.length === 1 ? fr[0][0] : fr.length + ' amigos'; g.strokeText(t, cx + 22, cy + 26); g.fillStyle = '#7dffa6'; g.fillText(t, cx + 22, cy + 26); }
      if (r.id === here) { g.fillStyle = '#ffd84a'; g.beginPath(); g.moveTo(cx, cy - 12); g.lineTo(cx - 9, cy - 28); g.lineTo(cx + 9, cy - 28); g.fill(); g.font = '700 12px Poppins'; g.strokeText('Você está aqui', cx, cy - 34); g.fillStyle = '#fff'; g.fillText('Você está aqui', cx, cy - 34); }
    }
    info.innerHTML = '';
    if (!travelInfo) { info.innerHTML = 'Cada terra é carregada só quando você viaja. Para viajar, fale com o <b>Guardião do Portal</b> (ao lado da fonte, em cada cidade).'; return; }
    const lvl = travelInfo.level, gold = me.gold;
    for (const r of D.REGIONS) {
      if (r.id === here) continue;
      const cost = r.id === 0 ? 50 : r.cost, ok = lvl >= r.lvl && gold >= cost;
      const row = document.createElement('div'); row.className = 'shopItem';
      row.innerHTML = `<div class="n"><b>${r.name}</b> — ${r.town}<br><small>${r.desc} · Nível ${r.lvl}+ · ${cost} ouro</small></div>`;
      const b = document.createElement('button'); b.className = 'sbtn'; b.textContent = lvl < r.lvl ? `Nível ${r.lvl}` : gold < cost ? 'Sem ouro' : 'Viajar';
      b.disabled = !ok; if (!ok) b.style.opacity = .45;
      b.onclick = () => { send({ t: 'travel', to: r.id }); };
      row.appendChild(b); info.appendChild(row);
    }
  }

  // ---------------------------------------------------- AMIGOS
  function updFriendBadge() {
    const on = friends.filter(f => f[1]).length, b = $('frCount');
    b.textContent = on; b.style.display = on ? 'block' : 'none';
  }
  function renderFriends(force) {
    const near = [...ents.values()].filter(e => e.kind === 'p' && e.id !== myId && e.name && !isFriend(e.name)).map(e => e.name).slice(0, 6);
    const sig = JSON.stringify([friends.map(f => [f[0], f[1], f[2], f[5]]), near]);
    if (!force && sig === frSig) return; frSig = sig;
    const nl = $('frNear'); nl.innerHTML = '';
    if (near.length) {
      const h = document.createElement('div'); h.className = 'frH'; h.textContent = 'Jogadores perto de você'; nl.appendChild(h);
      near.forEach(n => { const b = document.createElement('button'); b.className = 'sbtn frNearBtn'; b.textContent = '+ ' + n; b.onclick = () => send({ t: 'friendAdd', name: n }); nl.appendChild(b); });
    }
    const L = $('frList'); L.innerHTML = '';
    if (!friends.length) { L.innerHTML = '<div class="frEmpty">Você ainda não tem amigos.<br>Digite o nome de um jogador online acima e toque em <b>Adicionar</b>. Quando ele aceitar, aparece como <b style="color:#5cf08a">ponto verde</b> no mapa.</div>'; return; }
    const sorted = friends.slice().sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    for (const f of sorted) {
      const row = document.createElement('div'); row.className = 'frRow' + (f[1] ? ' on' : '');
      const reg = f[1] ? D.REGIONS[f[2]] : null;
      row.innerHTML = `<i class="frDot"></i><div class="frN"><b>${f[0]}</b><small>${f[1] ? `Online · ${reg ? reg.name : ''} · Nv ${f[5]}` : 'Offline'}</small></div>`;
      if (f[1]) { const m = document.createElement('button'); m.className = 'sbtn'; m.textContent = 'Ver no mapa'; m.onclick = () => openMap(f[2] === REG.id ? 'region' : 'world'); row.appendChild(m); }
      const del = document.createElement('button'); del.className = 'sbtn frDel'; del.textContent = 'Remover';
      del.onclick = () => { if (del.dataset.c) send({ t: 'friendDel', name: f[0] }); else { del.dataset.c = 1; del.textContent = 'Confirmar?'; setTimeout(() => { del.dataset.c = ''; del.textContent = 'Remover'; }, 3000); } };
      row.appendChild(del); L.appendChild(row);
    }
  }
  $('frAddBtn').onclick = () => { const v = $('frName').value.trim(); if (v) { send({ t: 'friendAdd', name: v }); $('frName').value = ''; } };
  $('frName').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('frAddBtn').click(); });
  function showFriendReq() {
    const r = frReqs[0], box = $('frReq');
    if (!r) { box.style.display = 'none'; return; }
    $('frReqTxt').innerHTML = `<b>${r.from}</b> <small>(Nv ${r.lv})</small> quer ser seu amigo`;
    box.style.display = 'flex';
  }
  function answerReq(ok) { const r = frReqs.shift(); if (r) send({ t: 'friendAnswer', name: r.from, ok }); showFriendReq(); }
  $('frYes').onclick = () => answerReq(true); $('frNo').onclick = () => answerReq(false);
  function openPanel(tab) {
    closeModals(); curTab = tab; $('mPanel').style.display = 'flex';
    $('panelTitle').textContent = { inv: 'Mochila', stats: 'Personagem', quest: 'Missão', friends: 'Amigos' }[tab];
    document.querySelectorAll('.tabs2 [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('tabInv').style.display = tab === 'inv' ? 'block' : 'none'; $('tabStats').style.display = tab === 'stats' ? 'block' : 'none'; $('tabQuest').style.display = tab === 'quest' ? 'block' : 'none'; $('tabFriends').style.display = tab === 'friends' ? 'block' : 'none';
    if (tab === 'friends') renderFriends(true);
    renderPanels();
  }
  function itemDesc(id) {
    const it = D.ITEMS[id]; if (!it) return '';
    const p = [];
    if (it.atk) p.push('Ataque +' + it.atk); if (it.def) p.push('Defesa +' + it.def); if (it.mag) p.push('Magia +' + it.mag);
    if (it.hp) p.push('Recupera ' + it.hp + ' de vida'); if (it.mp) p.push('Recupera ' + it.mp + ' de mana');
    if (it.lvl) p.push('Nível ' + it.lvl); if (it.voc) p.push(D.VOC[it.voc].name);
    return `<b>${it.name}</b><br><span style="color:#b9a98c">${p.join(' · ')}${p.length ? ' · ' : ''}Venda: ${D.sellPrice(id)} ouro</span>`;
  }
  function slotEl(id, q, label) {
    const d = document.createElement('div'); d.className = 'slot';
    if (id) { d.style.backgroundImage = `url(${SPR.itemIcon(id).toDataURL()})`; if (q > 1) d.innerHTML = `<b>${q}</b>`; }
    else if (label) d.innerHTML = `<em>${label}</em>`;
    return d;
  }
  function showDet(html, btns) {
    const el = $('idet'); el.innerHTML = `<div class="t">${html}</div>`;
    (btns || []).forEach(([l, f]) => { const b = document.createElement('button'); b.className = 'sbtn'; b.textContent = l; b.onclick = f; el.appendChild(b); });
  }
  function renderPanels() {
    let hp = 0, mp = 0; inv.forEach(s => { if (s.id.startsWith('pot_hp')) hp += s.q; if (s.id.startsWith('pot_mp')) mp += s.q; });
    $('nHp').textContent = hp; $('nMp').textContent = mp;
    if ($('mPanel').style.display !== 'flex') { if ($('mShop').style.display === 'flex') renderShop(); return; }
    const eqEl = $('eq'); eqEl.innerHTML = '';
    [['weapon', 'Arma'], ['armor', 'Armadura'], ['helmet', 'Elmo'], ['shield', 'Escudo']].forEach(([k, l]) => {
      const d = slotEl(eq[k], 1, l);
      d.onclick = () => { if (eq[k]) showDet(itemDesc(eq[k]), [['Remover', () => { send({ t: 'unequip', slot: k }); showDet('Item removido.'); }]]); };
      eqEl.appendChild(d);
    });
    const invEl = $('inv'); invEl.innerHTML = '';
    for (let i = 0; i < 24; i++) {
      const s = inv[i], d = slotEl(s && s.id, s && s.q);
      if (s) d.onclick = () => {
        invEl.querySelectorAll('.slot').forEach(x => x.classList.remove('on')); d.classList.add('on');
        const it = D.ITEMS[s.id], act = it.type === 'potion' ? 'Usar' : it.type === 'loot' ? null : 'Equipar';
        showDet(itemDesc(s.id) + (it.type === 'loot' ? '<br><i>Venda para um comerciante.</i>' : ''), act ? [[act, () => send({ t: 'use', slot: i })]] : []);
      };
      invEl.appendChild(d);
    }
    const atkPerSec = me.atkDelay ? (1000 / me.atkDelay).toFixed(2).replace('.', ',') + '/s' : '—';
    $('kv').innerHTML = `<div>Vocação<b>${D.VOC[me.voc] ? D.VOC[me.voc].name : ''}</b></div><div>Nível<b>${me.lv}</b></div><div>Experiência<b>${me.xp}</b></div><div>Ataque<b>${me.atk}</b></div><div>Vel. de ataque<b>${atkPerSec}</b></div><div>Defesa<b>${me.def}</b></div><div>Ouro<b>${me.gold}</b></div>`;
    $('ptsTxt').textContent = me.pts ? `Você tem ${me.pts} ponto(s) para distribuir!` : 'Ganhe pontos subindo de nível.';
    const stEl = $('stats'); stEl.innerHTML = '';
    for (const k in D.STATS) {
      const r = document.createElement('div'); r.className = 'stat';
      r.innerHTML = `<div><b>${D.STATS[k].name}: ${stats[k] || 0}</b><small>${D.STATS[k].desc}</small></div>`;
      const b = document.createElement('button'); b.className = 'sbtn'; b.textContent = '+'; b.disabled = !me.pts; b.onclick = () => send({ t: 'stat', s: k });
      r.appendChild(b); stEl.appendChild(r);
    }
    $('task').innerHTML = task ? `Derrotar <b style="color:#f2c14e">${D.MON[task.mon].name}</b>: ${task.k} / ${task.n}` + (task.k >= task.n ? '<br><span style="color:#86efac">Concluída! Volte ao Mestre Aldo na cidade.</span>' : '') : 'Você não tem missão. Fale com o <b>Mestre Aldo</b> no centro da cidade.';
  }
  // loja
  function openShop() { closeModals(); $('mShop').style.display = 'flex'; $('shopName').textContent = shopData.name; $('shopGreet').textContent = shopData.greet; renderShop(); }
  $('tabBuy').onclick = () => { shopTab = 'buy'; renderShop(); };
  $('tabSell').onclick = () => { shopTab = 'sell'; renderShop(); };
  function renderShop() {
    $('shopGold').textContent = me.gold + ' ouro'; const L = $('shopList'); L.innerHTML = '';
    $('tabBuy').classList.toggle('on', shopTab === 'buy'); $('tabSell').classList.toggle('on', shopTab === 'sell');
    const row = (id, extra, btns) => {
      const d = document.createElement('div'); d.className = 'shopItem';
      const c = document.createElement('canvas'); c.width = 32; c.height = 32; c.getContext('2d').drawImage(SPR.itemIcon(id), 0, 0); d.appendChild(c);
      const it = D.ITEMS[id], n = document.createElement('div'); n.className = 'n';
      n.innerHTML = `${it.name}<br><small>${[it.atk ? 'Atq ' + it.atk : '', it.def ? 'Def ' + it.def : '', it.hp ? '+' + it.hp + ' vida' : '', it.mp ? '+' + it.mp + ' mana' : '', it.lvl ? 'Nv ' + it.lvl : ''].filter(Boolean).join(' · ')} ${extra}</small>`;
      d.appendChild(n); btns.forEach(([l, f]) => { const b = document.createElement('button'); b.className = 'sbtn'; b.textContent = l; b.onclick = f; b.style.marginLeft = '4px'; d.appendChild(b); }); L.appendChild(d);
    };
    if (shopTab === 'buy') {
      for (const id of shopData.items) {
        const it = D.ITEMS[id]; if (it.voc && it.voc !== me.voc) continue;
        const btns = [[`${it.price} ouro`, () => send({ t: 'buy', item: id, q: 1 })]];
        if (it.type === 'potion') btns.push(['x10', () => send({ t: 'buy', item: id, q: 10 })]);
        row(id, '', btns);
      }
    } else {
      if (!inv.length) L.innerHTML = '<div style="color:#b9a98c">Mochila vazia.</div>';
      inv.forEach((s, i) => { const btns = [[`Vender ${D.sellPrice(s.id)}`, () => send({ t: 'sell', slot: i })]]; if (s.q > 1) btns.push(['Todos', () => send({ t: 'sell', slot: i, all: true })]); row(s.id, s.q > 1 ? `· x${s.q}` : '', btns); });
    }
  }
  function openDialog(name, text) {
    closeModals(); $('dlgName').textContent = name; $('dlgText').textContent = text;
    const npc = [...ents.values()].find(e => e.name === name), c = $('dlgCv'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    if (npc && npc.look[0] === 'c') g.drawImage(CHARS.sprite(npc.look, 0, 0), 0, 0);
    $('mDialog').style.display = 'flex';
  }
  $('chatIn').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = $('chatIn').value.trim(); if (v) send({ t: 'chat', m: v }); $('chatIn').value = ''; } e.stopPropagation(); });

  // ======================================================== CONTROLES
  // joystick — controle robusto para qualquer celular:
  //  • funciona com Pointer Events e, em navegadores antigos, com Touch Events;
  //  • o canto inferior esquerdo inteiro serve para andar (não precisa acertar o círculo);
  //  • o visual do joystick continua o mesmo.
  const joy = $('joy'), knob = $('knob'); let joyId = null, joyDir = -1, joyAX = 0, joyAY = 0;
  function setWalk(d) { if (loadingOn) d = -1; if (d !== joyDir) { joyDir = d; send({ t: 'walk', d }); } }
  setInterval(() => { if (joyDir >= 0 && inGame) send({ t: 'walk', d: joyDir }); }, 250);
  function joyRect() { const r = joy.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; }
  function inZone(x, y) {
    if (!inGame || joy.offsetParent === null) return false;
    if (document.querySelector('.modal[style*="flex"]')) return false;
    const j = joyRect();
    if (Math.hypot(x - j.x, y - j.y) <= j.r + 30) return true;               // no joystick (com folga)
    if (x > innerWidth * 0.38 || y < innerHeight * 0.38) return false;          // fora do canto inferior esquerdo
    const el = document.elementFromPoint(x, y);
    return !el || el === cv || el === joy || joy.contains(el);                  // só sobre o mapa, nunca sobre botões
  }
  function joyStart(id, x, y) {
    joyId = id; const j = joyRect();
    // tocou no círculo: centro é o do joystick; tocou fora: o ponto do toque vira o centro
    if (Math.hypot(x - j.x, y - j.y) <= j.r + 30) { joyAX = j.x; joyAY = j.y; } else { joyAX = x; joyAY = y; }
    joyMove(x, y);
  }
  function joyEnd() { joyId = null; knob.style.transform = ''; setWalk(-1); }
  function joyMove(x, y) {
    const dx = x - joyAX, dy = y - joyAY, d = Math.hypot(dx, dy), m = Math.min(d, 42);
    knob.style.transform = `translate(${dx / (d || 1) * m}px,${dy / (d || 1) * m}px)`;
    if (d < 12) return setWalk(-1);
    setWalk(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 1) : (dy > 0 ? 0 : 2));
  }
  if (window.PointerEvent) {
    document.addEventListener('pointerdown', e => {
      if (joyId !== null || (e.pointerType === 'mouse' && !joy.contains(e.target))) return;
      if (!inZone(e.clientX, e.clientY)) return;
      e.preventDefault(); e.stopPropagation(); joyStart('p' + e.pointerId, e.clientX, e.clientY);
    }, true);
    document.addEventListener('pointermove', e => { if (joyId === 'p' + e.pointerId) { e.preventDefault(); joyMove(e.clientX, e.clientY); } }, { capture: true, passive: false });
    const up = e => { if (joyId === 'p' + e.pointerId) joyEnd(); };
    document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true);
  } else {
    const find = (list, id) => { for (const t of list) if ('t' + t.identifier === id) return t; return null; };
    document.addEventListener('touchstart', e => {
      if (joyId !== null) return; const t = e.changedTouches[0]; if (!t || !inZone(t.clientX, t.clientY)) return;
      e.preventDefault(); joyStart('t' + t.identifier, t.clientX, t.clientY);
    }, { capture: true, passive: false });
    document.addEventListener('touchmove', e => { const t = joyId && find(e.changedTouches, joyId); if (t) { e.preventDefault(); joyMove(t.clientX, t.clientY); } }, { capture: true, passive: false });
    const tend = e => { if (joyId && find(e.changedTouches, joyId)) joyEnd(); };
    document.addEventListener('touchend', tend, true); document.addEventListener('touchcancel', tend, true);
  }
  // se o app perder o foco (ligação, notificação, trocar de app), o personagem para
  document.addEventListener('visibilitychange', () => { if (document.hidden) joyEnd(); });
  // teclado (PC)
  const KD = { ArrowDown: 0, s: 0, S: 0, ArrowLeft: 1, a: 1, A: 1, ArrowUp: 2, w: 2, W: 2, ArrowRight: 3, d: 3, D: 3 };
  const held = [];
  const updWalk = () => setWalk(held.length ? held[held.length - 1] : -1);
  document.addEventListener('keydown', e => {
    if (!inGame || document.activeElement === $('chatIn')) return;
    if (e.key === 'Enter') { closeModals(); $('mChat').style.display = 'flex'; setTimeout(() => $('chatIn').focus(), 10); e.preventDefault(); return; }
    if (e.key in KD) { e.preventDefault(); if (e.repeat) return; const d = KD[e.key]; if (!held.includes(d)) held.push(d); updWalk(); return; }
    const spellKey = /^F([1-4])$/.exec(e.key);
    if (spellKey || (e.key >= '1' && e.key <= '4')) {
      e.preventDefault(); setSel(spellKey ? +spellKey[1] - 1 : +e.key - 1); cast(); return;
    }
    if (e.key === ' ') { e.preventDefault(); cast(); }
    if (e.key === 't' || e.key === 'T') send({ t: 'nearest' });
    if (e.key === 'q' || e.key === 'Q') send({ t: 'quick', k: 'hp' });
    if (e.key === 'e' || e.key === 'E') send({ t: 'quick', k: 'mp' });
    if (e.key === 'i' || e.key === 'I') openPanel('inv');
    if (e.key === 'Escape') { send({ t: 'target', id: 0 }); closeModals(); }
  });
  document.addEventListener('keyup', e => { if (e.key in KD) { const d = KD[e.key]; for (let i = held.length - 1; i >= 0; i--) if (held[i] === d) held.splice(i, 1); updWalk(); } });
  window.addEventListener('blur', () => { held.length = 0; if (inGame) setWalk(-1); });
  // toque no mapa: alvo / NPC / andar
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect();
    const wx = (e.clientX - r.left) * (cv.width / r.width) / K - cam.ox, wy = (e.clientY - r.top) * (cv.height / r.height) / K - cam.oy;
    const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
    let hit = null; const now = performance.now();
    for (const en of ents.values()) { if (en.id === myId) continue; const p = rpos(en, now); if (Math.round(p.x) === tx && (Math.round(p.y) === ty || Math.round(p.y) === ty + 1)) { hit = en; if (Math.round(p.y) === ty) break; } }
    if (hit) send({ t: 'target', id: hit.id });   // tocar no chão não move o personagem: só o joystick/teclado
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
})();
