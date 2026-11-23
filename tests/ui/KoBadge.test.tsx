import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KO_TAG, KoBadge } from '../../src/ui/KoBadge';

const css = readFileSync('src/styles/floattip.css', 'utf8');
/** La regola CSS di una fascia (es. `.ko-badge.off.ohko`), senza spazi in più. */
const rule = (sel: string) => {
  const m = new RegExp(`${sel.replace(/\./g, '\\.')}[^{]*\\{([^}]*)\\}`).exec(css);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
};

describe('KoBadge: la fascia dei colpi uguale in ogni tooltip', () => {
  it('il nome della fascia sempre intero (mai solo "KO") e il numero facoltativo dopo', () => {
    expect(Object.values(KO_TAG)).toEqual(['OHKO', '2HKO', '3HKO', '4HKO+', '3HKO+']);
    const { container, rerender } = render(<KoBadge side="off" band="ohko" n={14} />);
    const badge = container.querySelector('.ko-badge')!;
    expect(badge).toHaveClass('off', 'ohko');
    expect(badge.querySelector('em')).toHaveTextContent(/^OHKO$/);
    expect(badge.querySelector('b')).toHaveTextContent(/^14$/);
    rerender(<KoBadge side="def" band="held" />);
    expect(container.querySelector('.ko-badge')).toHaveClass('def', 'held');
    expect(container.querySelector('.ko-badge em')).toHaveTextContent(/^3HKO\+$/);
    expect(container.querySelector('.ko-badge b')).toBeNull();
  });

  it('un colore fisso per fascia, quello delle tessere della Generale e delle caselle di Coverage del suo lato', () => {
    // Offesa: OHKO verde pieno, 2HKO verde chiaro, 3HKO giallo, 4HKO+ grigio (come .ko-ohko/.ko-two/.ko-three/.ko-none)
    expect(rule('.ko-badge.off.ohko')).toContain('color-mix(in srgb, var(--good) 46%, var(--panel))');
    expect(rule('.ko-badge.off.two')).toContain('color-mix(in srgb, var(--good) 22%, var(--panel))');
    expect(rule('.ko-badge.off.three')).toContain('color-mix(in srgb, var(--warn) 24%, var(--panel))');
    expect(rule('.ko-badge.off.four')).toContain('var(--raised)');
    // Difesa: OHKO rosso, 2HKO giallo, 3HKO verde chiaro, 4HKO+ verde (come .hold-ohko/.hold-2/.hold-3/.hold-4)
    expect(rule('.ko-badge.def.ohko')).toContain('color-mix(in srgb, var(--bad) 46%, var(--panel))');
    expect(rule('.ko-badge.def.two')).toContain('color-mix(in srgb, var(--warn) 26%, var(--panel))');
    expect(rule('.ko-badge.def.three')).toContain('color-mix(in srgb, var(--good) 42%, var(--panel))');
    expect(rule('.ko-badge.def.four')).toContain('color-mix(in srgb, var(--good) 30%, var(--panel))');
    // Le vecchie fasce dei tooltip (.ftip-ko, .kob.labeled) non ci sono più
    expect(css).not.toMatch(/\.ftip-ko|\.kob\.labeled/);
  });
});
