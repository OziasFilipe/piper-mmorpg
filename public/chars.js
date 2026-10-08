// Personagens em camadas (paper doll) a partir das folhas PNG geradas — As Aventuras do Piper
const CHARS = (function () {
  const D = DEFS, SHEETS = {}, ANIMATIONS = {}, cache = new Map();
  const ASSET_REV = 'motion-pixel-actions-1';
  let CW = 128, CH = 192, ready = false;

  async function load(onProgress) {
    const man = await (await fetch(`assets/chars/manifest.json?rev=${ASSET_REV}`)).json();
    CW = man.cell[0]; CH = man.cell[1];
    // Cada ação do herói é carregada como um recurso independente. Assim um
    // walk.png ou attack.png pode ganhar quadros sem alterar a folha dos NPCs.
    let clips = [];
    if (man.animationManifest) {
      try {
        const index = await (await fetch(`assets/chars/${man.animationManifest}?rev=${ASSET_REV}`)).json();
        const records = await Promise.all(Object.entries(index).flatMap(([actor, actions]) =>
          Object.entries(actions).map(async ([action, definition]) => {
            const data = await (await fetch(`assets/chars/${definition}?rev=${ASSET_REV}`)).json();
            const folder = definition.slice(0, definition.lastIndexOf('/') + 1);
            return { actor, action, ...data, path: folder + data.sheet };
          })
        ));
        clips = records;
      } catch (err) { console.warn('Animações separadas indisponíveis; usando folha legada.', err); }
    }
    let done = 0;
    const resources = [
      ...man.sheets.map(name => ({ name, path: `${name}.png` })),
      ...clips.map(clip => ({ ...clip, name: `animation:${clip.actor}:${clip.action}` }))
    ];
    await Promise.all(resources.map(resource => new Promise(res => {
      const im = new Image(); im.onload = () => {
        if (resource.actor) {
          (ANIMATIONS[resource.actor] ||= {})[resource.action] = { ...resource, image: im };
        } else SHEETS[resource.name] = im;
        done++; onProgress && onProgress(done / resources.length); res();
      };
      im.onerror = () => { done++; onProgress && onProgress(done / resources.length); res(); };
      im.src = `assets/chars/${resource.path}?rev=${ASSET_REV}`;
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
  // ---- Quadros do mesmo tamanho: as folhas pintadas trazem pequenas diferenças de escala e de
  // altura dos pés entre direções, ações e poses. Cada direção/ação recebe a mesma escala da pose
  // parada de frente, e todo quadro fica com os pés exatamente na linha do chão (185 de 192).
  const BASE_Y = 185, norm = new Map(), ncache = new Map();
  function bbox(cv) {
    try {
      const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return x1 < 0 ? null : { y1, h: y1 - y0 + 1, cx: (x0 + x1 + 1) / 2 };
    } catch (e) { return null; }
  }
  function sprite(look, dir, frame, action = 'idle') {
    const raw = rawSprite(look, dir, frame, action);
    if (!ready) return raw;
    const key = look + '#' + dir + '#' + frame + '#' + action;
    let out = ncache.get(key); if (out) return out;
    const nk = look + '#' + dir + '#' + action;
    let n = norm.get(nk);
    if (!n) {
      const ref = bbox(rawSprite(look, 0, 0, 'idle')), b0 = bbox(rawSprite(look, dir, 0, action));
      n = ref && b0 ? { s: Math.max(0.85, Math.min(1.15, ref.h / b0.h)), cx: b0.cx } : null;
      norm.set(nk, n || false);
    }
    const b = n && bbox(raw);
    if (!b) { ncache.set(key, raw); return raw; }
    out = document.createElement('canvas'); out.width = raw.width; out.height = raw.height;
    const g = out.getContext('2d'); g.imageSmoothingEnabled = n.s !== 1;
    g.setTransform(n.s, 0, 0, n.s, raw.width / 2 - n.s * n.cx, BASE_Y - n.s * (b.y1 + 1)); g.drawImage(raw, 0, 0);
    ncache.set(key, out); if (ncache.size > 3000) ncache.delete(ncache.keys().next().value);
    return out;
  }
  function rawSprite(look, dir, frame, action = 'idle') {
    const key = look + '#' + dir + frame + '#' + action;
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
    const actor = voc === 'wizard' ? 'wizard' : 'warrior';
    const clip = ANIMATIONS[actor] && ANIMATIONS[actor][action];
    if (clip && clip.image && weapon !== 'spear' && armor !== 'n_apron' && armor !== 'n_green' && armor !== 'n_white' && voc !== 'npc') {
      const count = Math.max(1, clip.frames | 0 || Math.floor(clip.image.width / CW));
      const clipFrame = clip.loop ? ((frame % count) + count) % count : Math.max(0, Math.min(count - 1, frame | 0));
      g.drawImage(clip.image, clipFrame * CW, dir * CH, CW, CH, 0, 0, CW, CH);
      if (ready) cache.set(key, c);
      return c;
    }
    const direct = SHEETS[body];
    const cols = direct ? Math.floor(direct.width / CW) : 0;
    if (direct && cols >= 3 && direct.height === CH * 4) {
      // Heróis usam doze poses; NPCs antigos de oito e folhas legadas de três
      // colunas seguem compatíveis enquanto recursos atualizam no navegador.
      const maxFrame = cols >= 12 ? 11 : cols >= 8 ? 7 : cols - 1;
      const frameIndex = Math.max(0, Math.min(maxFrame, frame | 0));
      g.drawImage(direct, frameIndex * CW, dir * CH, CW, CH, 0, 0, CW, CH);
      if (ready) cache.set(key, c);
      return c;
    }
    for (const n of layers(look, dir)) { const im = SHEETS[n]; if (im) g.drawImage(im, frame * CW, dir * CH, CW, CH, 0, 0, CW, CH); }
    if (ready) cache.set(key, c);
    return c;
  }
  function actionFrame(look, action, elapsed) {
    const [, voc] = look.split('|');
    const clip = ANIMATIONS[voc === 'wizard' ? 'wizard' : 'warrior']?.[action];
    if (!clip) return null;
    const count = Math.max(1, clip.frames | 0 || Math.floor(clip.image.width / CW));
    const index = Math.floor(Math.max(0, elapsed) * (clip.fps || 12) / 1000);
    return clip.loop ? index % count : Math.min(count - 1, index);
  }
  function portrait(look, size) {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(sprite(look, 0, 0), CW * 0.1, CH * 0.0, CW * 0.8, CW * 0.8, 0, 0, size, size);
    return c;
  }
  const lookOf = (voc, eq, app) => ['c', voc, eq.armor || '', eq.helmet || '', eq.weapon || '', eq.shield || '', app.skin, app.hs, app.hc, ''].join('|');
  return { load, sprite, portrait, lookOf, actionFrame, get CW() { return CW; }, get CH() { return CH; }, get ready() { return ready; } };
})();
