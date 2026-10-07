// Folhas exclusivas dos aventureiros jogáveis. O fallback mantém o jogo
// utilizável se uma imagem não puder ser baixada.
const HERO = (() => {
  const sheets = {}, cache = new Map();
  function load(onProgress) {
    const names = ['warrior', 'wizard']; let done = 0;
    return Promise.all(names.map(v => new Promise(resolve => {
      const img = new Image();
      const finish = () => { done++; onProgress && onProgress(done / names.length); resolve(); };
      img.onload = () => { sheets[v] = img; finish(); };
      img.onerror = finish; img.src = `assets/chars/hero-${v}.png`;
    }))).then(() => undefined);
  }
  function vocation(look) { return (look || '').split('|')[1] === 'wizard' ? 'wizard' : 'warrior'; }
  function sprite(look, dir, frame) {
    const voc = vocation(look), sheet = sheets[voc];
    if (!sheet) return null;
    const key = `${voc}:${dir}:${frame}`;
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas'); c.width = 128; c.height = 192;
    c.getContext('2d').drawImage(sheet, frame * 128, dir * 192, 128, 192, 0, 0, 128, 192);
    cache.set(key, c); return c;
  }
  function portrait(look, size) {
    const body = sprite(look, 0, 0); if (!body) return null;
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    c.getContext('2d').drawImage(body, 14, 3, 100, 156, 0, 0, size, size); return c;
  }
  return { load, sprite, portrait };
})();
