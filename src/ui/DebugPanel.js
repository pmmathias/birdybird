import GUI from 'lil-gui';

export function createDebugPanel(options = {}) {
  const gui = new GUI({ title: 'VogelSimulator Debug' });

  const params = {
    wireframe: false,
    fogNear: options.fogNear || 100,
    fogFar: options.fogFar || 800,
    showStats: true,
  };

  gui.add(params, 'wireframe').name('Wireframe').onChange((v) => {
    if (options.onWireframe) options.onWireframe(v);
  });

  gui.add(params, 'fogNear', 10, 500).name('Fog Near').onChange((v) => {
    if (options.onFogChange) options.onFogChange(v, params.fogFar);
  });

  gui.add(params, 'fogFar', 100, 2000).name('Fog Far').onChange((v) => {
    if (options.onFogChange) options.onFogChange(params.fogNear, v);
  });

  return { gui, params };
}
