// Bestiário pintado. Os quadros estáticos recebem vida no renderer por meio
// de balanço, avanço de ataque e clarão de dano.
const ENEMIES = (() => {
  const names = ['rabbit', 'rat', 'snake', 'wolf', 'goblin', 'bear', 'orc', 'shaman', 'troll', 'scorpion', 'mummy', 'skeleton', 'spider', 'dragon'];
  const images = {};
  const ASSET_REV = 'motion-pixel-3';
  function load(onProgress) {
    let done = 0;
    return Promise.all(names.map(name => new Promise(resolve => {
      const img = new Image();
      const finish = () => { done++; onProgress && onProgress(done / names.length); resolve(); };
      img.onload = () => { images[name] = img; finish(); };
      img.onerror = finish; img.src = `assets/enemies/${name}.png?rev=${ASSET_REV}`;
    }))).then(() => undefined);
  }
  const cache = new Map();
  function sprite(name, frame = 0) {
    const sheet = images[name]; if (!sheet) return null;
    const step = Math.max(0, Math.min(4, frame | 0));
    const key = `${name}:${step}`;
    if (cache.has(key)) return cache.get(key);
    const F = sheet.height;   // tamanho do quadro = altura da folha (folhas reduzidas para carregar rápido)
    const c = document.createElement('canvas'); c.width = F; c.height = F;
    c.getContext('2d').drawImage(sheet, step * F, 0, F, F, 0, 0, F, F);
    cache.set(key, c); return c;
  }
  return { load, sprite };
})();
