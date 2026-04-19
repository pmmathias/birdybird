import * as THREE from 'three';

/**
 * Manages frustum culling of terrain chunks via octree.
 */
export class FrustumCuller {
  /**
   * @param {import('./Octree.js').Octree} octree
   * @param {THREE.Mesh[]} allChunks - all terrain chunk meshes
   */
  constructor(octree, allChunks) {
    this.octree = octree;
    this.allChunks = allChunks;
    this._frustum = new THREE.Frustum();
    this._projScreenMatrix = new THREE.Matrix4();
  }

  /**
   * Update chunk visibility based on camera frustum.
   * @param {THREE.Camera} camera
   */
  update(camera) {
    // Build frustum from camera
    this._projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this._frustum.setFromProjectionMatrix(this._projScreenMatrix);

    // Query octree for visible chunks
    const visible = this.octree.queryFrustum(this._frustum);
    const visibleSet = new Set(visible);

    // Toggle visibility
    for (const chunk of this.allChunks) {
      chunk.visible = visibleSet.has(chunk);
    }
  }
}
