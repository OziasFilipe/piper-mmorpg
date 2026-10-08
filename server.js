'use strict';
// As Aventuras do Piper — servidor MMORPG 2D (Node.js + WebSocket)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { createStore } = require('./store');
const BOOT = Date.now();
const { WebSocketServer } = require('ws');
const D = require('./public/defs.js');
const { T, BLOCK, VOC, ITEMS, SPELLS, MON, ZONES, TASKS, NPCS, SHOPS, STATS, xpFor } = D;

const PORT = +process.env.PORT || 3000;
const XP_RATE = +process.env.XP_RATE || 2;
const W = D.W, H = D.H, CX = W >> 1, CY = H >> 1;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const TICK = 100;

// ------------------------------------------------------------------ MUNDO (várias regiões)
// Cada região é um mapa W x H. Ficam lado a lado num grande arranjo, separadas
// pelo mar da borda, então a lógica de combate/movimento é a mesma em todas.
// O cliente só recebe os tiles da região onde o jogador está.
function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(1337);
function noise(cell, rnd = R) {
  const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2, g = [];
  for (let i = 0; i < gw * gh; i++) g.push(rnd());
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
    const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}
const REGIONS = D.REGIONS, NR = REGIONS.length, TW = W * NR;
const tiles = new Uint8Array(TW * H);
const get = (x, y) => (x < 0 || y < 0 || x >= TW || y >= H) ? T.WATER : tiles[y * TW + x];
const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < TW && y < H) tiles[y * TW + x] = v; };
const regionOf = x => Math.max(0, Math.min(NR - 1, Math.floor(x / W)));
const townOf = r => ({ x: r * W + CX, y: CY });
const isTown = (x, y) => Math.abs(x - regionOf(x) * W - CX) <= 10 && Math.abs(y - CY) <= 10;
// As fachadas das lojas são objetos altos. Elas coincidem com os tiles WALL
// enviados ao cliente, mas a regra explícita evita que uma alteração futura de
// textura transforme uma construção em um lugar atravessável por engano.
const TOWN_BUILDINGS = [
  { x: -8, y: -8, w: 4, h: 3 }, { x: 5, y: -8, w: 4, h: 3 },
  { x: -8, y: 5, w: 4, h: 3 }, { x: 5, y: 5, w: 4, h: 3 }
];
function townObjectSolid(x, y) {
  const lx = x - regionOf(x) * W, ly = y - CY;
  return TOWN_BUILDINGS.some(b => lx >= CX + b.x && lx < CX + b.x + b.w && ly >= b.y && ly < b.y + b.h);
}
const inCave = (x, y) => { const r = regionOf(x), lx = x - r * W; return REGIONS[r].biome === 'green' && lx > CX + 28 && y > CY + 28; };
const inDesert = (x, y) => { const r = regionOf(x), lx = x - r * W; return REGIONS[r].biome === 'green' && lx > CX + 28 && y < CY - 28; };
const BASE = { green: T.GRASS, island: T.GRASS, snow: T.SNOW, dark: T.CAVE };

function genRegion(r) {
  const reg = REGIONS[r], X0 = r * W, rnd = r === 0 ? R : rng(1337 + r * 7919), base = BASE[reg.biome];
  const lget = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? T.WATER : tiles[y * TW + X0 + x];
  const lset = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * TW + X0 + x] = v; };
  const n1 = noise(10, rnd), n2 = noise(4, rnd), n3 = noise(3, rnd);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let t = base; const v = n1(x, y) * 0.75 + n3(x, y) * 0.25;
    const dTown = Math.max(Math.abs(x - CX), Math.abs(y - CY));
    if (reg.biome === 'green') {
      if (inDesert(X0 + x, y)) t = rnd() < 0.035 ? T.ROCK : T.SAND;
      else if (v < 0.3) t = T.WATER;
      else if (v < 0.34) t = T.SAND;
      else if (n2(x, y) > (dTown < 35 ? 0.68 : 0.6)) t = T.TREE;
      else if (rnd() < 0.03) t = T.FLOWER;
    } else if (reg.biome === 'island') {
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);          // ilha: mais água perto das bordas
      const vv = v - Math.max(0, (22 - edge) / 22) * 0.35;
      if (vv < 0.33) t = T.WATER; else if (vv < 0.4) t = T.SAND;
      else if (n2(x, y) > (dTown < 30 ? 0.66 : 0.56)) t = T.TREE;
      else if (rnd() < 0.05) t = T.FLOWER;
    } else if (reg.biome === 'snow') {
      if (v < 0.27) t = T.WATER;
      else if (n2(x, y) > (dTown < 30 ? 0.7 : 0.645)) t = T.TREE;
      else if (rnd() < 0.035) t = T.SNOWROCK;
    } else {
      if (v < 0.24) t = T.WATER;
      else if (n2(x, y) > (dTown < 30 ? 0.7 : 0.63)) t = T.CAVEWALL;
      else if (n2(x, y) > 0.56 && rnd() < 0.2) t = T.TREE;
    }
    if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) t = T.WATER;
    lset(x, y, t);
  }
  if (reg.biome === 'green') {   // caverna (sudeste) só no Vale de Aurora
    for (let y = CY + 29; y < H - 3; y++) for (let x = CX + 29; x < W - 3; x++) lset(x, y, T.CAVEWALL);
    let px = CX + 31, py = CY + 40;
    for (let i = 0; i < 6500; i++) {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const xx = px + dx, yy = py + dy; if (xx > CX + 29 && yy > CY + 29 && xx < W - 4 && yy < H - 4) lset(xx, yy, T.CAVE); }
      const d = rnd() * 4 | 0; px += [0, 1, 0, -1][d]; py += [1, 0, -1, 0][d];
      px = Math.max(CX + 30, Math.min(W - 6, px)); py = Math.max(CY + 30, Math.min(H - 6, py));
    }
  }
  const road = (x, y) => { const t = lget(x, y); if (t === T.WATER) lset(x, y, T.BRIDGE); else if (t !== T.CAVE || reg.biome === 'dark') lset(x, y, inCave(X0 + x, y) ? T.CAVE : T.PATH); };
  const road2 = (x, y) => { road(x, y); road(x + 1, y); };
  const road2v = (x, y) => { road(x, y); road(x, y + 1); };
  for (let y = 4; y < CY - 10; y++) road2(CX, y);
  for (let y = CY + 11; y < H - 4; y++) road2(CX, y);
  for (let x = 4; x < CX - 10; x++) road2v(x, CY);
  for (let x = CX + 11; x < W - 4; x++) road2v(x, CY);
  if (reg.biome === 'green') {
    for (let x = CX; x <= CX + 32; x++) road2v(x, CY + 40);
    for (let y = CY - 42; y < CY; y++) road2(CX + 40, y);
  }
  // clareira em volta de cada portal, para ele ficar sempre acessível
  for (const pt of D.portalsOf(r)) for (let dy = -2; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) road(pt.x + dx, pt.y + dy);
  for (let y = CY - 13; y <= CY + 13; y++) for (let x = CX - 13; x <= CX + 13; x++) if (BLOCK[lget(x, y)] || lget(x, y) === T.WATER) lset(x, y, base);
  for (let y = CY - 10; y <= CY + 10; y++) for (let x = CX - 10; x <= CX + 10; x++) {
    const edge = Math.abs(x - CX) === 10 || Math.abs(y - CY) === 10;
    lset(x, y, edge ? T.WALL : T.FLOOR);
  }
  for (let k = -1; k <= 2; k++) { lset(CX + k, CY - 10, T.FLOOR); lset(CX + k, CY + 10, T.FLOOR); lset(CX - 10, CY + k, T.FLOOR); lset(CX + 10, CY + k, T.FLOOR); }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (lget(x, y) === T.BRIDGE) {
    let wet = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (lget(x + dx, y + dy) === T.WATER) wet = true;
    if (!wet) lset(x, y, T.PATH);
  }
  lset(CX, CY, T.WATER); lset(CX + 1, CY, T.WATER); lset(CX, CY + 1, T.WATER); lset(CX + 1, CY + 1, T.WATER);
  const hut = (x0, y0) => { for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 4; x++) lset(x, y, T.WALL); };
  hut(CX - 8, CY - 8); hut(CX + 5, CY - 8); hut(CX - 8, CY + 5); hut(CX + 5, CY + 5);
  return rnd;
}
const regionRng = REGIONS.map((_, r) => genRegion(r));
const SPAWN = { x: CX, y: CY + 4 };                       // região 0 (jogadores novos)
const spawnOf = r => ({ x: r * W + CX, y: CY + 4 });
// tiles de cada região já codificados para enviar ao cliente
const regionTiles = REGIONS.map((_, r) => {
  const b = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b[y * W + x] = tiles[y * TW + r * W + x];
  return b.toString('base64');
});

// ------------------------------------------------------------------ ENTIDADES
let nextId = 1;
const ents = new Map();
const occ = new Map();
const players = new Map(); // id -> player
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const DX = [0, -1, 0, 1], DY = [1, 0, -1, 0]; // 0 baixo,1 esquerda,2 cima,3 direita
// Limites explícitos impedem que uma concentração de jogadores transforme uma
// única tela em milhares de entidades/partículas e congele todos os clientes.
const VIEW_ENTITY_LIMIT = Math.max(40, +process.env.VIEW_ENTITY_LIMIT || 96);
const FX_QUEUE_LIMIT = Math.max(24, +process.env.FX_QUEUE_LIMIT || 80);
const SOCKET_BACKLOG_LIMIT = Math.max(65536, +process.env.SOCKET_BACKLOG_LIMIT || 512 * 1024);

