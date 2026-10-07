// Biblioteca de cenário em PNG — carregada antes do mundo para que os objetos
// do mapa possam usar arte final, mantendo um fallback no renderer.
const WORLD = (function () {
  const files = {
    oak: 'assets/world/oak-guardian.png',
    hub: 'assets/world/town-hub.png',
    rock: 'assets/world/mossy-crystals.png',
    grass: 'assets/world/grass-texture.png',
    water: 'assets/world/water-texture.png',
    bridge: 'assets/world/bridge-texture.png'
  };
  const images = {};
  let ready = false;

  function load(onProgress) {
    const keys = Object.keys(files);
    let done = 0;
    return Promise.all(keys.map(key => new Promise(resolve => {
      const image = new Image();
      image.onload = () => { images[key] = image; done++; onProgress && onProgress(done / keys.length); resolve(); };
      image.onerror = () => { done++; onProgress && onProgress(done / keys.length); resolve(); };
      image.src = files[key];
    }))).then(() => { ready = true; });
  }

  return {
    load,
    get ready() { return ready; },
    get oak() { return images.oak; },
    get hub() { return images.hub; },
    get rock() { return images.rock; },
    get grass() { return images.grass; },
    get water() { return images.water; },
    get bridge() { return images.bridge; }
  };
})();
