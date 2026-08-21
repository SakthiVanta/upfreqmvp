'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { TrackballControls, useGLTF, Grid } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Box } from 'lucide-react';
import { RobotLink, RobotJoint, Vec3 } from '@/lib/urdf/types';

export interface LinkMeshRef {
  url: string;
  extension: 'stl' | 'obj' | 'glb' | 'gltf';
  scale?: number;
}

interface ModelViewerProps {
  links: RobotLink[];
  joints: RobotJoint[];
  meshByLinkId: Map<string, LinkMeshRef>;
  selectedLinkId?: string;
  onSelectMesh?: (linkId: string) => void;
}

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

// True forward kinematics, not a flat placement: a link's mesh has no
// "world position" in URDF — its <visual><origin> is only a tiny offset
// within its OWN frame, and that frame's actual position comes entirely
// from walking the joint chain down from the root (each <joint><origin> is
// the parent-frame-to-child-frame transform). Rendering flatly at each
// link's own origin looked fine here but silently diverged from every real
// URDF viewer, which only ever honors the joint chain — this builds nested
// three.js groups that mirror that chain exactly (three.js composes nested
// transforms for us), so what's shown here matches a real viewer.
export function ModelViewer({ links, joints, meshByLinkId, selectedLinkId, onSelectMesh }: ModelViewerProps) {
  const [isDragging, setIsDragging] = useState(false);
  // Bounding box for auto-fit must come from ONLY the robot meshes — using
  // useThree().scene (as an earlier version did) also picks up the
  // infinite background Grid, whose huge/degenerate bounds corrupted the
  // fit math (camera ended up positioned inside the mesh). This ref scopes
  // the box computation to exactly the rendered link/joint tree.
  const contentRef = useRef<THREE.Group>(null);
  const linkById = useMemo(() => new Map(links.map((l) => [l.id, l])), [links]);
  const jointByChildId = useMemo(() => new Map(joints.map((j) => [j.childLinkId, j])), [joints]);
  const childJointsByParentId = useMemo(() => {
    const map = new Map<string, RobotJoint[]>();
    for (const j of joints) {
      const list = map.get(j.parentLinkId);
      if (list) list.push(j);
      else map.set(j.parentLinkId, [j]);
    }
    return map;
  }, [joints]);
  // Every link that is nobody's child renders as its own tree root — this
  // naturally covers not-yet-connected links (rendered at their own local
  // origin) as well as the real root once joints are wired up.
  const roots = useMemo(() => links.filter((l) => !jointByChildId.has(l.id)), [links, jointByChildId]);

  // Changes whenever the rendered content meaningfully changes (link
  // added/removed, mesh attached, scale/position edited) — AutoFitCamera
  // re-fits whenever this changes, and only then.
  const fitKey = useMemo(
    () =>
      links
        .map((l) => {
          const m = meshByLinkId.get(l.id);
          const o = l.visualOrigin?.xyz ?? ZERO;
          return `${l.id}:${m ? `${m.url}:${m.scale ?? 1}` : 'none'}:${o.x},${o.y},${o.z}`;
        })
        .join('|') +
      '#' +
      joints.map((j) => `${j.id}:${j.origin.xyz.x},${j.origin.xyz.y},${j.origin.xyz.z}`).join('|'),
    [links, joints, meshByLinkId]
  );

  const hasAnyMesh = links.some((l) => meshByLinkId.has(l.id));
  if (!hasAnyMesh) {
    return (
      <div className="w-full h-full min-h-96 bg-sand-950 border border-sand-800 flex flex-col items-center justify-center gap-3 text-sand-600">
        <Box className="h-10 w-10" />
        <p className="text-xs font-semibold">Upload 3D files above to see them here</p>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full min-h-96 bg-sand-950 border border-sand-800 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onPointerDown={() => setIsDragging(true)}
      onPointerUp={() => setIsDragging(false)}
      onPointerLeave={() => setIsDragging(false)}
    >
      <Canvas camera={{ position: [1, 1, 1], fov: 50 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} />
        <directionalLight position={[-5, -3, -5]} intensity={0.3} />
        {/* TrackballControls, not OrbitControls: OrbitControls locks the
            camera to a fixed world "up" axis and clamps how far you can
            rotate over the poles, which reads as the view "getting stuck".
            TrackballControls has no up-axis lock and no pole clamp — true
            arcball rotation, free in every direction, no restricted zones. */}
        <TrackballControls makeDefault noPan={false} rotateSpeed={4} />
        {/* Real-world meshes range from millimeter parts to meter-scale
            chassis, and a fixed camera distance looks wrong (too close, too
            far, or literally inside the mesh) for most of them. drei's
            Bounds helper does this but assumes an OrbitControls-shaped API
            closely enough that pairing it with TrackballControls left the
            camera stuck inside the mesh on load (confirmed: still wrong
            after 5s, not a timing issue) — this computes the actual scene
            bounding box every frame and fits manually once it's non-empty
            and has stopped changing (covers Suspense's async mesh load),
            independent of whatever controls type is active. */}
        <AutoFitCamera fitKey={fitKey} contentRef={contentRef} />
        <Suspense fallback={null}>
          <group ref={contentRef}>
            {roots.map((root) => (
              <LinkNode
                key={root.id}
                link={root}
                jointFromParent={undefined}
                linkById={linkById}
                childJointsByParentId={childJointsByParentId}
                meshByLinkId={meshByLinkId}
                selectedLinkId={selectedLinkId}
                onSelectMesh={onSelectMesh}
              />
            ))}
          </group>
        </Suspense>
        <Grid args={[20, 20]} cellColor="#44403c" sectionColor="#57534e" fadeDistance={15} infiniteGrid />
      </Canvas>
    </div>
  );
}

// Fits the camera to whatever's actually in the scene right now — reusable
// regardless of which controls type is active (see the note above where
// this is used). Runs every frame but does real work only until the
// bounding box has been non-empty and unchanged for a few consecutive
// frames (Suspense resolves each mesh async, one at a time), then goes
// idle until `fitKey` changes again.
function AutoFitCamera({ fitKey, contentRef }: { fitKey: string; contentRef: React.RefObject<THREE.Group | null> }) {
  const { camera, controls } = useThree();
  const fittedKey = useRef<string | null>(null);
  const stableFrames = useRef(0);
  const lastSize = useRef<THREE.Vector3 | null>(null);

  useFrame(() => {
    if (fittedKey.current === fitKey) return;
    const content = contentRef.current;
    if (!content) return;

    const box = new THREE.Box3().setFromObject(content);
    if (box.isEmpty()) return;

    const size = new THREE.Vector3();
    box.getSize(size);

    if (lastSize.current && lastSize.current.distanceTo(size) < 0.0001) {
      stableFrames.current++;
    } else {
      stableFrames.current = 0;
    }
    lastSize.current = size.clone();

    if (stableFrames.current < 3) return;

    const center = new THREE.Vector3();
    box.getCenter(center);
    const radius = Math.max(size.length() / 2, 0.01);

    // Distance needed for a sphere of this radius to fit inside the
    // camera's vertical FOV, with margin — not a flat multiplier, which
    // (at fov=50) was placing the camera too close for wide/flat meshes
    // and too far for tall ones.
    let distance = radius * 2.2;
    if (camera instanceof THREE.PerspectiveCamera) {
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const fitFov = Math.min(vFov, hFov);
      distance = (radius / Math.sin(fitFov / 2)) * 1.15;
    }

    const direction = new THREE.Vector3(1, 0.8, 1).normalize();
    camera.position.copy(center).addScaledVector(direction, distance);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.near = Math.max(distance / 1000, 0.001);
      camera.far = distance * 100;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(center);

    const anyControls = controls as unknown as {
      target?: THREE.Vector3;
      target0?: THREE.Vector3;
      position0?: THREE.Vector3;
      update?: () => void;
    } | null;
    if (anyControls?.target) {
      anyControls.target.copy(center);
      // TrackballControls snapshots the initial target/position into
      // target0/position0 once at construction, before this fit ever runs,
      // for its double-click "reset" — without updating that snapshot too,
      // a reset would silently jump back to the pre-fit (0,0,0)/[1,1,1] view.
      anyControls.target0?.copy(center);
      anyControls.position0?.copy(camera.position);
      anyControls.update?.();
    }

    fittedKey.current = fitKey;
  });

  return null;
}

function LinkNode({
  link,
  jointFromParent,
  linkById,
  childJointsByParentId,
  meshByLinkId,
  selectedLinkId,
  onSelectMesh,
}: {
  link: RobotLink;
  jointFromParent: RobotJoint | undefined;
  linkById: Map<string, RobotLink>;
  childJointsByParentId: Map<string, RobotJoint[]>;
  meshByLinkId: Map<string, LinkMeshRef>;
  selectedLinkId?: string;
  onSelectMesh?: (linkId: string) => void;
}) {
  // Outer group: this link's frame, positioned relative to its parent by
  // the connecting joint (identity for a root — a root's frame IS the
  // world frame). Children attach here, never inside the mesh-offset
  // group below, so a link's own visual tweak never displaces its kids.
  const jointXyz = jointFromParent?.origin.xyz ?? ZERO;
  const jointRpy = jointFromParent?.origin.rpy ?? ZERO;
  const localXyz = link.visualOrigin?.xyz ?? ZERO;
  const localRpy = link.visualOrigin?.rpy ?? ZERO;
  const meshRef = meshByLinkId.get(link.id);
  const scale = meshRef?.scale ?? 1;
  const children = childJointsByParentId.get(link.id) ?? [];

  return (
    <group position={[jointXyz.x, jointXyz.y, jointXyz.z]} rotation={[jointRpy.x, jointRpy.y, jointRpy.z]}>
      <group
        position={[localXyz.x, localXyz.y, localXyz.z]}
        rotation={[localRpy.x, localRpy.y, localRpy.z]}
        scale={[scale, scale, scale]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectMesh?.(link.id);
        }}
      >
        {meshRef && <MeshGeometry url={meshRef.url} extension={meshRef.extension} selected={link.id === selectedLinkId} />}
      </group>
      {children.map((childJoint) => {
        const childLink = linkById.get(childJoint.childLinkId);
        if (!childLink) return null;
        return (
          <LinkNode
            key={childLink.id}
            link={childLink}
            jointFromParent={childJoint}
            linkById={linkById}
            childJointsByParentId={childJointsByParentId}
            meshByLinkId={meshByLinkId}
            selectedLinkId={selectedLinkId}
            onSelectMesh={onSelectMesh}
          />
        );
      })}
    </group>
  );
}

function MeshGeometry({ url, extension, selected }: { url: string; extension: LinkMeshRef['extension']; selected?: boolean }) {
  switch (extension) {
    case 'stl':
      return <StlMesh url={url} selected={selected} />;
    case 'obj':
      return <ObjMesh url={url} />;
    default:
      return <GltfMesh url={url} />;
  }
}

function StlMesh({ url, selected }: { url: string; selected?: boolean }) {
  const geometry = useLoader(STLLoader, url);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={selected ? '#34d399' : '#a8a29e'} />
    </mesh>
  );
}

function ObjMesh({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url);
  return <primitive object={obj} />;
}

function GltfMesh({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}
