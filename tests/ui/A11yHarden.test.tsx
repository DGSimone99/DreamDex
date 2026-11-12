import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { encodeShare } from '../../src/share';
import { App } from '../../src/App';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

afterEach(() => window.history.replaceState(null, '', '/'));

const withTeam = () => {
  window.history.replaceState(null, '', `/#team=${encodeShare([tusk, gholdengo], DEFAULT_FORMAT)}`);
  return render(<App initialLang="it" data={fixtureData} />);
};

describe('accessibilità di team e voto', () => {
  it('il voto della testata si legge anche con il lettore di schermo', () => {
    const { container } = withTeam();
    const badge = container.querySelector('.band .grade-badge')!;
    expect(badge.getAttribute('aria-hidden')).toBeNull();
    expect(badge.querySelector('.visually-hidden')!.textContent).toMatch(/^Voto [A-D], \d+ su 100, .+$/);
  });

  it('la carta ha un nome breve: nome, Lead, tipi, strumento', () => {
    const { container } = withTeam();
    const [first, second] = container.querySelectorAll('.slot-toggle');
    expect(first.getAttribute('aria-label')).toMatch(/^Great Tusk, Lead, (Terra\/Lotta|Ground\/Fighting), .+$/);
    expect(second.getAttribute('aria-label')).not.toMatch(/Lead/);
  });

  it('dopo Rimuovi il focus passa alla carta successiva, non si perde', async () => {
    const user = userEvent.setup();
    const { container } = withTeam();
    await user.click(screen.getByRole('button', { name: 'Rimuovi Great Tusk' }));
    await new Promise(r => requestAnimationFrame(r));
    expect(document.activeElement).toBe(container.querySelector('.slot-toggle'));
  });

  it('nessun controllo dentro un altro: stella, × e avvisi stanno accanto al pulsante della carta', async () => {
    const user = userEvent.setup();
    const { container } = withTeam();
    const controls = 'button, a, input, select, textarea, summary, [tabindex]';
    for (const el of container.querySelectorAll('.slot-card')) {
      expect([...el.querySelectorAll(controls)].filter(c => c.parentElement?.closest(controls))).toEqual([]);
    }
    const toggle = container.querySelector<HTMLElement>('.slot-toggle')!;
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // La stella non apre l'editor
    await user.click(screen.getByRole('button', { name: 'Preferito Great Tusk' }));
    expect(container.querySelector('.slot.open')).toBeNull();
    // Il clic sulla carta apre l'editor e lascia il fuoco sul suo pulsante
    await user.click(container.querySelector<HTMLElement>('.slot-card .name')!);
    expect(container.querySelector('.slot.open')).not.toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toHaveClass('drawer');
    expect(document.activeElement).toBe(toggle);
  });
});
