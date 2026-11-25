/**
 * Parse a port list like "80, 443, 8000-8002" into sorted unique numbers. Returns null on invalid input.
 */
export function parsePorts(input: string): number[] | null {
  const ports = new Set<number>();
  const parts = input.split(/[\s,;]+/).filter(Boolean);
  if (!parts.length) return null;
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return null;
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : start;
    if (start < 1 || end > 65535 || end < start || end - start > 1000) return null;
    for (let p = start; p <= end; p += 1) ports.add(p);
  }
  return [...ports].sort((a, b) => a - b);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'canvas';
}
