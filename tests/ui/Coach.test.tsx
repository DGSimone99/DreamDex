import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { analyzeTeam } from '../../src/engine/analysis';
import { coachTeam, type Coaching } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, exportShowdown, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { AnalysisPanel } from '../../src/ui/AnalysisPanel';
import { CoachingView } from '../../src/ui/CoachingView';
import { fixtureData, fixtureStats } from '../fixtures/data';
import { adviceOf } from '../helpers/coach';
import { renderIt } from '../helpers/italian';

// Due membri deboli lasciano spazio ai sostituti delle statistiche di prova (come nei test del motore)
const junk = (species: string): TeamSet => ({ ...emptySet(species), moves: ['Splash'] });
const six = [...['Great Tusk', 'Gholdengo', 'Toxapex', 'Corviknight'].map(n => mostCommonSet(fixtureStats, n)!), junk('Magikarp'), junk('Sunkern')];
const three = six.slice(0, 3);
const data = { ...fixtureData, formatId: DEFAULT_FORMAT.formatId };

const analysis = () => screen.getByRole('region', { name: 'Analisi' });
const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });

/** Importa il team, apre Analisi e la scheda Coaching. */
async function openCoaching(team: TeamSet[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(exportShowdown(team));
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
  await user.click(within(analysis()).getByRole('tab', { name: /^Coaching/ }));
  return user;
}

/** Il "+N" della riga del candidato nella lista di Migliora team. */
const rowGain = (species: string) => {
  const row = [...suggestions().querySelectorAll<HTMLElement>('.suggestions li')]
    .find(li => li.querySelector('.name-line strong')?.textContent?.replace(/^\d+\. /, '') === species)!;
  expect(row).toBeTruthy();
  return /\(([^)]+)\)$/.exec(within(row).getByLabelText(/^Voto del team: /).getAttribute('aria-label')!)![1];
};

