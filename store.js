// Armazenamento dos jogadores e do log — As Aventuras do Piper
// Escolhe sozinho onde guardar, para o jogo rodar em qualquer lugar:
//   • Redis (Upstash) — quando existem as variáveis KV_REST_API_URL/KV_REST_API_TOKEN
//     ou UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN. Usado na Vercel (não há disco).
//   • SQLite (arquivo data/players.sqlite) — computador, VPS/Docker, Render.
//   • Memória — último recurso (ex.: Vercel sem Redis). Funciona, mas apaga tudo ao reiniciar.
// Para forçar: STORAGE=sqlite | redis | memory
'use strict';
const fs = require('fs'), path = require('path');

const LOG_KEEP_MS = 60 * 864e5;   // log guardado por 60 dias
const META_DEFAULT = () => ({ created_at: new Date().toISOString(), last_login: null, last_ip: null, logins: 0, play_seconds: 0, banned: 0, ban_reason: null });
const levelOf = d => (d && d.level) || 1;

function createStore({ dataDir }) {
  const want = String(process.env.STORAGE || '').toLowerCase();
  const rUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL, rTok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (want === 'redis' || (!want && rUrl && rTok)) {
    if (!rUrl || !rTok) throw new Error('STORAGE=redis, mas faltam KV_REST_API_URL e KV_REST_API_TOKEN');
    return memoryStore({ redis: { url: rUrl.replace(/\/$/, ''), token: rTok } });
  }
  if (want !== 'memory' && !process.env.VERCEL) {
    try { return sqliteStore(dataDir); }
    catch (e) { console.error('[armazenamento] SQLite indisponível (' + e.message + '). Usando memória: os dados se perdem ao reiniciar.'); }
  }
  if (process.env.VERCEL) console.warn('[armazenamento] Vercel sem Redis: os personagens ficam só na memória e se perdem quando o servidor reinicia. Conecte o Upstash Redis (veja VERCEL.md).');
  return memoryStore({});
}

