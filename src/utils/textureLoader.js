import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map();

export function loadTexture(path, options = {}) {
  if (cache.has(path)) return cache.get(path);

  const texture = loader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;

  if (options.repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(options.repeat, options.repeat);
  }

  if (options.filter === 'nearest') {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
  }

  cache.set(path, texture);
  return texture;
}