describe('scheda Coaching', () => {
  it('i gravi sotto "Gravi", prima dei minori', async () => {
    await openCoaching(six);
    const serious = within(analysis()).getByRole('list', { name: 'Gravi' });
    const minor = within(analysis()).getByRole('list', { name: 'Minori' });
    expect(serious).toHaveTextContent('Mosse non legali');
    expect(minor).toHaveTextContent('Debole a');
    expect(serious.compareDocumentPosition(minor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Area a destra di ogni problema
    expect(within(serious).getByText('Regole')).toBeInTheDocument();
  });

  it('clic su un sostituto: scheda Pokémon, quel membro da sostituire, il candidato aperto, stesso +N', async () => {
    const user = await openCoaching(six);
    const button = within(analysis()).getAllByRole('button', { name: /^Al posto di .+: .+, \+\d+$/ })[0];
    const [, member, species, gain] = /^Al posto di (.+): (.+), \+(\d+)$/.exec(button.getAttribute('aria-label')!)!;
    await user.click(button);
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveTextContent(`Sostituisci ${member}`);
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${species}` })).toBeInTheDocument();
    expect(rowGain(species)).toBe(`+${gain}`);
  });

  it('una ricerca rimasta nella scheda Pokémon non nasconde il candidato: impostazioni predefinite, stesso +N', async () => {
    const user = await openCoaching(six);
    await user.click(screen.getByRole('tab', { name: /^Pokémon/ }));
    const search = within(suggestions()).getByLabelText('Aggiungi Pokémon');
    await user.type(search, 'Zap');
    // Anche un tipo di team scelto a mano torna quello riconosciuto
    const type = () => within(suggestions()).getByRole('combobox', { name: 'Tipo di team' }) as HTMLSelectElement;
    const recognised = type().value;
    await user.selectOptions(type(), recognised === 'stall' ? 'hyperOffense' : 'stall');
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    const button = within(analysis()).getAllByRole('button', { name: /^Al posto di .+: .+, \+\d+$/ })[0];
    const [, , species, gain] = /^Al posto di (.+): (.+), \+(\d+)$/.exec(button.getAttribute('aria-label')!)!;
    await user.click(button);
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${species}` }, { timeout: 3000 })).toBeInTheDocument();
    expect(within(suggestions()).getByLabelText('Aggiungi Pokémon')).toHaveValue('');
    expect(type().value).toBe(recognised);
    expect(rowGain(species)).toBe(`+${gain}`);
  });

  it('team di 3: un candidato da aggiungere apre Aggiungi con lui nel dettaglio, stesso +N', async () => {
    const user = await openCoaching(three);
    const button = within(analysis()).getAllByRole('button', { name: /^Aggiungi .+, \+\d+$/ })[0];
    const [, species, gain] = /^Aggiungi (.+), \+(\d+)$/.exec(button.getAttribute('aria-label')!)!;
    await user.click(button);
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(suggestions()).getByRole('button', { name: 'Aggiungi' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${species}` })).toBeInTheDocument();
    expect(rowGain(species)).toBe(`+${gain}`);
  });

  it('invito ad aggiungere con meno di 2 membri', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    // Nella Panoramica: come giudizio e nel "Cosa fare" del cruscotto
    expect(within(analysis()).getAllByText('Aggiungi almeno 2 Pokémon per ricevere il coaching').length).toBeGreaterThan(0);
    // Anche nella scheda Coaching, non "nessun problema"
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    await user.click(within(analysis()).getByRole('tab', { name: /^Coaching/ }));
    expect(within(analysis()).getByText('Aggiungi almeno 2 Pokémon per ricevere il coaching')).toBeInTheDocument();
    expect(within(analysis()).queryByText('Nessun problema: il team è a posto.')).toBeNull();
  });
});

describe('CoachingView', () => {
  it('candidati sotto il problema raggruppati per membro, anche per chi lo riduce soltanto', () => {
    const coaching = coachTeam(three, DEFAULT_FORMAT, data);
    renderIt(<CoachingView coaching={coaching} advice={adviceOf(three, DEFAULT_FORMAT, data)} members={3} onFix={() => {}} />);
    // Corviknight risolve Psychic come aggiunta
    const psychic = screen.getAllByRole('listitem').find(li => li.textContent?.startsWith('Debole a Psychic'))!;
    expect(psychic).toHaveTextContent(/Considera di aggiungere: Corviknight\+\d+/);
    // Ground si risolve sostituendo Toxapex
    const ground = screen.getAllByRole('listitem').find(li => li.textContent?.startsWith('Debole a Ground'))!;
    expect(ground).toHaveTextContent(/Considera, al posto di Toxapex: Rotom-Wash\+\d+/);
    // Problemi raggruppati: chi copre uno dei tipi o porta uno dei ruoli è un candidato, niente testo di ripiego
    for (const start of ['Nessuna mossa super efficace contro', 'Ruoli importanti mancanti']) {
      const item = screen.getAllByRole('listitem').find(li => li.textContent?.startsWith(start))!;
      expect(within(item).getAllByRole('button').length).toBeGreaterThan(0);
      expect(item).not.toHaveTextContent('Nessun cambio');
    }
  });

  it('nessun candidato lo risolve né lo riduce: chi lo gestisce, come testo', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
      problems: [{ severity: 'minor', category: 'roles', text: 'Ruoli importanti mancanti: Pivot', fixes: ['Corviknight', 'Rotom-Wash'], key: 'roles:important' }] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], moves: [], steps: [] }} members={3} onFix={() => {}} />);
    const roles = screen.getByRole('listitem');
    expect(roles).toHaveTextContent('Nessun cambio fra i consigliati lo risolve: lo gestiscono Corviknight o Rotom-Wash');
    expect(within(roles).queryByRole('button')).toBeNull();
  });

  it('consigli in calcolo: i problemi sì, al posto dei candidati una riga', () => {
    const coaching = coachTeam(three, DEFAULT_FORMAT, data);
    renderIt(<CoachingView coaching={coaching} advice={null} members={3} onFix={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Calcolo dei consigli…');
    expect(screen.getByRole('list', { name: 'Gravi' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Nessun cambio/)).toBeNull();
  });

  it('con un membro solo: invito ad aggiungere, non "nessun problema"', () => {
    const coaching = coachTeam([six[0]], DEFAULT_FORMAT, data);
    renderIt(<CoachingView coaching={coaching} advice={null} members={1} onFix={() => {}} />);
    expect(screen.getByText('Aggiungi almeno 2 Pokémon per ricevere il coaching')).toBeInTheDocument();
    expect(screen.queryByText('Nessun problema: il team è a posto.')).toBeNull();
  });

  it('senza meta nessun problema "senza un check" né candidati', () => {
    const withMeta = coachTeam(three, DEFAULT_FORMAT, data);
    expect(withMeta.problems.some(p => /senza un check/.test(p.text))).toBe(true);
    const coaching = coachTeam(three, { ...DEFAULT_FORMAT, meta: false }, { ...data, ignoreMeta: true });
    renderIt(<CoachingView coaching={coaching} advice={null} members={3} onFix={() => {}} />);
    expect(screen.queryByText(/senza un check/)).toBeNull();
  });

  it('nessun problema: un messaggio positivo', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], problems: [], threatFixes: {} };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], moves: [], steps: [] }} members={6} onFix={() => {}} />);
    expect(screen.getByText('Nessun problema: il team è a posto.')).toBeInTheDocument();
  });

  it('dice quanti bannati restano fuori dai candidati', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], problems: [], threatFixes: {}, bannedCount: 1 };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], moves: [], steps: [] }} members={6} onFix={() => {}} />);
    expect(screen.getByText('1 bannato escluso')).toBeInTheDocument();
  });
});

describe('AnalysisPanel: Coaching e profilo di un membro', () => {
  it('la vista Coaching vince sul membro aperto', () => {
    const coaching = coachTeam(three, DEFAULT_FORMAT, data);
    renderIt(<AnalysisPanel team={three} analysis={analyzeTeam(three, data)} rating={rateTeam(three, data, 'it')} data={data} coaching={coaching}
      view="coaching" onView={() => {}} member={0} onMember={() => {}} />);
    expect(screen.getByRole('list', { name: 'Gravi' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Panoramica/ })).toBeNull();
  });
});
