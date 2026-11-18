import { useId, useRef, useState } from 'react';
import type { SpeedRival, SpeedTier } from '../engine/speed';
import { formatPercent } from '../i18n';
import { useLang, useT } from '../i18n/react';
import { PokemonIcon } from './PokemonName';

/** Altezza del tooltip con i vicini (3 sopra, 3 sotto, nota). */
const POP_HEIGHT = 340;

/**
 * Il valore finale della Velocità nella riga VEL dell'editor: passandoci sopra (o col fuoco) il tooltip dice la Velocità
 * reale (con la Sciarpa), il posto fra i più usati del meta ("più veloce del 55%…") e i vicini sopra e sotto.
 */
export function SpeedFinal({ name, tier, scarf, value, testId }: { name: string; tier: SpeedTier; scarf: boolean; value: number; testId?: string }) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  // L'elenco dei vicini esiste solo mentre lo guardi: le card chiuse non ripetono i nomi
  const [shown, setShown] = useState(false);
  // Si apre sopra quando sotto non c'è spazio (riga in fondo alla finestra)
  const [up, setUp] = useState(false);
  const anchor = useRef<HTMLElement>(null);
  const show = () => {
    const rect = anchor.current?.getBoundingClientRect();
    setUp(!!rect && window.innerHeight - rect.bottom < POP_HEIGHT && rect.top > POP_HEIGHT);
    setShown(true);
  };
  const group = (title: string, rivals: SpeedRival[]) => rivals.length > 0 && (
    <span className="speed-group">
      <span className="speed-group-title">{title}</span>
      {rivals.map(r => (
        <span key={`${r.species}-${r.scarf}-${!!r.booster}`} className="speed-rival">
          <PokemonIcon name={r.species} />
          <span className="speed-rival-name">{r.species}</span>
          {r.scarf && <span className="speed-scarf">{t('editor.scarf')}</span>}
          {r.booster && <span className="speed-scarf">{t('editor.booster')}</span>}
          <span className="speed-rival-value">{r.value}</span>
        </span>
      ))}
    </span>
  );
  const rank = t(tier.vsMeta ? 'editor.speedRank' : 'editor.speedRankTier', { pct: formatPercent(lang, tier.outspeeds, 0), n: tier.total });
  return (
    <strong className="stat-final speed-final" data-testid={testId} tabIndex={0} ref={anchor}
      aria-label={`${value}, ${rank}`} aria-describedby={shown ? id : undefined}
      onMouseEnter={show} onMouseLeave={() => setShown(false)} onFocus={show} onBlur={() => setShown(false)}>
      {value}
        {shown && <span id={id} role="tooltip" className={`speed-pop${up ? ' up' : ''}`}>
          <span className="speed-pop-head">
            <span>{t('editor.speed')} <b>{tier.speed}</b>{scarf && <> <span className="speed-scarf">{t('editor.scarf')}</span></>}</span>
            <span className="speed-pop-rank">{rank}</span>
          </span>
          {group(t('editor.speedFaster'), [...tier.faster].reverse())}
          {group(t('editor.speedTies'), tier.ties)}
          <span className="speed-rival speed-self">
            <PokemonIcon name={name} />
            <span className="speed-rival-name">{name}</span>
            <span className="speed-rival-value">{tier.speed}</span>
          </span>
          {group(t('editor.speedSlower'), tier.slower)}
          <span className="speed-note">{t('editor.speedNote')}</span>
        </span>}
    </strong>
  );
}
