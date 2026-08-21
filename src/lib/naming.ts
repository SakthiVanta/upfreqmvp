// Shared helpers for turning "whatever the user gave us" into a unique,
// URDF-safe link name — used both for filename-derived names (upload flows)
// and AI-suggested names (still needs collision handling against whatever
// already exists).

export function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

export function nameFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]+/g, '_') || 'link';
}