// ===================================================================== SQLite
function sqliteStore(dataDir) {
  const Database = require('better-sqlite3');
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'players.sqlite'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      username TEXT PRIMARY KEY COLLATE NOCASE, name TEXT NOT NULL, vocation TEXT NOT NULL,
      password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, data_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_players_name ON players(name COLLATE NOCASE);
    CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, type TEXT NOT NULL, player TEXT, ip TEXT, msg TEXT);
    CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts);
    CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type, ts);
    CREATE INDEX IF NOT EXISTS idx_logs_player ON logs(player COLLATE NOCASE, ts);`);
  const cols = new Set(db.prepare('PRAGMA table_info(players)').all().map(c => c.name));
  for (const [c, def] of [['last_login', 'TEXT'], ['last_ip', 'TEXT'], ['logins', 'INTEGER NOT NULL DEFAULT 0'], ['play_seconds', 'INTEGER NOT NULL DEFAULT 0'], ['banned', 'INTEGER NOT NULL DEFAULT 0'], ['ban_reason', 'TEXT']])
    if (!cols.has(c)) db.exec(`ALTER TABLE players ADD COLUMN ${c} ${def}`);
  const q = {
    get: db.prepare('SELECT data_json FROM players WHERE username = ?'),
    upsert: db.prepare(`INSERT INTO players (username, name, vocation, password_salt, password_hash, data_json) VALUES (@username, @name, @voc, @salt, @hash, @data)
      ON CONFLICT(username) DO UPDATE SET name = excluded.name, vocation = excluded.vocation, password_salt = excluded.password_salt,
      password_hash = excluded.password_hash, data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP`),
    meta: db.prepare('SELECT created_at, last_login, last_ip, logins, play_seconds, banned, ban_reason FROM players WHERE username = ?'),
    touch: db.prepare('UPDATE players SET last_login = ?, last_ip = ?, logins = logins + 1 WHERE username = ?'),
    play: db.prepare('UPDATE players SET play_seconds = play_seconds + ? WHERE username = ?'),
    ban: db.prepare('UPDATE players SET banned = ?, ban_reason = ? WHERE username = ?'),
    log: db.prepare('INSERT INTO logs (ts, type, player, ip, msg) VALUES (?, ?, ?, ?, ?)'),
    count: db.prepare('SELECT COUNT(*) n FROM players')
  };
  const prune = () => { try { db.prepare('DELETE FROM logs WHERE ts < ?').run(Date.now() - LOG_KEEP_MS); } catch (e) { } };
  prune(); setInterval(prune, 864e5).unref();
  const sqlTime = ts => new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
  const store = {
    kind: 'sqlite', persistent: true, ready: Promise.resolve(),
    getPlayer(key) { const r = q.get.get(key); if (!r) return null; try { return JSON.parse(r.data_json); } catch (e) { return null; } },
    async refreshPlayer() { },
    savePlayer(o) { q.upsert.run({ username: o.name.toLowerCase(), name: o.name, voc: o.voc, salt: o.salt, hash: o.hash, data: JSON.stringify(o) }); },
    saveMany(list) { db.transaction(l => { for (const o of l) store.savePlayer(o); })(list); },
    getMeta(key) { return q.meta.get(key) || null; },
    touchLogin(key, ip) { q.touch.run(new Date().toISOString(), ip, key); },
    addPlayTime(key, secs) { q.play.run(secs, key); },
    setBan(key, on, reason) { q.ban.run(on ? 1 : 0, on ? reason : null, key); },
    countPlayers() { return q.count.get().n; },
    countNewSince(ts) { return db.prepare('SELECT COUNT(*) n FROM players WHERE created_at >= ?').get(sqlTime(ts)).n; },
    countBanned() { return db.prepare('SELECT COUNT(*) n FROM players WHERE banned = 1').get().n; },
    listPlayers({ q: term = '', sort, filter, page = 0, size = 50 }) {
      const SORTS = { recent: 'last_login DESC', created: 'created_at DESC', level: "CAST(json_extract(data_json,'$.level') AS INTEGER) DESC", name: 'name COLLATE NOCASE' };
      const where = 'name LIKE ?' + (filter === 'banned' ? ' AND banned = 1' : ''), like = '%' + term + '%';
      const total = db.prepare(`SELECT COUNT(*) n FROM players WHERE ${where}`).get(like).n;
      const rows = db.prepare(`SELECT name, vocation, created_at, updated_at, last_login, last_ip, logins, play_seconds, banned, ban_reason,
        json_extract(data_json,'$.level') level, json_extract(data_json,'$.gold') gold, json_extract(data_json,'$.deaths') deaths, json_extract(data_json,'$.kills') kills
        FROM players WHERE ${where} ORDER BY ${SORTS[sort] || SORTS.recent} LIMIT ? OFFSET ?`).all(like, size, page * size);
      return { total, rows };
    },
    log(type, player, msg, ip) { try { q.log.run(Date.now(), type, player || null, ip || null, String(msg || '').slice(0, 500)); } catch (e) { } },
    queryLogs({ type, q: term, before = 9e15, limit = 200, player }) {
      let sql = 'SELECT id, ts, type, player, ip, msg FROM logs WHERE ts < ?'; const args = [before];
      if (type) { sql += ' AND type = ?'; args.push(type); }
      if (player) { sql += ' AND player = ? COLLATE NOCASE'; args.push(player); }
      if (term) { sql += ' AND (player LIKE ? OR msg LIKE ? OR ip LIKE ?)'; args.push('%' + term + '%', '%' + term + '%', '%' + term + '%'); }
      sql += ' ORDER BY ts DESC LIMIT ?'; args.push(limit);
      return db.prepare(sql).all(...args);
    },
    countLogs(type, since) { return db.prepare('SELECT COUNT(*) n FROM logs WHERE type = ? AND ts >= ?').get(type, since).n; },
    flush() { try { db.pragma('wal_checkpoint(PASSIVE)'); } catch (e) { } },
    async flushAsync() { store.flush(); }
  };
  // importa o arquivo antigo players.json uma única vez
  const legacy = path.join(dataDir, 'players.json');
  if (!store.countPlayers() && fs.existsSync(legacy)) {
    try { const rows = Object.values(JSON.parse(fs.readFileSync(legacy, 'utf8'))).filter(p => p && p.name && p.voc && p.salt && p.hash); store.saveMany(rows); if (rows.length) console.log(`${rows.length} jogador(es) migrado(s) para SQLite.`); }
    catch (e) { console.error('migração players.json -> SQLite', e); }
  }
  return store;
}

// ===================================================================== Memória (+ Redis opcional)
// Tudo fica em memória (rápido e simples). Com Redis, cada mudança também é gravada lá
// em lotes a cada 2 s, e ao ligar o servidor tudo é carregado de volta.
function memoryStore({ redis }) {
  const P = new Map(), M = new Map();     // jogadores e dados extras (último acesso, bloqueio...)
  let logs = [];                           // mais novo no fim
  const dirtyP = new Set(), dirtyM = new Set(), newLogs = [];
  const NS = 'piper:';
  async function cmd(body, pipeline) {
    const r = await fetch(redis.url + (pipeline ? '/pipeline' : ''), { method: 'POST', headers: { Authorization: 'Bearer ' + redis.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('Redis respondeu ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const j = await r.json(); if (!pipeline && j.error) throw new Error('Redis: ' + j.error);
    return pipeline ? j.map(x => { if (x.error) throw new Error('Redis: ' + x.error); return x.result; }) : j.result;
  }
  const parse = s => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  async function load() {
    if (!redis) return;
    const keys = (await cmd(['SMEMBERS', NS + 'players'])) || [];
    for (let i = 0; i < keys.length; i += 200) {
      const part = keys.slice(i, i + 200);
      const [pd, md] = await cmd([['MGET', ...part.map(k => NS + 'p:' + k)], ['MGET', ...part.map(k => NS + 'm:' + k)]], true);
      part.forEach((k, j) => { const d = parse(pd[j]); if (d) { P.set(k, d); M.set(k, Object.assign(META_DEFAULT(), parse(md[j]) || {})); } });
    }
    const raw = (await cmd(['LRANGE', NS + 'logs', 0, 19999])) || [];
    logs = raw.map(parse).filter(Boolean).reverse();
    console.log(`[armazenamento] Redis: ${P.size} jogador(es) e ${logs.length} registro(s) de log carregados.`);
  }
  const ready = load().catch(e => console.error('[armazenamento] falha ao carregar do Redis:', e.message));
  let flushing = null;
  async function flushAsync() {
    if (!redis) return; if (flushing) return flushing;
    if (!dirtyP.size && !dirtyM.size && !newLogs.length) return;
    const ops = [];
    for (const k of dirtyP) { const d = P.get(k); if (d) ops.push(['SET', NS + 'p:' + k, JSON.stringify(d)], ['SADD', NS + 'players', k]); }
    for (const k of dirtyM) { const m = M.get(k); if (m) ops.push(['SET', NS + 'm:' + k, JSON.stringify(m)]); }
    if (newLogs.length) ops.push(['LPUSH', NS + 'logs', ...newLogs.map(l => JSON.stringify(l))], ['LTRIM', NS + 'logs', 0, 49999]);
    const sentP = [...dirtyP], sentM = [...dirtyM], sentL = newLogs.length;
    dirtyP.clear(); dirtyM.clear(); newLogs.splice(0, sentL);
    flushing = (async () => {
      try { for (let i = 0; i < ops.length; i += 400) await cmd(ops.slice(i, i + 400), true); }
      catch (e) { console.error('[armazenamento] falha ao gravar no Redis (tento de novo):', e.message); sentP.forEach(k => dirtyP.add(k)); sentM.forEach(k => dirtyM.add(k)); }
      finally { flushing = null; }
    })();
    return flushing;
  }
  if (redis) setInterval(() => { flushAsync(); }, 2000).unref();
  setInterval(() => { const lim = Date.now() - LOG_KEEP_MS; if (logs.length > 20000) logs = logs.slice(-20000); while (logs.length && logs[0].ts < lim) logs.shift(); }, 3600e3).unref();
  let logId = 0;
  const meta = k => { let m = M.get(k); if (!m) { m = META_DEFAULT(); M.set(k, m); } return m; };
  const store = {
    kind: redis ? 'redis' : 'memory', persistent: !!redis, ready,
    getPlayer(key) { const d = P.get(key); return d ? JSON.parse(JSON.stringify(d)) : null; },
    // em vários servidores (Vercel), busca a versão mais nova do jogador antes de entrar
    async refreshPlayer(key) {
      await ready; if (!redis || dirtyP.has(key)) return;
      try { const [pd, md] = await cmd([['GET', NS + 'p:' + key], ['GET', NS + 'm:' + key]], true); const d = parse(pd); if (d) { P.set(key, d); M.set(key, Object.assign(META_DEFAULT(), parse(md) || {})); } }
      catch (e) { console.error('[armazenamento] refresh', e.message); }
    },
    savePlayer(o) { const k = o.name.toLowerCase(); P.set(k, JSON.parse(JSON.stringify(o))); if (!M.has(k)) { meta(k); dirtyM.add(k); } dirtyP.add(k); },
    saveMany(list) { list.forEach(store.savePlayer); },
    getMeta(key) { return P.has(key) ? Object.assign({}, meta(key)) : null; },
    touchLogin(key, ip) { const m = meta(key); m.last_login = new Date().toISOString(); m.last_ip = ip; m.logins = (m.logins || 0) + 1; dirtyM.add(key); },
    addPlayTime(key, secs) { const m = meta(key); m.play_seconds = (m.play_seconds || 0) + secs; dirtyM.add(key); },
    setBan(key, on, reason) { const m = meta(key); m.banned = on ? 1 : 0; m.ban_reason = on ? reason : null; dirtyM.add(key); },
    countPlayers() { return P.size; },
    countNewSince(ts) { let n = 0; for (const k of P.keys()) if (Date.parse(meta(k).created_at) >= ts) n++; return n; },
    countBanned() { let n = 0; for (const k of P.keys()) if (meta(k).banned) n++; return n; },
    listPlayers({ q: term = '', sort, filter, page = 0, size = 50 }) {
      const t = term.toLowerCase();
      let rows = [];
      for (const [k, d] of P) {
        if (t && !d.name.toLowerCase().includes(t)) continue;
        const m = meta(k); if (filter === 'banned' && !m.banned) continue;
        rows.push(Object.assign({ name: d.name, vocation: d.voc, level: levelOf(d), gold: d.gold || 0, deaths: d.deaths || 0, kills: d.kills || 0, updated_at: null }, m));
      }
      const by = { recent: (a, b) => String(b.last_login || '').localeCompare(String(a.last_login || '')), created: (a, b) => String(b.created_at).localeCompare(String(a.created_at)), level: (a, b) => b.level - a.level, name: (a, b) => a.name.localeCompare(b.name) };
      rows.sort(by[sort] || by.recent);
      return { total: rows.length, rows: rows.slice(page * size, page * size + size) };
    },
    log(type, player, msg, ip) { const l = { id: ++logId, ts: Date.now(), type, player: player || null, ip: ip || null, msg: String(msg || '').slice(0, 500) }; logs.push(l); if (redis) newLogs.push(l); },
    queryLogs({ type, q: term, before = 9e15, limit = 200, player }) {
      const t = (term || '').toLowerCase(), pl = (player || '').toLowerCase(), out = [];
      for (let i = logs.length - 1; i >= 0 && out.length < limit; i--) {
        const l = logs[i]; if (l.ts >= before) continue; if (type && l.type !== type) continue;
        if (pl && String(l.player || '').toLowerCase() !== pl) continue;
        if (t && !(String(l.player || '').toLowerCase().includes(t) || String(l.msg).toLowerCase().includes(t) || String(l.ip || '').includes(t))) continue;
        out.push(l);
      }
      return out;
    },
    countLogs(type, since) { let n = 0; for (let i = logs.length - 1; i >= 0 && logs[i].ts >= since; i--) if (logs[i].type === type) n++; return n; },
    flush() { flushAsync(); },
    flushAsync
  };
  return store;
}

module.exports = { createStore };
