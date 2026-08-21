import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';

const exporter = new STLExporter();

export function geometryToStlFile(geometry: THREE.BufferGeometry, filename: string): File {
  const mesh = new THREE.Mesh(geometry);
  const stlText = exporter.parse(mesh, { binary: false }) as string;
  return new File([stlText], filename, { type: 'model/stl' });
}
