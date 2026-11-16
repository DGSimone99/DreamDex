import type { CoachProblem } from '../../engine/coach';
import { MAX_STEPS, type CoachStep } from '../../engine/coachSteps';
import { t as translate, type Lang } from '../../i18n';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { Icon } from '../icons';

/** Nomi delle minacce scritti nella frase; gli altri diventano "e altri N" (tutti nel tooltip). */
export const THREAT_NAMES = 3;

/**
 * I problemi che il Coaching sa risolvere: quelli delle tappe che mostra (il problema della tappa, il suo gruppo e gli altri
 * che copre). Gli altri (es. minacce minori quando nessun cambio alza il voto) non vanno nella riga: lì non c'è consiglio.
 */
export function solvable(problems: CoachProblem[], steps: CoachStep[]): CoachProblem[] {
  const keys = new Set(steps.slice(0, MAX_STEPS).flatMap(step => [step.problem.key, ...step.group, ...step.alsoSolves]));
  return problems.filter(p => keys.has(p.key));
}

/** Quante voci si leggono nella riga; le altre stanno nel "+N" (col testo nel tooltip). */
export const FIX_SHOWN = 2;

/**
 * Le voci della riga "Da sistemare": prima i problemi gravi (l'ordine del Coaching resta a parità), e le minacce del meta
 * che nessuno regge in una frase sola coi nomi, al posto della prima di loro.
 */
export function fixItems(problems: CoachProblem[], lang: Lang): { shown: string[]; hidden: string[]; more: number } {
  const sorted = [...problems.filter(p => p.severity === 'serious'), ...problems.filter(p => p.severity !== 'serious')];
  // Le minacce del meta in una frase sola per tipo (chi nessuno regge, chi nessuno manda KO), al posto della prima di loro
  const SENTENCES = {
    meta: ['overview.fix.threats', 'overview.fix.threatsMore'],
    metaHit: ['overview.fix.metaHit', 'overview.fix.metaHitMore'],
  } as const;
  const grouped = (p: CoachProblem): p is CoachProblem & { category: keyof typeof SENTENCES } => (p.category === 'meta' || p.category === 'metaHit') && !!p.subjects?.length;
  const items: string[] = [];
  const placed = new Set<string>();
  for (const p of sorted) {
    if (!grouped(p)) { items.push(p.text); continue; }
    if (placed.has(p.category)) continue;
    placed.add(p.category);
    const names = sorted.filter(q => q.category === p.category && q.subjects?.length).flatMap(q => q.subjects!);
    const list = names.slice(0, THREAT_NAMES).join(', ');
    const rest = names.length - THREAT_NAMES;
    const [one, more] = SENTENCES[p.category];
    items.push(rest > 0 ? translate(lang, more, { list, n: rest }) : translate(lang, one, { list }));
  }
  const shown = items.slice(0, FIX_SHOWN);
  const hidden = items.slice(FIX_SHOWN);
  return { shown, hidden, more: hidden.length };
}

/**
 * In fondo alla Panoramica: cosa il Coaching sa sistemare, coi nomi, e il passaggio al Coaching (tutta la striscia porta lì,
 * come quella in fondo alle aree, che sta nello stesso posto). C'è sempre: mentre i consigli si calcolano (`steps` null)
 * uno scheletro alto uguale; quando il Coaching non ha nessuna proposta (nessun problema, o problemi che nessuna tappa
 * risolve) "Nessun problema da sistemare", verde e ferma (niente link: lì non ci sarebbe niente da fare). Porta al
 * Coaching solo con almeno una proposta. Così la pagina non salta.
 */
export function FixRow({ problems, steps, onView }: { problems: CoachProblem[]; steps: CoachStep[] | null; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const lang = useLang();
  const fixable = steps ? solvable(problems, steps) : [];
  const { shown, hidden, more } = fixItems(fixable, lang);
  if (!steps) {
    return (
      <div className="fix-row is-skeleton fill-skeleton" aria-hidden="true">
        <span className="fix-bone" style={{ width: 84 }} />
        <span className="fix-bone" style={{ width: 280 }} />
        <span className="fix-bone" style={{ width: 96, marginLeft: 'auto' }} />
      </div>
    );
  }
  const count = shown.length + more;
  // Senza proposte la striscia è verde e ferma, anche se restano problemi che il Coaching non sa risolvere
  const link = count > 0;
  const status = link ? t(count === 1 ? 'area.problems.one' : 'area.problems.many', { n: count }) : t('overview.fix.none');
  // Il colore dice il caso come nelle aree: rosso con almeno un problema grave, giallo coi soli minori, verde senza
  const serious = fixable.some(p => p.severity === 'serious');
  return (
    // Il clic sta sulla striscia; il pulsante vero è "Vai al Coaching" (tastiera e lettori: Invio e Spazio fanno un clic)
    <section className={`fix-row${link ? ` is-link${serious ? ' serious' : ' minor'}` : ' is-clear'}`} aria-label={t('overview.fix.title')} onClick={link ? () => onView('coaching') : undefined}>
      {link ? (
        <>
          {/* "N problemi" come in fondo alle aree (stessa etichetta, stessi colori) */}
          <span className="area-problems-label" aria-hidden="true"><Icon name="warning" />{status}</span>
          <span className="fix-items" title={[...shown, ...hidden].join(' · ')}>
            {shown.join(' · ')}
          </span>
          {more > 0 && (
            <span className="fix-more" title={hidden.join(' · ')}>
              <span aria-hidden="true">{t('overview.fix.more', { n: more })}</span>
              <span className="visually-hidden">{hidden.join(' · ')}</span>
            </span>
          )}
        </>
      ) : (
        <span className="area-problems-label"><Icon name="check" />{status}</span>
      )}
      {link && (
        <button type="button" className="fix-go dash-link" aria-label={t('area.problems.go', { what: status })}>
          {t('overview.fix.go')}<span aria-hidden="true"> ›</span>
        </button>
      )}
    </section>
  );
}
