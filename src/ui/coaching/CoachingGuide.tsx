import { useT } from '../../i18n/react';
import { Icon } from '../icons';
import { hint } from '../MoveTip';
import { useFlash } from '../useFlash';

/** La guida del Coaching (il "?" in testa alla diagnosi): come si legge la scheda, in cinque punti (il Piano a sé). */
export function CoachingGuide() {
  const tr = useT();
  return (
    <div className="coach-guide">
      {(['diag', 'card', 'plan', 'facts', 'apply'] as const).map(k => (
        <section key={k}>
          <h4>{tr(`coach.help.${k}.title`)}</h4>
          <p>{tr(`coach.help.${k}.text`)}</p>
        </section>
      ))}
    </div>
  );
}

/**
 * Esporta per Showdown in fondo alla classifica, anche coi problemi che restano: secondario (un collegamento leggero con
 * l'icona), per un attimo la spunta quando il team è copiato (l'avviso dell'app dice "Team copiato").
 */
export function ExportLink({ onExport }: { onExport: () => Promise<boolean> }) {
  const tr = useT();
  const [copied, setCopied] = useFlash(1800);
  return (
    <button type="button" className="coach-link coach-export" aria-label={tr('coach.clear.export')} {...hint(tr('coach.clear.export'))} onClick={async () => setCopied(await onExport())}>
      <Icon name={copied ? 'check' : 'copy'} /><span aria-hidden="true">{tr('coach.rank.export')}</span>
    </button>
  );
}
