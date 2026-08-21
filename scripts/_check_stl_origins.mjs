import * as fs from 'fs';

// Minimal binary STL bounding-box reader (no three.js needed) — just to
// confirm/deny whether left_tire.stl and right_tire.stl share a coordinate
// system, independent of anything in the app's own pipeline.
function readBinaryStlBounds(path) {
  const buf = fs.readFileSync(path);
  const triCount = buf.readUInt32LE(80);
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let offset = 84;
  for (let i = 0; i < triCount; i++) {
    offset += 12; // skip normal
    for (let v = 0; v < 3; v++) {
      const x = buf.readFloatLE(offset); offset += 4;
      const y = buf.readFloatLE(offset); offset += 4;
      const z = buf.readFloatLE(offset); offset += 4;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    offset += 2; // attribute byte count
  }
  return {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
  };
}

for (const f of ['burger_base.stl', 'left_tire.stl', 'right_tire.stl', 'lds.stl']) {
  const bounds = readBinaryStlBounds(`./stl_demos/${f}`);
  console.log(f, JSON.stringify(bounds));
}
