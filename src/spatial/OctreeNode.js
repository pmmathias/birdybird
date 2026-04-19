import * as THREE from 'three';

const MAX_DEPTH = 5;
const MAX_ITEMS_PER_NODE = 4;

export class OctreeNode {
  /**
   * @param {THREE.Box3} bounds - AABB for this node
   * @param {number} depth - current depth
   */
  constructor(bounds, depth = 0) {
    this.bounds = bounds;
    this.depth = depth;
    this.children = null; // null = leaf, array of 8 = branch
    this.items = [];      // items stored in this leaf
  }

  /**
   * Insert an item with a bounding box.
   * @param {{ bbox: THREE.Box3, data: any }} item
   */
  insert(item) {
    if (!this.bounds.intersectsBox(item.bbox)) return;

    if (this.children) {
      // Branch: insert into children
      for (const child of this.children) {
        child.insert(item);
      }
      return;
    }

    this.items.push(item);

    // Subdivide if too many items and not at max depth
    if (this.items.length > MAX_ITEMS_PER_NODE && this.depth < MAX_DEPTH) {
      this._subdivide();
    }
  }

  /**
   * Query items intersecting a frustum.
   * @param {THREE.Frustum} frustum
   * @param {Array} results - output array
   */
  queryFrustum(frustum, results) {
    if (!frustum.intersectsBox(this.bounds)) return;

    if (this.children) {
      for (const child of this.children) {
        child.queryFrustum(frustum, results);
      }
    } else {
      for (const item of this.items) {
        // Avoid duplicates
        if (!results.includes(item.data)) {
          results.push(item.data);
        }
      }
    }
  }

  _subdivide() {
    const min = this.bounds.min;
    const max = this.bounds.max;
    const mid = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);

    this.children = [];

    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          const childMin = new THREE.Vector3(
            x === 0 ? min.x : mid.x,
            y === 0 ? min.y : mid.y,
            z === 0 ? min.z : mid.z,
          );
          const childMax = new THREE.Vector3(
            x === 0 ? mid.x : max.x,
            y === 0 ? mid.y : max.y,
            z === 0 ? mid.z : max.z,
          );
          this.children.push(
            new OctreeNode(new THREE.Box3(childMin, childMax), this.depth + 1),
          );
        }
      }
    }

    // Re-insert items into children
    for (const item of this.items) {
      for (const child of this.children) {
        child.insert(item);
      }
    }
    this.items = [];
  }
}
