import * as THREE from 'three';
import { STLLoader, OBJLoader, ThreeMFLoader, ColladaLoader, PLYLoader, FBXLoader, GLTFLoader } from 'three-stdlib';

export const SUPPORTED_3D_EXTENSIONS = [
  'stl',
  'step',
  'stp',
  'iges',
  'igs',
  'brep',
  'obj',
  'dae',
  'gltf',
  'glb',
  'ply',
  '3mf',
  'fbx',
] as const;

export type Supported3DFormat = (typeof SUPPORTED_3D_EXTENSIONS)[number];

export const CAD_SOLID_EXTENSIONS = ['step', 'stp', 'iges', 'igs', 'brep'] as const;
export type CadSolidFormat = (typeof CAD_SOLID_EXTENSIONS)[number];

export interface FormatMetadata {
  extension: Supported3DFormat;
  category: 'cad_solid' | 'mesh' | 'point_cloud';
  label: string;
  fullName: string;
  description: string;
  industrySoftware: string;
  hasAssemblyHierarchy: boolean;
  hasColorData: boolean;
}

export const FORMAT_METADATA_MAP: Record<Supported3DFormat, FormatMetadata> = {
  step: {
    extension: 'step',
    category: 'cad_solid',
    label: 'STEP',
    fullName: 'ISO 10303-21 STEP Product Model',
    description: 'Universal CAD solid/assembly exchange format preserving B-Rep boundaries, part hierarchy, and names.',
    industrySoftware: 'SolidWorks, Onshape, Fusion 360, PTC Creo, Inventor, Siemens NX, CATIA, FreeCAD',
    hasAssemblyHierarchy: true,
    hasColorData: true,
  },
  stp: {
    extension: 'stp',
    category: 'cad_solid',
    label: 'STP',
    fullName: 'ISO 10303-21 STEP Product Model',
    description: 'Standard shorthand for STEP CAD solid/assembly models.',
    industrySoftware: 'SolidWorks, Onshape, Fusion 360, PTC Creo, Inventor, Siemens NX, CATIA, FreeCAD',
    hasAssemblyHierarchy: true,
    hasColorData: true,
  },
  iges: {
    extension: 'iges',
    category: 'cad_solid',
    label: 'IGES',
    fullName: 'Initial Graphics Exchange Specification',
    description: 'Legacy neutral CAD surface & solid format common in CNC machining, tooling, and automotive.',
    industrySoftware: 'Mastercam, AutoCAD, CATIA, Rhino, SolidWorks',
    hasAssemblyHierarchy: true,
    hasColorData: true,
  },
  igs: {
    extension: 'igs',
    category: 'cad_solid',
    label: 'IGS',
    fullName: 'Initial Graphics Exchange Specification',
    description: 'Standard shorthand for IGES CAD surfaces and wireframes.',
    industrySoftware: 'Mastercam, AutoCAD, CATIA, Rhino, SolidWorks',
    hasAssemblyHierarchy: true,
    hasColorData: true,
  },
  brep: {
    extension: 'brep',
    category: 'cad_solid',
    label: 'BREP',
    fullName: 'OpenCASCADE Boundary Representation',
    description: 'Native OpenCASCADE boundary-representation solid geometry structure.',
    industrySoftware: 'OpenCASCADE, FreeCAD, Salome',
    hasAssemblyHierarchy: true,
    hasColorData: true,
  },
  stl: {
    extension: 'stl',
    category: 'mesh',
    label: 'STL',
    fullName: 'Stereolithography Triangular Mesh',
    description: 'Standard facet triangle mesh used in 3D printing and baseline ROS URDF descriptions.',
    industrySoftware: 'ROS URDF, PrusaSlicer, Cura, Meshmixer, SolidWorks',
    hasAssemblyHierarchy: false,
    hasColorData: false,
  },
  obj: {
    extension: 'obj',
    category: 'mesh',
    label: 'OBJ',
    fullName: 'Wavefront 3D Object Mesh',
    description: 'Standard 3D polygon geometry format widely used in ROS Gazebo simulation visual meshes.',
    industrySoftware: 'Blender, ROS Gazebo, RViz, Maya, 3ds Max',
    hasAssemblyHierarchy: true,
    hasColorData: true,
  },
  dae: {
    extension: 'dae',
    category: 'mesh',
    label: 'DAE',
    fullName: 'COLLADA Digital Asset Exchange',
    description: 'Standard multi-material visual & collision mesh format used heavily in ROS1 and ROS2 packages.',
    industrySoftware: 'ROS Gazebo, MoveIt!, RViz, Blender, SketchUp',
    hasAssemblyHierarchy: true,
    hasColorData: true,
  },
  gltf: {
    extension: 'gltf',
    category: 'mesh',
    label: 'glTF',
    fullName: 'GL Transmission Format (JSON)',
    description: 'Modern PBR 3D asset transmission standard for web and real-time robotics simulation.',
    industrySoftware: 'NVIDIA Isaac Sim, Webots, Blender, Three.js',
    hasAssemblyHierarchy: true,
    hasColorData: true,
  },
  glb: {
    extension: 'glb',
    category: 'mesh',
    label: 'GLB',
    fullName: 'GL Transmission Format (Binary)',
    description: 'Binary container packaging glTF 2.0 geometry, hierarchy, and materials in a single file.',
    industrySoftware: 'NVIDIA Isaac Sim, Webots, Blender, Three.js',
    hasAssemblyHierarchy: true,
    hasColorData: true,
  },
  '3mf': {
    extension: '3mf',
    category: 'mesh',
    label: '3MF',
    fullName: '3D Manufacturing Format',
    description: 'Modern XML-based additive manufacturing standard supporting multi-body assemblies and materials.',
    industrySoftware: 'SolidWorks, Bambu Studio, PrusaSlicer, Autodesk Fusion 360',
    hasAssemblyHierarchy: true,
    hasColorData: true,
  },
  ply: {
    extension: 'ply',
    category: 'mesh',
    label: 'PLY',
    fullName: 'Polygon File Format (Stanford)',
    description: 'Format for high-density 3D scanner data, LiDAR meshes, and point clouds.',
    industrySoftware: 'CloudCompare, MeshLab, LiDAR Scanners, Blender',
    hasAssemblyHierarchy: false,
    hasColorData: true,
  },
  fbx: {
    extension: 'fbx',
    category: 'mesh',
    label: 'FBX',
    fullName: 'Autodesk Filmbox',
    description: 'Interchange format for complex articulated 3D models and robotics simulators.',
    industrySoftware: 'Autodesk Maya, 3ds Max, Unity, Unreal Engine',
    hasAssemblyHierarchy: true,
    hasColorData: true,
  },
};