// Grade espacial: cada célula de 16x16 tiles guarda as entidades dentro dela.
// Assim o servidor só olha o que está perto de cada jogador (bem mais leve).
const CELL = 16, cells = new Map();
const cellKey = (x, y) => ((y / CELL) | 0) * 100000 + ((x / CELL) | 0);
function cellAdd(e) { const k = cellKey(e.x, e.y); let c = cells.get(k); if (!c) { c = new Set(); cells.set(k, c); } c.add(e); e._cell = k; }
function cellDel(e) { if (e._cell == null) return; const c = cells.get(e._cell); if (c) { c.delete(e); if (!c.size) cells.delete(e._cell); } e._cell = null; }
function near(x, y, rx, ry, fn) {
  const cx0 = ((x - rx) / CELL) | 0, cx1 = ((x + rx) / CELL) | 0, cy0 = (Math.max(0, y - ry) / CELL) | 0, cy1 = ((y + ry) / CELL) | 0;
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = Math.max(0, cx0); cx <= cx1; cx++) {
    const c = cells.get(cy * 100000 + cx); if (!c) continue;
    for (const e of c) if (Math.abs(e.x - x) <= rx && Math.abs(e.y - y) <= ry) fn(e);
  }
}
function place(e, x, y) {
  if (e.x != null && occ.get(e.y * TW + e.x) === e) occ.delete(e.y * TW + e.x);
  e.x = x; e.y = y; occ.set(y * TW + x, e);
  const k = cellKey(x, y); if (e._cell !== k) { cellDel(e); cellAdd(e); }
}
function unplace(e) { if (occ.get(e.y * TW + e.x) === e) occ.delete(e.y * TW + e.x); cellDel(e); }
function walkable(x, y, forMon) {
  if (BLOCK[get(x, y)] || townObjectSolid(x, y)) return false;
  if (forMon && isTown(x, y)) return false;
  return true;
}
function free(x, y, forMon) { return walkable(x, y, forMon) && !occ.has(y * TW + x); }
function findFree(x, y) {
  for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (free(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  return { x, y };
}

// NPCs
for (const n of NPCS) {
  const e = { id: nextId++, kind: 'n', npc: n, name: n.name, look: n.look, dir: 0 };
  const c = townOf(n.r || 0); place(e, c.x + n.dx, c.y + n.dy); ents.set(e.id, e);
}

// Pontos de spawn
function zoneOf(x, y) {
  if (isTown(x, y)) return null;
  const r = regionOf(x), reg = REGIONS[r], lx = x - r * W;
  const d = Math.max(Math.abs(lx - CX), Math.abs(y - CY));
  // Dois tiles separam a muralha da faixa de aprendizado: há monstros logo
  // ao sair da cidade, sem comprometer a área segura ou os comerciantes.
  if (d < 12) return null;
  if (reg.biome === 'green') {
    if (inCave(x, y)) return 'cave';
    if (inDesert(x, y)) return 'desert';
    if (r === 0 && d < 32) return 'starter';
    if (d < 38) return 'meadow'; if (d < 58) return 'forest'; return 'wild';
  }
  return d < 45 ? reg.zones[0] : reg.zones[1];
}
const spawns = [];
for (let rg = 0; rg < NR; rg++) {
  const RND = regionRng[rg];
  for (let y = 3; y < H - 3; y++) for (let lx = 3; lx < W - 3; lx++) {
    const x = rg * W + lx;
    const z = zoneOf(x, y); if (!z || !walkable(x, y, true)) continue;
    const t = get(x, y); if (t === T.PATH || t === T.BRIDGE) continue;
    // O anel inicial é um pouco mais povoado para que novos personagens
    // encontrem vários tipos de monstro sem atravessar metade do mapa.
    if (RND() > (z === 'starter' ? 1 / 34 : 1 / 55)) continue;
    const list = ZONES[z]; const tot = list.reduce((s, a) => s + a[1], 0); let r = RND() * tot, type = list[0][0];
    for (const [m, w] of list) { r -= w; if (r <= 0) { type = m; break; } }
    spawns.push({ type, x, y, ent: null, at: 0 });
  }
}
function spawnMon(s) {
  if (!free(s.x, s.y, true)) { s.at = Date.now() + 5000; return; }
  const def = MON[s.type];
  const e = { id: nextId++, kind: 'm', type: s.type, name: def.name, look: s.type, hp: def.hp, mhp: def.hp, dir: 0, home: s, nextAct: 0, nextAtk: 0, target: null, dmgBy: new Map() };
  place(e, s.x, s.y); ents.set(e.id, e); s.ent = e;
}
spawns.forEach(spawnMon);
console.log(`${NR} regiões ${W}x${H} geradas, ${spawns.length} monstros.`);

// ------------------------------------------------------------------ PERSISTÊNCIA
const SAVE_KEYS = ['name', 'voc', 'x', 'y', 'level', 'maxLevel', 'xp', 'hp', 'mp', 'stats', 'points', 'gold', 'inv', 'eq', 'taskIdx', 'task', 'kills', 'deaths', 'salt', 'hash', 'app', 'friends'];
// Onde os personagens ficam salvos é decidido em store.js: SQLite (computador/VPS/Docker/Render),
// Redis/Upstash (Vercel) ou memória (último recurso).
const store = createStore({ dataDir: DATA_DIR });
console.log('[armazenamento] usando ' + store.kind + (store.persistent ? '' : ' (TEMPORÁRIO: os dados somem ao reiniciar)'));
function persist(p) {
  const o = {}; for (const k of SAVE_KEYS) o[k] = p[k];
  saveData(o);
}
function saveData(o) { store.savePlayer(o); }
function loadPlayer(username) { return store.getPlayer(username); }
function saveDb() { store.flush(); }

// ------------------------------------------------------------------ ADMIN: dados extras + LOG
// tipos: start, create, login, logout, auth (senha errada), ban, death, level, chat, travel, friend, admin, error
function logEv(type, player, text, ip) { try { store.log(type, player, text, ip); } catch (e) { } }
const clientIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress || '').replace(/^::ffff:/, '');
const hashPw = (pw, salt) => crypto.createHash('sha256').update(salt + ':' + pw).digest('hex');

// ------------------------------------------------------------------ JOGADOR
const maxHp = p => VOC[p.voc].hp + VOC[p.voc].hpL * (p.level - 1) + p.stats.vit * 10;
const maxMp = p => VOC[p.voc].mp + VOC[p.voc].mpL * (p.level - 1) + p.stats.mag * 5;
function eqSum(p, k) { let s = 0; for (const slot in p.eq) { const id = p.eq[slot]; if (id && ITEMS[id][k]) s += ITEMS[id][k]; } return s; }
function playerAtk(p) {
  const base = VOC[p.voc].atk + p.level * 1.2 + eqSum(p, 'atk');
  return p.voc === 'warrior' ? base + p.stats.str * 2 : base + (p.stats.mag + eqSum(p, 'mag')) * 2;
}
const playerDef = p => eqSum(p, 'def') + p.stats.dfs + p.level * (p.voc === 'warrior' ? 0.4 : 0.2);
const stepTime = p => Math.max(150, 260 - p.level * 2);
// Ritmo inspirado na progressão de ASPD: todo nível encurta um pouco o
// intervalo do ataque básico, mas os ganhos vão ficando menores. O teto de
// 32% mantém o combate legível mesmo em níveis altos.
function attackDelay(p) {
  const base = VOC[p.voc].atkSpeed;
  const haste = 0.32 * (1 - Math.exp(-(Math.max(1, p.level) - 1) / 26));
  return Math.round(base * (1 - haste));
}

const HAIR_STYLES = ['curto', 'longo', 'rabo'], HAIR_COLORS = ['preto', 'castanho', 'loiro', 'ruivo', 'branco', 'azul', 'rosa'];
function cleanApp(a) { a = a || {}; return { skin: [0, 1, 2].includes(a.skin) ? a.skin : 0, hs: HAIR_STYLES.includes(a.hs) ? a.hs : 'curto', hc: HAIR_COLORS.includes(a.hc) ? a.hc : 'castanho' }; }
function newPlayer(name, voc, pw, app) {
  const salt = crypto.randomBytes(8).toString('hex');
  const p = {
    name, voc, x: SPAWN.x, y: SPAWN.y, level: 1, maxLevel: 1, xp: 0, stats: { str: 0, mag: 0, dfs: 0, vit: 0 }, points: 0, gold: 50,
    inv: [], eq: { weapon: null, armor: 'a_cloth', helmet: null, shield: null }, app: cleanApp(app), taskIdx: 0, task: null, kills: 0, deaths: 0, salt, hash: hashPw(pw, salt)
  };
  if (voc === 'warrior') { p.eq.weapon = 'w_dagger'; p.eq.shield = 's_wood'; p.inv = [{ id: 'pot_hp', q: 8 }, { id: 'pot_mp', q: 2 }]; }
  else { p.eq.weapon = 'm_wand'; p.inv = [{ id: 'pot_hp', q: 5 }, { id: 'pot_mp', q: 6 }]; }
  p.hp = maxHp(p); p.mp = maxMp(p);
  return p;
}

function send(p, o, dropIfCongested = false) {
  if (!p.ws || p.ws.readyState !== 1) return false;
  if (dropIfCongested && p.ws.bufferedAmount > SOCKET_BACKLOG_LIMIT) return false;
  p.ws.send(JSON.stringify(o)); return true;
}
function msg(p, m, c) { send(p, { t: 'msg', m, c: c || '#fff' }); }
function broadcast(o) { const s = JSON.stringify(o); for (const p of players.values()) if (p.ws.readyState === 1) p.ws.send(s); }
function queueFx(p, f) {
  // Para um cliente atrasado, o estado mais recente importa mais que centenas
  // de faíscas antigas. A fila é curta e o servidor nunca cresce em memória.
  if (p.fx.length >= FX_QUEUE_LIMIT) p.fx.splice(0, p.fx.length - FX_QUEUE_LIMIT + 1);
  p.fx.push(f);
}
function addFx(x, y, f) {
  f.x = f.x ?? x; f.y = f.y ?? y;
  // Usa a mesma grade espacial de monstros, em vez de percorrer todos os
  // jogadores online para cada impacto.
  near(x, y, 14, 11, e => { if (e.kind === 'p') queueFx(e, f); });
}

function addItem(p, id, q = 1) {
  const it = ITEMS[id]; if (!it) return false;
  const stack = it.type === 'potion' || it.type === 'loot';
  if (stack) { const s = p.inv.find(s => s.id === id); if (s) { s.q += q; p.dirty = true; return true; } }
  if (p.inv.length >= 24) { msg(p, 'Sua mochila está cheia!', '#f66'); return false; }
  if (stack) p.inv.push({ id, q }); else for (let i = 0; i < q && p.inv.length < 24; i++) p.inv.push({ id, q: 1 });
  p.dirty = true; return true;
}
function removeAt(p, slot, q = 1) { const s = p.inv[slot]; if (!s) return; s.q -= q; if (s.q <= 0) p.inv.splice(slot, 1); p.dirty = true; }

function gainXp(p, amount) {
  p.xp += amount;
  let up = false;
  while (p.xp >= xpFor(p.level + 1)) {
    p.level++; up = true;
    if (p.level > p.maxLevel) { p.points += 1; p.maxLevel = p.level; }
  }
  if (up) {
    p.hp = maxHp(p); p.mp = maxMp(p); p.dirty = true;
    addFx(p.x, p.y, { k: 'level' });
    const aps = (1000 / attackDelay(p)).toFixed(2).replace('.', ',');
    msg(p, `Você avançou para o nível ${p.level}! Ataque básico: ${aps}/s.` + (p.points ? ` Você tem ${p.points} ponto(s) de atributo para distribuir.` : ''), '#ffd84a');
    for (const sp of SPELLS[p.voc]) if (sp.lvl === p.level) msg(p, `Nova magia aprendida: ${sp.name}!`, '#9cf');
    logEv('level', p.name, `Subiu para o nível ${p.level}`, p.ip);
  }
}

function playerDie(p, killer) {
  p.deaths++;
  addFx(p.x, p.y, { k: 'corpse', look: 'player' });
  const lost = Math.floor(p.xp * 0.08);
  p.xp -= lost;
  while (p.level > 1 && p.xp < xpFor(p.level)) p.level--;
  p.hp = maxHp(p); p.mp = maxMp(p); p.target = null; p.path = null; p.berserk = 0;
  const sp = spawnOf(regionOf(p.x)), pos = findFree(sp.x, sp.y); place(p, pos.x, pos.y);
  msg(p, `Você morreu${killer ? ' para ' + killer : ''}! Perdeu ${lost} de experiência.`, '#f55');
  logEv('death', p.name, `Morreu${killer ? ' para ' + killer : ''} (nível ${p.level})`, p.ip);
  send(p, { t: 'dead', by: killer || '' });
  p.dirty = true;
}

// ------------------------------------------------------------------ COMBATE
function canHit(a, t) {
  if (!t || t.dead || !ents.has(t.id)) return false;
  if (t.kind === 'n') return false;
  if (isTown(a.x, a.y) || isTown(t.x, t.y)) return false;
  if (a.kind === 'p' && t.kind === 'p') return a.level >= 8 && t.level >= 8 && a !== t;
  return true;
}
function damage(t, dmg, src, color) {
  if (dmg <= 0) { addFx(t.x, t.y, { k: 'puff' }); return; }
  t.hp -= dmg;
  addFx(t.x, t.y, { k: 'dmg', v: dmg, c: color || (t.kind === 'p' ? '#f33' : '#ff5050') });
  // O impacto é transmitido para todos que enxergam o combate. O dano segue
  // calculado exclusivamente no servidor; isto é apenas retorno visual.
  addFx(t.x, t.y, { k: 'hit', id: t.id, c: color || (t.kind === 'p' ? '#ff6b6b' : '#ffd1a1') });
  addFx(t.x, t.y, { k: 'blood' });
  if (t.kind === 'm') {
    if (src && src.kind === 'p') { t.dmgBy.set(src.id, (t.dmgBy.get(src.id) || 0) + dmg); if (!t.target) t.target = src.id; }
    if (t.hp <= 0) monDie(t, src);
  } else if (t.kind === 'p') {
    if (src && src.kind === 'p') { src.skull = Date.now() + 5 * 60000; t.lastPvp = src.name; }
    if (t.hp <= 0) {
      if (src && src.kind === 'p') { broadcast({ t: 'msg', m: `${t.name} foi derrotado por ${src.name}!`, c: '#f88' }); }
      playerDie(t, src ? src.name : null);
    }
  }
}
function attack(a, t, mult, color) {
  a.attackUntil = Date.now() + 300;
  addFx(a.x, a.y, { k: 'swing', tx: t.x, ty: t.y, c: color || (a.kind === 'p' ? '#ffe3a3' : '#ff9a72') });
  let atk = a.kind === 'p' ? playerAtk(a) : MON[a.type].atk;
  if (a.kind === 'p' && a.berserk > Date.now()) atk *= 1.5;
  const def = t.kind === 'p' ? playerDef(t) : MON[t.type].def;
  let dmg = Math.round(atk * mult * (0.6 + Math.random() * 0.6) - def * (0.4 + Math.random() * 0.4));
  if (t.kind === 'p' && a.kind === 'p') dmg = Math.round(dmg * 0.6);
  damage(t, Math.max(0, dmg), a, color);
}
function monDie(m, killer) {
  const def = MON[m.type];
  unplace(m); ents.delete(m.id); m.dead = true;
  addFx(m.x, m.y, { k: 'corpse', look: m.type });
  const s = m.home; s.ent = null; s.at = Date.now() + (m.type === 'dragon' ? 240000 : 25000 + Math.random() * 30000);
  const total = [...m.dmgBy.values()].reduce((a, b) => a + b, 0) || 1;
  let top = null, topD = -1;
  for (const [pid, d] of m.dmgBy) {
    const p = players.get(pid); if (!p) continue;
    const share = Math.max(1, Math.round(def.xp * XP_RATE * d / total));
    gainXp(p, share); addFx(p.x, p.y, { k: 'dmg', v: share, c: '#fff', xp: true, x: p.x, y: p.y });
    if (d > topD) { topD = d; top = p; }
    if (p.task && p.task.mon === m.type && p.task.k < p.task.n) { p.task.k++; p.dirty = true; if (p.task.k === p.task.n) msg(p, `Missão concluída! Volte ao Mestre Aldo.`, '#9f9'); }
  }
  if (top) {
    top.kills++;
    const got = [];
    const g = def.gold[0] + Math.floor(Math.random() * (def.gold[1] - def.gold[0] + 1));
    if (g > 0) { top.gold += g; got.push(g + ' moedas de ouro'); }
    for (const [id, ch] of def.loot) if (Math.random() < ch && addItem(top, id)) got.push(ITEMS[id].name);
    msg(top, `Loot de ${def.name}: ${got.length ? got.join(', ') : 'nada'}.`, '#bbb');
    top.dirty = true;
  }
}

// ------------------------------------------------------------------ MOVIMENTO / PATH
function tryMove(e, d, forMon) {
  e.dir = d; const nx = e.x + DX[d], ny = e.y + DY[d];
  if (!free(nx, ny, forMon)) return false;
  place(e, nx, ny); return true;
}
function bfsStep(from, tx, ty, maxNodes = 2500, stopAdj = false) {
  const start = from.y * TW + from.x, goal = ty * TW + tx;
  const prev = new Map([[start, -1]]); const q = [start]; let qi = 0;
  while (qi < q.length && prev.size < maxNodes) {
    const cur = q[qi++]; const cx = cur % TW, cy = (cur / TW) | 0;
    if (cur === goal || (stopAdj && Math.max(Math.abs(cx - tx), Math.abs(cy - ty)) <= 1)) {
      let c = cur, p = prev.get(c); if (p === -1) return -1;
      while (prev.get(p) !== -1) { c = p; p = prev.get(c); }
      const nx = c % TW, ny = (c / TW) | 0;
      for (let d = 0; d < 4; d++) if (from.x + DX[d] === nx && from.y + DY[d] === ny) return d;
      return -1;
    }
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d], ny = cy + DY[d], k = ny * TW + nx;
      if (prev.has(k)) continue;
      if (k !== goal && !free(nx, ny)) continue;
      if (k === goal && BLOCK[get(nx, ny)]) continue;
      prev.set(k, cur); q.push(k);
    }
  }
  return -1;
}
function greedyStep(m, t, forMon) {
  const dx = Math.sign(t.x - m.x), dy = Math.sign(t.y - m.y);
  const opts = [];
  if (Math.abs(t.x - m.x) >= Math.abs(t.y - m.y)) { if (dx) opts.push(dx > 0 ? 3 : 1); if (dy) opts.push(dy > 0 ? 0 : 2); }
  else { if (dy) opts.push(dy > 0 ? 0 : 2); if (dx) opts.push(dx > 0 ? 3 : 1); }
  for (const d of opts) if (tryMove(m, d, forMon)) return true;
  return false;
}

