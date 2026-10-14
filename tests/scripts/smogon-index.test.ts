import { describe, expect, it } from 'vitest';
import { listMonths, pickCutoff } from '../../scripts/smogon-index';

describe('indice smogon.com/stats', () => {
  it('elenca i mesi dal più recente, ignorando le cartelle DLC', () => {
    const html = '<a href="2026-08/">2026-08/</a><a href="2026-09/">2026-09/</a><a href="2023-01-DLC1/">x</a>';
    expect(listMonths(html)).toEqual(['2026-09', '2026-08']);
  });

  it('sceglie la soglia preferita disponibile', () => {
    const files = (cutoffs: number[]) => cutoffs.map(c => `<a href="gen9nationaldex-${c}.json">x</a>`).join('');
    expect(pickCutoff(files([0, 1500, 1630, 1760]), 'gen9nationaldex')).toBe(1630);
    expect(pickCutoff(files([0, 1500, 1695, 1825]), 'gen9nationaldex')).toBe(1695);
    expect(pickCutoff(files([1760]), 'gen9nationaldex')).toBe(1760);
    expect(pickCutoff('<a href="gen9ou-1695.json">x</a>', 'gen9nationaldex')).toBeNull();
  });

  it('non confonde formati con lo stesso prefisso', () => {
    const html = '<a href="gen9nationaldexubers-1630.json">x</a><a href="gen9nationaldex-1500.json">x</a>';
    expect(pickCutoff(html, 'gen9nationaldex')).toBe(1500);
  });
});