export function isSupported3DFormat(ext: string): ext is Supported3DFormat {
  const normalized = ext.toLowerCase().replace(/^\./, '') as Supported3DFormat;
  return SUPPORTED_3D_EXTENSIONS.includes(normalized);
}

export function isCadSolidFormat(ext: string): ext is CadSolidFormat {
  const normalized = ext.toLowerCase().replace(/^\./, '') as CadSolidFormat;
  return CAD_SOLID_EXTENSIONS.includes(normalized);
}

export function getFormatInfo(ext: string): FormatMetadata {
  const normalized = ext.toLowerCase().replace(/^\./, '') as Supported3DFormat;
  return (
    FORMAT_METADATA_MAP[normalized] || {
      extension: 'stl',
      category: 'mesh',
      label: normalized.toUpperCase(),
      fullName: `${normalized.toUpperCase()} 3D File`,
      description: '3D geometry file.',
      industrySoftware: 'CAD / 3D software',
      hasAssemblyHierarchy: false,
      hasColorData: false,
    }
  );
}

// Singleton OCCT instance cache so OpenCASCADE WebAssembly is compiled only once
let occtPromise: Promise<any> | null = null;

export async function getOcctImporter(): Promise<any> {
  if (!occtPromise) {
    occtPromise = (async () => {
      const occtimportjs = (await import('occt-import-js')).default;
      return occtimportjs({
        locateFile: (path: string) => {
          if (typeof window !== 'undefined') {
            return `/${path}`;
          }
          return path;
        },
      });
    })();
  }
  return occtPromise;
}

export interface CadMeshInfo {
  name: string;
  color?: [number, number, number];
  triangleCount: number;
  geometry: THREE.BufferGeometry;
}

export interface CadAssemblyResult {
  group: THREE.Group;
  parts: CadMeshInfo[];
  boundingBox: THREE.Box3;
}

/**
 * Parses raw STEP, STP, IGES, IGS, or BREP byte buffer using OpenCASCADE WASM.
 * Constructs full Three.js geometry with preserved part names, materials, and face colors.
 */
