import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { encodeShare } from '../../src/share';
import { App } from '../../src/App';
import { resetMySetsCache } from '../../src/ui/mySets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

beforeEach(() => { window.localStorage.clear(); resetMySetsCache(); });
afterEach(() => window.history.replaceState(null, '', '/'));

const team = () => screen.getByRole('region', { name: 'Team' });

async function importTeam(text: string) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  return user;
}

async function pasteInMember(text: string) {
  const user = userEvent.setup();
  window.history.replaceState(null, '', `/#team=${encodeShare([tusk, gholdengo], DEFAULT_FORMAT)}`);
  const { container } = render(<App initialLang="it" data={fixtureData} />);
  await user.click(container.querySelector<HTMLElement>('.slot-toggle')!);
  const slot = () => container.querySelector<HTMLElement>('.slot.open')!;
  await user.click(within(slot()).getByRole('button', { name: 'Testo del set' }));
  const area = within(slot()).getByLabelText('Set in testo Showdown');
  await user.clear(area);
  await user.click(area);
  await user.paste(text);
  await user.click(within(slot()).getByRole('button', { name: 'Applica' }));
  return { user, container, slot };
}

describe('import del team: cosa lo ferma', () => {
  it('Pokémon non trovato, più di 4 mosse: niente importato, una riga per problema', async () => {
    await importTeam('Fakemon-Xyz\n- Tackle\n\nGarchomp\n- Earthquake\n- Outrage\n- Swords Dance\n- Scale Shot\n- Fire Fang');
    const dialog = screen.getByRole('alertdialog', { name: 'Niente importato' });
    expect(within(dialog).getAllByRole('listitem').map(li => li.textContent)).toEqual([
      'Pokémon "Fakemon-Xyz" non trovato: controlla il nome (in inglese, come su Showdown)',
      'Garchomp: più di 4 mosse, lasciane al massimo 4',
    ]);
    expect(within(team()).getByRole('heading', { name: 'Team (0/6)' })).toBeInTheDocument();
  });

  it('più di 6 Pokémon: niente importato', async () => {
    await importTeam(['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex', 'Rotom-Wash'].join('\n\n'));
    expect(within(screen.getByRole('alertdialog', { name: 'Niente importato' }))
      .getByText('Più di 6 Pokémon: Rotom-Wash e gli altri in più non entrano')).toBeInTheDocument();
    expect(within(team()).getByRole('heading', { name: 'Team (0/6)' })).toBeInTheDocument();
  });

  it('nessun set nel testo: lo dice, con cosa incollare', async () => {
    await importTeam('- Tackle');
    expect(screen.getByRole('alertdialog', { name: 'Niente importato' })).toHaveTextContent('Set 1 non letto');
  });
});

describe('import del team: mosse non imparabili', () => {
  it('importa, poi chiede il Custom Skillset per quei Pokémon; Sì lo attiva solo su di loro', async () => {
    const user = await importTeam('Drakloak\nAbility: Infiltrator\n- Dragon Darts\n- Laser Blast\n\nCorviknight\nAbility: Pressure\n- Defog');
    expect(within(team()).getByRole('heading', { name: 'Team (2/6)' })).toBeInTheDocument();
    const dialog = screen.getByRole('alertdialog', { name: 'Mosse non imparabili' });
    expect(dialog).toHaveTextContent('Uno o più di questi Pokémon non possono imparare queste mosse:');
    expect(within(dialog).getAllByRole('listitem').map(li => li.textContent)).toEqual(['Drakloak: Dragon Darts, Laser Blast (non trovata)']);
    expect(dialog).toHaveTextContent('Attivare il Custom Skillset per questi Pokémon?');
    await user.click(within(dialog).getByRole('button', { name: 'Sì' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Custom Skillset Drakloak' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Custom Skillset Corviknight' })).not.toBeChecked();
    expect(within(team()).queryByText(/Mosse non legali in questo formato/)).toBeNull();
  });

  it('No: le mosse restano, segnalate come oggi', async () => {
    const user = await importTeam('Drakloak\nAbility: Infiltrator\n- Dragon Darts');
    await user.click(within(screen.getByRole('alertdialog', { name: 'Mosse non imparabili' })).getByRole('button', { name: 'No' }));
    expect(screen.getByRole('checkbox', { name: 'Custom Skillset Drakloak' })).not.toBeChecked();
    const warning = within(team()).getByText('Mosse non legali in questo formato: Dragon Darts');
    expect(warning).toHaveAttribute('title', 'Cambiale o attiva Custom Skillset');
  });

  it('strumento non trovato: importato, detto solo per sapere (OK)', async () => {
    const user = await importTeam('Clefable @ Magic Wand\nAbility: Magic Guard\n- Moonblast');
    const dialog = screen.getByRole('alertdialog', { name: 'Nomi non trovati' });
    expect(within(dialog).getByText('Clefable: strumento Magic Wand')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Sì' })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(within(team()).getByText('Clefable')).toBeInTheDocument();
  });
});

describe('Incolla set del membro', () => {
  it('due set nel testo: non incolla niente e il testo resta', async () => {
    const text = 'Garchomp\n- Earthquake\n\nCorviknight\n- Defog';
    const { user, slot } = await pasteInMember(text);
    const dialog = screen.getByRole('alertdialog', { name: 'Niente importato' });
    expect(dialog).toHaveTextContent('Nel testo ci sono 2 set: qui se ne incolla uno solo');
    // Esc chiude solo la finestra: l'editor e il testo restano
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(slot()).getByLabelText('Set in testo Showdown')).toHaveValue(text);
    expect(within(team()).queryByText('Garchomp')).toBeNull();
  });

  it('Pokémon non trovato: non incolla niente', async () => {
    await pasteInMember('Fakemon-Xyz\n- Tackle');
    expect(screen.getByRole('alertdialog', { name: 'Niente importato' }))
      .toHaveTextContent('Pokémon "Fakemon-Xyz" non trovato: controlla il nome (in inglese, come su Showdown)');
  });

  it('mosse non imparabili: incolla, poi chiede; Sì attiva il Custom Skillset del membro', async () => {
    const { user } = await pasteInMember('Drakloak\nAbility: Infiltrator\n- Dragon Darts');
    expect(within(team()).getAllByText('Drakloak').length).toBeGreaterThan(0);
    const dialog = screen.getByRole('alertdialog', { name: 'Mosse non imparabili' });
    expect(within(dialog).getByText('Drakloak: Dragon Darts')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Sì' }));
    expect(screen.getByRole('checkbox', { name: 'Custom Skillset Drakloak' })).toBeChecked();
  });
});
