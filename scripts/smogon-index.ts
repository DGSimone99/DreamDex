export const PREFERRED_CUTOFFS = [1695, 1630, 1500, 0];

export function listMonths(indexHtml: string): string[] {
  const months = [...indexHtml.matchAll(/href="(\d{4}-\d{2})\/"/g)].map(match => match[1]);
  return [...new Set(months)].sort().reverse();
}

export function pickCutoff(chaosIndexHtml: string, format: string): number | null {
  const pattern = new RegExp(`href="${format}-(\\d+)\\.json"`, 'g');
  const available = [...chaosIndexHtml.matchAll(pattern)].map(match => Number(match[1]));
  const preferred = PREFERRED_CUTOFFS.find(cutoff => available.includes(cutoff));
  if (preferred !== undefined) return preferred;
  return available.length ? Math.max(...available) : null;
}
