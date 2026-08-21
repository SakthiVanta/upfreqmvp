import * as THREE from 'three';

// Union-find over "welded" vertex ids — two triangles are in the same
// connected component if they share a vertex position (within epsilon),
// which is what "one physical part" means for a mesh with no other
// metadata. This works whether the source geometry is indexed or not:
// indexed geometry may still have coincident-but-separate positions (common
// in CAD exports), so positions are welded by rounded coordinate rather
// than trusting the index buffer alone.
class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }

  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb;
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
  }
}

const WELD_PRECISION = 5; // decimal places — merges positions within ~1e-5 units

function positionKey(x: number, y: number, z: number): string {
  return `${x.toFixed(WELD_PRECISION)}|${y.toFixed(WELD_PRECISION)}|${z.toFixed(WELD_PRECISION)}`;
}

export interface SegmentResult {
  geometry: THREE.BufferGeometry;
  triangleCount: number;
  boundingBox: THREE.Box3;
  center: THREE.Vector3;
  size: THREE.Vector3;
}

/**
 * Splits a geometry into its connected components (disjoint physical
 * parts). A single-part mesh (most STL files) returns one component
 * covering the whole geometry.
 */
export function segmentGeometry(geometry: THREE.BufferGeometry): SegmentResult[] {
  const position = geometry.attributes.position;
  if (!position) return [];

  const vertexCount = position.count;
  const canonicalId = new Int32Array(vertexCount);
  const keyToCanonical = new Map<string, number>();

  for (let i = 0; i < vertexCount; i++) {
    const key = positionKey(position.getX(i), position.getY(i), position.getZ(i));
    let canon = keyToCanonical.get(key);
    if (canon === undefined) {
      canon = keyToCanonical.size;
      keyToCanonical.set(key, canon);
    }
    canonicalId[i] = canon;
  }

  const uf = new UnionFind(keyToCanonical.size);
  const index = geometry.index;
  const triangleVertexIndices: [number, number, number][] = [];

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);
      triangleVertexIndices.push([a, b, c]);
      uf.union(canonicalId[a], canonicalId[b]);
      uf.union(canonicalId[b], canonicalId[c]);
    }
  } else {
    for (let i = 0; i < vertexCount; i += 3) {
      triangleVertexIndices.push([i, i + 1, i + 2]);
      uf.union(canonicalId[i], canonicalId[i + 1]);
      uf.union(canonicalId[i + 1], canonicalId[i + 2]);
    }
  }

  const triangleGroups = new Map<number, [number, number, number][]>();
  for (const tri of triangleVertexIndices) {
    const root = uf.find(canonicalId[tri[0]]);
    let list = triangleGroups.get(root);
    if (!list) {
      list = [];
      triangleGroups.set(root, list);
    }
    list.push(tri);
  }

  const normal = geometry.attributes.normal;
  const results: SegmentResult[] = [];

  for (const triangles of triangleGroups.values()) {
    const positions = new Float32Array(triangles.length * 9);
    const normals = normal ? new Float32Array(triangles.length * 9) : null;

    triangles.forEach((tri, triIdx) => {
      tri.forEach((vertexIdx, corner) => {
        const base = triIdx * 9 + corner * 3;
        positions[base] = position.getX(vertexIdx);
        positions[base + 1] = position.getY(vertexIdx);
        positions[base + 2] = position.getZ(vertexIdx);
        if (normals && normal) {
          normals[base] = normal.getX(vertexIdx);
          normals[base + 1] = normal.getY(vertexIdx);
          normals[base + 2] = normal.getZ(vertexIdx);
        }
      });
    });

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (normals) {
      geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    } else {
      geom.computeVertexNormals();
    }
    geom.computeBoundingBox();

    const boundingBox = geom.boundingBox ?? new THREE.Box3();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    boundingBox.getCenter(center);
    boundingBox.getSize(size);

    results.push({ geometry: geom, triangleCount: triangles.length, boundingBox, center, size });
  }

  results.sort((a, b) => b.triangleCount - a.triangleCount);
  return results;
}

export interface Bounds3 {
  center: THREE.Vector3;
  size: THREE.Vector3;
}

/** Whole-object bounding box — no connected-component splitting, just "how
 * big is this and where's its middle" for a single already-loaded link's
 * geometry (used for AI topology suggestions, not segmentation). */
export function computeBounds(geometry: THREE.BufferGeometry): Bounds3 {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  return { center, size };
}

/** Same as computeBounds but for a loaded scene/group (OBJ/GLTF) rather
 * than a single BufferGeometry. */
export function computeObject3DBounds(object: THREE.Object3D): Bounds3 {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  return { center, size };
}

/**
 * Re-centers a geometry on its own bounding-box center (mutates a clone,
 * leaves the input untouched) and returns the offset that was removed.
 * Auto-detected components come out of a shared/world coordinate space;
 * this gives each one a sane local origin before it's exported as its own
 * mesh file, and the removed offset becomes the link's visual origin so the
 * part still renders in the right place.
 */
export function centerGeometry(geometry: THREE.BufferGeometry): { geometry: THREE.BufferGeometry; center: THREE.Vector3 } {
  const centered = geometry.clone();
  centered.computeBoundingBox();
  const center = new THREE.Vector3();
  centered.boundingBox?.getCenter(center);
  centered.translate(-center.x, -center.y, -center.z);
  return { geometry: centered, center };
}

/**
 * Collects every distinct geometry found in a loaded scene/group (as
 * returned by OBJLoader/GLTFLoader), each already segmented into its own
 * connected components. Meshes that already arrive as separate scene nodes
 * (common in multi-part GLB/OBJ exports) are kept separate rather than
 * merged before segmenting, since that grouping is real authored intent.
 */
export function segmentObject3D(object: THREE.Object3D): SegmentResult[] {
  const results: SegmentResult[] = [];
  object.updateMatrixWorld(true);

  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const worldGeometry = child.geometry.clone();
      worldGeometry.applyMatrix4(child.matrixWorld);
      results.push(...segmentGeometry(worldGeometry));
    }
  });

  return results;
}
