// Gráficos gerados por código — As Aventuras do Piper
const SPR = (function () {
  const D = DEFS, T = D.T;
  const cache = new Map();
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const memo = (k, f) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };

  function outline(src, col = '#140d08') {
    const s = mk(src.width, src.height), sg = s.getContext('2d');
    sg.drawImage(src, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = col; sg.fillRect(0, 0, s.width, s.height);
    const c = mk(src.width, src.height), g = c.getContext('2d');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(s, dx, dy);
    g.drawImage(src, 0, 0); return c;
  }
  function mirror(src) { const c = mk(src.width, src.height), g = c.getContext('2d'); g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); return c; }
  function painter(g, u) { return (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x * u), Math.round(y * u), Math.round(w * u), Math.round(h * u)); }; }
  function disc(r, cx, cy, rad, col) { for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad + rad * 0.6) r(cx + x, cy + y, 1, 1, col); }
  const shade = (hex, f) => { const n = parseInt(hex.slice(1).padEnd(6, '0'), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; if (hex.length === 4) { r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16); } const c = v => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${c(r)},${c(g)},${c(b)})`; };

  // ------------------------------------------------------------ TILES
  function speckle(g, base, cols, n, seed, sz = 2) {
    g.fillStyle = base; g.fillRect(0, 0, 32, 32);
    for (let i = 0; i < n; i++) { const x = (hash(i, seed, 1) * 16 | 0) * 2, y = (hash(i, seed, 2) * 16 | 0) * 2; g.fillStyle = cols[i % cols.length]; g.fillRect(x, y, sz, sz); }
  }
  // Recorta regiões diferentes de uma textura grande. Assim o mesmo PNG fica
  // leve na rede e não forma um tabuleiro repetitivo no mapa inteiro.
  function texture(g, img, seed, frame = 0, drift = 0) {
    if (!img || !img.width) return false;
    const side = Math.max(72, Math.min(img.width, img.height) * .16);
    const maxX = Math.max(0, img.width - side), maxY = Math.max(0, img.height - side);
    const sx = Math.min(maxX, Math.floor(hash(seed, 71 + frame * 3, 4) * (maxX + 1) + drift * frame));
    const sy = Math.min(maxY, Math.floor(hash(seed, 91 + frame * 5, 7) * (maxY + 1)));
    g.drawImage(img, sx, sy, side, side, 0, 0, 32, 32);
    return true;
  }
  function tile(t, v, frame) {
    return memo(`t${t}_${v}_${t === T.WATER || t === T.BRIDGE ? frame : 0}`, () => {
      const c = mk(32, 32), g = c.getContext('2d'), r = painter(g, 2), s = v * 7 + t * 31;
      switch (t) {
        case T.GRASS: case T.TREE: case T.FLOWER:
          if (!texture(g, WORLD.grass, s)) speckle(g, '#4b8d3b', ['#3f7d32', '#5c9f46', '#3a7330', '#55963f'], 30, s);
          g.fillStyle = 'rgba(20,70,28,.12)'; g.fillRect(0, 0, 32, 32);
          for (let i = 0; i < 5; i++) { const x = (hash(i, s, 5) * 15 | 0), y = (hash(i, s, 6) * 14 | 0); r(x, y, 1, 2, i % 2 ? '#357029' : '#70a94c'); }
          if (t === T.FLOWER) for (let i = 0; i < 3; i++) { const x = 1 + (hash(i, s, 7) * 13 | 0), y = 1 + (hash(i, s, 8) * 13 | 0), col = ['#f3e04a', '#f06a8a', '#ffffff', '#9a7cf0'][(hash(i, s, 9) * 4) | 0]; r(x, y + 1, 1, 1, col); r(x + 1, y, 1, 1, col); r(x + 2, y + 1, 1, 1, col); r(x + 1, y + 2, 1, 1, col); r(x + 1, y + 1, 1, 1, '#e9a020'); }
          break;
        case T.WATER: case T.BRIDGE: {
          if (!texture(g, WORLD.water, s, frame, 12)) {
            g.fillStyle = '#2b5fae'; g.fillRect(0, 0, 32, 32);
            for (let i = 0; i < 5; i++) { const x = ((hash(i, s, 1) * 12 | 0) + frame * 2) % 14, y = (hash(i, s, 2) * 15 | 0); r(x, y, 3, 1, '#4a83d2'); r(x + 1, y + 1, 2, 1, '#2350a0'); }
          }
          g.fillStyle = 'rgba(18,71,135,.18)'; g.fillRect(0, 0, 32, 32);
          for (let i = 0; i < 3; i++) { const x = ((hash(i, s, 1) * 13 | 0) + frame * 2) % 15, y = hash(i, s, 2) * 15 | 0; r(x, y, 3, .45, 'rgba(221,248,255,.48)'); }
          if (t === T.BRIDGE) {
            if (!texture(g, WORLD.bridge, s, 0)) {
              for (let y = 0; y < 16; y += 2) { r(1, y, 14, 2, (y / 2) % 2 ? '#8b5e34' : '#9a6b3d'); r(1, y + 1, 14, .5, '#5c3c1e'); }
              r(0, 0, 1, 16, '#5c3c1e'); r(15, 0, 1, 16, '#5c3c1e');
            }
            // Corrimãos mantêm a ponte legível mesmo quando o recorte da
            // textura mostra apenas o madeiramento central.
            r(0, 0, .8, 16, '#342015'); r(15.2, 0, .8, 16, '#342015');
            r(.8, 0, .35, 16, '#c29962'); r(14.85, 0, .35, 16, '#c29962');
          }
          break; }
        case T.SAND: speckle(g, '#d8c07c', ['#c8ae68', '#e6d297', '#cdb571', '#f0dca1'], 42, s); for (let i = 0; i < 3; i++) { const x = hash(i, s, 3) * 15 | 0, y = hash(i, s, 4) * 15 | 0; r(x, y, 3, .5, '#b89b5d'); } break;
        case T.PATH: speckle(g, '#9b7b4f', ['#8a6b43', '#ac8c5d', '#927349', '#b09264'], 42, s); for (let i = 0; i < 5; i++) { const x = hash(i, s, 3) * 15 | 0, y = hash(i, s, 4) * 15 | 0; r(x, y, 1, 1, '#6f665b'); if (i % 2) r(x + 1, y + 1, 1, .5, '#c5a87a'); } break;
        case T.FLOOR:
          g.fillStyle = '#8f877a'; g.fillRect(0, 0, 32, 32);
          r(0, 0, 16, 0.5, '#6e675c'); r(0, 8, 16, 0.5, '#6e675c'); r(v % 2 ? 4 : 10, 0, 0.5, 8, '#6e675c'); r(v % 2 ? 12 : 6, 8, 0.5, 8, '#6e675c');
          for (let i = 0; i < 10; i++) r(hash(i, s, 3) * 16 | 0, hash(i, s, 4) * 16 | 0, 1, 1, i % 2 ? '#a39b8e' : '#837b6f');
          break;
        case T.WALL:
          g.fillStyle = '#5a544d'; g.fillRect(0, 0, 32, 32);
          for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) { const x = col * 6 + (row % 2 ? 3 : 0); r(x + 0.5, row * 4 + 0.5, 5, 3, row === 0 ? '#9a938a' : '#7b746b'); r(x + 0.5, row * 4 + 0.5, 5, 0.5, '#a8a197'); }
          r(0, 14, 16, 2, '#3c3833');
          break;
        case T.CAVE: speckle(g, '#3f3228', ['#33281f', '#4b3c30', '#382c23'], 34, s); break;
        case T.CAVEWALL:
          g.fillStyle = '#231b15'; g.fillRect(0, 0, 32, 32);
          for (let i = 0; i < 6; i++) { const x = 2 + (hash(i, s, 1) * 11 | 0), y = 2 + (hash(i, s, 2) * 11 | 0); disc(r, x, y, 2, '#3a2f27'); r(x - 1, y - 2, 2, 1, '#54463a'); }
          break;
        case T.ROCK:
          speckle(g, '#d8c07c', ['#c8ae68', '#e6d297'], 20, s);
          break;
      }
      return c;
    });
  }
  // objetos altos desenhados por cima (árvores, pedras)
  function treeObj(v) {
    return memo('tree' + v, () => {
      const c = mk(48, 56), g = c.getContext('2d'), r = painter(g, 2);
      r(11, 19, 3, 8, '#6b4423'); r(11, 19, 1, 8, '#80552e'); r(10, 26, 5, 1, '#5a381c');
      const dark = v % 3 === 0 ? '#2a5f2a' : v % 3 === 1 ? '#2d6830' : '#356b27';
      disc(r, 12, 11, 8, dark); disc(r, 7, 15, 5, dark); disc(r, 17, 15, 5, dark);
      disc(r, 10, 9, 5, shade(dark, 1.3)); disc(r, 9, 8, 2, shade(dark, 1.6));
      for (let i = 0; i < 10; i++) r(4 + (hash(i, v, 1) * 16 | 0), 4 + (hash(i, v, 2) * 14 | 0), 1, 1, shade(dark, 0.75));
      if (v % 5 === 0) for (let i = 0; i < 4; i++) r(6 + (hash(i, v, 3) * 12 | 0), 6 + (hash(i, v, 4) * 10 | 0), 1, 1, '#d33');
      return outline(c);
    });
  }
  function rockObj(v) {
    return memo('rock' + v, () => {
      const c = mk(32, 32), g = c.getContext('2d'), r = painter(g, 2);
      disc(r, 8, 10, 5, '#8a8178'); disc(r, 7, 9, 3, '#a39a90'); r(5, 7, 2, 1, '#bdb4aa'); r(4, 14, 9, 1, '#5e5750');
      return outline(c);
    });
  }

  // ------------------------------------------------------------ ARMAS
  function weapon(r, look, x, orb) {
    const B = '#dfe6ee', G = '#c9a227', W = '#7a4a20';
    switch (look) {
      case 'dagger': r(x, 7, 1, 4, B); r(x - 1, 10, 3, 1, G); r(x, 11, 1, 2, W); break;
      case 'sword': r(x, 3, 1, 8, B); r(x - 1, 10, 3, 1, G); r(x, 11, 1, 2, W); break;
      case 'sword2': r(x, 0, 1, 11, B); r(x, 0, 1, 11, B); r(x - 1, 10, 3, 1, G); r(x, 11, 1, 2, W); break;
      case 'dsword': r(x, 0, 1, 11, '#ff5a4a'); r(x - 1, 10, 3, 1, G); r(x, 11, 1, 2, '#333'); break;
      case 'axe': r(x, 3, 1, 10, W); r(x + 1, 3, 2, 4, '#aab'); r(x - 1, 4, 1, 2, '#889'); break;
      case 'hammer': r(x, 4, 1, 9, W); r(x - 2, 2, 5, 3, '#99a'); r(x - 2, 2, 5, 1, '#ccd'); break;
      case 'club': r(x, 5, 2, 8, '#5e3a1a'); r(x, 5, 1, 8, '#7a4f28'); break;
      case 'spear': r(x, 2, 1, 12, W); r(x, 0, 1, 2, '#ccd'); break;
      case 'wand': r(x, 6, 1, 6, W); r(x, 5, 1, 1, orb || '#9ef'); r(x - 0.5, 4.5, 2, 1, orb || '#9ef'); break;
      case 'staff': r(x, 1, 1, 14, W); r(x - 1, 0, 3, 2, orb || '#7f7'); r(x - 0.5, 0, 1, 1, '#fff'); break;
    }
  }

  // ------------------------------------------------------------ HUMANÓIDE
  // o: {skin,hair,body,legs,boots,belt,robe,hat,hatC,weapon,orb,shield,shieldC,beard,eyes,u}
  function human(o, dir, frame) {
    const u = o.u || 2, c = mk(16 * u, 16 * u), g = c.getContext('2d'), r = painter(g, u);
    const side = dir === 1 || dir === 3, back = dir === 2;
    const body = o.body, dark = shade(body, 0.75), legs = o.legs || '#4a3a2a', boots = o.boots || '#3a2a1a', skin = o.skin, hair = o.hair || '#4a2a10';
    const lu = frame === 1 ? 1 : 0, ru = frame === 2 ? 1 : 0;
    const wx = side ? 4 : back ? 2 : 13;
    if (back && o.weapon) weapon(r, o.weapon, wx, o.orb);
    if (!side) {
      if (!o.robe) { r(5, 12, 2, 3 - lu, legs); r(5, 14 - lu, 2, 1, boots); r(9, 12, 2, 3 - ru, legs); r(9, 14 - ru, 2, 1, boots); }
      else { r(5, 14 - lu, 2, 1, boots); r(9, 14 - ru, 2, 1, boots); }
      r(4, 7, 8, o.robe ? 7 : 5, body); r(4, 7, 1, o.robe ? 7 : 5, dark); r(11, 7, 1, o.robe ? 7 : 5, dark);
      if (o.robe) r(7, 8, 2, 6, shade(body, 1.2));
      r(4, 11, 8, 1, o.belt || '#2a1a0a');
      r(3, 7 + lu, 1, 4, dark); r(3, 11 + lu, 1, 1, skin); r(12, 7 + ru, 1, 4, dark); r(12, 11 + ru, 1, 1, skin);
      r(5, 2, 6, 5, skin); r(5, 6, 6, 1, shade(skin, 0.85));
      if (back) { r(5, 1, 6, 5, hair); }
      else { r(5, 1, 6, 2, hair); r(5, 3, 1, 1, hair); r(10, 3, 1, 1, hair); r(6, 4, 1, 1, o.eyes || '#1a1a2a'); r(9, 4, 1, 1, o.eyes || '#1a1a2a'); if (o.beard) { r(6, 5, 4, 3, o.beard); r(7, 8, 2, 1, o.beard); } }
    } else {
      const f = frame ? 1 : 0;
      if (!o.robe) { r(6 - f, 12, 2, 2, legs); r(6 - f, 14, 2, 1, boots); r(8 + f, 12, 2, 2, shade(legs, 0.8)); r(8 + f, 14, 2, 1, boots); }
      else { r(6 - f, 14, 2, 1, boots); r(8 + f, 14, 2, 1, boots); }
      r(5, 7, 6, o.robe ? 7 : 5, body); r(10, 7, 1, o.robe ? 7 : 5, dark);
      r(5, 11, 6, 1, o.belt || '#2a1a0a');
      r(5, 2, 6, 5, skin); r(6, 1, 5, 2, hair); r(9, 2, 2, 4, hair); r(6, 4, 1, 1, o.eyes || '#1a1a2a'); r(4, 4, 1, 1, skin);
      if (o.beard) { r(5, 5, 4, 3, o.beard); }
      r(6, 8 + f, 2, 3, dark); r(5, 10 + f, 2, 1, skin);
    }
    // chapéus
    const hc = o.hatC || '#888';
    if (o.hat === 'helm') { if (back) r(5, 1, 6, 4, hc); else if (side) { r(5, 1, 6, 2, hc); r(9, 1, 2, 4, hc); } else { r(5, 1, 6, 2, hc); r(4, 2, 1, 3, hc); r(11, 2, 1, 3, hc); r(5, 1, 6, 0.5, shade(hc, 1.3)); } }
    if (o.hat === 'wiz') { r(4, 2, 8, 1, hc); r(5, 1, 6, 1, hc); r(side ? 6 : 6, 0, 4, 1, hc); r(side ? 9 : 9, -0.5, 2, 1, hc); r(5, 1, 6, 0.5, shade(hc, 1.3)); }
    if (o.hat === 'hood') { r(4, 1, 8, 2, hc); if (!side) { r(4, 3, 1, 4, hc); r(11, 3, 1, 4, hc); } else r(9, 1, 3, 6, hc); if (back) r(5, 3, 6, 4, hc); }
    if (o.hat === 'horns') { r(3, 0, 1, 3, '#eed'); r(12, 0, 1, 3, '#eed'); }
    if (o.hat === 'cap') { r(5, 1, 6, 1.5, hc); }
    // escudo
    if (o.shield && !side) { const sx = back ? 12 : 1; r(sx, 8, 3, 5, o.shieldC); r(sx, 8, 3, 0.5, shade(o.shieldC, 1.3)); r(sx + 1, 9.5, 1, 2, shade(o.shieldC, 0.6)); }
    if (!back && o.weapon) weapon(r, o.weapon, wx, o.orb);
    return outline(c);
  }

  // ------------------------------------------------------------ MONSTROS (perfil à esquerda)
  function quad(o, frame) {
    const u = o.u || 2, c = mk(16 * u, 16 * u), g = c.getContext('2d'), r = painter(g, u), f = frame ? 1 : 0;
    const B = o.body, Dk = shade(B, 0.7), L = shade(B, 1.2);
    // pernas
    const ly = o.legY;
    r(o.bx + 1 - f, ly, 1.5, 15 - ly, Dk); r(o.bx + o.bw - 3 + f, ly, 1.5, 15 - ly, Dk);
    r(o.bx + 2 + f, ly, 1.5, 15 - ly, B); r(o.bx + o.bw - 2 - f, ly, 1.5, 15 - ly, B);
    // cauda
    if (o.tail) o.tail(r, f);
    // corpo
    r(o.bx, o.by, o.bw, o.bh, B); r(o.bx, o.by, o.bw, 1, L); r(o.bx + 1, o.by + o.bh - 1, o.bw - 2, 1, o.belly || Dk);
    // cabeça (à esquerda)
    r(o.hx, o.hy, o.hw, o.hh, B); r(o.hx, o.hy, o.hw, 1, L);
    if (o.snout) r(o.hx - 2, o.hy + o.hh - 2, 2, 2, o.snout);
    r(o.hx + 1, o.hy + 1, 1, 1, o.eye || '#111');
    if (o.ears) o.ears(r);
    if (o.extra) o.extra(r, f);
    return outline(c);
  }
  const MONS = {
    rat: f => quad({ body: '#7b7470', bx: 6, by: 10, bw: 7, bh: 4, hx: 3, hy: 10, hw: 4, hh: 3, legY: 14, snout: '#e9a0a0', ears: r => { r(5, 9, 2, 1, '#e9a0a0'); }, tail: (r, f) => { r(13, 12 + f, 3, 1, '#e9a0a0'); } }, f),
    rabbit: f => quad({ body: '#eee8e0', bx: 6, by: 10, bw: 6, bh: 4, hx: 4, hy: 8, hw: 4, hh: 4, legY: 14, eye: '#c22', ears: r => { r(6, 4, 1, 4, '#eee8e0'); r(7, 4, 1, 4, '#f3c0c0'); }, tail: r => r(12, 10, 2, 2, '#fff') }, f),
    wolf: f => quad({ u: 2.2, body: '#7d7d88', belly: '#bbb', bx: 5, by: 7, bw: 9, bh: 5, hx: 2, hy: 5, hw: 5, hh: 4, legY: 12, snout: '#5a5a63', eye: '#ff3', ears: r => { r(4, 3, 1, 2, '#5a5a63'); r(6, 3, 1, 2, '#5a5a63'); }, tail: (r, f) => { r(14, 6 - f, 2, 4, '#6a6a75'); } }, f),
    bear: f => quad({ u: 2.5, body: '#6b4423', bx: 4, by: 5, bw: 11, bh: 7, hx: 1, hy: 4, hw: 5, hh: 5, legY: 12, snout: '#c9a27a', ears: r => { r(2, 3, 2, 1, '#4a2e15'); r(5, 3, 1, 1, '#4a2e15'); } }, f),
    snake: f => { const c = mk(32, 32), g = c.getContext('2d'), r = painter(g, 2);
      for (let i = 0; i < 6; i++) { const x = 4 + i * 2, y = 12 + Math.round(Math.sin(i * 1.3 + f * 1.5) * 1.2); r(x, y, 2, 2, i % 2 ? '#3f8a2a' : '#5aab3a'); r(x, y + 1.5, 2, 0.5, '#d8d070'); }
      r(1, 10, 4, 3, '#5aab3a'); r(2, 10, 1, 1, '#ff3'); r(0, 12, 1, 0.5, '#e22'); r(-1, 12.5, 1, 0.5, '#e22'); return outline(c); },
    scorpion: f => { const c = mk(32, 32), g = c.getContext('2d'), r = painter(g, 2), B = '#b8641e';
      for (let i = 0; i < 3; i++) { r(5 + i * 2 + f * (i % 2), 13, 1, 2, '#6b3a10'); }
      r(4, 10, 8, 3, B); r(4, 10, 8, 1, '#d88440'); r(12, 9, 2, 2, B); r(13, 6, 2, 3, B); r(12, 4, 2, 2, B); r(10, 3, 2, 2, B); r(9, 4, 1, 2, '#222');
      r(1, 9 - f, 3, 2, B); r(0, 8 - f, 1, 2, B); r(2, 11, 2, 1, B); r(5, 10, 1, 1, '#111'); return outline(c); },
    spider: f => { const c = mk(32, 32), g = c.getContext('2d'), r = painter(g, 2), L = '#2a1f2f';
      for (let i = 0; i < 4; i++) { const y = 8 + i * 1.5; r(2 - (i % 2 ? f : 0), y + 2, 3, 1, L); r(1 - (i % 2 ? f : 0), y + 3, 1, 3, L); r(11, y + 2, 3, 1, L); r(14 + (i % 2 ? f : 0), y + 3, 1, 3, L); }
      disc(r, 8, 8, 4, '#3b2a4a'); r(6, 6, 4, 1, '#6a3a7a'); r(7, 8, 2, 2, '#c22'); disc(r, 8, 12, 2, '#2a1f2f'); r(7, 12, 1, 1, '#f33'); r(9, 12, 1, 1, '#f33'); return outline(c); },
    dragon: f => { const c = mk(48, 48), g = c.getContext('2d'), r = painter(g, 3), B = '#b8282a', Dk = '#7a1517';
      r(10, 9, 5, 2, B); r(13, 10, 3, 1, B); // cauda
      r(4 + f, 2 - f, 6, 2, Dk); r(5 + f, 1 - f, 4, 1, Dk); r(6, 4, 4, 3, Dk); // asa
      r(4, 7, 8, 5, B); r(5, 10, 6, 2, '#e8b04a'); r(5, 12, 2, 3, Dk); r(9, 12, 2, 3, Dk);
      r(1, 4, 4, 4, B); r(0, 6, 2, 2, B); r(1, 5, 1, 1, '#ff3'); r(2, 3, 1, 1, '#eed'); r(4, 3, 1, 1, '#eed'); r(0, 7.5, 1, 0.5, '#fa0');
      return outline(c); }
  };
  const HUMANOIDS = {
    goblin: { skin: '#6fa83a', hair: '#3a5a1a', body: '#6b4a2a', legs: '#4a3a1a', weapon: 'club', eyes: '#f22', hat: 'horns' },
    orc: { skin: '#5a8a3a', hair: '#222', body: '#5a4030', legs: '#3a2a1a', weapon: 'axe', eyes: '#f22', belt: '#a33' },
    shaman: { skin: '#5a8a3a', hair: '#222', body: '#8a2222', robe: true, weapon: 'staff', orb: '#f60', eyes: '#ff0', hat: 'hood', hatC: '#6a1a1a' },
    troll: { skin: '#8a8a4a', hair: '#555522', body: '#6a5a3a', legs: '#8a8a4a', boots: '#6a6a3a', weapon: 'club', u: 2.5, eyes: '#f80' },
    mummy: { skin: '#d8cfa8', hair: '#c8bf98', body: '#d0c69c', legs: '#c8bf98', boots: '#b8af88', belt: '#a89f78', eyes: '#3f3', hat: 'cap', hatC: '#c8bf98' },
    skeleton: { skin: '#eeeae0', hair: '#eeeae0', body: '#d8d4ca', legs: '#d8d4ca', boots: '#bbb', belt: '#555', weapon: 'sword', eyes: '#111' },
    npc_smith: { skin: '#e0b088', hair: '#3a2a1a', body: '#6a4a2a', legs: '#3a3a4a', weapon: 'hammer', beard: '#3a2a1a', belt: '#222' },
    npc_alch: { skin: '#f0c8a0', hair: '#c0402a', body: '#2a7a4a', robe: true, belt: '#c9a227' },
    npc_sage: { skin: '#e8c098', hair: '#eee', body: '#e8e4dc', robe: true, beard: '#f4f4f4', weapon: 'staff', orb: '#ff8', belt: '#c9a227' },
    npc_guard: { skin: '#e0b088', hair: '#5a3a1a', body: '#8d96a0', legs: '#3a3a5a', hat: 'helm', hatC: '#a0a8b0', weapon: 'spear', shield: true, shieldC: '#2a4a8a' }
  };

  function playerOpts(look) {
    const [voc, armor, helmet, wpn, shield] = look.split('|');
    const A = D.ITEMS[armor], Hm = D.ITEMS[helmet], Wp = D.ITEMS[wpn], S = D.ITEMS[shield];
    const o = { skin: '#f0c8a0', hair: '#6a3a1a', legs: '#4a3a5a', boots: '#3a2414' };
    if (voc === 'wizard') { o.body = A ? (armor === 'a_cloth' ? '#4a3a8a' : A.color) : '#4a3a8a'; o.robe = true; o.hat = Hm ? 'helm' : 'wiz'; o.hatC = Hm ? Hm.color : shade(o.body, 0.9); o.belt = '#c9a227'; o.hair = '#bbb'; }
    else { o.body = A ? A.color : '#8a7350'; o.hat = Hm ? 'helm' : null; o.hatC = Hm && Hm.color; o.hair = '#5a2a10'; }
    if (Wp) { o.weapon = Wp.look; o.orb = Wp.orb; }
    if (S) { o.shield = true; o.shieldC = S.color; }
    return o;
  }

  function entity(kind, look, dir, frame, faceLeft) {
    return memo(`e${look}_${dir}_${frame}_${faceLeft ? 1 : 0}`, () => {
      if (kind === 'p') return human(playerOpts(look), dir, frame);
      if (HUMANOIDS[look]) return human(HUMANOIDS[look], dir, frame);
      if (MONS[look]) { const s = MONS[look](frame); return faceLeft ? s : mirror(s); }
      return human({ skin: '#f0c8a0', body: '#888' }, dir, frame);
    });
  }

  // ------------------------------------------------------------ ÍCONES
  function itemIcon(id) {
    return memo('i' + id, () => {
      const it = D.ITEMS[id], c = mk(32, 32), g = c.getContext('2d'), r = painter(g, 2);
      if (!it) return c;
      if (it.type === 'potion') {
        const col = it.hp ? '#e02a2a' : '#2a5ae0', big = id.endsWith('2');
        r(7, 2, 2, 1, '#8b5a2b'); r(7, 3, 2, 3, '#cde'); disc(r, 8, big ? 10 : 11, big ? 5 : 4, '#cde');
        disc(r, 8, big ? 10.5 : 11.5, big ? 4 : 3, col); r(6, big ? 7 : 9, 1, 2, '#fff');
      } else if (it.type === 'weapon') {
        const s = mk(32, 32), sg = s.getContext('2d'); weapon(painter(sg, 2), it.look, 8, it.orb);
        g.imageSmoothingEnabled = false; g.translate(16, 16); g.rotate(Math.PI / 4); g.drawImage(s, -16, -15);
        g.setTransform(1, 0, 0, 1, 0, 0);
      } else if (it.type === 'armor') {
        const col = it.color; r(4, 3, 8, 10, col); r(2, 3, 2, 6, shade(col, 0.8)); r(12, 3, 2, 6, shade(col, 0.8)); r(6, 3, 4, 1.5, '#1a130d'); r(4, 10, 8, 1, '#2a1a0a'); r(5, 4, 1, 6, shade(col, 1.25));
      } else if (it.type === 'helmet') {
        const col = it.color; disc(r, 8, 8, 5, col); r(3, 8, 10, 5, col); r(5, 9, 6, 1, '#1a130d'); r(7, 10, 2, 3, '#1a130d'); r(5, 4, 2, 1, shade(col, 1.3));
      } else if (it.type === 'shield') {
        const col = it.color; r(3, 2, 10, 9, col); r(4, 11, 8, 2, col); r(6, 13, 4, 1, col); r(3, 2, 10, 1, shade(col, 1.3)); r(7, 4, 2, 7, shade(col, 0.6)); r(5, 6, 6, 2, shade(col, 0.6));
      } else {
        disc(r, 8, 9, 4, it.color || '#aaa'); r(6, 7, 2, 1, '#fff8');
      }
      return outline(c);
    });
  }
  function spellIcon(id) {
    return memo('s' + id, () => {
      const c = mk(32, 32), g = c.getContext('2d'), r = painter(g, 2);
      const bg = { strike: '#5a1a1a', heal: '#1a4a2a', whirl: '#3a3a4a', berserk: '#6a2a0a', fireball: '#5a2a0a', ice: '#0a3a5a', storm: '#3a1a5a' }[id] || '#333';
      g.fillStyle = bg; g.fillRect(0, 0, 32, 32);
      if (id === 'strike') { for (let i = 0; i < 10; i++) r(3 + i, 12 - i, 2, 2, i % 2 ? '#fdd' : '#f66'); }
      if (id === 'heal') { r(6, 3, 4, 10, '#6f6'); r(3, 6, 10, 4, '#6f6'); r(7, 4, 2, 8, '#cfc'); }
      if (id === 'whirl') { for (let a = 0; a < 18; a++) { const rr = 2 + a * 0.32, t = a * 0.7; r(8 + Math.cos(t) * rr, 8 + Math.sin(t) * rr, 1.5, 1.5, '#ccd'); } }
      if (id === 'berserk') { disc(r, 8, 7, 4, '#eee'); r(6, 6, 1.5, 2, '#a00'); r(9, 6, 1.5, 2, '#a00'); r(6, 11, 4, 2, '#eee'); r(7, 11, 0.5, 2, '#333'); r(8.5, 11, 0.5, 2, '#333'); }
      if (id === 'fireball') { disc(r, 8, 8, 5, '#e43'); disc(r, 8, 8, 3, '#fa3'); disc(r, 8, 8, 1, '#ffa'); }
      if (id === 'ice') { for (let i = 0; i < 9; i++) r(3 + i, 12 - i, 2, 2, i % 3 ? '#9ef' : '#fff'); r(11, 2, 3, 3, '#fff'); }
      if (id === 'storm') { const pts = [[9, 1], [7, 4], [9, 5], [6, 9], [8, 10], [5, 14]]; for (const [x, y] of pts) r(x, y, 3, 2, '#ff6'); r(7, 7, 2, 2, '#c8f'); }
      return c;
    });
  }

  // ------------------------------------------------------------ ÁGUA E PONTE CONTÍNUAS
  // As texturas são desenhadas como padrões ancorados no MUNDO (não no quadrado),
  // então os tiles vizinhos continuam a mesma imagem, sem emendas.
  const GIMG = {}; let pats = null;
  ['water-seamless.jpg', 'bridge-h.png', 'bridge-v.png'].forEach(n => {
    const im = new Image(); im.onload = () => { GIMG[n] = im; pats = null; }; im.src = 'assets/world/' + n;
  });
  function getPats(ctx) {
    if (pats) return pats;
    if (!GIMG['water-seamless.jpg'] || !GIMG['bridge-h.png'] || !GIMG['bridge-v.png'] || typeof DOMMatrix === 'undefined') return null;
    pats = { water: ctx.createPattern(GIMG['water-seamless.jpg'], 'repeat'), bh: ctx.createPattern(GIMG['bridge-h.png'], 'repeat'), bv: ctx.createPattern(GIMG['bridge-v.png'], 'repeat') };
    return pats;
  }
  function fillPat(ctx, pat, tx, ty, sc, dx, dy, w, h) {
    pat.setTransform(new DOMMatrix([sc, 0, 0, sc, tx, ty]));
    ctx.fillStyle = pat; ctx.fillRect(dx, dy, w, h);
  }
  // contorno ondulado da margem, contínuo entre tiles (usa a coordenada do mundo)
  const wob = u => 3.4 + 1.4 * Math.sin(u * 0.21) + 0.8 * Math.sin(u * 0.53 + 1.7);
  const BANK = { [T.SAND]: '#d9c283', [T.PATH]: '#a9875a', [T.FLOOR]: '#9c9484', [T.WALL]: '#6b655d' };
  function shoreEdge(ctx, side, dx, dy, wx, wy, col, foamA) {
    // side: 0 norte, 1 sul, 2 oeste, 3 leste
    const pts = [];
    for (let i = 0; i <= 32; i += 2) {
      const u = (side < 2 ? wx : wy) + i, d = wob(u);
      if (side === 0) pts.push([dx + i, dy + d]);
      else if (side === 1) pts.push([dx + i, dy + 32 - d]);
      else if (side === 2) pts.push([dx + d, dy + i]);
      else pts.push([dx + 32 - d, dy + i]);
    }
    // sombra de profundidade logo abaixo da margem
    const g = side === 0 ? ctx.createLinearGradient(0, dy, 0, dy + 13) : side === 1 ? ctx.createLinearGradient(0, dy + 32, 0, dy + 19)
      : side === 2 ? ctx.createLinearGradient(dx, 0, dx + 13, 0) : ctx.createLinearGradient(dx + 32, 0, dx + 19, 0);
    g.addColorStop(0, 'rgba(6,30,60,.38)'); g.addColorStop(1, 'rgba(6,30,60,0)');
    ctx.fillStyle = g; ctx.fillRect(dx, dy, 32, 32);
    // faixa de terra/areia
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts) ctx.lineTo(q[0], q[1]);
    if (side === 0) { ctx.lineTo(dx + 32.05, dy - 0.05); ctx.lineTo(dx - 0.05, dy - 0.05); }
    else if (side === 1) { ctx.lineTo(dx + 32.05, dy + 32.05); ctx.lineTo(dx - 0.05, dy + 32.05); }
    else if (side === 2) { ctx.lineTo(dx - 0.05, dy + 32.05); ctx.lineTo(dx - 0.05, dy - 0.05); }
    else { ctx.lineTo(dx + 32.05, dy + 32.05); ctx.lineTo(dx + 32.05, dy - 0.05); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    // linha de areia molhada + espuma
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(90,70,40,.45)';
    ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
    const o = 1.6, ofs = side === 0 ? [0, o] : side === 1 ? [0, -o] : side === 2 ? [o, 0] : [-o, 0];
    ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(235,250,255,${foamA})`;
    ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0] + ofs[0], q[1] + ofs[1]) : ctx.moveTo(q[0] + ofs[0], q[1] + ofs[1])); ctx.stroke();
  }
  function bankColor(k) { return BANK[k] || '#c9b47c'; }
  function waterTile(ctx, x, y, dx, dy, now, ox, oy, at, P) {
    const t = now / 1000;
    // correnteza lenta: o padrão inteiro desliza, sem camadas transparentes (que marcariam a grade)
    fillPat(ctx, P.water, ox + t * 5 + Math.sin(t * 0.6) * 3, oy + t * 2.5, 0.25, dx, dy, 32.05, 32.05);
    const k = (xx, yy) => at(xx, yy);
    const land = q => q !== T.WATER && q !== T.BRIDGE;
    const n = k(x, y - 1), s = k(x, y + 1), w = k(x - 1, y), e = k(x + 1, y);
    // sombra da ponte na água
    const shade = (x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(dx, dy, 32, 32); };
    if (n === T.BRIDGE) shade(0, dy, 0, dy + 9); if (s === T.BRIDGE) shade(0, dy + 32, 0, dy + 26);
    if (w === T.BRIDGE) shade(dx, 0, dx + 9, 0); if (e === T.BRIDGE) shade(dx + 32, 0, dx + 26, 0);
    const foam = (0.45 + 0.2 * Math.sin(now / 650 + x * 0.7 + y * 0.4)).toFixed(2);
    const wx = x * 32, wy = y * 32;
    if (land(n)) shoreEdge(ctx, 0, dx, dy, wx, wy, bankColor(n), foam);
    if (land(s)) shoreEdge(ctx, 1, dx, dy, wx, wy, bankColor(s), foam);
    if (land(w)) shoreEdge(ctx, 2, dx, dy, wx, wy, bankColor(w), foam);
    if (land(e)) shoreEdge(ctx, 3, dx, dy, wx, wy, bankColor(e), foam);
    // cantos externos (terra só na diagonal)
    const corner = (cx, cy, q, ang) => {
      ctx.fillStyle = bankColor(q); ctx.beginPath(); ctx.arc(cx, cy, 5.2, ang, ang + Math.PI / 2); ctx.lineTo(cx, cy); ctx.fill();
      ctx.strokeStyle = `rgba(235,250,255,${foam})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, 6.6, ang, ang + Math.PI / 2); ctx.stroke();
    };
    const nw = k(x - 1, y - 1), ne = k(x + 1, y - 1), sw = k(x - 1, y + 1), se = k(x + 1, y + 1);
    if (!land(n) && !land(w) && land(nw)) corner(dx, dy, nw, 0);
    if (!land(n) && !land(e) && land(ne)) corner(dx + 32, dy, ne, Math.PI / 2);
    if (!land(s) && !land(e) && land(se)) corner(dx + 32, dy + 32, se, Math.PI);
    if (!land(s) && !land(w) && land(sw)) corner(dx, dy + 32, sw, -Math.PI / 2);
  }
  function bridgeTile(ctx, x, y, dx, dy, now, ox, oy, at, P) {
    const isB = (xx, yy) => { const q = at(xx, yy); return q === T.BRIDGE || q === T.PATH; };
    let hx = 0, vy = 0;
    for (let k = 1; k <= 4; k++) { if (isB(x - k, y)) hx++; else break; }
    for (let k = 1; k <= 4; k++) { if (isB(x + k, y)) hx++; else break; }
    for (let k = 1; k <= 4; k++) { if (isB(x, y - k)) vy++; else break; }
    for (let k = 1; k <= 4; k++) { if (isB(x, y + k)) vy++; else break; }
    if (hx > vy) {      // ponte horizontal: tábuas atravessam de cima a baixo das linhas da ponte
      let r0 = y; if (at(x, y - 1) === T.BRIDGE) r0 = y - 1;
      const rows = at(x, r0 + 1) === T.BRIDGE ? 2 : 1, sc = rows * 32 / 256;
      fillPat(ctx, P.bh, ox, oy + r0 * 32, sc, dx, dy, 32.05, 32.05);
    } else {            // ponte vertical
      let c0 = x; if (at(x - 1, y) === T.BRIDGE) c0 = x - 1;
      const cols = at(c0 + 1, y) === T.BRIDGE ? 2 : 1, sc = cols * 32 / 256;
      fillPat(ctx, P.bv, ox + c0 * 32, oy, sc, dx, dy, 32.05, 32.05);
    }
    // ponta da ponte encontrando a terra: sombra suave
    const endShade = (x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(40,25,10,.35)'); g.addColorStop(1, 'rgba(40,25,10,0)'); ctx.fillStyle = g; ctx.fillRect(dx, dy, 32, 32); };
    if (hx > vy) { if (at(x - 1, y) === T.PATH || at(x - 1, y) === T.SAND) endShade(dx, 0, dx + 5, 0); if (at(x + 1, y) === T.PATH || at(x + 1, y) === T.SAND) endShade(dx + 32, 0, dx + 27, 0); }
    else { if (at(x, y - 1) === T.PATH || at(x, y - 1) === T.SAND) endShade(0, dy, 0, dy + 5); if (at(x, y + 1) === T.PATH || at(x, y + 1) === T.SAND) endShade(0, dy + 32, 0, dy + 27); }
  }
  // desenha um tile do chão; água e ponte usam as texturas contínuas
  function ground(ctx, t, x, y, dx, dy, v, wf, now, at, ox, oy) {
    const P = (t === T.WATER || t === T.BRIDGE) ? getPats(ctx) : null;
    if (P) { if (t === T.WATER) waterTile(ctx, x, y, dx, dy, now, ox, oy, at, P); else bridgeTile(ctx, x, y, dx, dy, now, ox, oy, at, P); return; }
    ctx.drawImage(tile(t, v, wf), dx, dy, 32.05, 32.05);
  }

  return { tile, ground, treeObj, rockObj, entity, itemIcon, spellIcon, hash, mk };
})();