// ------------------------------------------------------------------ IA MONSTROS
function monTick(m, now) {
  if (now < m.nextAct) return;
  const def = MON[m.type];
  let tgt = m.target ? players.get(m.target) : null;
  if (tgt && (isTown(tgt.x, tgt.y) || cheb(m, tgt) > 10 || tgt.safeUntil > now)) tgt = null;
  if (!tgt && !def.passive) {
    let best = 7;
    // Antes este ponto comparava cada monstro ativo com todos os jogadores.
    // Em mil conexões, uma briga local podia virar milhões de comparações por
    // segundo. A busca espacial só visita quem está dentro do raio de aggro.
    near(m.x, m.y, 6, 6, p => { const d = p.kind === 'p' ? cheb(m, p) : 99; if (d < best && !isTown(p.x, p.y) && !(p.safeUntil > now)) { best = d; tgt = p; } });
  }
  m.target = tgt ? tgt.id : null;
  if (tgt && !def.passive) {
    const d = cheb(m, tgt), range = def.range || 1;
    if (d <= range && now >= m.nextAtk) {
      m.dir = Math.abs(tgt.x - m.x) > Math.abs(tgt.y - m.y) ? (tgt.x > m.x ? 3 : 1) : (tgt.y > m.y ? 0 : 2);
      if (def.proj) addFx(m.x, m.y, { k: 'proj', tx: tgt.x, ty: tgt.y, fx: def.proj });
      attack(m, tgt, 1);
      m.nextAtk = now + (def.big ? 1800 : 1500);
    }
    if (d > range || (range > 1 && d <= 1 && Math.random() < 0.3)) greedyStep(m, tgt, true);
    m.nextAct = now + def.spd;
  } else {
    if (Math.random() < 0.5) {
      const h = m.home; let d = Math.random() * 4 | 0;
      if (Math.abs(m.x - h.x) > 5 || Math.abs(m.y - h.y) > 5) d = Math.abs(m.x - h.x) > Math.abs(m.y - h.y) ? (h.x > m.x ? 3 : 1) : (h.y > m.y ? 0 : 2);
      tryMove(m, d, true);
    }
    m.nextAct = now + def.spd * (1.5 + Math.random() * 2);
  }
}

