// Definições compartilhadas — As Aventuras do Piper
(function (root) {
  const D = {};
  D.W = 160; D.H = 160;
  // Portais no fim da estrada de cada terra (2 quadrados de altura, sobre a estrada).
  // Oeste: volta para a terra anterior. Leste: segue para a próxima. Posições locais da região.
  D.portalsOf = r => {
    const P = [], y = D.H >> 1, n = 4;   // n = número de regiões (Vale, Ilha, Picos, Sombrias)
    if (r > 0) P.push({ x: 5, y, to: r - 1, back: true });
    if (r < n - 1) P.push({ x: D.W - 7, y, to: r + 1, back: false });
    return P;
  };
  D.GAME = 'As Aventuras do Piper';
  D.HAIR_STYLES = { curto: 'Curto', longo: 'Longo', rabo: 'Rabo de cavalo' };
  D.HAIR_COLORS = { preto: '#2b2329', castanho: '#6e4024', loiro: '#e6c25e', ruivo: '#c4492b', branco: '#ecebe7', azul: '#3c6bd2', rosa: '#e07ab0' };
  D.SKINS = ['#f7d5b8', '#dca57e', '#8e5b3c'];

  D.T = { GRASS: 0, TREE: 1, WATER: 2, SAND: 3, FLOOR: 4, WALL: 5, CAVE: 6, PATH: 7, ROCK: 8, FLOWER: 9, BRIDGE: 10, CAVEWALL: 11, SNOW: 12, SNOWROCK: 13 };
  D.BLOCK = [0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1];

  // Fórmula clássica de experiência por nível
  D.xpFor = (L) => L <= 1 ? 0 : Math.floor(50 / 3 * (L * L * L - 6 * L * L + 17 * L - 12));

  D.VOC = {
    warrior: { name: 'Guerreiro', hp: 110, hpL: 15, mp: 20, mpL: 4, atk: 6, range: 1, atkSpeed: 1000 },
    wizard:  { name: 'Mago',      hp: 75,  hpL: 8,  mp: 60, mpL: 14, atk: 5, range: 5, atkSpeed: 1300 }
  };

  D.STATS = {
    str: { name: 'Força',      desc: '+2 de ataque corpo a corpo' },
    mag: { name: 'Magia',      desc: '+2 de poder mágico, +5 de mana' },
    dfs: { name: 'Defesa',     desc: '+1 de defesa' },
    vit: { name: 'Vitalidade', desc: '+10 de vida máxima' }
  };

  D.ITEMS = {
    pot_hp:  { name: 'Poção de Vida', type: 'potion', hp: 70, price: 15 },
    pot_hp2: { name: 'Poção Grande de Vida', type: 'potion', hp: 240, price: 70 },
    pot_mp:  { name: 'Poção de Mana', type: 'potion', mp: 50, price: 20 },
    pot_mp2: { name: 'Poção Grande de Mana', type: 'potion', mp: 180, price: 80 },

    w_dagger: { name: 'Adaga', type: 'weapon', voc: 'warrior', atk: 3, lvl: 1, price: 30, look: 'dagger' },
    w_sword:  { name: 'Espada Curta', type: 'weapon', voc: 'warrior', atk: 7, lvl: 3, price: 120, look: 'sword' },
    w_axe:    { name: 'Machado de Batalha', type: 'weapon', voc: 'warrior', atk: 12, lvl: 8, price: 450, look: 'axe' },
    w_long:   { name: 'Espada Longa', type: 'weapon', voc: 'warrior', atk: 18, lvl: 14, price: 1200, look: 'sword2' },
    w_hammer: { name: 'Martelo de Guerra', type: 'weapon', voc: 'warrior', atk: 26, lvl: 22, price: 3500, look: 'hammer' },
    w_dragon: { name: 'Lâmina do Dragão', type: 'weapon', voc: 'warrior', atk: 36, lvl: 30, price: 0, sell: 4000, look: 'dsword' },

    m_wand:   { name: 'Varinha de Aprendiz', type: 'weapon', voc: 'wizard', atk: 3, lvl: 1, price: 30, look: 'wand', orb: '#9ef' },
    m_staff:  { name: 'Cajado de Carvalho', type: 'weapon', voc: 'wizard', atk: 7, lvl: 3, price: 120, look: 'staff', orb: '#7f7' },
    m_ice:    { name: 'Varinha de Gelo', type: 'weapon', voc: 'wizard', atk: 12, lvl: 8, price: 450, look: 'wand', orb: '#6df' },
    m_fire:   { name: 'Cajado Flamejante', type: 'weapon', voc: 'wizard', atk: 18, lvl: 14, price: 1200, look: 'staff', orb: '#f80' },
    m_arcane: { name: 'Cetro Arcano', type: 'weapon', voc: 'wizard', atk: 26, lvl: 22, price: 3500, look: 'staff', orb: '#c6f' },
    m_dragon: { name: 'Cajado do Dragão', type: 'weapon', voc: 'wizard', atk: 36, lvl: 30, price: 0, sell: 4000, look: 'staff', orb: '#f33' },

    a_cloth:   { name: 'Túnica de Pano', type: 'armor', def: 2, lvl: 1, price: 25, color: '#8a7350' },
    a_leather: { name: 'Armadura de Couro', type: 'armor', def: 5, lvl: 4, price: 150, color: '#7a4a24' },
    a_chain:   { name: 'Cota de Malha', type: 'armor', def: 9, lvl: 10, price: 600, color: '#8d96a0' },
    a_plate:   { name: 'Armadura de Placas', type: 'armor', voc: 'warrior', def: 14, lvl: 18, price: 2000, color: '#c9d1da' },
    a_robe:    { name: 'Manto Arcano', type: 'armor', voc: 'wizard', def: 9, lvl: 18, price: 2000, mag: 5, color: '#3a2a8a' },
    a_dragon:  { name: 'Escamas de Dragão', type: 'armor', def: 20, lvl: 28, price: 0, sell: 5000, color: '#a8262a' },

    h_leather: { name: 'Capuz de Couro', type: 'helmet', def: 1, lvl: 1, price: 20, color: '#7a4a24' },
    h_iron:    { name: 'Elmo de Ferro', type: 'helmet', def: 3, lvl: 6, price: 200, color: '#8d96a0' },
    h_steel:   { name: 'Elmo de Aço', type: 'helmet', def: 6, lvl: 15, price: 900, color: '#d2dae2' },

    s_wood:  { name: 'Escudo de Madeira', type: 'shield', voc: 'warrior', def: 2, lvl: 1, price: 40, color: '#8b5a2b' },
    s_iron:  { name: 'Escudo de Ferro', type: 'shield', voc: 'warrior', def: 5, lvl: 8, price: 350, color: '#8d96a0' },
    s_tower: { name: 'Escudo Torre', type: 'shield', voc: 'warrior', def: 9, lvl: 16, price: 1500, color: '#c9d1da' },

    l_cheese: { name: 'Queijo', type: 'loot', sell: 2, color: '#f5d442' },
    l_fur:    { name: 'Pele de Lobo', type: 'loot', sell: 8, color: '#888' },
    l_ear:    { name: 'Orelha de Goblin', type: 'loot', sell: 12, color: '#6a3' },
    l_claw:   { name: 'Garra de Urso', type: 'loot', sell: 15, color: '#ddd' },
    l_tusk:   { name: 'Presa de Orc', type: 'loot', sell: 25, color: '#eed' },
    l_troll:  { name: 'Couro de Troll', type: 'loot', sell: 40, color: '#8a8a4a' },
    l_sting:  { name: 'Ferrão de Escorpião', type: 'loot', sell: 35, color: '#c60' },
    l_wrap:   { name: 'Bandagem Antiga', type: 'loot', sell: 30, color: '#d8cfa8' },
    l_bone:   { name: 'Osso Antigo', type: 'loot', sell: 30, color: '#eee' },
    l_silk:   { name: 'Seda de Aranha', type: 'loot', sell: 45, color: '#ccf' },
    l_scale:  { name: 'Escama de Dragão', type: 'loot', sell: 250, color: '#c22' }
  };

  D.SPELLS = {
    warrior: [
      { id: 'strike',  name: 'Golpe Brutal',      lvl: 1,  mp: 8,  cd: 2500,  type: 'melee', mult: 1.8 },
      { id: 'heal',    name: 'Curar Feridas',     lvl: 4,  mp: 15, cd: 4000,  type: 'heal', base: 25, scale: 4 },
      { id: 'whirl',   name: 'Redemoinho',        lvl: 8,  mp: 25, cd: 6000,  type: 'area', radius: 1, mult: 1.4, fx: 'whirl' },
      { id: 'berserk', name: 'Fúria Berserker',   lvl: 15, mp: 40, cd: 30000, type: 'buff', dur: 12000 }
    ],
    wizard: [
      { id: 'fireball', name: 'Bola de Fogo',       lvl: 1,  mp: 10, cd: 1800, type: 'target', mult: 1.6, range: 6, fx: 'fire' },
      { id: 'heal',     name: 'Cura',               lvl: 3,  mp: 20, cd: 3000, type: 'heal', base: 40, scale: 6 },
      { id: 'ice',      name: 'Lança de Gelo',      lvl: 8,  mp: 25, cd: 3500, type: 'target', mult: 2.4, range: 6, fx: 'ice' },
      { id: 'storm',    name: 'Tempestade Elétrica',lvl: 14, mp: 60, cd: 8000, type: 'area', radius: 3, mult: 1.8, fx: 'energy' }
    ]
  };

  D.MON = {
    rabbit:   { name: 'Coelho', hp: 12, atk: 0, def: 0, xp: 3, spd: 450, passive: true, gold: [0, 0], loot: [] },
    rat:      { name: 'Rato', hp: 22, atk: 5, def: 0, xp: 8, spd: 700, gold: [0, 4], loot: [['l_cheese', 0.3]] },
    snake:    { name: 'Cobra', hp: 32, atk: 7, def: 1, xp: 12, spd: 800, gold: [0, 6], loot: [['pot_hp', 0.05]] },
    wolf:     { name: 'Lobo', hp: 60, atk: 12, def: 2, xp: 25, spd: 450, gold: [0, 0], loot: [['l_fur', 0.5]] },
    goblin:   { name: 'Goblin', hp: 75, atk: 14, def: 3, xp: 32, spd: 600, gold: [3, 15], loot: [['l_ear', 0.4], ['w_dagger', 0.03], ['pot_hp', 0.1], ['h_leather', 0.03]] },
    bear:     { name: 'Urso', hp: 130, atk: 18, def: 4, xp: 48, spd: 650, gold: [0, 0], loot: [['l_claw', 0.5]] },
    orc:      { name: 'Orc', hp: 150, atk: 22, def: 6, xp: 70, spd: 600, gold: [8, 30], loot: [['l_tusk', 0.4], ['w_axe', 0.02], ['a_leather', 0.04], ['s_iron', 0.02]] },
    shaman:   { name: 'Orc Xamã', hp: 110, atk: 20, def: 3, xp: 80, spd: 650, range: 4, proj: 'fire', gold: [10, 35], loot: [['pot_mp', 0.15], ['m_ice', 0.02], ['m_staff', 0.04]] },
    troll:    { name: 'Troll', hp: 240, atk: 30, def: 8, xp: 120, spd: 650, gold: [15, 50], loot: [['l_troll', 0.4], ['h_iron', 0.04], ['a_chain', 0.02]] },
    scorpion: { name: 'Escorpião Gigante', hp: 210, atk: 28, def: 10, xp: 115, spd: 550, gold: [0, 0], loot: [['l_sting', 0.5], ['pot_hp', 0.15]] },
    mummy:    { name: 'Múmia', hp: 290, atk: 32, def: 9, xp: 155, spd: 800, gold: [20, 70], loot: [['l_wrap', 0.5], ['h_steel', 0.02], ['m_fire', 0.015], ['pot_mp2', 0.05]] },
    skeleton: { name: 'Esqueleto', hp: 270, atk: 34, def: 10, xp: 155, spd: 600, gold: [15, 60], loot: [['l_bone', 0.5], ['w_long', 0.015], ['s_tower', 0.01]] },
    spider:   { name: 'Aranha Gigante', hp: 430, atk: 45, def: 12, xp: 270, spd: 500, gold: [0, 0], loot: [['l_silk', 0.5], ['pot_hp2', 0.15], ['a_plate', 0.01], ['a_robe', 0.01]] },
    dragon:   { name: 'Dragão', hp: 1300, atk: 70, def: 20, xp: 950, spd: 700, range: 4, proj: 'fire', gold: [80, 260], big: true,
                loot: [['l_scale', 0.6], ['w_dragon', 0.03], ['m_dragon', 0.03], ['a_dragon', 0.02], ['w_hammer', 0.03], ['m_arcane', 0.03]] }
  };

  D.ZONES = {
    // Faixa ao redor da cidade inicial: apresenta os três inimigos de nível 1
    // antes de o jogador alcançar os campos e a floresta mais perigosos.
    starter: [['rabbit', 3], ['rat', 5], ['snake', 3]],
    meadow: [['rabbit', 3], ['rat', 5], ['snake', 3]],
    forest: [['wolf', 4], ['goblin', 4], ['bear', 2]],
    wild:   [['orc', 5], ['shaman', 2], ['troll', 2]],
    desert: [['scorpion', 4], ['mummy', 3]],
    cave:   [['skeleton', 5], ['spider', 3], ['dragon', 0.4]],
    coast:     [['snake', 3], ['scorpion', 3], ['goblin', 4]],
    jungle:    [['orc', 5], ['shaman', 3], ['bear', 2]],
    snowfield: [['wolf', 5], ['bear', 3], ['troll', 2]],
    peaks:     [['troll', 4], ['skeleton', 4], ['mummy', 1]],
    shadow:    [['skeleton', 4], ['mummy', 4], ['spider', 2]],
    abyss:     [['spider', 4], ['skeleton', 2], ['dragon', 1]]
  };

  D.TASKS = [
    { mon: 'rat', n: 10, gold: 50, xp: 100, item: 'pot_hp', q: 5 },
    { mon: 'snake', n: 10, gold: 80, xp: 200, item: 'h_leather' },
    { mon: 'wolf', n: 15, gold: 150, xp: 600, item: 's_wood' },
    { mon: 'goblin', n: 20, gold: 300, xp: 1200, item: 'a_leather' },
    { mon: 'bear', n: 15, gold: 400, xp: 2000, item: 'pot_hp', q: 15 },
    { mon: 'orc', n: 25, gold: 700, xp: 4000, item: 'h_iron' },
    { mon: 'troll', n: 20, gold: 1200, xp: 8000, item: 'pot_hp2', q: 10 },
    { mon: 'scorpion', n: 25, gold: 1500, xp: 11000, item: 'a_chain' },
    { mon: 'mummy', n: 25, gold: 2000, xp: 15000, item: 'h_steel' },
    { mon: 'skeleton', n: 30, gold: 2500, xp: 20000, item: 'pot_mp2', q: 10 },
    { mon: 'spider', n: 30, gold: 4000, xp: 35000, item: 'pot_hp2', q: 20 },
    { mon: 'dragon', n: 5, gold: 10000, xp: 100000, item: 'a_dragon' }
  ];

  // Regiões do mundo: cada uma é um mapa separado, carregado só quando o jogador viaja.
  // wx/wy = posição no mapa-múndi (0-100). zones = [perto da cidade, longe da cidade].
  D.REGIONS = [
    { id: 0, name: 'Vale de Aurora', town: 'Aurora', biome: 'green', lvl: 1, cost: 0, wx: 22, wy: 55,
      desc: 'Campos iniciais com coelhos, ratos e cobras; florestas, deserto a nordeste e caverna do dragão a sudeste.',
      labels: [{ x: 80, y: 66, t: 'Aurora' }, { x: 128, y: 30, t: 'Deserto' }, { x: 130, y: 132, t: 'Caverna' }, { x: 80, y: 40, t: 'Campos' }, { x: 30, y: 120, t: 'Floresta' }] },
    { id: 1, name: 'Ilha Coral', town: 'Porto Coral', biome: 'island', lvl: 10, cost: 120, wx: 58, wy: 78, zones: ['coast', 'jungle'],
      desc: 'Praias e selvas. Goblins, cobras e escorpiões na costa; orcs e xamãs na selva.',
      labels: [{ x: 80, y: 66, t: 'Porto Coral' }, { x: 80, y: 120, t: 'Costa' }, { x: 30, y: 30, t: 'Selva' }] },
    { id: 2, name: 'Picos Gelados', town: 'Forte Gélido', biome: 'snow', lvl: 20, cost: 350, wx: 48, wy: 18, zones: ['snowfield', 'peaks'],
      desc: 'Montanhas nevadas. Lobos, ursos e trolls; esqueletos e múmias nos picos.',
      labels: [{ x: 80, y: 66, t: 'Forte Gélido' }, { x: 80, y: 120, t: 'Planície Branca' }, { x: 130, y: 30, t: 'Picos' }] },
    { id: 3, name: 'Terras Sombrias', town: 'Cidadela Sombria', biome: 'dark', lvl: 30, cost: 800, wx: 82, wy: 40, zones: ['shadow', 'abyss'],
      desc: 'Terra amaldiçoada. Múmias, aranhas gigantes e dragões.',
      labels: [{ x: 80, y: 66, t: 'Cidadela' }, { x: 80, y: 120, t: 'Vale das Sombras' }, { x: 30, y: 30, t: 'Abismo' }] }
  ];

  D.NPCS = [
    { id: 'smith', name: 'Ferreiro Bruno', look: 'c|npc|n_apron||npc_hammer||1|curto|preto|preto', dx: -6, dy: -5, shop: 'equip', greet: 'Bem-vindo à forja! Armas e armaduras de qualidade.' },
    { id: 'alch', name: 'Alquimista Lia', look: 'c|npc|n_green||||0|rabo|ruivo|', dx: 6, dy: -5, shop: 'potions', greet: 'Poções fresquinhas! Também compro o que você caçar.' },
    { id: 'sage', name: 'Mestre Aldo', look: 'c|npc|n_white||sage_staff||0|longo|branco|branco', dx: 0, dy: -6, quest: true },
    { id: 'guard1', name: 'Guarda Rui', look: 'c|warrior|a_chain|h_iron|spear|s_guard|1|curto|castanho|', dx: -2, dy: -9, talk: [
      'Ao norte e ao sul ficam campos com ratos e cobras. Bom para iniciantes.',
      'Quanto mais longe da cidade, mais perigosos os monstros.',
      'Dentro das muralhas ninguém pode atacar ninguém.'] },
    { id: 'guard2', name: 'Guarda Téo', look: 'c|warrior|a_chain|h_iron|spear|s_guard|1|curto|castanho|', dx: 2, dy: 9, talk: [
      'Dizem que há dragões na caverna a sudeste... só vá depois do nível 30!',
      'O deserto a nordeste é cheio de múmias e escorpiões.',
      'Fale com o Mestre Aldo para conseguir missões de caça.',
      'A Guardiã do Portal leva você para outras terras.'] },
    { id: 'portal', r: 0, name: 'Guardiã do Portal', look: 'c|wizard|a_robe||m_arcane||2|longo|branco|', dx: 3, dy: 3, travel: true },
    { id: 'smith', r: 1, name: 'Ferreira Marina', look: 'c|npc|n_apron||npc_hammer||2|rabo|preto|', dx: -6, dy: -5, shop: 'equip', greet: 'Aço forjado com água do mar! Dá uma olhada.' },
    { id: 'alch', r: 1, name: 'Curandeiro Kai', look: 'c|npc|n_green||||1|curto|preto|', dx: 6, dy: -5, shop: 'potions', greet: 'Poções da ilha, fresquinhas.' },
    { id: 'portal', r: 1, name: 'Guardião do Portal', look: 'c|wizard|a_robe||m_arcane||1|curto|azul|azul', dx: 3, dy: 3, travel: true },
    { id: 'guard1', r: 1, name: 'Vigia Lúcio', look: 'c|warrior|a_leather|h_leather|spear|s_wood|1|curto|castanho|', dx: -2, dy: -9, talk: ['A selva ao norte é cheia de orcs. Cuidado!', 'Escorpiões adoram a areia quente da costa.'] },
    { id: 'smith', r: 2, name: 'Ferreiro Bjorn', look: 'c|npc|n_apron||npc_hammer||0|longo|loiro|loiro', dx: -6, dy: -5, shop: 'equip', greet: 'Armaduras que aguentam o frio e os trolls!' },
    { id: 'alch', r: 2, name: 'Alquimista Neve', look: 'c|npc|n_white||||0|longo|branco|', dx: 6, dy: -5, shop: 'potions', greet: 'Poções quentinhas para enfrentar a neve.' },
    { id: 'portal', r: 2, name: 'Guardião do Portal', look: 'c|wizard|a_chain||m_ice||0|curto|branco|branco', dx: 3, dy: 3, travel: true },
    { id: 'guard1', r: 2, name: 'Sentinela Erik', look: 'c|warrior|a_plate|h_steel|spear|s_tower|0|curto|loiro|', dx: -2, dy: -9, talk: ['Nos picos a nordeste vivem esqueletos antigos.', 'Trolls do gelo batem forte. Leve poções grandes.'] },
    { id: 'smith', r: 3, name: 'Forjador Vex', look: 'c|npc|n_apron||npc_hammer||2|curto|preto|preto', dx: -6, dy: -5, shop: 'equip', greet: 'Só os fortes chegam até aqui.' },
    { id: 'alch', r: 3, name: 'Bruxa Morgana', look: 'c|wizard|a_dragon||m_fire||0|longo|preto|', dx: 6, dy: -5, shop: 'potions', greet: 'Poções sombrias... mas funcionam.' },
    { id: 'portal', r: 3, name: 'Guardião do Portal', look: 'c|wizard|a_dragon||m_dragon||1|longo|ruivo|', dx: 3, dy: 3, travel: true },
    { id: 'guard1', r: 3, name: 'Cavaleiro Negro', look: 'c|warrior|a_dragon|h_steel|spear|s_tower|2|curto|preto|', dx: -2, dy: -9, talk: ['Os dragões dormem no abismo a noroeste.', 'Aranhas gigantes envenenam. Não lute sozinho.'] }
  ];

  D.SHOPS = {
    equip: ['w_dagger', 'w_sword', 'w_axe', 'w_long', 'w_hammer', 'm_wand', 'm_staff', 'm_ice', 'm_fire', 'm_arcane',
            'a_cloth', 'a_leather', 'a_chain', 'a_plate', 'a_robe', 'h_leather', 'h_iron', 'h_steel', 's_wood', 's_iron', 's_tower'],
    potions: ['pot_hp', 'pot_hp2', 'pot_mp', 'pot_mp2']
  };

  D.sellPrice = (id) => { const it = D.ITEMS[id]; if (!it) return 0; return it.sell || Math.floor((it.price || 0) / 2); };

  if (typeof module !== 'undefined' && module.exports) module.exports = D; else root.DEFS = D;
})(this);
