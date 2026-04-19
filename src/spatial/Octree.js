import * as THREE from 'three';
import { OctreeNode } from './OctreeNode.js';
import { WORLD_SIZE, WORLD_HALF } from '../constants.js';

export class Octree {
  constructor() {
    // Root bounds encompass the entire world
    const bounds = new THREE.Box3(
      new THREE.Vector3(-WORLD_HALF, -200, -WORLD_HALF),
      new THREE.Vector3(WORLD_HALF, 2000, WORLD_HALF),
    );
    this.root = new OctreeNode(bounds);
  }

  /**
   * Insert a mesh into the octree using its world bounding box.
   * @param {THREE.Mesh} mesh
   */
  insertMesh(mesh) {
    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox();
    }

    // Transform bounding box to world space with padding to prevent culling artifacts
    const bbox = mesh.geometry.boundingBox.clone();
    bbox.applyMatrix4(mesh.matrixWorld);
    bbox.expandByScalar(50); // padding to account for height variations

    this.root.insert({ bbox, data: mesh });
  }

  /**
   * Query all meshes visible in the given frustum.
   * @param {THREE.Frustum} frustum
   * @returns {THREE.Mesh[]}
   */
  queryFrustum(frustum) {
    const results = [];
    this.root.queryFrustum(frustum, results);
    return results;
  }
}