export async function parseCadBuffer(
  buffer: ArrayBuffer | Uint8Array,
  extension: string
): Promise<CadAssemblyResult> {
  const ext = extension.toLowerCase().replace(/^\./, '');
  const occt = await getOcctImporter();
  const fileBuffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  let result: any;
  if (ext === 'step' || ext === 'stp') {
    result = occt.ReadStepFile(fileBuffer, null);
  } else if (ext === 'iges' || ext === 'igs') {
    result = occt.ReadIgesFile(fileBuffer, null);
  } else if (ext === 'brep') {
    result = occt.ReadBrepFile(fileBuffer, null);
  } else {
    throw new Error(`Unsupported CAD format: .${ext}`);
  }

  if (!result || !result.success) {
    throw new Error(`Failed to parse CAD file (${ext.toUpperCase()}). The file may be corrupt or contain unsupported entities.`);
  }

  const group = new THREE.Group();
  group.name = result.root?.name || 'CAD_Assembly';
  const parts: CadMeshInfo[] = [];

  const meshesArray = result.meshes || [];
  for (let i = 0; i < meshesArray.length; i++) {
    const rawMesh = meshesArray[i];
    const geometry = new THREE.BufferGeometry();

    if (rawMesh.attributes?.position?.array) {
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(rawMesh.attributes.position.array, 3)
      );
    }
    if (rawMesh.attributes?.normal?.array) {
      geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(rawMesh.attributes.normal.array, 3)
      );
    } else {
      geometry.computeVertexNormals();
    }
    if (rawMesh.index?.array) {
      const indexArray = Uint32Array.from(rawMesh.index.array);
      geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
    }

    geometry.name = rawMesh.name || `part_${i + 1}`;
    geometry.computeBoundingBox();

    // Color resolution: check mesh color or face colors
    let meshMaterial: THREE.Material;
    if (rawMesh.color) {
      meshMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(rawMesh.color[0], rawMesh.color[1], rawMesh.color[2]),
        roughness: 0.4,
        metalness: 0.2,
      });
    } else {
      meshMaterial = new THREE.MeshStandardMaterial({
        color: '#a8a29e',
        roughness: 0.4,
        metalness: 0.2,
      });
    }

    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.name = geometry.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    parts.push({
      name: mesh.name,
      color: rawMesh.color,
      triangleCount: rawMesh.index?.array ? rawMesh.index.array.length / 3 : 0,
      geometry,
    });
  }

  const boundingBox = new THREE.Box3().setFromObject(group);
  return { group, parts, boundingBox };
}

// In-memory cache for loaded 3D models to avoid repeated downloads & parsing
const modelCache = new Map<string, Promise<THREE.Object3D>>();

/**
 * Universal 3D loader for all supported formats:
 * - STEP / STP / IGES / IGS / BREP (OpenCASCADE WASM)
 * - STL (Binary / ASCII)
 * - OBJ
 * - glTF / GLB
 * - Collada DAE
 * - 3MF
 * - PLY
 * - FBX
 */
export function load3DModelFromUrl(url: string, extension: string): Promise<THREE.Object3D> {
  const cacheKey = `${url}#${extension}`;
  const existing = modelCache.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<THREE.Object3D> => {
    const ext = extension.toLowerCase().replace(/^\./, '') as Supported3DFormat;

    if (isCadSolidFormat(ext)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch CAD model from ${url} (${res.status})`);
      const buffer = await res.arrayBuffer();
      const { group } = await parseCadBuffer(buffer, ext);
      return group;
    }

    switch (ext) {
      case 'stl': {
        const loader = new STLLoader();
        const geometry = await loader.loadAsync(url);
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ color: '#a8a29e', roughness: 0.4, metalness: 0.2 });
        return new THREE.Mesh(geometry, material);
      }
      case 'obj': {
        const loader = new OBJLoader();
        return await loader.loadAsync(url);
      }
      case 'gltf':
      case 'glb': {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(url);
        return gltf.scene;
      }
      case 'dae': {
        const loader = new ColladaLoader();
        const collada = await loader.loadAsync(url);
        return collada.scene;
      }
      case '3mf': {
        const loader = new ThreeMFLoader();
        return await loader.loadAsync(url);
      }
      case 'ply': {
        const loader = new PLYLoader();
        const geometry = await loader.loadAsync(url);
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ color: '#a8a29e', roughness: 0.4, metalness: 0.2 });
        return new THREE.Mesh(geometry, material);
      }
      case 'fbx': {
        const loader = new FBXLoader();
        return await loader.loadAsync(url);
      }
      default: {
        // Fallback to STLLoader
        const loader = new STLLoader();
        const geometry = await loader.loadAsync(url);
        return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#a8a29e' }));
      }
    }
  })();

  modelCache.set(cacheKey, promise);
  return promise;
}

export interface InspectedPart {
  name: string;
  triangleCount: number;
  box: THREE.Box3;
  size: THREE.Vector3;
  center: THREE.Vector3;
}

export interface ModelInspectionResult {
  totalTriangles: number;
  meshCount: number;
  boundingBox: THREE.Box3;
  size: THREE.Vector3;
  center: THREE.Vector3;
  parts: InspectedPart[];
}

/**
 * Inspects a loaded 3D object / CAD assembly to extract part hierarchy, names, and dimensions.
 */
export function inspectModelParts(object: THREE.Object3D): ModelInspectionResult {
  object.updateMatrixWorld(true);
  const parts: InspectedPart[] = [];
  let totalTriangles = 0;

  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geom = child.geometry;
      let triCount = 0;
      if (geom.index) {
        triCount = geom.index.count / 3;
      } else if (geom.attributes.position) {
        triCount = geom.attributes.position.count / 3;
      }
      totalTriangles += Math.floor(triCount);

      child.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(child);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      parts.push({
        name: child.name || child.parent?.name || `part_${parts.length + 1}`,
        triangleCount: Math.floor(triCount),
        box,
        size,
        center,
      });
    }
  });

  const overallBox = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  overallBox.getSize(size);
  overallBox.getCenter(center);

  return {
    totalTriangles,
    meshCount: parts.length,
    boundingBox: overallBox,
    size,
    center,
    parts,
  };
}
