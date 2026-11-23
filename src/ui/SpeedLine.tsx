import { useId } from 'react';
import { battleSpecies } from '../engine/dex';
import { laneNear, speedItem, type SpeedLane } from '../engine/overviewDashboard';
import type { TeamSet } from '../engine/sets';
import type { SpeedTier } from '../engine/speed';
import { formatPercent } from '../i18n';
import { useLang, useT } from '../i18n/react';
import { SpeedTip } from './dashboard/SpeedTip';
import { FloatTip, useFloatAnchor } from './FloatTip';
import { Icon } from './icons';
import { TIP_NEUTRAL } from './TipHead';

/**
 * La riga sotto le statistiche dell'editor: "Più veloce del 64% del meta", che cambia con gli EV. Passandoci sopra (o col
 * fuoco) si apre lo stesso tooltip delle barre di Analisi › Velocità: chi ti supera, tu, chi superi. Per i lettori di
 * schermo la frase resta il testo della riga; il confronto per intero e i vicini sono la sua descrizione.
 */
export function SpeedMeta({ set, tier }: { set: TeamSet; tier: SpeedTier }) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const tip = useFloatAnchor<0>();
  const name = battleSpecies(set)?.name ?? set.species;
  const lane: SpeedLane = {
    species: name, speed: tier.speed, share: tier.outspeeds, above: tier.outspeeds > 0.5, near: laneNear(tier), item: speedItem(set),
  };
  const pct = formatPercent(lang, tier.outspeeds, 0);
  const text = t(tier.vsMeta ? 'editor.speedLine' : 'editor.speedLineTier', { pct });
  // Il numero in grassetto dentro la frase
  const [before, after] = text.includes(pct) ? [text.slice(0, text.indexOf(pct)), text.slice(text.indexOf(pct) + pct.length)] : [text, ''];
  const rank = t(tier.vsMeta ? 'editor.speedRank' : 'editor.speedRankTier', { pct, n: tier.total });
  // Come nella scala: chi corre con la Sciarpa lo dice anche la descrizione
  const names = (list: { species: string; value: number; scarf?: boolean; item?: string }[]) =>
    list.map(r => `${r.species} ${r.value}${r.scarf || r.item === 'Choice Scarf' ? ` (${t('stip.scarf')})` : ''}`).join(', ');
  const description = [
    rank,
    `${t('editor.speed')} ${tier.speed}`,
    tier.faster.length ? `${t('editor.speedFaster')}: ${names([...tier.faster].reverse())}` : '',
    tier.ties.length ? `${t('editor.speedTies')}: ${names(tier.ties)}` : '',
    tier.slower.length ? `${t('editor.speedSlower')}: ${names(tier.slower)}` : '',
  ].filter(Boolean).join('. ');
  return (
    <div className="speed-line">
      <span className="speed-line-anchor" tabIndex={0} data-testid="speed-line" aria-describedby={id} {...tip.bind(0)}>
        <Icon name="speed" />
        <span>{before}<b>{pct}</b>{after}</span>
      </span>
      <span className="speed-line-hint" aria-hidden="true">{t('editor.speedLineHint')}</span>
      <span id={id} className="visually-hidden">{description}</span>
      {tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={TIP_NEUTRAL} className="tip-w-m speed">
          <SpeedTip lane={lane} vsMeta={tier.vsMeta} />
        </FloatTip>
      )}
    </div>
  );
}