// ------------------------------------------------------------------ TICK JOGADOR
// Um passo na direção d. Retorna true (andou), 'portal' (atravessou), um monstro (encostou) ou false.
function walkStep(p, d, now) {
  p.path = null;
  const nx = p.x + DX[d], ny = p.y + DY[d], pt = portalAt(nx, ny);
  if (pt && p.level < REGIONS[pt.to].lvl) {        // portal trancado pelo nível
    p.dir = d; p.nextMove = now + 400;
    if (now - (p.portalMsg || 0) > 3000) { p.portalMsg = now; msg(p, `Este portal leva a ${REGIONS[pt.to].name}. Você precisa do nível ${REGIONS[pt.to].lvl}.`, '#f88'); }
    return false;
  }
  if (tryMove(p, d)) { p.nextMove = now + stepTime(p); if (pt) { portalTravel(p, pt); return 'portal'; } return true; }
  p.dir = d; const e = occ.get(ny * TW + nx);
  if (e && e.kind === 'm' && !isTown(p.x, p.y)) { p.target = e.id; p.autoTarget = true; return e; }
  return false;
}
function playerTick(p, now) {
  if (now - p.lastRegen >= 2000) {
    p.lastRegen = now;
    const mh = maxHp(p), mm = maxMp(p), town = isTown(p.x, p.y) ? 2 : 1;
    p.hp = Math.min(mh, p.hp + Math.ceil(mh * 0.012) * town + 1);
    p.mp = Math.min(mm, p.mp + Math.ceil(mm * 0.02) * town + 1);
  }
  let t = p.target ? ents.get(p.target) : null;
  if (p.target && (!t || t.dead || (t.kind === 'p' && !canHit(p, t)) || cheb(p, t) > 12)) { p.target = null; t = null; }
  const range = VOC[p.voc].range;
  // alvo automático só enquanto o monstro está ENCOSTADO; se ele se afastar, o alvo some
  if (t && p.autoTarget && cheb(p, t) > 1) { p.target = null; p.autoTarget = false; t = null; }
  if (!t && !isTown(p.x, p.y)) {
    for (const [dx, dy] of [[0, 1], [-1, 0], [0, -1], [1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const e = occ.get((p.y + dy) * TW + p.x + dx);
      if (e && e.kind === 'm' && !MON[e.type].passive) { p.target = e.id; p.autoTarget = true; t = e; break; }
    }
  }
  // segurança: se o celular parar de mandar "andar", o personagem para sozinho
  if (p.walkDir >= 0 && now - (p.walkAt || 0) > 1500) p.walkDir = -1;   // 1,5 s: tolera oscilação da internet móvel
  if (now >= p.nextMove) {
    // anda com o controle; ao soltar, termina os passos que o celular já mostrou (stopAt),
    // para a posição do servidor e a da tela baterem sem "puxão" para trás
    let d = p.walkDir;
    if (d < 0 && p.stopAt) {
      if ((p.x === p.stopAt.x && p.y === p.stopAt.y) || p.stopAt.n <= 0) p.stopAt = null;
      else { d = p.stopAt.d; p.stopAt.n--; }
    }
    if (d >= 0) {
      const r = walkStep(p, d, now);
      if (r === 'portal') return;
      if (r && r.kind) t = r;                     // encostou num monstro: vira alvo
      if (r === false) p.stopAt = null;
    }
    // o personagem NUNCA anda sozinho: sem perseguição automática nem caminho automático
  }
  if (t && now >= p.nextAtk && cheb(p, t) <= range && canHit(p, t)) {
    p.dir = Math.abs(t.x - p.x) > Math.abs(t.y - p.y) ? (t.x > p.x ? 3 : 1) : (t.y > p.y ? 0 : 2);
    if (p.voc === 'wizard') addFx(p.x, p.y, { k: 'proj', tx: t.x, ty: t.y, fx: 'arcane' });
    else addFx(t.x, t.y, { k: 'slash' });
    attack(p, t, 1);
    p.nextAtk = now + attackDelay(p);
  }
}

// ------------------------------------------------------------------ AÇÕES
function castSpell(p, id) {
  const sp = SPELLS[p.voc].find(s => s.id === id); if (!sp) return;
  const now = Date.now();
  if (p.level < sp.lvl) return msg(p, `Você precisa do nível ${sp.lvl} para usar ${sp.name}.`, '#f88');
  if ((p.cds[id] || 0) > now) return;
  if (p.mp < sp.mp) return msg(p, 'Mana insuficiente.', '#88f');
  let t = p.target ? ents.get(p.target) : null;
  if ((sp.type === 'melee' || sp.type === 'target') && (!t || !canHit(p, t))) {
    let bd = 99; t = null;
    near(p.x, p.y, 8, 8, e => { if (e.kind === 'm' && !MON[e.type].passive) { const d = cheb(p, e); if (d <= (sp.range || 1) && d < bd) { bd = d; t = e; } } });
    if (t) p.target = t.id;
  }
  if (sp.type === 'melee' || sp.type === 'target') {
    const range = sp.range || 1;
    if (!t || !canHit(p, t)) return msg(p, 'Selecione um alvo primeiro.', '#f88');
    if (cheb(p, t) > range) return msg(p, 'Alvo muito longe.', '#f88');
    addFx(p.x, p.y, { k: 'cast', fx: sp.fx || 'steel' });
    if (sp.type === 'target') addFx(p.x, p.y, { k: 'proj', tx: t.x, ty: t.y, fx: sp.fx });
    else addFx(t.x, t.y, { k: 'area', fx: sp.fx || 'strike' });
    attack(p, t, sp.mult, sp.fx === 'water' ? '#66dfff' : sp.fx === 'fire' ? '#ff9a32' : sp.fx === 'earth' ? '#d7a55b' : null);
  } else if (sp.type === 'heal') {
    addFx(p.x, p.y, { k: 'cast', fx: sp.fx || 'water' });
    const v = Math.round(sp.base + sp.scale * p.level + p.stats.mag * 3);
    p.hp = Math.min(maxHp(p), p.hp + v);
    addFx(p.x, p.y, { k: 'heal', fx: sp.fx || 'water' }); addFx(p.x, p.y, { k: 'dmg', v: '+' + v, c: '#4af' });
  } else if (sp.type === 'area') {
    if (isTown(p.x, p.y)) return msg(p, 'Não é permitido atacar na cidade.', '#f88');
    addFx(p.x, p.y, { k: 'cast', fx: sp.fx || 'earth' });
    const r = sp.radius;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (!dx && !dy) continue; if (dx * dx + dy * dy > r * r + 1) continue;
      addFx(p.x + dx, p.y + dy, { k: 'area', fx: sp.fx });
      const e = occ.get((p.y + dy) * TW + p.x + dx);
      if (e && e !== p && (e.kind === 'm' || (e.kind === 'p' && p.target === e.id)) && canHit(p, e)) attack(p, e, sp.mult);
    }
  } else if (sp.type === 'buff') {
    addFx(p.x, p.y, { k: 'cast', fx: sp.fx || 'fire' });
    p.berserk = now + sp.dur; addFx(p.x, p.y, { k: 'area', fx: 'berserk' }); msg(p, 'Você entrou em fúria!', '#f84');
  }
  p.mp -= sp.mp; p.cds[id] = now + sp.cd;
}

function useItem(p, slot) {
  const s = p.inv[slot]; if (!s) return;
  const it = ITEMS[s.id];
  if (it.type === 'potion') {
    if ((p.potCd || 0) > Date.now()) return;
    p.potCd = Date.now() + 800;
    if (it.hp) { p.hp = Math.min(maxHp(p), p.hp + it.hp); addFx(p.x, p.y, { k: 'dmg', v: '+' + it.hp, c: '#4f4' }); }
    if (it.mp) { p.mp = Math.min(maxMp(p), p.mp + it.mp); addFx(p.x, p.y, { k: 'dmg', v: '+' + it.mp, c: '#68f' }); }
    addFx(p.x, p.y, { k: 'heal' });
    removeAt(p, slot);
  } else if (['weapon', 'armor', 'helmet', 'shield'].includes(it.type)) {
    if (it.voc && it.voc !== p.voc) return msg(p, `Apenas ${VOC[it.voc].name}s podem usar isso.`, '#f88');
    if (it.lvl > p.level) return msg(p, `Você precisa do nível ${it.lvl}.`, '#f88');
    const old = p.eq[it.type]; p.inv.splice(slot, 1); p.eq[it.type] = s.id;
    if (old) p.inv.push({ id: old, q: 1 });
    msg(p, `Você equipou ${it.name}.`, '#cfc');
    p.hp = Math.min(p.hp, maxHp(p)); p.mp = Math.min(p.mp, maxMp(p)); p.dirty = true;
  }
}
function nearNpc(p, kind) { let f = null; near(p.x, p.y, 3, 3, e => { if (!f && e.kind === 'n' && (!kind || e.npc.shop === kind || e.npc.id === kind)) f = e; }); return f; }

function talkNpc(p, e) {
  const n = e.npc;
  if (cheb(p, e) > 3) return msg(p, `Chegue mais perto de ${n.name} para conversar.`, '#f2c14e');
  if (n.shop) {
    send(p, { t: 'shop', npc: n.id, name: n.name, greet: n.greet, items: SHOPS[n.shop] });
  } else if (n.quest) {
    let text;
    if (!p.task) {
      const tk = TASKS[p.taskIdx];
      if (!tk) text = 'Você completou todas as minhas missões, herói! Seu nome será lembrado.';
      else { p.task = { mon: tk.mon, n: tk.n, k: 0 }; p.dirty = true; text = `Preciso da sua ajuda! Derrote ${tk.n} ${MON[tk.mon].name}(s) e volte aqui. Recompensa: ${tk.gold} ouro, ${tk.xp * XP_RATE} XP e ${tk.q ? tk.q + 'x ' : ''}${ITEMS[tk.item].name}.`; }
    } else if (p.task.k >= p.task.n) {
      const tk = TASKS[p.taskIdx];
      p.gold += tk.gold; addItem(p, tk.item, tk.q || 1); gainXp(p, tk.xp * XP_RATE);
      p.taskIdx++; p.task = null; p.dirty = true;
      text = `Excelente trabalho! Aqui está sua recompensa: ${tk.gold} ouro e ${ITEMS[tk.item].name}. Fale comigo de novo para outra missão.`;
    } else text = `Você ainda precisa derrotar ${p.task.n - p.task.k} ${MON[p.task.mon].name}(s). Não desista!`;
    send(p, { t: 'dialog', name: n.name, text });
  } else if (n.travel) {
    const here = regionOf(p.x);
    send(p, { t: 'travel', name: n.name, here, gold: p.gold, level: p.level });
  } else if (n.talk) {
    send(p, { t: 'dialog', name: n.name, text: n.talk[Math.random() * n.talk.length | 0] });
  }
}

// ------------------------------------------------------------------ REDE
function sendRegion(p, first) {
  const r = regionOf(p.x);
  p.region = r; p.known = new Map();   // cliente limpa as entidades ao trocar de região
  send(p, { t: first ? 'welcome' : 'region', id: p.id, r, ox: r * W, W, H, tiles: regionTiles[r], xpRate: XP_RATE });
}
// ------------------------------------------------------------------ PORTAIS
// Pisou no portal do fim da estrada: viaja para a terra vizinha (de graça, mas precisa do nível).
const portalAt = (x, y) => { const r = regionOf(x), lx = x - r * W; return D.portalsOf(r).find(pt => pt.x === lx && (y === pt.y || y === pt.y + 1)) || null; };
function portalTravel(p, pt) {
  const from = regionOf(p.x), to = pt.to, reg = REGIONS[to];
  // chega ao lado do portal que leva de volta, na terra de destino
  const back = D.portalsOf(to).find(q => q.to === from);
  const ax = to * W + (back ? (back.back ? back.x + 3 : back.x - 3) : CX), ay = back ? back.y : CY + 4;
  moveToRegion(p, to, ax, ay);
  msg(p, `Você atravessou o portal e chegou em ${reg.name}.`, '#d8a8ff');
}
function moveToRegion(p, to, x, y) {
  logEv('travel', p.name, `Viajou de ${REGIONS[regionOf(p.x)].name} para ${REGIONS[to].name}`, p.ip);
  send(p, { t: 'loading', to });                       // celular mostra a tela de carregamento
  p.target = null; p.goto = null; p.walkDir = -1; p.pendingNpc = null; p.dirty = true; p.autoTarget = false;
  p.safeUntil = Date.now() + 4000;                     // 4 s sem ser atacado enquanto carrega
  const pos = findFree(x, y); place(p, pos.x, pos.y);
  sendRegion(p, false);
  addFx(p.x, p.y, { k: 'level' });
}
function travel(p, to) {
  const reg = REGIONS[to], from = regionOf(p.x);
  if (!reg || to === from) return;
  if (!nearNpc(p, 'portal')) return msg(p, 'Fale com o Guardião do Portal na cidade para viajar.', '#f88');
  if (p.level < reg.lvl) return msg(p, `Você precisa do nível ${reg.lvl} para ir a ${reg.name}.`, '#f88');
  const cost = to === 0 ? 50 : reg.cost;
  if (p.gold < cost) return msg(p, `A viagem custa ${cost} ouro.`, '#f88');
  p.gold -= cost;
  const sp = spawnOf(to); moveToRegion(p, to, sp.x, sp.y);
  msg(p, `Você chegou em ${reg.town} — ${reg.name}.`, '#ffd84a');
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
// Arquivos do jogo ficam em memória, comprimidos (gzip) e com ETag:
// o celular só baixa de novo o que mudou (resposta 304 = quase instantânea).
const PUBLIC = path.join(__dirname, 'public'), fileCache = new Map();
const GZ = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.ttf']);
function loadFile(f) {
  const st = fs.statSync(f); if (!st.isFile()) throw new Error('not file');
  let c = fileCache.get(f); if (c && c.mtime === st.mtimeMs && c.size === st.size) return c;   // arquivo mudou? relê
  const data = fs.readFileSync(f), ext = path.extname(f);
  c = { mtime: st.mtimeMs, size: st.size, data, gz: GZ.has(ext) ? zlib.gzipSync(data, { level: 9 }) : null, etag: '"' + crypto.createHash('sha1').update(data).digest('base64').slice(0, 20) + '"', type: MIME[ext] || 'application/octet-stream' };
  fileCache.set(f, c); return c;
}
// ------------------------------------------------------------------ PAINEL ADMIN (/admin)
// Senha na variável ADMIN_PASSWORD. Sem ela, o painel fica desligado.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const adminTokens = new Map(), adminTries = new Map();
const onlineHist = [];   // jogadores online a cada minuto (últimas 24 h)
let peakToday = 0, peakDay = new Date().toDateString();
setInterval(() => {
  onlineHist.push([Date.now(), players.size]); if (onlineHist.length > 1440) onlineHist.shift();
  const d = new Date().toDateString(); if (d !== peakDay) { peakDay = d; peakToday = 0; }
}, 60000);
setInterval(() => { if (players.size > peakToday) peakToday = players.size; }, 5000);
function adminSend(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((ok, fail) => { let b = ''; req.on('data', c => { b += c; if (b.length > 20000) { fail(new Error('grande demais')); req.destroy(); } }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { ok({}); } }); req.on('error', fail); });
}
const sameSecret = (a, b) => { const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };
const regionName = x => REGIONS[regionOf(x)].name;
function findAny(name) {
  const key = String(name || '').trim().toLowerCase(); if (!key) return {};
  for (const o of players.values()) if (o.name.toLowerCase() === key) return { online: o, key };
  const data = loadPlayer(key); return data ? { data, key } : {};
}
async function adminApi(req, res, u) {
  try {
    if (req.method === 'OPTIONS') return adminSend(res, 204, {});
    if (!ADMIN_PASSWORD) return adminSend(res, 503, { error: 'Painel desligado: defina a variável ADMIN_PASSWORD no servidor.' });
    const ip = clientIp(req), now = Date.now(), route = u.slice('/admin/api/'.length);
    if (route === 'login' && req.method === 'POST') {
      const t = adminTries.get(ip) || []; const recent = t.filter(x => now - x < 600000);
      if (recent.length >= 8) return adminSend(res, 429, { error: 'Muitas tentativas. Espere 10 minutos.' });
      const body = await readBody(req);
      if (!sameSecret(body.password || '', ADMIN_PASSWORD)) { recent.push(now); adminTries.set(ip, recent); logEv('admin', null, 'Senha do painel incorreta', ip); return adminSend(res, 401, { error: 'Senha incorreta.' }); }
      adminTries.delete(ip);
      const token = crypto.randomBytes(24).toString('hex'); adminTokens.set(token, now + 12 * 3600e3);
      logEv('admin', null, 'Entrou no painel admin', ip);
      return adminSend(res, 200, { token });
    }
    const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), exp = adminTokens.get(tok);
    if (!exp || exp < now) { adminTokens.delete(tok); return adminSend(res, 401, { error: 'Sessão expirada. Entre de novo.' }); }
    const q = new URL(req.url, 'http://x').searchParams;
    if (req.method === 'GET') {
      if (route === 'stats') {
        const day0 = new Date(); day0.setHours(0, 0, 0, 0);
        const users = store.countPlayers(), newToday = store.countNewSince(day0.getTime()), banned = store.countBanned();
        const cnt = type => store.countLogs(type, day0.getTime());
        const byRegion = REGIONS.map(r => ({ name: r.name, n: 0 })); for (const o of players.values()) byRegion[regionOf(o.x)].n++;
        const mem = process.memoryUsage();
        return adminSend(res, 200, {
          uptime: Math.round((now - BOOT) / 1000), online: players.size, peakToday: Math.max(peakToday, players.size), users, newToday, banned,
          loginsToday: cnt('login') + cnt('create'), deathsToday: cnt('death'), chatsToday: cnt('chat'),
          monsters: [...ents.values()].filter(e => e.kind === 'm').length, byRegion,
          memMB: Math.round(mem.rss / 1048576), heapMB: Math.round(mem.heapUsed / 1048576),
          tickAvg: +(perf.sum / (perf.n || 1)).toFixed(2), tickMax: perf.max, node: process.version, storage: store.kind, persistent: store.persistent, host: process.env.VERCEL ? 'Vercel' : 'servidor próprio', xpRate: XP_RATE, history: onlineHist.slice(-180)
        });
      }
      if (route === 'online') {
        return adminSend(res, 200, [...players.values()].map(o => ({ name: o.name, voc: VOC[o.voc].name, level: o.level, hp: o.hp, mhp: maxHp(o), gold: o.gold, region: regionName(o.x), x: o.x - regionOf(o.x) * W, y: o.y, town: isTown(o.x, o.y), ip: o.ip, since: o.since, friends: o.friends.length })).sort((a, b) => b.level - a.level));
      }
      if (route === 'users') {
        const page = Math.max(0, +q.get('page') || 0), size = 50;
        const { total, rows } = store.listPlayers({ q: (q.get('q') || '').trim(), sort: q.get('sort'), filter: q.get('filter'), page, size });
        const on = new Set([...players.values()].map(o => o.name.toLowerCase()));
        for (const r of rows) { r.online = on.has(r.name.toLowerCase()); r.voc = (VOC[r.vocation] || {}).name || r.vocation; }
        return adminSend(res, 200, { total, page, size, rows });
      }
      if (route === 'user') {
        const f = findAny(q.get('name')); const d = f.online || f.data; if (!d) return adminSend(res, 404, { error: 'Jogador não encontrado.' });
        const meta = store.getMeta(f.key) || {};
        const out = {}; for (const k of SAVE_KEYS) if (k !== 'salt' && k !== 'hash') out[k] = d[k];
        out.region = regionName(d.x); out.online = !!f.online; out.vocName = (VOC[d.voc] || {}).name;
        out.invNames = (d.inv || []).map(s => `${s.q}x ${(ITEMS[s.id] || {}).name || s.id}`);
        out.eqNames = Object.fromEntries(Object.entries(d.eq || {}).map(([k, v]) => [k, v ? (ITEMS[v] || {}).name || v : null]));
        const logs = store.queryLogs({ player: d.name, limit: 60 });
        return adminSend(res, 200, { player: out, meta, logs });
      }
      if (route === 'logs') {
        return adminSend(res, 200, store.queryLogs({ limit: Math.min(500, +q.get('limit') || 200), before: +q.get('before') || 9e15, type: q.get('type') || '', q: (q.get('q') || '').trim() }));
      }
    }
    if (req.method === 'POST') {
      const b = await readBody(req);
      if (route === 'logout') { adminTokens.delete(tok); return adminSend(res, 200, { ok: true }); }
      if (route === 'broadcast') {
        const text = String(b.msg || '').trim().slice(0, 200); if (!text) return adminSend(res, 400, { error: 'Escreva a mensagem.' });
        broadcast({ t: 'msg', m: '[Aviso] ' + text, c: '#ffb347' }); logEv('admin', null, 'Aviso para todos: ' + text, ip);
        return adminSend(res, 200, { ok: true, sent: players.size });
      }
      const f = findAny(b.name); if (!f.key) return adminSend(res, 404, { error: 'Jogador não encontrado.' });
      const o = f.online, nm = o ? o.name : f.data.name;
      if (route === 'kick') {
        if (!o) return adminSend(res, 400, { error: `${nm} não está online.` });
        send(o, { t: 'err', m: 'Você foi desconectado pelo administrador.' + (b.reason ? ' Motivo: ' + b.reason : '') }); try { o.ws.close(); } catch (e) { } leave(o);
        logEv('admin', nm, 'Expulso pelo admin' + (b.reason ? ': ' + b.reason : ''), ip); return adminSend(res, 200, { ok: true });
      }
      if (route === 'ban') {
        const on = !!b.ban, reason = String(b.reason || '').slice(0, 200);
        store.setBan(f.key, on, reason);
        if (on && o) { send(o, { t: 'err', m: 'Sua conta foi bloqueada.' + (reason ? ' Motivo: ' + reason : '') }); try { o.ws.close(); } catch (e) { } leave(o); }
        logEv(on ? 'ban' : 'admin', nm, on ? 'Conta bloqueada' + (reason ? ': ' + reason : '') : 'Conta desbloqueada', ip); return adminSend(res, 200, { ok: true });
      }
      if (route === 'password') {
        const pw = String(b.pass || ''); if (pw.length < 3) return adminSend(res, 400, { error: 'Senha muito curta (mín. 3).' });
        const salt = crypto.randomBytes(8).toString('hex'), hash = hashPw(pw, salt);
        if (o) { o.salt = salt; o.hash = hash; persist(o); } else { f.data.salt = salt; f.data.hash = hash; saveData(f.data); }
        logEv('admin', nm, 'Senha redefinida pelo admin', ip); return adminSend(res, 200, { ok: true });
      }
      if (route === 'gold') {
        const amt = Math.trunc(+b.amount || 0); if (!amt || Math.abs(amt) > 1e7) return adminSend(res, 400, { error: 'Valor inválido.' });
        if (o) { o.gold = Math.max(0, o.gold + amt); o.dirty = true; persist(o); msg(o, `O administrador ${amt > 0 ? 'enviou' : 'retirou'} ${Math.abs(amt)} de ouro.`, '#ffd84a'); }
        else { f.data.gold = Math.max(0, (f.data.gold || 0) + amt); saveData(f.data); }
        logEv('admin', nm, `${amt > 0 ? 'Recebeu' : 'Perdeu'} ${Math.abs(amt)} de ouro (admin)`, ip); return adminSend(res, 200, { ok: true });
      }
      if (route === 'message') {
        if (!o) return adminSend(res, 400, { error: `${nm} não está online.` });
        const text = String(b.msg || '').trim().slice(0, 200); if (!text) return adminSend(res, 400, { error: 'Escreva a mensagem.' });
        msg(o, '[Admin] ' + text, '#ffb347'); logEv('admin', nm, 'Mensagem do admin: ' + text, ip); return adminSend(res, 200, { ok: true });
      }
    }
    return adminSend(res, 404, { error: 'Rota desconhecida.' });
  } catch (e) { console.error('admin', e); return adminSend(res, 500, { error: 'Erro no servidor: ' + e.message }); }
}
const server = http.createServer((req, res) => {
  try {
    let u = decodeURIComponent(req.url.split('?')[0]);
    const viaR = new URL(req.url, 'http://x').searchParams.get('r');   // ex.: /api/server?r=health (Vercel)
    if (viaR) u = '/' + viaR.replace(/^\/+/, '');
    if (u === '/' || u === '/api/server') u = '/index.html';
    if (u === '/admin' || u === '/admin/') u = '/admin/index.html';
    if (u.startsWith('/admin/api/')) return adminApi(req, res, u);
    if (u === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); return res.end('ok ' + players.size); }
    const f = path.join(PUBLIC, path.normalize(u).replace(/^(\.\.[\/\\])+/, ''));
    if (!f.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    let c; try { c = loadFile(f); } catch (e) { res.writeHead(404); return res.end('404'); }
    const headers = { 'Content-Type': c.type, ETag: c.etag, 'Cache-Control': u.startsWith('/assets/') ? 'public, max-age=3600' : 'no-cache', Vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === c.etag) { res.writeHead(304, headers); return res.end(); }
    if (c.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { headers['Content-Encoding'] = 'gzip'; res.writeHead(200, headers); return res.end(c.gz); }
    res.writeHead(200, headers); res.end(c.data);
  } catch (e) { console.error('http', e); try { res.writeHead(500); res.end(); } catch (_) { } }
});
// ALLOWED_ORIGINS (opcional): endereços do jogo que podem conectar, ex.: https://piper.vercel.app,https://jogo.seudominio.com.br
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
const wss = new WebSocketServer({ server, perMessageDeflate: false, maxPayload: 16 * 1024,
  verifyClient: info => !ALLOWED.length || !info.origin || ALLOWED.includes(info.origin) || info.origin === 'https://' + info.req.headers.host });

wss.on('connection', (ws, req) => {
  let p = null; const ip = clientIp(req);
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  let loggingIn = false;
  ws.on('message', raw => { onMessage(raw).catch(e => console.error('msg', e)); });
  async function onMessage(raw) {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!p) {
      if (m.t !== 'login') return;
      const name = String(m.name || '').trim().replace(/\s+/g, ' ');
      const pw = String(m.pass || '');
      if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{2,15}$/.test(name)) return ws.send(JSON.stringify({ t: 'err', m: 'Nome inválido (3-16 letras).' }));
      if (pw.length < 3) return ws.send(JSON.stringify({ t: 'err', m: 'Senha muito curta (mín. 3).' }));
      const key = name.toLowerCase();
      if (loggingIn) return; loggingIn = true;
      try { await store.refreshPlayer(key); } finally { loggingIn = false; }
      if (p || ws.readyState !== 1) return;
      let data = loadPlayer(key);
      if (m.create) {
        if (data) return ws.send(JSON.stringify({ t: 'err', m: 'Esse nome já está em uso. Escolha outro.' }));
        if (!VOC[m.voc]) return ws.send(JSON.stringify({ t: 'err', m: 'Escolha uma vocação.' }));
        data = newPlayer(name, m.voc, pw, m.app);
      } else {
        if (!data) return ws.send(JSON.stringify({ t: 'err', m: 'Personagem não encontrado. Crie um novo personagem.' }));
        if (hashPw(pw, data.salt) !== data.hash) { logEv('auth', data.name, 'Senha incorreta', ip); return ws.send(JSON.stringify({ t: 'err', m: 'Senha incorreta para este personagem.' })); }
        const meta = store.getMeta(key);
        if (meta && meta.banned) { logEv('auth', data.name, 'Tentou entrar, mas a conta está bloqueada', ip); return ws.send(JSON.stringify({ t: 'err', m: 'Esta conta foi bloqueada.' + (meta.ban_reason ? ' Motivo: ' + meta.ban_reason : '') })); }
      }
      for (const o of players.values()) if (o.name.toLowerCase() === key) { send(o, { t: 'err', m: 'Conectado em outro lugar.' }); o.ws.close(); leave(o); }
      p = Object.assign({}, data, { id: nextId++, kind: 'p', ws, dir: 0, walkDir: -1, nextMove: 0, nextAtk: 0, lastRegen: Date.now(), cds: {}, fx: [], dirty: true, target: null, skull: 0, berserk: 0 });
      p.stats = Object.assign({ str: 0, mag: 0, dfs: 0, vit: 0 }, p.stats); p.app = cleanApp(p.app);
      p.friends = Array.isArray(p.friends) ? p.friends.filter(n => typeof n === 'string').slice(0, FRIEND_MAX) : []; p.reqs = new Set(); p.frSent = 0; p.frDirty = true;
      const pos = p.x >= 0 && p.x < TW && walkable(p.x, p.y) ? findFree(p.x, p.y) : findFree(SPAWN.x, SPAWN.y);
      place(p, pos.x, pos.y); ents.set(p.id, p); players.set(p.id, p); persist(p);
      sendRegion(p, true);
      msg(p, `Bem-vindo(a) a As Aventuras do Piper, ${p.name}! Fale com o Mestre Aldo (no centro da cidade) para missões.`, '#ffd84a');
      broadcast({ t: 'msg', m: `${p.name} entrou no jogo.`, c: '#8c8' });
      p.ip = ip; p.since = Date.now(); store.touchLogin(key, ip);
      logEv(m.create ? 'create' : 'login', p.name, m.create ? `Criou o personagem (${VOC[p.voc].name})` : `Entrou no jogo (nível ${p.level}, ${REGIONS[regionOf(p.x)].name})`, ip);
      return;
    }
    switch (m.t) {
      case 'walk': {
        const now = Date.now(), d = [0, 1, 2, 3].includes(m.d) ? m.d : -1, last = p.walkDir;
        p.walkDir = d; p.walkAt = now;
        if (d >= 0) { p.stopAt = null; if (now >= p.nextMove) walkStep(p, d, now); }
        else if (last >= 0 && Number.isInteger(m.x) && Number.isInteger(m.y)) {
          // parou: se o celular mostrou o personagem até 3 passos à frente nessa mesma direção, completa os passos
          const dx = m.x - p.x, dy = m.y - p.y, n = Math.abs(dx) + Math.abs(dy);
          if (n > 0 && n <= 3 && (dx === 0 || dy === 0) && DX[last] * Math.sign(dx) + DY[last] * Math.sign(dy) === 1) p.stopAt = { x: m.x, y: m.y, d: last, n };
        }
        break;
      }
      case 'goto': break; // removido: o personagem só anda pelo controle do jogador
      case 'target': {
        const e = ents.get(m.id);
        if (!e || e === p) { p.target = null; break; }
        if (e.kind === 'n') { talkNpc(p, e); break; }
        if (e.kind === 'p' && !canHit(p, e)) { msg(p, isTown(p.x, p.y) || isTown(e.x, e.y) ? 'Não é permitido atacar na cidade.' : 'PvP só é permitido entre jogadores de nível 8+.', '#f88'); break; }
        if (isTown(p.x, p.y)) { msg(p, 'Você está em zona protegida.', '#f88'); }
        p.target = p.target === e.id ? null : e.id; p.autoTarget = false; break;
      }
      case 'nearest': {
        let best = null, bd = 99;
        near(p.x, p.y, 8, 8, e => { if (e.kind === 'm' && !MON[e.type].passive) { const d = cheb(p, e); if (d < bd) { bd = d; best = e; } } });
        if (best) { p.target = best.id; p.autoTarget = false; } break;
      }
      case 'spell': castSpell(p, String(m.s)); break;
      case 'travel': travel(p, m.to | 0); break;
      case 'use': useItem(p, m.slot | 0); break;
      case 'quick': { const ids = m.k === 'hp' ? ['pot_hp2', 'pot_hp'] : ['pot_mp2', 'pot_mp'];
        const want = m.k === 'hp' ? (maxHp(p) - p.hp > 200 ? ids : ids.slice().reverse()) : (maxMp(p) - p.mp > 150 ? ids : ids.slice().reverse());
        for (const id of want) { const i = p.inv.findIndex(s => s.id === id); if (i >= 0) { useItem(p, i); break; } } break; }
      case 'unequip': { const slot = m.slot; if (p.eq[slot] && p.inv.length < 24) { p.inv.push({ id: p.eq[slot], q: 1 }); p.eq[slot] = null; p.hp = Math.min(p.hp, maxHp(p)); p.dirty = true; } break; }
      case 'stat': if (STATS[m.s] && p.points > 0) { p.points--; p.stats[m.s]++; p.dirty = true; } break;
      case 'buy': {
        const e = nearNpc(p); if (!e || !e.npc.shop) return msg(p, 'Fique perto do vendedor.', '#f88');
        const id = m.item, q = Math.max(1, Math.min(100, m.q | 0 || 1));
        if (!SHOPS[e.npc.shop].includes(id)) return;
        const cost = ITEMS[id].price * q;
        if (p.gold < cost) return msg(p, 'Ouro insuficiente.', '#f88');
        if (addItem(p, id, q)) { p.gold -= cost; msg(p, `Você comprou ${q}x ${ITEMS[id].name} por ${cost} ouro.`, '#cfc'); }
        break;
      }
      case 'sell': {
        const e = nearNpc(p); if (!e || !e.npc.shop) return msg(p, 'Fique perto de um comerciante.', '#f88');
        const s = p.inv[m.slot | 0]; if (!s) break;
        const q = m.all ? s.q : 1, v = D.sellPrice(s.id) * q;
        p.gold += v; msg(p, `Você vendeu ${q}x ${ITEMS[s.id].name} por ${v} ouro.`, '#cfc'); removeAt(p, m.slot | 0, q);
        break;
      }
      case 'friendAdd': friendAdd(p, m.name); break;
      case 'friendAnswer': friendAnswer(p, m.name, !!m.ok); break;
      case 'friendDel': friendDel(p, m.name); break;
      case 'chat': {
        const text = String(m.m || '').slice(0, 140).trim(); if (!text) break;
        if (text === '/online') { msg(p, 'Online: ' + [...players.values()].map(o => `${o.name} (${o.level})`).join(', '), '#9cf'); break; }
        broadcast({ t: 'chat', id: p.id, name: p.name, lv: p.level, m: text }); logEv('chat', p.name, text, p.ip);
        break;
      }
    }
  }
  ws.on('close', () => { if (p) leave(p); });
  ws.on('error', () => { });
});
// derruba conexões mortas (celular que perdeu sinal) para não deixar "fantasmas"
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch (e) { } } }, 25000);
function leave(p) {
  if (!players.has(p.id)) return;
  persist(p); saveDb();
  const secs = Math.round((Date.now() - (p.since || Date.now())) / 1000);
  try { store.addPlayTime(p.name.toLowerCase(), secs); } catch (e) { }
  logEv('logout', p.name, `Saiu do jogo (jogou ${Math.floor(secs / 60)} min)`, p.ip);
  unplace(p); ents.delete(p.id); players.delete(p.id);
  broadcast({ t: 'msg', m: `${p.name} saiu do jogo.`, c: '#888' });
}

