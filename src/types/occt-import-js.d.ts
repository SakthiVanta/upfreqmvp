declare module 'occt-import-js' {
  export interface OcctImportParams {
    linearUnit?: 'millimeter' | 'centimeter' | 'meter' | 'inch' | 'foot';
    linearDeflectionType?: 'bounding_box_ratio' | 'absolute_value';
    linearDeflection?: number;
    angularDeflection?: number;
  }

  export interface OcctMesh {
    name: string;
    color?: [number, number, number];
    brep_faces?: Array<{
      first: number;
      last: number;
      color: [number, number, number] | null;
    }>;
    attributes: {
      position: {
        array: number[];
      };
      normal?: {
        array: number[];
      };
    };
    index: {
      array: number[];
    };
  }

  export interface OcctHierarchyNode {
    name: string;
    meshes: number[];
    children: OcctHierarchyNode[];
  }

  export interface OcctImportResult {
    success: boolean;
    root?: OcctHierarchyNode;
    meshes?: OcctMesh[];
  }

  export interface OcctImporterInstance {
    ReadStepFile(buffer: Uint8Array, params: OcctImportParams | null): OcctImportResult;
    ReadIgesFile(buffer: Uint8Array, params: OcctImportParams | null): OcctImportResult;
    ReadBrepFile(buffer: Uint8Array, params: OcctImportParams | null): OcctImportResult;
  }

  export interface OcctInitOptions {
    locateFile?: (path: string) => string;
  }

  export default function occtimportjs(options?: OcctInitOptions): Promise<OcctImporterInstance>;
}
