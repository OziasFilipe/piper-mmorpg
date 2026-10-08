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
        case T.SNOW: case T.SNOWROCK: speckle(g, '#e6edf4', ['#d3dde8', '#f6f9fc', '#c9d5e2', '#ffffff', '#dce5ee'], 46, s); for (let i = 0; i < 3; i++) { const x = hash(i, s, 3) * 15 | 0, y = hash(i, s, 4) * 15 | 0; r(x, y, 2, .5, '#b9c6d4'); } break;
        case T.SAND: speckle(g, '#d8c07c', ['#c8ae68', '#e6d297', '#cdb571', '#f0dca1'], 42, s); for (let i = 0; i < 3; i++) { const x = hash(i, s, 3) * 15 | 0, y = hash(i, s, 4) * 15 | 0; r(x, y, 3, .5, '#b89b5d'); } break;
        case T.PATH: speckle(g, '#9b7b4f', ['#8a6b43', '#ac8c5d', '#927349', '#b09264'], 42, s); for (let i = 0; i < 5; i++) { const x = hash(i, s, 3) * 15 | 0, y = hash(i, s, 4) * 15 | 0; r(x, y, 1, 1, '#6f665b'); if (i % 2) r(x + 1, y + 1, 1, .5, '#c5a87a'); } break;
        case T.FLOOR:
          // Praça da cidade: blocos de pedra irregulares, com juntas escuras
          // e desgaste leve. As bordas continuam alinhadas ao tile.
          g.fillStyle = '#635d56'; g.fillRect(0, 0, 32, 32);
          for (let row = 0; row < 4; row++) {
            const off = ((row + v) & 1) ? -2 : 0;
            for (let col = -1; col < 4; col++) {
              const id = row * 7 + col + s, x = off + col * 5, y = row * 4;
              const tone = ['#9c958a', '#928a7f', '#a69f94', '#877f74'][(hash(id, s, 33) * 4) | 0];
              r(x + .35, y + .35, 4.3, 3.25, tone);
              r(x + .8, y + .7, 2.2, .45, shade(tone, 1.12));
              if (hash(id, s, 34) > .82) r(x + 2, y + 2, 1.1, .45, '#6e675f');
            }
          }
          r(0, 0, 16, .45, '#c1b9ab'); r(0, 15.55, 16, .45, '#514c46');
          break;
        case T.WALL:
          // Muralha com coroamento claro, pedras maiores e base sombreada.
          g.fillStyle = '#3f3b37'; g.fillRect(0, 0, 32, 32);
          r(0, 0, 16, 1.3, '#b5ada1'); r(0, 1.3, 16, .7, '#716a63');
          for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) {
            const id = row * 9 + col + s, x = col * 6 + ((row + v) % 2 ? 3 : 0), y = row * 3.55 + 1.4;
            const tone = ['#827b73', '#756e67', '#908980', '#69635e'][(hash(id, s, 51) * 4) | 0];
            r(x + .35, y + .45, 5.1, 2.75, tone); r(x + .7, y + .75, 3.3, .4, shade(tone, 1.2));
            if (hash(id, s, 52) > .86) r(x + 2.2, y + 1.6, .5, 1.1, '#514c47');
          }
          r(0, 13.8, 16, 2.2, '#34312e'); r(0, 13.8, 16, .45, '#a0978b');
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

  // Fachadas do centro: mantêm a leitura pixel-art e encaixam exatamente nos
  // 4 x 3 tiles de parede que o servidor marca como sólidos.
  // Arte da cidade pintada (2x da resolução do mundo). Enquanto não carrega, usa a versão desenhada no código.
  const TOWN = {};
  ['shop-forge', 'shop-potion', 'shop-guild', 'shop-travel', 'fountain', 'lamp'].forEach(n => {
    const im = new Image(); im.onload = () => { TOWN[n] = im; }; im.src = 'assets/world/town/' + n + '.png?v=gpt1';
  });
  function townLamp() { return TOWN.lamp || null; }
  function townShop(kind) {
    if (TOWN['shop-' + kind]) return TOWN['shop-' + kind];
    return memo('town-shop-' + kind, () => {
      const c = mk(128, 112), g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      const skin = {
        forge:  { roof: '#9d4c2e', roofHi: '#df7950', awning: '#e0a03d', sign: 'FORJA', icon: '⚒' },
        potion: { roof: '#395a91', roofHi: '#6290d1', awning: '#b94f72', sign: 'POÇÕES', icon: '✦' },
        guild:  { roof: '#5a487f', roofHi: '#9074bb', awning: '#d1ad55', sign: 'MISSÕES', icon: '!' },
        travel: { roof: '#356957', roofHi: '#62a580', awning: '#4f8fd0', sign: 'VIAGENS', icon: '↟' }
      }[kind] || { roof: '#70482d', roofHi: '#a87044', awning: '#d1ad55', sign: 'LOJA', icon: '•' };
      const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
      // Sombra no chão e fundação de pedra.
      px(5, 101, 118, 7, 'rgba(22,16,13,.38)');
      px(8, 61, 112, 40, '#4a4038');
      for (let y = 64; y < 100; y += 9) for (let x = 10 + ((y / 9) % 2 ? 8 : 0); x < 118; x += 20) {
        px(x, y, 18, 7, '#71685d'); px(x + 1, y + 1, 16, 1, '#958b7d');
      }
      // Telhado em camadas, com beiral e contorno escuro.
      px(3, 40, 122, 22, '#271a16');
      for (let y = 12; y < 55; y += 7) {
        const inset = Math.max(7, 47 - y);
        px(inset, y, 128 - inset * 2, 8, skin.roof);
        px(inset + 3, y + 1, 128 - inset * 2 - 6, 2, skin.roofHi);
        for (let x = inset + ((y / 7) % 2 ? 6 : 0); x < 128 - inset - 2; x += 13) px(x, y + 5, 10, 1, '#63311f');
      }
      px(3, 55, 122, 6, '#2a1b15'); px(6, 56, 116, 2, '#e0b56c');
      // Postes, porta e janelas iluminadas.
      px(12, 61, 7, 42, '#42291c'); px(15, 62, 2, 38, '#a86b35');
      px(109, 61, 7, 42, '#42291c'); px(110, 62, 2, 38, '#a86b35');
      px(52, 72, 24, 30, '#2b1c19'); px(55, 75, 18, 27, '#704227'); px(63, 76, 2, 25, '#c9934d');
      for (const x of [27, 88]) { px(x, 72, 16, 18, '#2d241d'); px(x + 3, 75, 10, 11, '#f4c56c'); px(x + 4, 76, 8, 3, '#fff0a2'); }
      // Placa e toldo que identificam a atividade sem usar imagem externa.
      px(35, 45, 58, 18, '#241813'); px(37, 47, 54, 14, '#b98642'); px(39, 49, 50, 10, '#ead18a');
      g.fillStyle = '#3a2418'; g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(skin.sign, 64, 54);
      px(21, 62, 29, 9, skin.awning); px(79, 62, 29, 9, skin.awning);
      for (let x = 22; x < 50; x += 7) px(x, 62, 3, 9, '#f5dfad');
      for (let x = 80; x < 108; x += 7) px(x, 62, 3, 9, '#f5dfad');
      g.fillStyle = '#fff3b0'; g.font = 'bold 14px monospace'; g.fillText(skin.icon, 64, 28);
      return c;
    });
  }
  function townFountain() {
    if (TOWN.fountain) return TOWN.fountain;
    return memo('town-fountain', () => {
      const c = mk(64, 72), g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
      px(5, 55, 54, 10, 'rgba(20,14,10,.35)');
      px(4, 43, 56, 17, '#3c3938'); px(7, 39, 50, 18, '#7f7b72'); px(10, 41, 44, 14, '#c1b9a6');
      px(14, 43, 36, 10, '#1769a6'); px(17, 44, 30, 7, '#39a9d6'); px(21, 44, 20, 2, '#b4f5ff');
      px(25, 21, 14, 24, '#5c5b58'); px(27, 19, 10, 26, '#bcb5a4'); px(29, 9, 6, 12, '#d9c44e');
      px(31, 2, 2, 13, '#8feaff'); px(27, 12, 10, 3, '#57c9ec'); px(24, 16, 16, 3, '#87e8ff');
      px(17, 57, 30, 4, '#9f9789'); px(22, 61, 20, 3, '#69645e');
      return c;
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
      if (id === 'ice') { disc(r, 8, 7, 4, '#49cfff'); disc(r, 7, 6, 2, '#b9f8ff'); r(7, 10, 2, 4, '#168dc4'); r(5, 13, 6, 1.5, '#62ddff'); }
      if (id === 'storm') { const pts = [[9, 1], [7, 4], [9, 5], [6, 9], [8, 10], [5, 14]]; for (const [x, y] of pts) r(x, y, 3, 2, '#ff6'); r(7, 7, 2, 2, '#c8f'); }
      return c;
    });
  }

  // ------------------------------------------------------------ CHÃO CONTÍNUO E EM CACHE
  // Água, ponte e mato são padrões ancorados no MUNDO (sem emendas entre tiles).
  // Todo o chão parado é desenhado uma vez em "pedaços" (8x8 tiles) e guardado;
  // a cada quadro só se desenha 1 preenchimento de água animada + ~12 pedaços.
  const GIMG = {};
  // O mapa preserva as texturas modernas; os personagens e o HUD fazem a
  // leitura clássica de RPG mobile sem transformar o mundo em baixa resolução.
  const GFILES = ['water-seamless.jpg', 'grass-pixel.png'];
  GFILES.forEach(n => { const im = new Image(); im.onload = () => { GIMG[n] = im; chunks.clear(); }; im.src = 'assets/world/' + n; });
  // Texturas contínuas opcionais (calçamento da praça, terra e areia): ancoradas no mundo, sem emenda entre tiles.
  const GOPT = { [T.FLOOR]: 'plaza.jpg', [T.PATH]: 'dirt.jpg', [T.SAND]: 'sand.jpg' };
  Object.values(GOPT).forEach(n => { const im = new Image(); im.onload = () => { GIMG[n] = im; chunks.clear(); }; im.src = 'assets/world/ground/' + n + '?v=gpt1'; });
  const gReady = () => GFILES.every(n => GIMG[n]) && typeof DOMMatrix !== 'undefined';
  function pats(c) {
    const P = { water: c.createPattern(GIMG['water-seamless.jpg'], 'repeat'), grass: c.createPattern(GIMG['grass-pixel.png'], 'repeat') };
    for (const t in GOPT) if (GIMG[GOPT[t]]) P[t] = c.createPattern(GIMG[GOPT[t]], 'repeat');
    return P;
  }
  // escala de cada textura de 512 px (0,5 = repete a cada 8 tiles; o calçamento usa pedras maiores)
  const GSCALE = { [T.FLOOR]: 0.2, [T.PATH]: 0.5, [T.SAND]: 0.5 };
  const grassy = q => q === T.GRASS || q === T.FLOWER || q === T.TREE;
  // Borda orgânica de grama por cima de terra/areia: tira o aspecto de "quadradinho" entre terrenos.
  function grassFringe(c, x, y, dx, dy, at, P, ox, oy) {
    const n = grassy(at(x, y - 1)), s = grassy(at(x, y + 1)), w = grassy(at(x - 1, y)), e = grassy(at(x + 1, y));
    const nw = grassy(at(x - 1, y - 1)), ne = grassy(at(x + 1, y - 1)), sw = grassy(at(x - 1, y + 1)), se = grassy(at(x + 1, y + 1));
    if (!(n || s || w || e || nw || ne || sw || se)) return;
    const wx = x * 32, wy = y * 32, d = u => 5.5 + 2.6 * Math.sin(u * 0.17) + 1.6 * Math.sin(u * 0.43 + 1.3) + 0.8 * Math.sin(u * 1.1 + 0.4);
    const path = new Path2D();
    const edge = (side) => {
      path.moveTo(side === 3 ? dx + 32 : dx, side === 1 ? dy + 32 : dy);
      for (let i = 0; i <= 32; i += 1) {
        const k = d((side < 2 ? wx : wy) + i);
        if (side === 0) path.lineTo(dx + i, dy + k); else if (side === 1) path.lineTo(dx + i, dy + 32 - k);
        else if (side === 2) path.lineTo(dx + k, dy + i); else path.lineTo(dx + 32 - k, dy + i);
      }
      if (side === 0) path.lineTo(dx + 32, dy); else if (side === 1) path.lineTo(dx + 32, dy + 32);
      else if (side === 2) path.lineTo(dx, dy + 32); else path.lineTo(dx + 32, dy + 32);
      path.closePath();
    };
    if (n) edge(0); if (s) edge(1); if (w) edge(2); if (e) edge(3);
    const corner = (cx, cy) => { path.moveTo(cx, cy); path.arc(cx, cy, 6.5 + 2 * Math.sin(wx * 0.3 + wy * 0.7), 0, Math.PI * 2); };
    if (nw && !n && !w) corner(dx, dy); if (ne && !n && !e) corner(dx + 32, dy);
    if (sw && !s && !w) corner(dx, dy + 32); if (se && !s && !e) corner(dx + 32, dy + 32);
    c.save(); c.clip(path); fillPat(c, P.grass, ox, oy, 0.25, dx, dy, 32, 32); c.restore();
  }
  function fillPat(c, pat, tx, ty, sc, dx, dy, w, h) { pat.setTransform(new DOMMatrix([sc, 0, 0, sc, tx, ty])); c.fillStyle = pat; c.fillRect(dx, dy, w, h); }
  const wob = u => 3.4 + 1.4 * Math.sin(u * 0.21) + 0.8 * Math.sin(u * 0.53 + 1.7);
  const BANK = { [T.SAND]: '#d9c283', [T.PATH]: '#a9875a', [T.FLOOR]: '#9c9484', [T.WALL]: '#6b655d', [T.SNOW]: '#e3ebf2', [T.SNOWROCK]: '#e3ebf2', [T.CAVE]: '#4a3b2f', [T.CAVEWALL]: '#3a2f27' };
  const bankColor = k => BANK[k] || '#c9b47c';
  function shoreEdge(c, side, dx, dy, wx, wy, col) {
    const pts = [];
    for (let i = 0; i <= 32; i += 2) {
      const d = wob((side < 2 ? wx : wy) + i);
      pts.push(side === 0 ? [dx + i, dy + d] : side === 1 ? [dx + i, dy + 32 - d] : side === 2 ? [dx + d, dy + i] : [dx + 32 - d, dy + i]);
    }
    const g = side === 0 ? c.createLinearGradient(0, dy, 0, dy + 13) : side === 1 ? c.createLinearGradient(0, dy + 32, 0, dy + 19)
      : side === 2 ? c.createLinearGradient(dx, 0, dx + 13, 0) : c.createLinearGradient(dx + 32, 0, dx + 19, 0);
    g.addColorStop(0, 'rgba(6,30,60,.38)'); g.addColorStop(1, 'rgba(6,30,60,0)');
    c.fillStyle = g; c.fillRect(dx, dy, 32, 32);
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const q of pts) c.lineTo(q[0], q[1]);
    if (side === 0) { c.lineTo(dx + 32, dy); c.lineTo(dx, dy); } else if (side === 1) { c.lineTo(dx + 32, dy + 32); c.lineTo(dx, dy + 32); }
    else if (side === 2) { c.lineTo(dx, dy + 32); c.lineTo(dx, dy); } else { c.lineTo(dx + 32, dy + 32); c.lineTo(dx + 32, dy); }
    c.closePath(); c.fillStyle = col; c.fill();
    c.lineWidth = 1.6; c.strokeStyle = 'rgba(90,70,40,.45)';
    c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke();
    const o = 1.6, of = side === 0 ? [0, o] : side === 1 ? [0, -o] : side === 2 ? [o, 0] : [-o, 0];
    c.lineWidth = 1.2; c.strokeStyle = 'rgba(235,250,255,.55)';
    c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0] + of[0], q[1] + of[1]) : c.moveTo(q[0] + of[0], q[1] + of[1])); c.stroke();
  }
  // margens/sombras desenhadas por cima da água (a água em si fica transparente no pedaço)
  function waterOverlay(c, x, y, dx, dy, at) {
    const land = q => q !== T.WATER && q !== T.BRIDGE;
    const n = at(x, y - 1), s = at(x, y + 1), w = at(x - 1, y), e = at(x + 1, y);
    const shade = (x0, y0, x1, y1) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(dx, dy, 32, 32); };
    if (n === T.BRIDGE) shade(0, dy, 0, dy + 9); if (s === T.BRIDGE) shade(0, dy + 32, 0, dy + 26);
    if (w === T.BRIDGE) shade(dx, 0, dx + 9, 0); if (e === T.BRIDGE) shade(dx + 32, 0, dx + 26, 0);
    const wx = x * 32, wy = y * 32;
    if (land(n)) shoreEdge(c, 0, dx, dy, wx, wy, bankColor(n));
    if (land(s)) shoreEdge(c, 1, dx, dy, wx, wy, bankColor(s));
    if (land(w)) shoreEdge(c, 2, dx, dy, wx, wy, bankColor(w));
    if (land(e)) shoreEdge(c, 3, dx, dy, wx, wy, bankColor(e));
    const corner = (cx, cy, q, ang) => {
      c.fillStyle = bankColor(q); c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 5.2, ang, ang + Math.PI / 2); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(235,250,255,.55)'; c.lineWidth = 1.2; c.beginPath(); c.arc(cx, cy, 6.6, ang, ang + Math.PI / 2); c.stroke();
    };
    const nw = at(x - 1, y - 1), ne = at(x + 1, y - 1), sw = at(x - 1, y + 1), se = at(x + 1, y + 1);
    if (!land(n) && !land(w) && land(nw)) corner(dx, dy, nw, 0);
    if (!land(n) && !land(e) && land(ne)) corner(dx + 32, dy, ne, Math.PI / 2);
    if (!land(s) && !land(e) && land(se)) corner(dx + 32, dy + 32, se, Math.PI);
    if (!land(s) && !land(w) && land(sw)) corner(dx, dy + 32, sw, -Math.PI / 2);
  }
  function bridgeTile(c, x, y, dx, dy, at) {
    // A leitura da direção usa a estrada só como extensão nas extremidades.
    // Antes, uma estrada paralela podia virar a textura 90° e abrir falhas.
    const linked = (xx, yy) => { const q = at(xx, yy); return q === T.BRIDGE || q === T.PATH; };
    const run = (ax, ay) => { let n = 0; for (let k = 1; k <= 4 && linked(x + ax * k, y + ay * k); k++) n++; return n; };
    const horizontal = run(-1, 0) + run(1, 0) >= run(0, -1) + run(0, 1);
    const wood = '#8e6038', light = '#bd8a52', dark = '#432819', edge = '#26170f';
    c.save();
    if (horizontal) {
      c.fillStyle = edge; c.fillRect(dx, dy + 2, 32, 28);
      c.fillStyle = wood; c.fillRect(dx + 2, dy + 4, 28, 24);
      for (let px = 3; px < 31; px += 7) { c.fillStyle = dark; c.fillRect(dx + px, dy + 4, 1, 24); c.fillStyle = light; c.fillRect(dx + px + 1, dy + 5, 1, 22); }
      c.fillStyle = '#51311d'; c.fillRect(dx, dy, 32, 3); c.fillRect(dx, dy + 29, 32, 3);
      c.fillStyle = '#c6975d'; c.fillRect(dx, dy + 1, 32, 1); c.fillRect(dx, dy + 29, 32, 1);
    } else {
      c.fillStyle = edge; c.fillRect(dx + 2, dy, 28, 32);
      c.fillStyle = wood; c.fillRect(dx + 4, dy + 2, 24, 28);
      for (let py = 3; py < 31; py += 7) { c.fillStyle = dark; c.fillRect(dx + 4, dy + py, 24, 1); c.fillStyle = light; c.fillRect(dx + 5, dy + py + 1, 22, 1); }
      c.fillStyle = '#51311d'; c.fillRect(dx, dy, 3, 32); c.fillRect(dx + 29, dy, 3, 32);
      c.fillStyle = '#c6975d'; c.fillRect(dx + 1, dy, 1, 32); c.fillRect(dx + 29, dy, 1, 32);
    }
    c.restore();
  }
  function grassTile(c, t, x, y, dx, dy, ox, oy, P) {
    fillPat(c, P.grass, ox, oy, 0.25, dx, dy, 32, 32);
    if (t === T.FLOWER) for (let i = 0; i < 3; i++) {
      const fx = dx + 3 + hash(i, x, y) * 24, fy = dy + 3 + hash(x, i, y) * 24, col = ['#f3e04a', '#f06a8a', '#ffffff', '#9a7cf0'][(hash(i, y, x) * 4) | 0];
      c.fillStyle = col; for (const [a, b] of [[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6]]) { c.beginPath(); c.arc(fx + a, fy + b, 1.4, 0, 7); c.fill(); }
      c.fillStyle = '#e9a020'; c.beginPath(); c.arc(fx, fy, 1.1, 0, 7); c.fill();
    }
  }
  // chão embaixo da árvore: neve/terra escura quando a árvore está nesses terrenos
  function treeBase(x, y, at) {
    for (const [a, b] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const q = at(x + a, y + b); if (q === T.SNOW || q === T.SNOWROCK) return T.SNOW; if (q === T.CAVE || q === T.CAVEWALL) return T.CAVE; if (q === T.GRASS || q === T.FLOWER) return T.GRASS;
    }
    return T.GRASS;
  }
  // cache de pedaços (LRU simples)
  const CHK = 8, CPX = CHK * 32, chunks = new Map(), MAX_CHUNKS = 30;
  function chunk(cx, cy, at, RS) {
    const key = cx + ',' + cy + ',' + RS;
    let cv = chunks.get(key);
    if (cv) { chunks.delete(key); chunks.set(key, cv); return cv; }
    cv = mk(Math.ceil(CPX * RS), Math.ceil(CPX * RS));
    const c = cv.getContext('2d'); c.scale(RS, RS); c.imageSmoothingEnabled = false;
    const P = pats(c), ox = -cx * CPX, oy = -cy * CPX;
    let wet = false;
    for (let j = 0; j < CHK; j++) for (let i = 0; i < CHK; i++) {
      const x = cx * CHK + i, y = cy * CHK + j, t = at(x, y), dx = i * 32, dy = j * 32;
      if (t === T.WATER || t === T.BRIDGE) wet = true;
      if (t === T.WATER) waterOverlay(c, x, y, dx, dy, at);
      else if (t === T.BRIDGE) bridgeTile(c, x, y, dx, dy, at);
      else if (t === T.TREE && treeBase(x, y, at) !== T.GRASS) c.drawImage(tile(treeBase(x, y, at), hash(x, y, 9) * 4 | 0, 0), dx, dy, 32, 32);
      else if (t === T.GRASS || t === T.TREE || t === T.FLOWER) grassTile(c, t, x, y, dx, dy, ox, oy, P);
      else if (P[t]) { fillPat(c, P[t], ox, oy, GSCALE[t], dx, dy, 32, 32); if (t !== T.FLOOR) grassFringe(c, x, y, dx, dy, at, P, ox, oy); }
      else { c.drawImage(tile(t, hash(x, y, 9) * 4 | 0, 0), dx, dy, 32, 32); if (t === T.PATH || t === T.SAND) grassFringe(c, x, y, dx, dy, at, P, ox, oy); }
    }
    cv.wet = wet;
    chunks.set(key, cv);
    while (chunks.size > MAX_CHUNKS) chunks.delete(chunks.keys().next().value);
    return cv;
  }
  let mainPat = null, mainCtx = null;
  function drawGround(ctx, x0, y0, x1, y1, ox, oy, now, at, K) {
    if (!gReady()) {   // texturas ainda carregando: desenho simples
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ctx.drawImage(tile(at(x, y), hash(x, y, 9) * 4 | 0, 0), x * 32 + ox, y * 32 + oy, 32.05, 32.05);
      return;
    }
    if (mainCtx !== ctx) { mainCtx = ctx; mainPat = ctx.createPattern(GIMG['water-seamless.jpg'], 'repeat'); }
    const t = now / 1000;
    const RS = K >= 2.6 ? 2.5 : K >= 1.8 ? 2 : 1.5;
    const cx0 = Math.floor(x0 / CHK), cx1 = Math.floor(x1 / CHK), cy0 = Math.floor(y0 / CHK), cy1 = Math.floor(y1 / CHK);
    // água animada só onde há água (antes pintava a tela inteira a cada quadro)
    const wx = ox + t * 5 + Math.sin(t * 0.6) * 3, wy = oy + t * 2.5;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = chunks.get(cx + ',' + cy + ',' + RS);
      if (!c || c.wet) fillPat(ctx, mainPat, wx, wy, 0.25, cx * CPX + ox, cy * CPX + oy, CPX + 0.1, CPX + 0.1);
    }
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++)
      ctx.drawImage(chunk(cx, cy, at, RS), cx * CPX + ox, cy * CPX + oy, CPX + 0.1, CPX + 0.1);
    ctx.imageSmoothingEnabled = sm;
    // prepara 1 pedaço vizinho por quadro (evita engasgo ao andar para área nova)
    for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
      if (!chunks.has(cx + ',' + cy + ',' + RS)) { chunk(cx, cy, at, RS); return; }
    }
  }
  const resetGround = () => chunks.clear();

  return { tile, drawGround, resetGround, treeObj, rockObj, townShop, townFountain, townLamp, entity, itemIcon, spellIcon, hash, mk };
})();
