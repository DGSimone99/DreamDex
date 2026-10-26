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
    expect(within(analysis()).getByText('Aggiungi almeno 2 Pokémon per ricevere il coaching')).toBeInTheDocument();
  });
});

describe('CoachingView', () => {
  it('"Prima di tutto": il cambio, il voto in più, quanti problemi risolve e il pulsante', async () => {
    const coaching = coachTeam(six, DEFAULT_FORMAT, data);
    const onFix = vi.fn();
    renderIt(<CoachingView coaching={coaching} onFix={onFix} />);
    const first = screen.getByRole('region', { name: 'Prima di tutto' });
    const { member, species, gain, solves } = coaching.first!;
    expect(first).toHaveTextContent(`Al posto di ${member} metti ${species}+${gain}`);
    expect(first).toHaveTextContent(`risolve ${solves.length} problemi`);
    await userEvent.click(within(first).getByRole('button', { name: /^Apri in Migliora team/ }));
    expect(onFix).toHaveBeenCalledWith(coaching.first);
  });

  it('candidati sotto il problema raggruppati per membro; senza cambi, chi lo gestisce', () => {
    const coaching = coachTeam(three, DEFAULT_FORMAT, data);
    renderIt(<CoachingView coaching={coaching} onFix={() => {}} />);
    // Corviknight risolve Psychic come aggiunta
    const psychic = screen.getAllByRole('listitem').find(li => li.textContent?.startsWith('Debole a Psychic'))!;
    expect(psychic).toHaveTextContent(/Considera di aggiungere: Corviknight\+\d+/);
    // Ground si risolve sostituendo Toxapex
    const ground = screen.getAllByRole('listitem').find(li => li.textContent?.startsWith('Debole a Ground'))!;
    expect(ground).toHaveTextContent(/Considera, al posto di Toxapex: Rotom-Wash\+\d+/);
    // Ruoli importanti: nessun cambio lo risolve, i nomi di oggi come testo
    const roles = screen.getAllByRole('listitem').find(li => li.textContent?.startsWith('Ruoli importanti mancanti'))!;
    expect(roles).toHaveTextContent('Nessun cambio alza il voto: lo gestiscono Corviknight o Rotom-Wash');
    expect(within(roles).queryByRole('button')).toBeNull();
  });

  it('senza meta nessun problema "senza un check" né candidati', () => {
    const withMeta = coachTeam(three, DEFAULT_FORMAT, data);
    expect(withMeta.problems.some(p => /senza un check/.test(p.text))).toBe(true);
    const coaching = coachTeam(three, { ...DEFAULT_FORMAT, meta: false }, { ...data, ignoreMeta: true });
    renderIt(<CoachingView coaching={coaching} onFix={() => {}} />);
    expect(screen.queryByText(/senza un check/)).toBeNull();
  });

  it('nessun problema: un messaggio positivo', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], problems: [], fixes: [], first: null, threatFixes: {} };
    renderIt(<CoachingView coaching={coaching} onFix={() => {}} />);
    expect(screen.getByText('Nessun problema: il team è a posto.')).toBeInTheDocument();
  });

  it('dice quanti bannati restano fuori dai candidati', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], problems: [], fixes: [], first: null, threatFixes: {}, bannedCount: 1 };
    renderIt(<CoachingView coaching={coaching} onFix={() => {}} />);
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
