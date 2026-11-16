import type { ReactNode } from 'react';
import type { TeamDefense } from '../../engine/defense';
import { DEFENSE_DEPTH, DEFENSE_SHARES } from '../../engine/defense';
import { DEFAULT_FORMAT, type FormatId } from '../../engine/format';
import { useLang, useT } from '../../i18n/react';
import { Keys, Rows } from '../guideParts';
import { Bar } from '../offense/OffenseGuide';
import { Ask, MetaTargets } from '../offense/TargetsTip';
import { TypeAttackers } from './HoldBars';

type Section = 'general' | 'sustain';
type Key = Parameters<ReturnType<typeof useT>>[0];

/** Quanto vale chi regge un bersaglio, dal primo al terzo: quelli del motore (DEFENSE_DEPTH), in percentuale. */
const DEPTH = DEFENSE_DEPTH.map(w => Math.round(100 * w));

/**
 * La guida alla Difesa, come quella dell'Offesa: "Come funziona" è una pagina sola per Generale, Coverage tipi e
 * Coverage meta (i bersagli col "?" per il dettaglio, il test, quanto vale ogni colpo retto, quanti lo reggono);
 * "Sostenibilità" ha la sua pagina, con quanto conta nella Difesa. Schematica e generica (niente valori del team).
 */
export function DefenseGuideSection({ section, defense, meta, formatId = DEFAULT_FORMAT.formatId }: {
  section: Section; defense: TeamDefense; meta: boolean; formatId?: FormatId;
}) {
  const t = useT();
  const lang = useLang();
  // Decimali alla maniera della lingua (0,5 in italiano, 0.5 in inglese)
  const dec = (text: string) => (lang === 'it' ? text : text.replace(',', '.'));
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.def.${key}` as Key, params);
  const metaSpecies = [...(defense.coverageMeta?.rows ?? [])].sort((a, b) => b.weight - a.weight).map(r => r.species);

  if (section === 'general') {
    return (
      <>
        <h5>{t('guide.off.test.targets')}</h5>
        <Rows compact rows={[
          [t('detail.coverageTypes'), <>{g('how.targets.types')} <Ask label={t('hold.attackersTitle')}><TypeAttackers formatId={formatId} /></Ask></>],
          ...(meta && defense.coverageMeta ? [[t('detail.coverageMeta'), <>{t('guide.off.cov.targets.meta', { n: metaSpecies.length })} <Ask label={t('guide.off.targets.metaTitle', { n: metaSpecies.length })}><MetaTargets species={metaSpecies} /></Ask></>] as [ReactNode, ReactNode]] : []),
        ]} />

        <h5>{t('guide.off.test')}</h5>
        <Rows compact rows={[
          // Sotto la regola, a capo e senza titolo: quello che conta meno
          [t('guide.off.power.hit'), <>{g('how.hit.rule')}<span className="guide-sub">{g('how.less')}</span></>],
        ]} />

        <h5>{g('how.value')}</h5>
        {/* Uguale per i colpi di tipo e per quelli delle minacce */}
        <ul className="guide-lines"><li>{g('how.value.rule')}</li></ul>

        <h5>{g('how.depth')}</h5>
        <Bar label={g('how.depth')} weights={DEPTH} rank={n => t('guide.off.cov.rank', { n })} />
        <ul className="guide-lines"><li>{g('how.scale', { one: DEPTH[0], two: DEPTH[0] + DEPTH[1], three: DEPTH[0] + DEPTH[1] + DEPTH[2] })}</li></ul>
      </>
    );
  }

  // Sostenibilità: quanto conta nella Difesa (col meta o senza è sempre la stessa parte), poi cosa recupera e cosa perde
  return (
      <>
        <h5>{g('sus.weight')}</h5>
        <ul className="guide-lines"><li>{g('sus.weight.rule', { n: Math.round(100 * DEFENSE_SHARES.sustain) })}</li></ul>
        <div className="guide-two even">
          <div>
            <h6>{t('ddetail.sus.gain')}</h6>
            <Keys items={[
              { label: g('sus.k.recover'), value: '+50%', title: g('sus.k.recover.rule') }, { label: 'Regenerator', value: '+33%' }, { label: 'Rest', value: '+33%' },
              { label: 'Wish · Life Dew', value: '+25%' }, { label: 'Pain Split', value: '+25%' }, { label: g('sus.k.drain'), value: dec('+12,5%') },
              { label: 'Poison Heal', value: dec('+12,5%'), title: g('sus.k.poisonHeal') }, { label: 'Leftovers', value: '+6%' },
              { label: g('sus.k.weather'), value: '+6%', title: g('sus.k.weather.rule') }, { label: 'Dry Skin', value: dec('+12,5%'), title: g('sus.k.dryskin') },
              { label: 'Grassy Terrain', value: '+6%', title: g('sus.k.grassy') },
            ]} />
          </div>
          <div>
            <h6>{t('ddetail.sus.loss')}</h6>
            <Keys items={[
              { label: 'Stealth Rock', value: dec('−12,5%'), title: g('sus.k.rocks') }, { label: 'Life Orb', value: '−10%' },
              { label: 'Toxic Orb', value: dec('−12,5%') }, { label: 'Black Sludge', value: dec('−12,5%'), title: g('sus.k.sludge') },
              { label: 'Flame Orb', value: '−6%' }, { label: 'Sticky Barb', value: '−6%' },
              { label: g('sus.k.sand'), value: '−6%', title: g('sus.k.sand.rule') },
              { label: g('sus.k.recoil'), value: '−10%', title: g('sus.k.recoil.rule') },
              { label: 'Steel Beam · Mind Blown', value: '−50%', title: g('sus.k.halfHp.rule') },
            ]} />
          </div>
        </div>
        <p className="guide-foot">{g('sus.k.rocks')} · {g('sus.k.sludge')}</p>

        <h5>{g('sus.except')}</h5>
        <Rows compact rows={[
          ['Heavy-Duty Boots', g('sus.x.boots')],
          [g('sus.x.removal'), g('sus.x.removal.rule')],
          [g('sus.x.half'), g('sus.x.half.rule')],
          ['Magic Guard', g('sus.x.guard')],
          [g('sus.x.status'), g('sus.x.status.rule')],
        ]} />
      </>
  );
}
