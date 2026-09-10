import { createOpenSCAD } from 'openscad-wasm';

// Real OpenSCAD, compiled to WebAssembly, run server-side in Node — not a
// mock. Verified during development: renders a box and a boolean CSG
// difference to valid ASCII STL with correct geometry (real vertex data,
// real bounding boxes). A fresh WASM instance is created per call — no
// cross-invocation state to worry about in a serverless environment where
// each request may land on a different process anyway.
export async function compileScadToStl(scadSource: string, timeoutMs = 20000): Promise<string> {
  const instance = await createOpenSCAD({
    print: () => {}, // suppress OpenSCAD's stdout logging in server logs
    printErr: () => {},
  });

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('OpenSCAD compilation timed out — the part may be too complex or the source invalid.')), timeoutMs);
  });

  const stl = await Promise.race([instance.renderToStl(scadSource), timeout]);

  if (!stl || !stl.includes('facet')) {
    throw new Error('OpenSCAD produced no geometry — check the generated source for a valid solid (e.g. an empty union, or a difference() that fully consumes itself).');
  }

  return stl;
}
