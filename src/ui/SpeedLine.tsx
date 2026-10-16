import { useId, useState } from 'react';
import type { SpeedRival, SpeedTier } from '../engine/speed';
import { formatPercent } from '../i18n';
import { useLang, useT } from '../i18n/react';
import { PokemonIcon } from './PokemonName';

/** Velocità finale del membro e il suo posto tra i più usati del meta; i vicini nel tooltip. */
export function SpeedLine({ name, tier, scarf }: { name: string; tier: SpeedTier; scarf: boolean }) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  // L'elenco dei vicini esiste solo mentre lo guardi: le card chiuse non ripetono i nomi
  const [shown, setShown] = useState(false);
  const group = (title: string, rivals: SpeedRival[]) => rivals.length > 0 && (
    <span className="speed-group">
      <span className="speed-group-title">{title}</span>
      {rivals.map(r => (
        <span key={r.species} className="speed-rival">
          <PokemonIcon name={r.species} />
          <span className="speed-rival-name">{r.species}</span>
          {r.scarf && <span className="speed-scarf">{t('editor.scarf')}</span>}
          <span className="speed-rival-value">{r.value}</span>
        </span>
      ))}
    </span>
  );
  return (
    <p className="speed-line">
      <span>{t('editor.speed')} <strong>{tier.speed}</strong>{scarf && <> <span className="speed-scarf">{t('editor.scarf')}</span></>}</span>
      <span aria-hidden="true">·</span>
      <span className="speed-rank" tabIndex={0} aria-describedby={shown ? id : undefined}
        onMouseEnter={() => setShown(true)} onMouseLeave={() => setShown(false)} onFocus={() => setShown(true)} onBlur={() => setShown(false)}>
        {t('editor.speedRank', { pct: formatPercent(lang, tier.outspeeds, 0), n: tier.total })}
        {shown && <span id={id} role="tooltip" className="speed-pop">
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
      </span>
    </p>
  );
}