// ------------------------------------------------------------------ AMIGOS
// Amizade é dos dois lados: um pede, o outro aceita. Só amigos veem a posição um do outro no mapa.
const FRIEND_MAX = 50;
const onlineByName = n => { const k = String(n || '').toLowerCase(); for (const o of players.values()) if (o.name.toLowerCase() === k) return o; return null; };
const hasFriend = (p, n) => p.friends.some(f => f.toLowerCase() === String(n).toLowerCase());
// altera a lista de um jogador esteja ele online ou não (offline: direto no banco)
function editFriends(name, fn) {
  const o = onlineByName(name);
  if (o) { fn(o.friends); o.frDirty = true; persist(o); return true; }
  const d = loadPlayer(String(name).toLowerCase()); if (!d) return false;
  d.friends = Array.isArray(d.friends) ? d.friends : []; fn(d.friends); saveData(d); return true;
}
function friendAdd(p, raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 16);
  if (!name) return;
  if (name.toLowerCase() === p.name.toLowerCase()) return msg(p, 'Você não pode adicionar a si mesmo.', '#f88');
  if (hasFriend(p, name)) return msg(p, `${name} já é seu amigo.`, '#f2c14e');
  if (p.friends.length >= FRIEND_MAX) return msg(p, `Limite de ${FRIEND_MAX} amigos.`, '#f88');
  const now = Date.now(); if (now - p.frSent < 1500) return; p.frSent = now;   // evita spam de pedidos
  const o = onlineByName(name);
  if (!o) return msg(p, loadPlayer(name.toLowerCase()) ? `${name} não está online. O pedido só chega para quem está jogando.` : `Jogador "${name}" não encontrado.`, '#f88');
  if (p.reqs.has(o.name)) return friendAnswer(p, o.name, true);   // os dois pediram: vira amizade na hora
  if (o.friends.length >= FRIEND_MAX) return msg(p, `${o.name} já tem amigos demais.`, '#f88');
  o.reqs.add(p.name); send(o, { t: 'freq', from: p.name, lv: p.level });
  msg(p, `Pedido de amizade enviado para ${o.name}.`, '#8c8');
}
function friendAnswer(p, raw, ok) {
  const name = [...p.reqs].find(n => n.toLowerCase() === String(raw || '').toLowerCase()); if (!name) return;
  p.reqs.delete(name);
  const o = onlineByName(name);
  if (!ok) { if (o) msg(o, `${p.name} recusou seu pedido de amizade.`, '#aaa'); return; }
  if (p.friends.length >= FRIEND_MAX) return msg(p, `Limite de ${FRIEND_MAX} amigos.`, '#f88');
  if (!hasFriend(p, name)) p.friends.push(name);
  editFriends(name, list => { if (!list.some(f => f.toLowerCase() === p.name.toLowerCase())) list.push(p.name); });
  p.frDirty = true; persist(p);
  msg(p, `Você e ${name} agora são amigos! Ele aparece como ponto verde no mapa.`, '#5f5');
  logEv('friend', p.name, `Agora é amigo de ${name}`, p.ip);
  if (o) msg(o, `${p.name} aceitou seu pedido. Vocês agora são amigos!`, '#5f5');
}
function friendDel(p, raw) {
  const name = p.friends.find(f => f.toLowerCase() === String(raw || '').toLowerCase()); if (!name) return;
  p.friends = p.friends.filter(f => f !== name); p.frDirty = true; persist(p);
  editFriends(name, list => { const i = list.findIndex(f => f.toLowerCase() === p.name.toLowerCase()); if (i >= 0) list.splice(i, 1); });
  msg(p, `${name} foi removido dos amigos.`, '#aaa');
}
// a cada segundo, cada jogador recebe onde estão seus amigos online
let lastFriendSync = 0;
function friendSync(now) {
  if (now - lastFriendSync < 1000) return; lastFriendSync = now;
  const by = new Map(); for (const o of players.values()) by.set(o.name.toLowerCase(), o);
  for (const p of players.values()) {
    if (!p.friends.length && !p.frDirty) continue;
    const l = p.friends.map(n => { const o = by.get(n.toLowerCase()); return o ? [n, 1, regionOf(o.x), o.x - regionOf(o.x) * W, o.y, o.level] : [n, 0]; });
    send(p, { t: 'fr', l }); p.frDirty = false;
  }
}

