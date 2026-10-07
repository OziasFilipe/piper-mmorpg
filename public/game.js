// Cliente — As Aventuras do Piper (mobile, paisagem, online)
(function () {
  const D = DEFS, T = D.T, TS = 32;
  const $ = id => document.getElementById(id);
  const cv = $('view'), ctx = cv.getContext('2d');
  let ws, myId = 0, tiles = null, MW = 160, MH = 160, CX = 80, CY = 80, inGame = false;
  let me = {}, inv = [], eq = {}, stats = {}, task = null, myLook = '';
  const ents = new Map(); let fxs = []; const speech = new Map();
  let miniImg = null, shopData = null, shopTab = 'buy', selSpell = 0, selItem = null;
  let K = 1, UI = 1, LWW = 0, LHH = 0; // escala mundo->dispositivo, fator de texto, tamanho lógico da tela
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };

  // ======================================================== ABERTURA
  const show = (id, on) => $(id).style.display = on ? (id === 'game' || id === 'title' ? 'block' : 'flex') : 'none';
  let loaded = false, titleShown = false;
  CHARS.load(p => $('loadbar').firstElementChild.style.width = Math.round(p * 100) + '%').then(() => { loaded = true; onLoaded(); });
  const timers = [];
  timers.push(setTimeout(() => $('sA').classList.add('on'), 300));
  timers.push(setTimeout(() => $('sA').classList.remove('on'), 2700));
  timers.push(setTimeout(() => $('sB').classList.add('on'), 3600));
  timers.push(setTimeout(() => $('sB').classList.remove('on'), 5600));
  timers.push(setTimeout(showTitle, 6500));
  $('splash').onclick = showTitle;
  function showTitle() {
    if (titleShown) return; titleShown = true; timers.forEach(clearTimeout);
    show('splash', false); show('title', true); onLoaded();
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
      g.drawImage(CHARS.portrait(CHARS.lookOf(el.dataset.v, starter(el.dataset.v), app), 88), 0, 0);
    });
  }
  let pT = 0;
  function animPreview(t) {
    requestAnimationFrame(animPreview);
    if ($('createForm').style.display === 'none' || !titleShown) return;
    if (pAuto && t - pT > 2200) { pT = t; pDir = [1, 2, 3, 0][pDir]; }
    const frame = pWalk ? [1, 0, 2, 0][Math.floor(t / 170) % 4] : 0;
    const c = $('prevCv'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high';
    g.drawImage(CHARS.sprite(CHARS.lookOf(voc, starter(voc), app), pDir, frame), 0, 0, c.width, c.height);
  }

  // ======================================================== CONEXÃO
  $('loginBtn').onclick = () => connect(false);
  $('createBtn').onclick = () => connect(true);
  $('lpass').onkeydown = e => { if (e.key === 'Enter') connect(false); };
  let connecting = false, errEl = null;
  function connect(create) {
    if (connecting) return; connecting = true;
    errEl = create ? $('authErr2') : $('authErr'); errEl.textContent = 'Conectando...';
    const name = create ? $('cname').value : $('lname').value, pass = create ? $('cpass').value : $('lpass').value;
    LS.set('piper_name', name);
    if (ws) try { ws.close(); } catch (e) { }
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'login', create, name, pass, voc, app }));
    ws.onmessage = ev => onMsg(JSON.parse(ev.data));
    ws.onerror = () => { };
    ws.onclose = () => {
      connecting = false;
      if (inGame) { inGame = false; show('game', false); show('title', true); $('authErr').textContent = 'Conexão perdida. Entre novamente.'; setTab('login'); }
      else if (errEl && errEl.textContent === 'Conectando...') errEl.textContent = 'Não foi possível conectar ao servidor.';
    };
  }
  const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

  function onMsg(m) {
    switch (m.t) {
      case 'err': if (!inGame) { errEl.textContent = m.m; connecting = false; } else addLog(m.m, '#ff8a8a'); break;
      case 'welcome': {
        myId = m.id; MW = m.W; MH = m.H; CX = MW >> 1; CY = MH >> 1;
        const bin = atob(m.tiles); tiles = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) tiles[i] = bin.charCodeAt(i);
        buildMini(); inGame = true; connecting = false; ents.clear(); fxs = []; $('feed').innerHTML = ''; $('chatLog').innerHTML = '';
        show('title', false); show('game', true); resize(); break;
      }
      case 's': onState(m); break;
      case 'msg': addLog(m.m, m.c); break;
      case 'chat': addLog(`${m.name} [${m.lv}]: ${m.m}`, '#ffe14a'); speech.set(m.id, { text: m.m, t0: performance.now() }); break;
      case 'shop': shopData = m; shopTab = 'buy'; openShop(); break;
      case 'dialog': openDialog(m.name, m.text); break;
      case 'dead': $('deathMsg').style.display = 'flex'; setTimeout(() => $('deathMsg').style.display = 'none', 2500); break;
    }
  }

  // ======================================================== ESTADO
  function moveDur(e) {
    if (e.kind === 'p') return Math.max(150, 260 - (e.lv || 1) * 2);
    if (e.kind === 'm' && D.MON[e.look]) return Math.min(450, D.MON[e.look].spd * 0.6);
    return 250;
  }
  function onState(m) {
    const now = performance.now();
    if (m.me.inv) { inv = m.me.inv; eq = m.me.eq; stats = m.me.st; task = m.me.task; }
    Object.assign(me, m.me);
    const seen = new Set();
    for (const a of m.e) {
      const [id, kind, x, y, dir, look, name, hp, flags, lv] = a; seen.add(id);
      let e = ents.get(id);
      if (!e) { e = { id, kind, x, y, fx: x, fy: y, t0: 0, dur: 1, walk: 0, faceLeft: true }; ents.set(id, e); }
      else if (e.x !== x || e.y !== y) {
        if (Math.abs(e.x - x) + Math.abs(e.y - y) > 2) { e.fx = x; e.fy = y; e.t0 = 0; }
        else { const p = rpos(e, now); e.fx = p.x; e.fy = p.y; e.t0 = now; e.walk++; }
        e.x = x; e.y = y;
      }
      Object.assign(e, { dir, look, name, hp, flags, lv });
      e.dur = moveDur(e);
      if (dir === 1) e.faceLeft = true; else if (dir === 3) e.faceLeft = false;
      if (id === myId && look !== myLook) { myLook = look; const pc = $('portrait'); const g = pc.getContext('2d'); g.clearRect(0, 0, 116, 116); g.drawImage(CHARS.portrait(look, 116), 0, 0); }
    }
    for (const id of ents.keys()) if (!seen.has(id)) ents.delete(id);
    for (const f of m.fx) { f.t0 = now; fxs.push(f); }
    if (m.me.inv) renderPanels();
    updateHud();
  }
  function rpos(e, now) {
    const k = e.t0 ? Math.min(1, (now - e.t0) / e.dur) : 1;
    return { x: e.fx + (e.x - e.fx) * k, y: e.fy + (e.y - e.fy) * k, moving: k < 1 };
  }

  // ======================================================== MAPA
  const tileAt = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? T.WATER : tiles[y * MW + x];
  const inCave = (x, y) => x > CX + 28 && y > CY + 28;
  const MINI_COL = ['#4b8d3b', '#2a5f2a', '#2b5fae', '#d8c07c', '#8f877a', '#555555', '#3f3228', '#9b7b4f', '#8a8178', '#5c9f46', '#8b5e34', '#1a1410'];
  function buildMini() {
    miniImg = SPR.mk(MW, MH); const g = miniImg.getContext('2d'); const id = g.createImageData(MW, MH);
    for (let i = 0; i < MW * MH; i++) { const c = parseInt(MINI_COL[tiles[i]].slice(1), 16); id.data.set([c >> 16, (c >> 8) & 255, c & 255, 255], i * 4); }
    g.putImageData(id, 0, 0);
  }

  // ======================================================== RENDER
  const FXC = { fire: '#ff8a2a', ice: '#8ef0ff', arcane: '#d08aff', energy: '#fff35a' };
  let cam = { ox: 0, oy: 0 };
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = innerWidth, h = innerHeight;
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
    const camX = mp.x + 0.5 - LWW / TS / 2, camY = mp.y + 0.2 - LHH / TS / 2;
    const ox = Math.round(-camX * TS * K) / K, oy = Math.round(-camY * TS * K) / K; cam = { ox, oy };
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(K, 0, 0, K, 0, 0); ctx.imageSmoothingEnabled = false;
    const x0 = Math.floor(camX) - 1, y0 = Math.floor(camY) - 1, x1 = x0 + Math.ceil(LWW / TS) + 2, y1 = y0 + Math.ceil(LHH / TS) + 3;
    const wf = Math.floor(now / 350) % 7;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = tileAt(x, y), v = SPR.hash(x, y, 9) * 4 | 0;
      ctx.drawImage(SPR.tile(t, v, wf), x * TS + ox, y * TS + oy, TS + 0.05, TS + 0.05);
    }
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
      for (let x = x0; x <= x1; x++) {
        const t = tileAt(x, y);
        if (t === T.TREE) ctx.drawImage(SPR.treeObj(SPR.hash(x, y, 3) * 6 | 0), x * TS + ox - 8, y * TS + oy - 26);
        else if (t === T.ROCK) ctx.drawImage(SPR.rockObj(0), x * TS + ox, y * TS + oy);
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
      const p = rpos(e, now), sx = p.x * TS + ox + 16, isC = typeof e.look === 'string' && e.look[0] === 'c';
      const top = isC ? 20 : (e.look === 'dragon' || e.look === 'troll' || e.look === 'bear' ? 14 : 4);
      const sy = p.y * TS + oy - top;
      const pct = e.hp / 100, hc = pct > 0.6 ? '#3fd35a' : pct > 0.3 ? '#f2c14e' : '#ef4444';
      const nc = e.kind === 'n' ? '#9fd8ff' : e.kind === 'p' ? ((e.flags & 1) ? '#ff6b6b' : '#ffffff') : hc;
      ctx.font = `700 ${11 * UI}px Poppins, sans-serif`;
      txt(e.name + (e.kind === 'p' && (e.flags & 1) ? ' ☠' : ''), sx, sy - 5 * UI, nc);
      if (e.kind !== 'n') { const bw = 26, bh = Math.max(2, 3.5 * UI); ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(sx - bw / 2 - 0.5, sy - 1, bw + 1, bh + 1); ctx.fillStyle = hc; ctx.fillRect(sx - bw / 2, sy - 0.5, bw * pct, bh); }
      const sp = speech.get(e.id);
      if (sp) { const age = now - sp.t0; if (age > 4500) speech.delete(e.id); else { ctx.font = `600 ${11 * UI}px Poppins, sans-serif`; wrapTxt(sp.text, sx, sy - 20 * UI, '#ffe14a'); } }
    }
    fxs = fxs.filter(f => drawFx(f, now, ox, oy));
    drawMini(meE);
  }
  function txt(s, x, y, c) { ctx.lineWidth = 3 * UI; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); ctx.fillStyle = c; ctx.fillText(s, x, y); }
  function wrapTxt(s, x, y, c) {
    const words = s.split(' '), lines = []; let cur = '';
    for (const w of words) { if ((cur + ' ' + w).length > 26) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    lines.push(cur); lines.forEach((l, i) => txt(l, x, y - (lines.length - 1 - i) * 13 * UI, c));
  }
  function drawEnt(e, p, now, ox, oy) {
    let frame = 0; if (p.moving) frame = 1 + (e.walk % 2);
    const sx = p.x * TS + ox, sy = p.y * TS + oy;
    if (typeof e.look === 'string' && e.look[0] === 'c') {
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 28.5, 10, 3.6, 0, 0, 7); ctx.fill();
      if (e.flags & 2) { ctx.fillStyle = 'rgba(255,80,20,.28)'; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 22, 17, 12, 0, 0, 7); ctx.fill(); }
      const img = CHARS.sprite(e.look, e.dir, frame);
      const breathe = p.moving ? 0 : Math.sin(now / 420 + e.id) * 0.35;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy + TS - 46.5 + breathe, 32, 48 - breathe);
      ctx.imageSmoothingEnabled = false;
      return;
    }
    if (e.kind === 'm' && !p.moving && Math.floor(now / 500 + e.id) % 4 === 0) frame = 1;
    const img = SPR.entity(e.kind, e.look, e.dir, frame, e.faceLeft);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 29, img.width > 32 ? 16 : 10, 4, 0, 0, 7); ctx.fill();
    ctx.drawImage(img, Math.round(sx + (TS - img.width) / 2), Math.round(sy + TS - img.height - 1));
  }
  function drawCorpse(f, sx, sy, age) {
    ctx.globalAlpha = age > 10000 ? 1 - (age - 10000) / 2000 : 1;
    ctx.fillStyle = '#6a0808'; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 24, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (f.look !== 'player') {
      const img = SPR.entity('m', f.look, 0, 0, true);
      ctx.save(); ctx.translate(sx + 16, sy + 20); ctx.rotate(Math.PI / 2); ctx.filter = 'grayscale(.6) brightness(.75)';
      ctx.drawImage(img, -img.width / 2, -img.height / 2 - 2, img.width * 0.9, img.height * 0.9); ctx.restore(); ctx.filter = 'none';
    } else { ctx.fillStyle = '#ddd'; ctx.fillRect(sx + 10, sy + 20, 12, 3); ctx.fillRect(sx + 13, sy + 16, 6, 6); }
    ctx.globalAlpha = 1;
  }
  function drawFx(f, now, ox, oy) {
    const age = now - f.t0, sx = f.x * TS + ox, sy = f.y * TS + oy;
    switch (f.k) {
      case 'dmg': { if (age > 1100) return false; const k = age / 1100; ctx.globalAlpha = 1 - k * k; ctx.font = `800 ${(f.xp ? 11 : 14) * UI}px Poppins, sans-serif`; txt(String(f.v), sx + 16 + (f.xp ? 10 : 0), sy - 2 - k * 26 - (f.xp ? 10 : 0), f.c); ctx.globalAlpha = 1; return true; }
      case 'puff': { if (age > 400) return false; ctx.strokeStyle = 'rgba(140,190,255,' + (1 - age / 400) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 4 + age / 30, 0, 7); ctx.stroke(); return true; }
      case 'slash': { if (age > 220) return false; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 11, -2.4 + age / 120, -0.6 + age / 120); ctx.stroke(); return true; }
      case 'proj': {
        const dur = 260; if (age > dur) return false; const k = age / dur, px = (f.x + (f.tx - f.x) * k) * TS + ox + 16, py = (f.y + (f.ty - f.y) * k) * TS + oy + 10;
        const c = FXC[f.fx] || '#fff'; ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 12 * K; ctx.beginPath(); ctx.arc(px, py, f.fx === 'arcane' ? 3.5 : 5.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 1.5, 0, 7); ctx.fill(); return true;
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
    g.drawImage(miniImg, meE.x - R, meE.y - R, R * 2, R * 2, 2, 2, 256, 256);
    for (const e of ents.values()) { if (e.id === myId) continue; g.fillStyle = e.kind === 'm' ? '#ff4d4d' : e.kind === 'n' ? '#4dd2ff' : '#fff'; g.fillRect(2 + (e.x - meE.x + R) * S, 2 + (e.y - meE.y + R) * S, 5, 5); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(130, 130, 5, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke();
  }
  requestAnimationFrame(render);

  // ======================================================== HUD
  function addLog(s, c) {
    const d = document.createElement('div'); d.textContent = s; d.style.color = c || '#fff';
    const f = $('feed'); f.appendChild(d); while (f.children.length > 6) f.removeChild(f.firstChild);
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 1000); }, 7000);
    const l = $('chatLog'), d2 = d.cloneNode(true); l.appendChild(d2); while (l.children.length > 200) l.removeChild(l.firstChild); l.scrollTop = l.scrollHeight;
  }
  function bar(id, v, max, label) { const b = $(id); b.querySelector('i').style.width = Math.max(0, Math.min(100, 100 * v / max)) + '%'; const s = b.querySelector('span'); if (s) s.textContent = label; }
  const spells = () => D.SPELLS[me.voc] || [];
  let spellsBuilt = '';
  function updateHud() {
    bar('hpB', me.hp, me.mhp, `${me.hp} / ${me.mhp}`);
    bar('mpB', me.mp, me.mmp, `${me.mp} / ${me.mmp}`);
    bar('xpB', me.xp - me.xpa, me.xpb - me.xpa);
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
  document.querySelectorAll('#acts .sp').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); setSel(+b.dataset.i); }));
  $('cast').addEventListener('pointerdown', e => { e.preventDefault(); cast(); });
  $('potHp').addEventListener('pointerdown', e => { e.preventDefault(); send({ t: 'quick', k: 'hp' }); });
  $('potMp').addEventListener('pointerdown', e => { e.preventDefault(); send({ t: 'quick', k: 'mp' }); });

  // ======================================================== PAINÉIS
  const modals = ['mPanel', 'mShop', 'mDialog', 'mChat'];
  const closeModals = () => modals.forEach(m => $(m).style.display = 'none');
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModals);
  modals.forEach(m => $(m).addEventListener('pointerdown', e => { if (e.target.id === m) closeModals(); }));
  document.querySelectorAll('.ib').forEach(b => b.onclick = () => { const k = b.dataset.open; if (k === 'chat') { closeModals(); $('mChat').style.display = 'flex'; $('chatLog').scrollTop = 1e9; } else openPanel(k); });
  $('portrait').onclick = () => openPanel('stats');
  document.querySelectorAll('.tabs2 [data-tab]').forEach(b => b.onclick = () => openPanel(b.dataset.tab));
  let curTab = 'inv';
  function openPanel(tab) {
    closeModals(); curTab = tab; $('mPanel').style.display = 'flex';
    $('panelTitle').textContent = { inv: 'Mochila', stats: 'Personagem', quest: 'Missão' }[tab];
    document.querySelectorAll('.tabs2 [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('tabInv').style.display = tab === 'inv' ? 'block' : 'none'; $('tabStats').style.display = tab === 'stats' ? 'block' : 'none'; $('tabQuest').style.display = tab === 'quest' ? 'block' : 'none';
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
    $('kv').innerHTML = `<div>Vocação<b>${D.VOC[me.voc] ? D.VOC[me.voc].name : ''}</b></div><div>Nível<b>${me.lv}</b></div><div>Experiência<b>${me.xp}</b></div><div>Ataque<b>${me.atk}</b></div><div>Defesa<b>${me.def}</b></div><div>Ouro<b>${me.gold}</b></div>`;
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
  // joystick
  const joy = $('joy'), knob = $('knob'); let joyId = null, joyDir = -1;
  function setWalk(d) { if (d !== joyDir) { joyDir = d; send({ t: 'walk', d }); } }
  joy.addEventListener('pointerdown', e => { e.preventDefault(); joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; knob.style.transform = ''; setWalk(-1); };
  joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
  function joyMove(e) {
    const r = joy.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy), m = Math.min(d, 42);
    knob.style.transform = `translate(${dx / (d || 1) * m}px,${dy / (d || 1) * m}px)`;
    if (d < 14) return setWalk(-1);
    setWalk(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 1) : (dy > 0 ? 0 : 2));
  }
  // teclado (PC)
  const KD = { ArrowDown: 0, s: 0, S: 0, ArrowLeft: 1, a: 1, A: 1, ArrowUp: 2, w: 2, W: 2, ArrowRight: 3, d: 3, D: 3 };
  const held = [];
  const updWalk = () => setWalk(held.length ? held[held.length - 1] : -1);
  document.addEventListener('keydown', e => {
    if (!inGame || document.activeElement === $('chatIn')) return;
    if (e.key === 'Enter') { closeModals(); $('mChat').style.display = 'flex'; setTimeout(() => $('chatIn').focus(), 10); e.preventDefault(); return; }
    if (e.key in KD) { e.preventDefault(); if (e.repeat) return; const d = KD[e.key]; if (!held.includes(d)) held.push(d); updWalk(); return; }
    if (e.key >= '1' && e.key <= '4') setSel(+e.key - 1);
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
    if (hit) send({ t: 'target', id: hit.id }); else send({ t: 'goto', x: tx, y: ty });
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
})();
