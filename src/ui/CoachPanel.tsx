import type { Archetype } from '../engine/archetype';
import type { FormatRules } from '../engine/formatRules';
import { useT } from '../i18n/react';
import { HelpButton } from './AnalysisTabs';
import { Icon } from './icons';

/** Un posto del team nella guida: attaccante, muro o l'uno o l'altro. */
type Slot = 'a' | 'w' | 'x';

/** I tipi dal più offensivo al più difensivo, coi sei posti disegnati (indicativi, non la regola esatta). */
const TYPES: { archetype: Archetype; slots: Slot[] }[] = [
  { archetype: 'hyperOffense', slots: ['a', 'a', 'a', 'a', 'a', 'a'] },
  { archetype: 'bulkyOffense', slots: ['a', 'a', 'a', 'a', 'x', 'x'] },
  { archetype: 'balance', slots: ['a', 'a', 'a', 'w', 'w', 'w'] },
  { archetype: 'semiStall', slots: ['a', 'x', 'w', 'w', 'w', 'w'] },
  { archetype: 'stall', slots: ['w', 'w', 'w', 'w', 'w', 'w'] },
];

function Pip({ slot }: { slot: Slot }) {
  return <span className={`tt-pip ${slot}`}>{slot !== 'x' && <Icon name={slot === 'a' ? 'sword' : 'shield'} />}</span>;
}

/**
 * La guida ai tipi di team: ogni tipo coi suoi sei posti e una frase corta, poi gli stili come "chi lo porta + chi lo sfrutta".
 * Con la regola di National Dex OU (recupero e velocità, archetype.ts) anche come si riconosce il tipo.
 */
function TeamTypesGuide({ rule }: { rule: FormatRules['typeRule'] }) {
  const t = useT();
  return (
    <div className="tt-guide">
      <ul className="tt-types">
        {TYPES.map(({ archetype, slots }) => (
          <li key={archetype}>
            <strong>{t(`archetype.${archetype}`)}</strong>
            <span className="tt-pips" role="img" aria-label={t(`teamTypes.${archetype}`)}>
              {slots.map((slot, i) => <Pip key={i} slot={slot} />)}
            </span>
            <span className="tt-caption" aria-hidden="true">{t(`teamTypes.${archetype}`)}</span>
          </li>
        ))}
      </ul>
      <p className="tt-legend" aria-hidden="true">
        <span><Pip slot="a" />{t('teamTypes.attacker')}</span>
        <span><Pip slot="w" />{t('teamTypes.wall')}</span>
        <span><Pip slot="x" />{t('teamTypes.either')}</span>
      </p>
      {rule === 'recoverySpeed' && (
        <>
          <h4 className="tt-section">{t('teamTypes.how')}</h4>
          <ul className="tt-styles tt-how">
            <li><strong><Icon name="heart" />{t('teamTypes.how.recovery')}</strong><span className="tt-caption">{t('teamTypes.how.recovery.text')}</span></li>
            <li><strong><Icon name="speed" />{t('teamTypes.how.speed')}</strong><span className="tt-caption">{t('teamTypes.how.speed.text')}</span></li>
          </ul>
          <p className="tt-note tt-how-note">{t('teamTypes.how.note')}</p>
        </>
      )}
      <h4 className="tt-section">{t('teamTypes.styles')}</h4>
      <ul className="tt-styles">
        <li>
          <strong><Icon name="cloud" />{t('teamTypes.weather')}</strong>
          <span className="tt-formula"><span>{t('teamTypes.weatherSetter')}</span>+<span>{t('teamTypes.weatherUsers')}</span></span>
        </li>
        <li>
          <strong><Icon name="swap" />{t('teamStyle.trickroom')}</strong>
          <span className="tt-formula"><span>{t('teamTypes.trSetter')}</span>+<span>{t('teamTypes.trUsers')}</span></span>
        </li>
      </ul>
      <p className="tt-note">{t('teamTypes.note')}</p>
    </div>
  );
}

/** Il "?" che apre la guida ai tipi di team; `rule`: come il formato riconosce il tipo. */
export function TeamTypeHelp({ rule = 'walls' }: { rule?: FormatRules['typeRule'] }) {
  const tr = useT();
  return <HelpButton title={tr('teamTypes.title')} label={tr('teamTypes.button')} className="tt-dialog"><TeamTypesGuide rule={rule} /></HelpButton>;
}
