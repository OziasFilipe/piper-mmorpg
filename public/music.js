// Música e efeitos sonoros — As Aventuras do Piper (Epiper Tecnologia)
// Tudo é tocado na hora pelo navegador (Web Audio): composições originais, nenhum arquivo de áudio
// para baixar. Faixas: título, cidade, campo (muda o tom em cada terra) e batalha, com transição suave.
(function () {
  let ac = null, master, musicBus, sfxBus, reverb, noiseBuf;
  let muted = false; try { muted = localStorage.getItem('piper_mute') === '1'; } catch (e) { }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // ------------------------------------------------------------ COMPOSIÇÕES
  // acordes: [nota fundamental (MIDI), 'm' menor | 'M' maior]; melodia: [nota MIDI ou null, duração em tempos]
  const TRACKS = {
    title: {
      bpm: 72, vol: 0.9, style: 'title',
      chords: [[62, 'm'], [58, 'M'], [65, 'M'], [60, 'M'], [62, 'm'], [58, 'M'], [55, 'm'], [57, 'M']],
      mel: [[69, 2], [74, 1], [76, 1], [77, 3], [76, 1], [74, 2], [72, 1], [69, 1], [72, 3], [null, 1],
        [69, 1], [74, 1], [77, 1], [81, 1], [79, 2], [77, 1], [74, 1], [74, 2], [70, 1], [74, 1], [73, 2], [76, 2]]
    },
    town: {
      bpm: 96, vol: 1.1, style: 'town',
      chords: [[67, 'M'], [64, 'm'], [60, 'M'], [62, 'M'], [67, 'M'], [64, 'm'], [57, 'm'], [62, 'M']],
      mel: [[74, 1], [79, 1], [78, .5], [76, .5], [74, 1], [71, 1.5], [74, .5], [76, 2], [76, 1], [79, 1], [76, 1], [72, 1], [74, 3], [null, 1],
        [79, 1], [81, .5], [79, .5], [78, 1], [74, 1], [76, 1], [71, 1], [74, 2], [72, 1], [76, 1], [74, 1], [72, 1], [69, 2], [66, 1], [67, 1]]
    },
    field: {
      bpm: 112, vol: 0.75, style: 'field',
      chords: [[57, 'm'], [55, 'M'], [53, 'M'], [55, 'M'], [57, 'm'], [55, 'M'], [53, 'M'], [52, 'M']],
      mel: [[69, 1], [72, 1], [76, 2], [74, 1.5], [72, .5], [71, 2], [72, 1], [69, 1], [65, 1], [69, 1], [67, 3], [null, 1],
        [76, 1], [77, .5], [76, .5], [74, 1], [72, 1], [71, 1], [74, 1], [79, 2], [77, 1.5], [76, .5], [74, 1], [72, 1], [71, 2], [68, 2]]
    },
    battle: {
      bpm: 150, vol: 0.85, style: 'battle',
      chords: [[52, 'm'], [52, 'm'], [48, 'M'], [50, 'M'], [52, 'm'], [52, 'm'], [48, 'M'], [47, 'M']],
      mel: [[76, .5], [76, .5], [79, 1], [78, .5], [76, .5], [74, 1], [76, 2], [71, 1], [74, 1], [72, 1], [76, 1], [79, 1], [76, 1], [78, 2], [74, 2],
        [76, .5], [79, .5], [83, 1], [81, .5], [79, .5], [78, 1], [79, 1], [76, 1], [71, 2], [72, .5], [74, .5], [76, 1], [79, 1], [84, 1], [83, 2], [78, 1], [75, 1]]
    }
  };
  // tom de cada terra (semitons): Vale, Ilha, Picos, Sombrias
  const REGION_TR = { town: [0, 2, -3, -5], field: [0, 3, -2, -4], battle: [0, 1, -1, -2] };

  // ------------------------------------------------------------ MOTOR
  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ac.destination);
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.9; musicBus.connect(comp);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(comp);
    // reverb simples (salão de pedra)
    reverb = ac.createConvolver(); const len = ac.sampleRate * 2.2, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    reverb.buffer = ir; const rv = ac.createGain(); rv.gain.value = 0.32; reverb.connect(rv); rv.connect(musicBus);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    setInterval(schedule, 30);
  }
  function unlock() { init(); if (ac && ac.state !== 'running') ac.resume().catch(() => { }); }
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume().catch(() => { }); });

  // instrumento genérico: oscilador(es) + envelope + filtro opcional
  function voice(bus, t, freq, dur, o) {
    const g = ac.createGain(), a = o.a || 0.01, r = o.r || 0.15, peak = o.v || 0.2;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    if (o.pluck) g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.05, dur + r));
    else { g.gain.setValueAtTime(peak, t + Math.max(a, dur - 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r); }
    let out = g;
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7; g.connect(f); out = f; }
    out.connect(bus); if (o.rev) { const s = ac.createGain(); s.gain.value = o.rev; out.connect(s); s.connect(reverb); }
    for (const [type, mul, det] of o.osc) {
      const os = ac.createOscillator(); os.type = type; os.frequency.value = freq * mul; os.detune.value = det || 0;
      if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.2; lg.gain.value = freq * 0.006; l.connect(lg); lg.connect(os.frequency); l.start(t + 0.15); l.stop(t + dur + r + 0.05); }
      os.connect(g); os.start(t); os.stop(t + dur + r + 0.05);
    }
  }
  function noise(bus, t, dur, type, freq, v, q) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.02);
  }
  function kick(bus, t, v) {
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.32);
  }
  const chordNotes = (root, q) => [root, root + (q === 'm' ? 3 : 4), root + 7];

  // cada faixa ativa tem seu próprio volume (para trocar de música com fade)
  const live = new Map(); let current = null, currentKey = '';
  function play(name, region) {
    if (!TRACKS[name]) return;
    const tr = (REGION_TR[name] || [])[region | 0] || 0, key = name + ':' + tr;
    if (key === currentKey) return;
    currentKey = key; init(); if (!ac) { current = { name, tr, pending: true }; return; }
    const now = ac.currentTime;
    for (const [k, L] of live) { L.gain.gain.cancelScheduledValues(now); L.gain.gain.setValueAtTime(L.gain.gain.value, now); L.gain.gain.linearRampToValueAtTime(0.0001, now + 1.6); L.dying = now + 1.7; }
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(TRACKS[name].vol, now + 1.8); g.connect(musicBus);
    const T = TRACKS[name], spb = 60 / T.bpm;
    const L = { name, tr, T, gain: g, spb, next: now + 0.12, beat: 0, dying: 0 };
    live.set(key + ':' + now, L); current = L;
  }
  function schedule() {
    if (!ac || ac.state !== 'running') return;
    const ahead = ac.currentTime + 0.18;
    for (const [k, L] of live) {
      if (L.dying && ac.currentTime > L.dying) { live.delete(k); try { L.gain.disconnect(); } catch (e) { } continue; }
      if (L.next < ac.currentTime - 0.1) L.next = ac.currentTime + 0.05;   // áudio estava pausado: não toca as notas atrasadas de uma vez
      while (L.next < ahead) { step(L, L.next); L.next += L.spb / 2; L.beat += 0.5; }   // passo de colcheia
    }
  }
  // um passo (colcheia) da faixa
  function step(L, t) {
    const T = L.T, bus = L.gain, tr = L.tr, bars = T.chords.length, b = L.beat % (bars * 4), bar = Math.floor(b / 4), inBar = b % 4, spb = L.spb;
    const [root0, q] = T.chords[bar], root = root0 + tr, ch = chordNotes(root, q), first = inBar === 0, eighth = Math.round(inBar * 2);
    // melodia: eventos pré-calculados (início em tempos), alinhados à grade de colcheias
    if (!T.ev) { let o = 0; T.ev = T.mel.map(([n, d]) => { const e = [o, n, d]; o += d; return e; }); T.len = o; }
    const mb = L.beat % T.len;
    for (const [o, n, d] of T.ev) if (Math.abs(o - mb) < 0.01 && n !== null) melody(T.style, bus, t, mtof(n + tr), d * spb);
    const st = T.style;
    if (st === 'title') {
      if (first) { for (const n of ch) voice(bus, t, mtof(n - 12), spb * 4, { osc: [['sawtooth', 1, -6], ['sawtooth', 1, 6]], a: 0.9, r: 1.4, v: 0.035, lp: 900, rev: 0.6 });
        voice(bus, t, mtof(root - 24), spb * 4, { osc: [['sine', 1]], a: 0.3, r: 1, v: 0.16 }); }
      const arp = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2] + 12, ch[0] + 12, ch[2], ch[1]][eighth];
      voice(bus, t, mtof(arp), spb * 0.5, { osc: [['triangle', 1], ['sine', 2]], a: 0.005, r: 0.9, v: 0.07, pluck: true, rev: 0.7 });
    } else if (st === 'town') {
      if (first) voice(bus, t, mtof(root - 12), spb * 4, { osc: [['triangle', 1]], a: 0.4, r: 0.8, v: 0.05, lp: 1200, rev: 0.4 });
      const pat = [ch[0] - 12, ch[2] - 12, ch[1], ch[2] - 12, ch[0], ch[2] - 12, ch[1], ch[2] - 12][eighth];
      voice(bus, t, mtof(pat), spb * 0.5, { osc: [['triangle', 1], ['square', 1, 4]], a: 0.004, r: 0.5, v: 0.045, pluck: true, lp: 2400, rev: 0.3 });
      if (eighth % 4 === 0) voice(bus, t, mtof(root - 24), spb * 1.8, { osc: [['sine', 1]], a: 0.02, r: 0.3, v: 0.13, pluck: true });
      if (eighth % 2 === 1) noise(bus, t, 0.05, 'highpass', 7000, 0.02);
    } else if (st === 'field') {
      voice(bus, t, mtof([ch[0], ch[2], ch[1] + 12, ch[2]][eighth % 4]), spb * 0.4, { osc: [['sawtooth', 1]], a: 0.005, r: 0.12, v: 0.04, lp: 1800, rev: 0.25 });
      if (first) voice(bus, t, mtof(root - 12), spb * 4, { osc: [['sawtooth', 1, -5], ['sawtooth', 1, 5]], a: 0.5, r: 0.8, v: 0.03, lp: 800, rev: 0.5 });
      if (eighth % 2 === 0) voice(bus, t, mtof(root - 24 + (eighth === 6 ? 7 : 0)), spb * 0.9, { osc: [['triangle', 1]], a: 0.01, r: 0.15, v: 0.14 });
      if (eighth === 0 || eighth === 4) kick(bus, t, 0.35);
      if (eighth % 2 === 1) noise(bus, t, 0.04, 'highpass', 8000, 0.025);
      if (eighth === 4) noise(bus, t, 0.12, 'bandpass', 1800, 0.06, 0.8);
    } else if (st === 'battle') {
      voice(bus, t, mtof(root - 24 + (eighth % 2 ? 12 : 0)), spb * 0.45, { osc: [['sawtooth', 1]], a: 0.004, r: 0.08, v: 0.09, lp: 700 });
      if (eighth === 0 || eighth === 3) for (const n of ch) voice(bus, t, mtof(n), spb * 0.6, { osc: [['square', 1, -7], ['sawtooth', 1, 7]], a: 0.01, r: 0.15, v: 0.03, lp: 2200, rev: 0.25 });
      if (eighth === 0 || eighth === 3 || eighth === 4) kick(bus, t, 0.5);
      if (eighth === 2 || eighth === 6) { noise(bus, t, 0.16, 'bandpass', 1600, 0.16, 0.7); voice(bus, t, 190, 0.06, { osc: [['triangle', 1]], a: 0.001, r: 0.08, v: 0.08, pluck: true }); }
      noise(bus, t, 0.035, 'highpass', 9000, 0.03);
      if (eighth === 7 && bar % 2 === 1) for (let i = 0; i < 3; i++) voice(bus, t + i * spb / 6, 120 - i * 18, 0.08, { osc: [['sine', 1]], a: 0.002, r: 0.12, v: 0.18, pluck: true });
    }
  }
  function melody(style, bus, t, f, d) {
    if (style === 'title') voice(bus, t, f, d * 0.95, { osc: [['sine', 1], ['triangle', 2, 3]], a: 0.08, r: 0.6, v: 0.075, vib: true, rev: 0.7, lp: 3000 });
    else if (style === 'town') voice(bus, t, f, d * 0.9, { osc: [['sine', 1], ['sine', 2]], a: 0.03, r: 0.25, v: 0.07, vib: true, rev: 0.45 });
    else if (style === 'field') voice(bus, t, f, d * 0.92, { osc: [['sawtooth', 1, -4], ['sawtooth', 1, 4]], a: 0.05, r: 0.3, v: 0.05, lp: 1500, q: 2, vib: true, rev: 0.4 });
    else voice(bus, t, f, d * 0.85, { osc: [['square', 1, -6], ['sawtooth', 1, 6]], a: 0.015, r: 0.12, v: 0.045, lp: 2600, rev: 0.25 });
  }

  // ------------------------------------------------------------ EFEITOS
  function sfx(name) {
    if (!ac || ac.state !== 'running' || muted) return;
    const t = ac.currentTime, B = sfxBus;
    switch (name) {
      case 'hit': noise(B, t, 0.09, 'lowpass', 1400, 0.35); kick(B, t, 0.25); break;
      case 'swing': noise(B, t, 0.14, 'bandpass', 2600, 0.12, 0.6); break;
      case 'spell': for (let i = 0; i < 4; i++) voice(B, t + i * 0.05, 520 * Math.pow(1.26, i), 0.12, { osc: [['sine', 1], ['triangle', 2]], a: 0.005, r: 0.25, v: 0.07, pluck: true }); break;
      case 'heal': for (let i = 0; i < 3; i++) voice(B, t + i * 0.08, mtof(72 + [0, 4, 7][i]), 0.25, { osc: [['sine', 1]], a: 0.01, r: 0.4, v: 0.09, pluck: true }); break;
      case 'level': [72, 76, 79, 84].forEach((n, i) => voice(B, t + i * 0.11, mtof(n), i === 3 ? 0.6 : 0.12, { osc: [['square', 1], ['triangle', 2]], a: 0.005, r: 0.35, v: 0.07, lp: 3500 })); break;
      case 'portal': { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(1400, t + 0.9);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1); o.connect(g); g.connect(B); o.start(t); o.stop(t + 1.2);
        noise(B, t, 1.0, 'bandpass', 900, 0.08, 0.5); break; }
      case 'click': voice(B, t, 880, 0.03, { osc: [['triangle', 1]], a: 0.001, r: 0.05, v: 0.06, pluck: true }); break;
      case 'friend': [76, 81].forEach((n, i) => voice(B, t + i * 0.12, mtof(n), 0.2, { osc: [['sine', 1], ['sine', 2]], a: 0.005, r: 0.4, v: 0.08, pluck: true })); break;
    }
  }
  function setMuted(m) {
    muted = !!m; try { localStorage.setItem('piper_mute', muted ? '1' : '0'); } catch (e) { }
    if (master) { const t = ac.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(muted ? 0 : 1, t + 0.25); }
  }
  window.MUSIC = { play, sfx, setMuted, get muted() { return muted; }, unlock, _dbg: () => ({ state: ac && ac.state, live: live.size, cur: currentKey }) };
})();
