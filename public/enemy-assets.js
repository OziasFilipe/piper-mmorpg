// Bestiário pintado. Os quadros estáticos recebem vida no renderer por meio
// de balanço, avanço de ataque e clarão de dano.
const ENEMIES = (() => {
  const names = ['rabbit', 'rat', 'snake', 'wolf', 'goblin', 'bear', 'orc', 'shaman', 'troll', 'scorpion', 'mummy', 'skeleton', 'spider', 'dragon'];
  const images = {};
  const ASSET_REV = 'motion-pixel-5';
  function load(onProgress) {
    let done = 0;
    return Promise.all(names.map(name => new Promise(resolve => {
      const img = new Image();
      const finish = () => { done++; onProgress && onProgress(done / names.length); resolve(); };
      img.onload = () => { images[name] = img; finish(); };
      img.onerror = finish; img.src = `assets/enemies/${name}.png?rev=${ASSET_REV}`;
    }))).then(() => undefined);
  }
  const cache = new Map(), refs = new Map();
  function box(c) {
    try {
      const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return x1 < 0 ? null : { y1, h: y1 - y0 + 1, cx: (x0 + x1 + 1) / 2 };
    } catch (e) { return null; }
  }
  function refBox(name, sheet, F) {
    if (refs.has(name)) return refs.get(name);
    const c = document.createElement('canvas'); c.width = F; c.height = F; c.getContext('2d').drawImage(sheet, 0, 0, F, F, 0, 0, F, F);
    const r = box(c); refs.set(name, r); return r;
  }
  function sprite(name, frame = 0, faceLeft = false) {
    const sheet = images[name]; if (!sheet) return null;
    const frames = Math.max(1, Math.floor(sheet.width / sheet.height));
    const step = Math.max(0, Math.min(frames - 1, frame | 0));
    const key = `${name}:${step}:${faceLeft ? 'l' : 'r'}`;
    if (cache.has(key)) return cache.get(key);
    const F = sheet.height;   // tamanho do quadro = altura da folha (folhas reduzidas para carregar rápido)
    const c = document.createElement('canvas'); c.width = F; c.height = F;
    const g = c.getContext('2d');
    if (faceLeft) { g.translate(F, 0); g.scale(-1, 1); }
    const ref = refBox(name, sheet, F), raw = document.createElement('canvas'); raw.width = F; raw.height = F;
    raw.getContext('2d').drawImage(sheet, step * F, 0, F, F, 0, 0, F, F);
    const b = ref && box(raw);
    if (b) {   // mesma altura (±6%) e pés na mesma linha do quadro parado
      const s = Math.max(0.94, Math.min(1.06, ref.h / b.h));
      g.drawImage(raw, 0, 0, F, F, ref.cx - s * b.cx, ref.y1 + 1 - s * (b.y1 + 1), F * s, F * s);
    } else g.drawImage(raw, 0, 0);
    cache.set(key, c); return c;
  }
  return { load, sprite };
})();