// ------------------------------------------------------------------ LOOP
// Só processa o que está perto de algum jogador. Sem jogadores, o servidor quase não gasta CPU.
let lastSpawnCheck = 0;
function tick() {
  const now = Date.now();
  if (now - lastSpawnCheck > 1000) { lastSpawnCheck = now; for (const s of spawns) if (!s.ent && now >= s.at) spawnMon(s); }
  if (!players.size) return;
  const awake = new Set();
  for (const p of players.values()) near(p.x, p.y, 18, 18, e => { if (e.kind === 'm') awake.add(e); });
  for (const e of awake) if (!e.dead) monTick(e, now);
  for (const p of players.values()) playerTick(p, now);
  friendSync(now);
  // enviar estado (só entidades na tela de cada jogador)
  // Em lotação alta, 4–6 atualizações/s continuam suaves graças à interpolação
  // do cliente e reduzem bastante CPU, banda e pressão nos WebSockets.
  const snapshotEvery = players.size >= 750 ? 250 : players.size >= 350 ? 200 : players.size >= 120 ? 150 : 100;
  for (const p of players.values()) {
    if (p.nextSnapshot && now < p.nextSnapshot) continue;
    p.nextSnapshot = now + snapshotEvery;
    // Nome e aparência só vão quando a criatura aparece ou muda (economiza internet do celular)
    const nearby = [];
    near(p.x, p.y, 12, 9, e => nearby.push(e));
    // Em hubs cheios, conserva o próprio jogador, alvo e NPCs antes dos mais
    // próximos. A lógica do servidor não é afetada — isso só limita a visão.
    if (nearby.length > VIEW_ENTITY_LIMIT) {
      const rank = e => (e.id === p.id ? -10000 : e.id === p.target ? -9000 : e.kind === 'n' ? -5000 : 0) + Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
      nearby.sort((a, b) => rank(a) - rank(b));
      nearby.length = VIEW_ENTITY_LIMIT;
    }
    const list = [], known = p.known || (p.known = new Map()), seen = new Set();
    for (const e of nearby) {
      const hpPct = e.kind === 'n' ? 100 : Math.max(0, Math.round(100 * e.hp / (e.kind === 'p' ? maxHp(e) : e.mhp)));
      let look = e.look;
      if (e.kind === 'p') look = ['c', e.voc, e.eq.armor || '', e.eq.helmet || '', e.eq.weapon || '', e.eq.shield || '', e.app.skin, e.app.hs, e.app.hc, ''].join('|');
      const attackMs = Math.max(0, (e.attackUntil || 0) - now);
      seen.add(e.id);
      const sig = look + '\n' + e.name, fresh = known.get(e.id) !== sig;
      if (fresh) known.set(e.id, sig);
      list.push([e.id, e.kind, e.x, e.y, e.dir, fresh ? look : 0, fresh ? e.name : 0, hpPct, e.kind === 'p' ? (e.skull > now ? 1 : 0) | (e.berserk > now ? 2 : 0) : 0, e.kind === 'p' ? e.level : 0, attackMs]);
    }
    for (const id of known.keys()) if (!seen.has(id)) known.delete(id);
    const cds = {}; for (const k in p.cds) if (p.cds[k] > now) cds[k] = p.cds[k] - now;
    const me = { x: p.x, y: p.y, hp: p.hp, mhp: maxHp(p), mp: p.mp, mmp: maxMp(p), lv: p.level, xp: p.xp, xpa: xpFor(p.level), xpb: xpFor(p.level + 1), gold: p.gold, tg: p.target, cds, voc: p.voc, town: isTown(p.x, p.y), r: regionOf(p.x), berserk: Math.max(0, p.berserk - now), atkDelay: attackDelay(p) };
    if (p.dirty) { Object.assign(me, { inv: p.inv, eq: p.eq, st: p.stats, pts: p.points, atk: Math.round(playerAtk(p)), def: Math.round(playerDef(p)), task: p.task, name: p.name }); p.dirty = false; }
    // Se o navegador estiver atrasado, a próxima foto será completa e com
    // aparências reanunciadas; nunca acumulamos uma fila infinita de estados.
    if (!send(p, { t: 's', me, e: list, fx: p.fx }, true)) p.known = new Map();
    p.fx = [];
  }
}
// Loop do jogo com medição: a cada minuto mostra no log do Render quanto tempo cada tick levou.
const perf = { n: 0, sum: 0, max: 0, late: 0 }; let lastTickAt = Date.now();
setInterval(() => {
  const t0 = Date.now(); if (t0 - lastTickAt > TICK * 2) perf.late++; lastTickAt = t0;
  try { tick(); } catch (e) { console.error('tick', e); }
  const dt = Date.now() - t0; perf.n++; perf.sum += dt; if (dt > perf.max) perf.max = dt;
}, TICK);
setInterval(() => {
  if (players.size) console.log(`[desempenho] jogadores=${players.size} tick médio=${(perf.sum / (perf.n || 1)).toFixed(1)}ms máx=${perf.max}ms atrasos=${perf.late} memória=${(process.memoryUsage().rss / 1048576).toFixed(0)}MB`);
  perf.n = perf.sum = perf.max = perf.late = 0;
}, 60000);
// Render (plano free) desliga o servidor após 15 min sem acesso, e o próximo jogador espera ~1 min.
// O servidor acessa o próprio endereço a cada 10 min para continuar acordado.
// Para desligar: variável KEEP_AWAKE=0 no Render.
if (process.env.RENDER_EXTERNAL_URL && process.env.KEEP_AWAKE !== '0') {
  const https = require('https'), url = process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '') + '/health';
  setInterval(() => { https.get(url, r => r.resume()).on('error', () => { }); }, 10 * 60 * 1000);
  console.log('Mantendo o servidor acordado: ' + url);
}
process.on('uncaughtException', e => { console.error('erro não tratado (servidor continua):', e); logEv('error', null, String(e && e.stack || e)); });
process.on('unhandledRejection', e => console.error('promessa rejeitada:', e));

