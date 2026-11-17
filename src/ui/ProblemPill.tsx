import type { CoachProblem } from '../engine/coach';
import { needLabel, type Need } from '../engine/needs';
import { formatPercent } from '../i18n';
import { typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Icon } from './icons';
import { PokemonIcon } from './PokemonName';
import { TypeIcons } from './typeIcons';
import { Typed } from './TypeText';

/** I tipi colorati; `plain`: senza colore (nella pillola l'icona del tipo è già davanti). */
export function ProblemText({ text, plain = false }: { text: string; plain?: boolean }) {
  return plain ? <>{text}</> : <Typed text={text} />;
}

/** Le minacce del meta: chi nessuno regge (Difesa) e chi nessuno manda KO (Offesa), con l'icona del Pokémon. */
export const isThreat = (p: CoachProblem) => p.category === 'meta' || p.category === 'metaHit';

/** I problemi "ruoli mancanti" (essenziali o importanti) coi ruoli come soggetti. */
export const isMissingRoles = (p: CoachProblem) => p.category === 'roles' && (p.key === 'roles:essential' || p.key === 'roles:important') && (p.subjects?.length ?? 0) > 0;

/**
 * Il testo intero di un problema per i tooltip: per i tipi della Difesa che qualcuno regge, anche quanti
 * ("solo 1 membro lo regge bene"); se nessuno lo regge lo dice già il testo.
 */
export function tipOf(p: CoachProblem, tr: ReturnType<typeof useT>): string {
  const held = p.counts?.held ?? 0;
  if (held === 0) return p.text;
  return `${p.text} · ${tr(held === 1 ? 'coach.pill.held1' : 'coach.pill.heldN', { n: held })}`;
}

/**
 * Il testo corto di un problema come pillola, uguale nella mappa del Coaching e nella testata delle aree: una minaccia con
 * l'icona e il nome del Pokémon; un ruolo mancante (`role`) con la × e il nome del ruolo; un tipo della Difesa con quanti
 * lo reggono ("Fuoco · 1 regge"); Difesa e Offesa con le icone dei tipi davanti e il testo senza colori; il resto col suo
 * testo. Ai lettori di schermo il testo intero dove la pillola lo accorcia. `usage`: l'uso nel meta di una minaccia (solo
 * nella mappa).
 */
export function ProblemPill({ problem, role, usage }: { problem: CoachProblem; role?: string; usage?: number }) {
  const tr = useT();
  const lang = useLang();
  const subjects = problem.subjects ?? [];
  const threat = isThreat(problem) && subjects.length > 0 ? subjects[0] : null;
  // Difesa e coverage: le icone dei tipi davanti, il testo senza colori (il tipo non si legge due volte)
  const typed = (problem.category === 'defense' || problem.category === 'coverage') && subjects.length > 0;
  const counts = problem.category === 'defense' && subjects.length === 1 ? problem.counts : undefined;
  if (threat) {
    return (
      <span className="coach-prob-text is-threat">
        <PokemonIcon name={threat} /><span className="coach-threat-name" aria-hidden="true">{threat}</span><span className="visually-hidden">{problem.text}</span>
        {usage !== undefined && <span className="coach-usage">{formatPercent(lang, usage, 0)}</span>}
      </span>
    );
  }
  if (role) return <span className="coach-prob-text coach-miss"><Icon name="close" />{needLabel(role as Need, lang)}</span>;
  if (counts) {
    return (
      <span className="coach-prob-text">
        <TypeIcons types={subjects} /><span aria-hidden="true">{typeName(subjects[0], lang)}{' '}
          <span className="coach-counts">· <span className={counts.held ? 'count-resist' : 'count-weak'}>{tr(counts.held === 0 ? 'coach.pill.held0' : counts.held === 1 ? 'coach.pill.held1' : 'coach.pill.heldN', { n: counts.held })}</span></span>
        </span><span className="visually-hidden">{problem.text}</span>
      </span>
    );
  }
  return (
    <span className="coach-prob-text">
      {typed && <TypeIcons types={subjects} />}
      <ProblemText text={problem.text} plain={typed} />
    </span>
  );
}
