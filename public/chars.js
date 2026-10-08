// Personagens em camadas (paper doll) a partir das folhas PNG geradas — As Aventuras do Piper
const CHARS = (function () {
  const D = DEFS, SHEETS = {}, cache = new Map();
  const ASSET_REV = 'motion-pixel-5';
  let CW = 128, CH = 192, ready = false;

  async function load(onProgress) {
    const man = await (await fetch('assets/chars/manifest.json')).json();
    CW = man.cell[0]; CH = man.cell[1];
    let done = 0;
    await Promise.all(man.sheets.map(n => new Promise(res => {
      const im = new Image(); im.onload = () => { SHEETS[n] = im; done++; onProgress && onProgress(done / man.sheets.length); res(); };
      im.onerror = () => { done++; res(); }; im.src = `assets/chars/${n}.png?rev=${ASSET_REV}`;
    })));
    ready = true;
  }
  // look: c|voc|armor|helmet|weapon|shield|skin|hairStyle|hairColor|beard
  function layers(look, dir) {
    const [, voc, armor, helm, wpn, shd, skin, hs, hc, beard] = look.split('|');
    const isRobeNpc = armor === 'n_green' || armor === 'n_white';
    let arm = null;
    if (voc === 'wizard') arm = SHEETS['robe_' + (armor || 'a_cloth')] ? 'robe_' + (armor || 'a_cloth') : 'robe_a_cloth';
    else if (isRobeNpc) arm = 'robe_' + armor;
    else if (armor) arm = 'armor_' + armor;
    const L = {
      hairb: hs === 'longo' ? `hairb_longo_${hc}` : null,
      body: 'body_' + (skin || 0), arm,
      beard: beard ? 'beard_' + beard : null,
      hair: `hair_${hs || 'curto'}_${hc || 'castanho'}`,
      helm: helm ? 'helm_' + helm : (voc === 'wizard' ? 'hat_' + (armor && SHEETS['hat_' + armor] ? armor : 'a_cloth') : null),
      wpn: wpn ? 'wpn_' + wpn : null, shd: shd ? 'shd_' + shd : null
    };
    const order = dir === 0 ? ['hairb', 'body', 'arm', 'beard', 'hair', 'helm', 'shd', 'wpn']
      : dir === 2 ? ['wpn', 'body', 'arm', 'hairb', 'hair', 'helm', 'shd']
      : ['shd', 'hairb', 'body', 'arm', 'beard', 'hair', 'helm', 'wpn'];
    return order.map(k => L[k]).filter(Boolean);
  }
  function sprite(look, dir, frame) {
    const key = look + '#' + dir + frame;
    let c = cache.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const g = c.getContext('2d');
    // Os corpos principais agora são folhas completas de alta qualidade.
    // Usar a folha inteira evita que cabelo, armadura e armas do sistema
    // antigo sejam desenhados por cima do novo personagem.
    const [, voc, armor, , weapon] = look.split('|');
    // NPCs recebem corpos próprios — guarda, ferreiro, curandeiro e sábio —
    // em vez de vestirem o mesmo guerreiro que o jogador controla.
    let body = 'body_' + (voc === 'wizard' ? 1 : 0);
    if (weapon === 'spear') body = 'body_npc_guard';
    else if (armor === 'n_apron') body = 'body_npc_blacksmith';
    else if (armor === 'n_green') body = 'body_npc_healer';
    else if (armor === 'n_white' || voc === 'npc') body = 'body_npc_sage';
    const direct = SHEETS[body];
    const cols = direct ? Math.floor(direct.width / CW) : 0;
    if (direct && cols >= 3 && direct.height === CH * 4) {
      // Folhas atuais têm oito poses; folhas antigas de três colunas seguem
      // compatíveis enquanto os recursos atualizam no navegador.
      const frameIndex = cols >= 8 ? Math.max(0, Math.min(7, frame | 0)) : ((frame | 0) % cols + cols) % cols;
      g.drawImage(direct, frameIndex * CW, dir * CH, CW, CH, 0, 0, CW, CH);
      if (ready) cache.set(key, c);
      return c;
    }
    for (const n of layers(look, dir)) { const im = SHEETS[n]; if (im) g.drawImage(im, frame * CW, dir * CH, CW, CH, 0, 0, CW, CH); }
    if (ready) cache.set(key, c);
    return c;
  }
  function portrait(look, size) {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(sprite(look, 0, 0), CW * 0.1, CH * 0.0, CW * 0.8, CW * 0.8, 0, 0, size, size);
    return c;
  }
  const lookOf = (voc, eq, app) => ['c', voc, eq.armor || '', eq.helmet || '', eq.weapon || '', eq.shield || '', app.skin, app.hs, app.hc, ''].join('|');
  return { load, sprite, portrait, lookOf, get CW() { return CW; }, get CH() { return CH; }, get ready() { return ready; } };
})();