setInterval(() => { for (const p of players.values()) persist(p); saveDb(); }, 30000);
async function shutdown() { for (const p of players.values()) persist(p); try { await Promise.race([store.flushAsync(), new Promise(r => setTimeout(r, 4000))]); } catch (e) { } process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

logEv('start', null, `Servidor iniciado (Node ${process.version})` + (ADMIN_PASSWORD ? '' : ' — painel admin desligado: defina ADMIN_PASSWORD'));
server.on('error', e => { console.error('Não foi possível abrir a porta ' + PORT + ':', e.message); process.exit(1); });
wss.on('error', e => { console.error('Não foi possível abrir a porta ' + PORT + ':', e.message); process.exit(1); });   // o ws repassa o erro da porta para cá
if (process.env.VERCEL) {
  // Na Vercel o servidor é uma função (api/server.js). Cada conexão dura no máximo 5 min (plano grátis):
  // antes disso o servidor pede ao celular para reconectar sozinho, sem o jogador perceber.
  const RENEW_MS = (+process.env.WS_RENEW_SECONDS || 270) * 1000;
  wss.on('connection', ws => { const t = setTimeout(() => { try { ws.send(JSON.stringify({ t: 'renew' })); ws.close(4000, 'renew'); } catch (e) { } }, RENEW_MS); ws.on('close', () => clearTimeout(t)); });
  console.log(`As Aventuras do Piper rodando na Vercel (pronto em ${Date.now() - BOOT} ms)`);
} else {
  store.ready.then(() => server.listen(PORT, '0.0.0.0', () => console.log(`As Aventuras do Piper rodando em http://localhost:${PORT} (pronto em ${Date.now() - BOOT} ms)`)));
}
module.exports = server;
