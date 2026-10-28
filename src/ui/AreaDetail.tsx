import type { ReactElement, ReactNode } from 'react';
import type { TeamAnalysis } from '../engine/analysis';
import type { TeamSet } from '../engine/sets';
import { MAX_BONUS, MAX_PENALTY, bonusMalusCatalog, type CatalogEntry, type TeamRating } from '../engine/rating';
import { stepBucket, type CoverageDetail, type WallCell } from '../engine/offense';
import type { TeamDefense } from '../engine/defense';
import { CONTROL_CONDITIONS, type MemberSpeed, type SpeedCondition, type TeamSpeed } from '../engine/speedArea';
import { ESSENTIAL_POINTS, type TeamRoles } from '../engine/rolesArea';
import { MISSING_BELOW } from '../engine/needs';
import type { Level, LevelKey } from '../engine/roleLevels';
import { FAMILIES, secondaryRoles, type Family, type SubRole, type SubRoleReason } from '../engine/subRoles';
import { useT } from '../i18n/react';
import type { Lang } from '../i18n';
import { typeName } from '../i18n/game';
import { Sprite, TypeChip } from './Sprite';

type Tab = 'general' | 'power' | 'wallbreaking' | 'coverageTypes' | 'coverageMeta';
type Sub = Exclude<Tab, 'general'>;

/** Una scheda del dettaglio: etichetta, valore e contenuto. */
export type T = ReturnType<typeof useT>;

export interface DetailTab { key: string; label: string; value: number | string | null; panel: ReactElement; help?: ReactNode }

/** Il contesto dell'area oltre al voto: il team e la sua analisi (lo usa la Difesa). */
export interface AreaContext { team: TeamSet[]; analysis: TeamAnalysis }

/** Casella della tabella dei muri: il danno, e tra parentesi quello dopo il setup quando cambia la soglia. */
function WallValue({ cell }: { cell: WallCell }) {
  const bucket = stepBucket(cell.step);
  const upgraded = cell.setupStep !== null && stepBucket(cell.setupStep) !== bucket;
  return (
    <span className={`ad-k ${bucket}${upgraded ? ' setup' : ''}`}>
      {cell.pct}%{upgraded ? ` (${cell.setupPct}%)` : ''}
    </span>
  );
}

/**
 * Dettaglio di un'area (Offesa o Difesa): una scheda generale e una per sottostatistica, ognuna con come si calcola
 * e il valore di ogni membro. Stesso guscio del modale "Come funziona il voto", con le schede a sinistra.
 */
export type DetailArea = 'strength' | 'defense' | 'speed' | 'roles' | 'bonusMalus';
/** Le aree del voto che hanno una scheda in Analisi (lo stesso insieme di DetailArea). */
export type AreaKey = DetailArea;

/** Punti col segno tipografico (meno vero, non il trattino). */
export const signed = (n: number) => (n < 0 ? `−${-n}` : n > 0 ? `+${n}` : '0');

/** Le schede di un'area (sottostatistiche col loro valore e contenuto): le usano la finestra e la vista in Analisi. */
export function areaTabs(rating: TeamRating, area: AreaKey, t: T, lang: Lang, ctx: AreaContext): DetailTab[] {
  void ctx; // Per ora lo usa solo la Difesa (prossimo passo)
  if (area === 'bonusMalus') return catalogueTabs(rating, t, lang);
  const value = rating.areas.find(a => a.key === area)?.value ?? null;
  return area === 'strength' ? offenseTabs(rating, t, lang)
    : area === 'defense' ? defenseTabs(rating.defense, !!rating.meta, t, lang)
    : area === 'roles' ? rolesTabs(rating, value, t)
    : speedTabs(rating.speed, !!rating.meta, t);
}

/** Il valore di un'area per la testa: il netto per Bonus/Malus, altrimenti il valore dell'area. */
export const areaValue = (rating: TeamRating, area: AreaKey): number | string | null =>
  (area === 'bonusMalus' ? signed(rating.bonus.total - rating.penalty.total) : rating.areas.find(a => a.key === area)?.value ?? null);

/** Catalogo di bonus e malus: due schede, ogni voce con quando scatta e quanto vale; quelle attive ora sono evidenziate. */
function catalogueTabs(rating: TeamRating, t: T, lang: Lang): DetailTab[] {
  const catalog = bonusMalusCatalog(lang, rating.teraCap);
  const panelOf = (kind: CatalogEntry['kind']) => {
    const items = kind === 'malus' ? rating.penalty.items : rating.bonus.items;
    // Punti attuali di una voce del catalogo: somma delle voci del voto con la sua chiave
    const nowOf = (entry: CatalogEntry) => items.filter(i => i.catalog === entry.key).reduce((n, i) => n + i.points, 0);
    const cap = kind === 'malus' ? MAX_PENALTY : MAX_BONUS;
    const capText = signed(kind === 'malus' ? -cap : cap);
    // Somma grezza delle voci attive: se supera il tetto, il totale mostrato è limitato
    const raw = items.reduce((n, i) => n + i.points, 0);
    return (
      <>
        <h4>{t(`catalogue.${kind}`)}{raw > cap && <small className="ad-limited"> {t('catalogue.limited', { cap: capText })}</small>}</h4>
        <div className="ad-scroll">
          <table className="ad-t ad-catalog">
            <thead>
              <tr>
                <th scope="col" className="left">{t('catalogue.col.name')}</th>
                <th scope="col" className="left">{t('catalogue.col.when')}</th>
                <th scope="col" className="left">{t('catalogue.col.points')}</th>
                <th scope="col">{t('catalogue.col.now')}</th>
              </tr>
            </thead>
            <tbody>
              {catalog.filter(e => e.kind === kind).map(entry => {
                const now = entry.applies ? nowOf(entry) : 0;
                const active = now > 0;
                return (
                  <tr key={entry.key} className={active ? 'active' : entry.applies ? undefined : 'na'} aria-current={active ? 'true' : undefined}>
                    <th scope="row" className="left">
                      {entry.name}
                      {!entry.applies && <small className="ad-src" title={t('catalogue.naTip')}> {t('catalogue.na')}</small>}
                    </th>
                    <td className="left">{entry.when}</td>
                    <td className="left">{entry.points}</td>
                    <td className="total">{active ? (kind === 'malus' ? `−${now}` : `+${now}`) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="ad-cap">{t(kind === 'malus' ? 'catalogue.capMalus' : 'catalogue.capBonus', { max: capText })}</p>
      </>
    );
  };
  return [
    { key: 'malus', label: t('catalogue.malus'), value: signed(-rating.penalty.total), panel: panelOf('malus') },
    { key: 'bonus', label: t('catalogue.bonus'), value: signed(rating.bonus.total), panel: panelOf('bonus') },
  ];
}

/** Le schede dell'Offesa: Generale, Potenza, Wallbreaking, Coverage di tipi e del meta. */
function offenseTabs(rating: TeamRating, t: T, lang: Lang): DetailTab[] {
  const area = 'strength';
  const offense = rating.offense;
  const value = rating.areas.find(a => a.key === area)?.value ?? null;
  const meta = !!rating.meta;
  // La Coverage del meta c'è solo col meta: senza, una scheda in meno
  const coverageMeta = offense.coverageMeta;
  const subs: Sub[] = coverageMeta ? ['power', 'wallbreaking', 'coverageTypes', 'coverageMeta'] : ['power', 'wallbreaking', 'coverageTypes'];
  const TABS: Tab[] = ['general', ...subs];

  const values: Record<Tab, number | null> = {
    general: value, power: offense.power, wallbreaking: offense.wallbreaking,
    coverageTypes: offense.coverageTypes.value, coverageMeta: coverageMeta?.value ?? null,
  };
  const tabLabel = (key: Tab) => (key === 'general' ? t('detail.tab.general') : t(`detail.${key}`));
  const setters = offense.setters.map(s => `${s.species} (${s.move})`).join(', ');
  const holesOf = (detail: CoverageDetail) => (detail.holes.length ? t('detail.coverage.holes', { list: detail.holes.map(h => typeName(h, lang)).join(', ') }) : t('detail.coverage.noHoles'));

  const general = (
    <>
      <h4>{t('detail.general.title')}</h4>
      <p>{t(meta ? 'detail.general.lead.meta' : 'detail.general.lead.tier', { walls: offense.defenders.length })}</p>
      {/* Solo informazione: quanti attaccanti per stile, non entra nel voto */}
      <p className="ad-holes">{t('detail.attackers', {
        physical: `${offense.attackers.physical} ${t(offense.attackers.physical === 1 ? 'detail.attackers.physical.one' : 'detail.attackers.physical.many')}`,
        special: `${offense.attackers.special} ${t(offense.attackers.special === 1 ? 'detail.attackers.special.one' : 'detail.attackers.special.many')}`,
        mixed: `${offense.attackers.mixed} ${t(offense.attackers.mixed === 1 ? 'detail.attackers.mixed.one' : 'detail.attackers.mixed.many')}`,
      })}</p>
      <dl className="ad-subs">
        {subs.map(sub => (
          <div key={sub} className="ad-sub">
            <dt>{t(`detail.${sub}`)}</dt>
            <dd>
              <meter min={0} max={100} value={values[sub] ?? 0} aria-hidden="true" />
              <strong>{values[sub]}</strong>
              <span>
                {t(`detail.general.${sub}`)}
                {sub === 'wallbreaking' && ` · ${setters ? t('detail.setters', { list: setters }) : t('detail.setup.none')}`}
                {sub === 'coverageTypes' && ` · ${holesOf(offense.coverageTypes)}`}
                {sub === 'coverageMeta' && coverageMeta && ` · ${holesOf(coverageMeta)}`}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <table className="ad-t">
        <thead>
          <tr>
            <th scope="col">{t('detail.member')}</th>
            <th scope="col">{t('detail.power')}</th>
            <th scope="col">{t('detail.wallbreaking')}</th>
            <th scope="col">{t('detail.coverage')}</th>
            <th scope="col">{t(`area.${area}`)}</th>
          </tr>
        </thead>
        <tbody>
          {offense.members.map((m, i) => (
            <tr key={`${m.species}-${i}`}>
              <th scope="row"><span className="ad-mon"><Sprite species={m.species} size={40} />{m.species}</span></th>
              <td>{m.power}</td>
              <td>
                {m.wallbreaking}
                {m.wallbreakingGain > 0 && <small className="ad-gain" title={t('detail.withSetup', { move: m.setupMove ?? '' })}> (+{m.wallbreakingGain})</small>}
              </td>
              <td>{m.covered}%</td>
              <td className="total">
                {m.value}
                {m.oneUseGain > 0 && m.oneUse && (
                  <small className="ad-once" title={m.oneUse.kind === 'tera' ? t('detail.withTera', { type: m.oneUse.name }) : t('detail.withZ', { item: m.oneUse.name })}> (+{m.oneUseGain})</small>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const power = (
    <>
      <h4>{t('detail.power')}</h4>
      <div className="ad-how">
        <p>{t('detail.power.how1', { targets: coverageMeta ? t('detail.targets.meta', { n: coverageMeta.rows.length }) : t('detail.targets.tier') })}</p>
        <p>{t('detail.power.how2')}</p>
        <p>{offense.referenceAttackers.length ? t('detail.power.how3.meta', { list: offense.referenceAttackers.join(', ') }) : t('detail.power.how3.fixed')}</p>
      </div>
      <table className="ad-t">
        <thead>
          <tr>
            <th scope="col">{t('detail.member')}</th>
            <th scope="col" aria-hidden="true" />
            <th scope="col">{t('detail.power')}</th>
            <th scope="col" className="left">{t('detail.bestMove')}</th>
          </tr>
        </thead>
        <tbody>
          {[...offense.members].sort((a, b) => b.power - a.power).map((m, i) => (
            <tr key={`${m.species}-${i}`}>
              <th scope="row"><span className="ad-mon"><Sprite species={m.species} size={32} />{m.species}</span></th>
              <td><meter min={0} max={100} value={m.power} aria-hidden="true" /></td>
              <td className="total">{m.power}</td>
              <td className="left">{m.bestMove ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const wallbreaking = (
    <>
      <h4>{t('detail.wallbreaking')}</h4>
      <div className="ad-how">
        <p>{t(offense.metaDefenders ? 'detail.wall.how1.meta' : 'detail.wall.how1.tier', { n: offense.defenders.length })}</p>
        <p>{t('detail.wall.how2')}</p>
        <p>{setters ? t('detail.wall.how3', { list: setters }) : t('detail.setup.none')}</p>
      </div>
      <div className="ad-scroll">
        <table className="ad-t ad-matrix">
          <thead>
            <tr>
              <th scope="col">{t('detail.wall')}</th>
              {offense.members.map((m, i) => (
                <th key={`${m.species}-${i}`} scope="col" aria-label={m.species} title={m.species}><Sprite species={m.species} size={32} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {offense.walls.map(wall => (
              <tr key={wall.species}>
                <th scope="row"><span className="ad-mon"><Sprite species={wall.species} size={32} />{wall.species}</span></th>
                {wall.cells.map((cell, i) => <td key={i}><WallValue cell={cell} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ad-legend">{t('detail.legend')}</p>
    </>
  );

  // Una scheda per ogni Coverage: di tipi (i 18 tipi contro un bersaglio neutro) e del meta (i Pokémon più usati)
  const coverageTab = (kind: 'coverageTypes' | 'coverageMeta', detail: CoverageDetail) => (
    <>
      <h4>{t(`detail.${kind}`)}</h4>
      <div className="ad-how">
        <p>{t(kind === 'coverageMeta' ? 'detail.coverage.how1.meta' : 'detail.coverage.how1.tier', { n: detail.rows.length })}</p>
        <p>{t('detail.coverage.how2')}</p>
        {coverageMeta && <p>{t('detail.coverage.split')}</p>}
      </div>
      <p className="ad-holes">{holesOf(detail)}</p>
      <table className="ad-t">
        <thead>
          <tr>
            <th scope="col">{t('detail.types')}</th>
            {kind === 'coverageMeta' && <th scope="col" className="left">{t('detail.member')}</th>}
            <th scope="col">{t('detail.level')}</th>
            <th scope="col" className="left">{t('detail.coveredBy')}</th>
          </tr>
        </thead>
        <tbody>
          {/* Dal più usato: l'ordine dice anche quanto pesa ogni bersaglio */}
          {[...detail.rows].sort((a, b) => b.weight - a.weight).map(row => (
            <tr key={row.label}>
              <th scope="row">{row.label.split('/').map(type => <TypeChip key={type} type={type} />)}</th>
              {kind === 'coverageMeta' && <td className="left"><span className="ad-mon"><Sprite species={row.species} size={32} />{row.species}</span></td>}
              <td>{row.level}%</td>
              <td className="left ad-cover">
                {row.coveredBy.length
                  ? row.coveredBy.map((c, i) => (
                    <span key={`${c.species}-${i}`} className={c.partial ? 'partial' : undefined}
                      title={`${c.species}: ${c.move} ${c.pct}%${c.partial ? ` (${t('detail.partial')})` : ''}`}>
                      <Sprite species={c.species} size={28} />
                      {/* Lo sprite da solo non dice niente a un lettore di schermo */}
                      <span className="visually-hidden">{`${c.species}: ${c.move} ${c.pct}%${c.partial ? ` (${t('detail.partial')})` : ''}`}</span>
                    </span>
                  ))
                  : <span className="ad-k none">{t('detail.nobody')}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const panels: Record<Tab, ReactElement | null> = {
    general, power, wallbreaking,
    coverageTypes: coverageTab('coverageTypes', offense.coverageTypes),
    coverageMeta: coverageMeta && coverageTab('coverageMeta', coverageMeta),
  };
  return TABS.map(key => ({ key, label: tabLabel(key), value: values[key], panel: panels[key]! }));
}

/** Soglia di un colpo standard ricevuto, dal valore del colpo (holdStep: OHKO 0 … 4HKO o più 1,5). */
const HOLD_TAGS: Record<number, { cls: string; tag: string }> = {
  0: { cls: 'd-ohko', tag: 'OHKO' }, 0.5: { cls: 'd-two', tag: '2HKO' }, 1: { cls: 'd-three', tag: '3HKO' }, 1.5: { cls: 'd-four', tag: '4HKO+' },
};
const pct = (x: number) => `${Math.round(100 * x)}%`;

/** Le schede della Difesa: Generale, Robustezza, Sostenibilità, Coverage di tipi e del meta. */
function defenseTabs(defense: TeamDefense, meta: boolean, t: T, lang: Lang): DetailTab[] {
  const coverageMeta = defense.coverageMeta;
  const members = defense.members;
  const physical = defense.matrix.filter(row => row.physical);
  const special = defense.matrix.filter(row => !row.physical);
  type Key = 'robustness' | 'sustain' | 'coverageTypes' | 'coverageMeta';
  const subs: Key[] = coverageMeta ? ['robustness', 'sustain', 'coverageTypes', 'coverageMeta'] : ['robustness', 'sustain', 'coverageTypes'];
  const values: Record<Key, number | null> = {
    robustness: defense.robustness, sustain: defense.sustain, coverageTypes: defense.coverageTypes.value, coverageMeta: coverageMeta?.value ?? null,
  };
  const label = (key: Key) => (key === 'robustness' || key === 'sustain' ? t(`ddetail.${key}`) : t(`detail.${key}`));
  const weakLine = defense.coverageTypes.weak.length
    ? t('ddetail.types.weak', { list: defense.coverageTypes.weak.map(type => typeName(type, lang)).join(', ') }) : t('ddetail.types.noWeak');
  const unansweredLine = coverageMeta && (coverageMeta.unanswered.length
    ? t('ddetail.meta.unanswered', { list: coverageMeta.unanswered.join(', ') }) : t('ddetail.meta.allAnswered'));
  const sprites = (names: string[]) => (names.length
    ? names.map((name, i) => (
      <span key={`${name}-${i}`} title={name}><Sprite species={name} size={28} /><span className="visually-hidden">{name}</span></span>
    ))
    : <span className="ad-k none">—</span>);
  const tips: Record<Key, string> = {
    robustness: t('ddetail.general.robustness', { physical: defense.physical, special: defense.special }),
    sustain: t('ddetail.general.sustain'),
    coverageTypes: `${t('ddetail.general.coverageTypes')} · ${weakLine}`,
    coverageMeta: `${t('ddetail.general.coverageMeta')}${unansweredLine ? ` · ${unansweredLine}` : ''}`,
  };

  const general = (
    <>
      <h4>{t('ddetail.title')}</h4>
      <p>{t(meta ? 'ddetail.lead.meta' : 'ddetail.lead.tier', { n: coverageMeta?.rows.length ?? 0 })}</p>
      <dl className="ad-subs">
        {subs.map(sub => (
          <div key={sub} className="ad-sub">
            <dt>{label(sub)}</dt>
            <dd>
              <meter min={0} max={100} value={values[sub] ?? 0} aria-hidden="true" />
              <strong>{values[sub]}</strong>
              <span>{tips[sub]}</span>
            </dd>
          </div>
        ))}
      </dl>
            <div className="ad-scroll">
  <table className="ad-t">
          <thead>
            <tr>
              <th scope="col">{t('detail.member')}</th>
              <th scope="col">{t('ddetail.physical')}</th>
              <th scope="col">{t('ddetail.special')}</th>
              <th scope="col">{t('ddetail.sustain')}</th>
              <th scope="col">{t('area.defense')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={`${m.species}-${i}`}>
                <th scope="row"><span className="ad-mon"><Sprite species={m.species} size={40} />{m.species}</span></th>
                <td>{m.physical}</td>
                <td>{m.special}</td>
                <td>{m.sustain}</td>
                <td className="total">
                  {m.value}
                  {/* Quanto aggiunge il setup difensivo (metà del guadagno entra nel voto) */}
                  {m.setupGain > 0 && m.setupMove && <small className="ad-gain" title={t('ddetail.withSetup', { move: m.setupMove })}> (+{m.setupGain})</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const side = (rows: TeamDefense['matrix'], title: string) => (
    <tbody>
      <tr className="ad-group"><th scope="rowgroup" colSpan={members.length + 1}>{title}</th></tr>
      {rows.map(row => (
        <tr key={`${row.species}-${row.physical}`}>
          <th scope="row"><span className="ad-mon"><Sprite species={row.species} size={32} />{row.species}</span></th>
          {row.cells.map((cell, i) => {
            const hold = HOLD_TAGS[cell.step];
            // La soglia anche in testo: il colore da solo non arriva ai lettori di schermo
            return <td key={i}><span className={`ad-k ${hold.cls}`} title={hold.tag}>{cell.pct}%<span className="visually-hidden"> {hold.tag}</span></span></td>;
          })}
        </tr>
      ))}
    </tbody>
  );
  const robustness = (
    <>
      <h4>{t('ddetail.robustness')}</h4>
      <div className="ad-how">
        <p>{t('ddetail.rob.how1', { n: physical.length })}</p>
        <p>{t('ddetail.rob.how2')}</p>
        <p>{t('ddetail.rob.how3', { physical: defense.physical, special: defense.special })}</p>
      </div>
      <div className="ad-scroll">
        <table className="ad-t ad-matrix">
          <thead>
            <tr>
              <th scope="col">{t('ddetail.attacker')}</th>
              {members.map((m, i) => (
                <th key={`${m.species}-${i}`} scope="col" aria-label={m.species} title={m.species}><Sprite species={m.species} size={32} /></th>
              ))}
            </tr>
          </thead>
          {side(physical, t('ddetail.side.physical'))}
          {side(special, t('ddetail.side.special'))}
        </table>
      </div>
      <p className="ad-legend">{t('ddetail.legend')}</p>
    </>
  );

  const sustain = (
    <>
      <h4>{t('ddetail.sustain')}</h4>
      <div className="ad-how">
        <p>{t('ddetail.sus.how1')}</p>
        <p>{t('ddetail.sus.how2')}</p>
      </div>
            <div className="ad-scroll">
  <table className="ad-t">
          <thead>
            <tr>
              <th scope="col">{t('detail.member')}</th>
              <th scope="col" className="left">{t('ddetail.recovery')}</th>
              <th scope="col">Stealth Rock</th>
              <th scope="col">Life Orb</th>
              <th scope="col">{t('ddetail.sustain')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const p = m.sustainParts;
              return (
                <tr key={`${m.species}-${i}`}>
                  <th scope="row"><span className="ad-mon"><Sprite species={m.species} size={32} />{m.species}</span></th>
                  <td className="left">
                    {p.recovery > 0 ? `+${pct(p.recovery)}` : '—'}
                    {p.sources.length > 0 && <small className="ad-src"> {p.sources.join(' + ')}</small>}
                    {p.halved && <small className="ad-halved" title={t('ddetail.halvedTip')}> {t('ddetail.halved')}</small>}
                  </td>
                  <td>{p.rocks > 0 ? `−${pct(p.rocks)}` : '—'}</td>
                  <td>{p.lifeOrb > 0 ? `−${pct(p.lifeOrb)}` : '—'}</td>
                  <td className="total">{m.sustain}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );

  const coverageTypes = (
    <>
      <h4>{t('detail.coverageTypes')}</h4>
      <div className="ad-how">
        <p>{t('ddetail.types.how1')}</p>
        {coverageMeta && <p>{t('ddetail.coverage.split')}</p>}
      </div>
      <p className="ad-holes">{weakLine}</p>
      <table className="ad-t">
        <thead>
          <tr>
            <th scope="col">{t('detail.types')}</th>
            <th scope="col">{t('ddetail.safety')}</th>
            <th scope="col" className="left gap">{t('ddetail.weak')}</th>
            <th scope="col" className="left">{t('ddetail.resist')}</th>
          </tr>
        </thead>
        <tbody>
          {defense.coverageTypes.rows.map(row => (
            <tr key={row.type} className={row.weak.length > row.resist.length ? 'ad-weak' : undefined}>
              <th scope="row"><TypeChip type={row.type} /></th>
              <td>{row.safety}</td>
              <td className="left gap ad-cover">{sprites(row.weak)}</td>
              <td className="left ad-cover">{sprites(row.resist)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const metaTab = coverageMeta && (
    <>
      <h4>{t('detail.coverageMeta')}</h4>
      <div className="ad-how">
        <p>{t('ddetail.meta.how1', { n: coverageMeta.rows.length })}</p>
        <p>{t('ddetail.meta.how2')}</p>
        <p>{t('ddetail.coverage.split')}</p>
      </div>
      <p className="ad-holes">{unansweredLine}</p>
      <table className="ad-t">
        <thead>
          <tr>
            <th scope="col">{t('ddetail.threat')}</th>
            <th scope="col">{t('ddetail.held')}</th>
            <th scope="col" className="left">{t('ddetail.heldBy')}</th>
          </tr>
        </thead>
        <tbody>
          {/* Dal più usato: l'ordine dice anche quanto pesa ogni minaccia */}
          {[...coverageMeta.rows].sort((a, b) => b.weight - a.weight).map(row => (
            <tr key={row.species}>
              <th scope="row"><span className="ad-mon"><Sprite species={row.species} size={32} />{row.species}</span></th>
              <td>{row.level}%</td>
              <td className="left ad-cover">
                {row.heldBy.length
                  ? row.heldBy.map((h, i) => {
                    const text = `${h.species}: ${h.move} ${h.pct}%${h.partial ? ` (${t('ddetail.partial')})` : ''}`;
                    return (
                      <span key={`${h.species}-${i}`} className={h.partial ? 'partial' : undefined} title={text}>
                        <Sprite species={h.species} size={28} />
                        {/* Lo sprite da solo non dice niente a un lettore di schermo */}
                        <span className="visually-hidden">{text}</span>
                      </span>
                    );
                  })
                  : <span className="ad-k none">{t('detail.nobody')}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const panels: Record<Key, ReactElement | null> = { robustness, sustain, coverageTypes, coverageMeta: metaTab };
  return [
    { key: 'general', label: t('detail.tab.general'), value: defense.value, panel: general },
    ...subs.map(key => ({ key, label: label(key), value: values[key], panel: panels[key]! })),
  ];
}

const OWN_CONDITIONS: SpeedCondition[] = ['setup', 'weather', 'unburden', 'priority'];
const points = (x: number) => Math.round(100 * x);

/** Le schede della Velocità: Generale, Velocità (ogni membro da solo) e Controllo velocità (quello che porta il team). */
function speedTabs(speed: TeamSpeed, meta: boolean, t: T): DetailTab[] {
  const members = speed.members;
  const gainOf = (m: MemberSpeed, c: SpeedCondition) => m.gains.find(g => g.condition === c);
  const presentOf = (list: SpeedCondition[]) => list.filter(c => members.some(m => gainOf(m, c)));
  const ownPresent = presentOf(OWN_CONDITIONS);
  const controlPresent = presentOf(CONTROL_CONDITIONS);
  const gainTip = (m: MemberSpeed) => m.gains.map(g => `${t(`sdetail.cond.${g.condition}`)} (${g.source}): +${points(g.gain)}`).join('\n');
  // Il totale coi guadagni; tra parentesi, in verde, quanto aggiungono le condizioni
  const totalCell = (m: MemberSpeed) => {
    const gain = points(m.total) - points(m.raw);
    return (
      <>
        {points(m.total)}%
        {gain > 0 && <small className="ad-gain" title={gainTip(m)}> (+{gain})</small>}
      </>
    );
  };
  const tips = {
    speed: t('sdetail.general.speed'),
    control: controlPresent.length
      ? t('sdetail.general.control', { list: controlPresent.map(c => t(`sdetail.cond.${c}`)).join(', ') })
      : t('sdetail.general.controlNone'),
  };
  const conditionTable = (list: SpeedCondition[], base: (m: MemberSpeed) => number, end: (m: MemberSpeed) => number, baseLabel: string) => (
    <div className="ad-scroll">
      <table className="ad-t">
        <thead>
          <tr>
            <th scope="col">{t('detail.member')}</th>
            <th scope="col">{t('sdetail.speed')}</th>
            <th scope="col">{baseLabel}</th>
            {list.map(c => <th key={c} scope="col">{t(`sdetail.cond.${c}`)}</th>)}
            <th scope="col">{t('sdetail.total')}</th>
          </tr>
        </thead>
        <tbody>
          {[...members].sort((a, b) => b.speed - a.speed).map((m, i) => (
            <tr key={`${m.species}-${i}`}>
              <th scope="row"><span className="ad-mon"><Sprite species={m.species} size={32} />{m.species}</span></th>
              <td>{m.speed}</td>
              <td>{points(base(m))}%</td>
              {list.map(c => {
                const g = gainOf(m, c);
                return <td key={c}>{g ? <span className="ad-gain-cell" title={g.source}>+{points(g.gain)}</span> : '—'}</td>;
              })}
              <td className="total">{points(end(m))}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const general = (
    <>
      <h4>{t('sdetail.title')}</h4>
      <p>{t(meta ? 'sdetail.lead.meta' : 'sdetail.lead.tier')}</p>
      <dl className="ad-subs">
        <div className="ad-sub">
          <dt>{t('sdetail.speed')}</dt>
          <dd>
            <meter min={0} max={100} value={speed.speed} aria-hidden="true" />
            <strong>{speed.speed}</strong>
            <span>{tips.speed}</span>
          </dd>
        </div>
        {/* Il controllo è un plus in punti sopra la Velocità: niente barra 0–100 */}
        <div className="ad-sub">
          <dt>{t('sdetail.control')}</dt>
          <dd>
            <strong className="ad-plus">+{speed.control}</strong>
            <span>{tips.control}</span>
          </dd>
        </div>
      </dl>
      <div className="ad-scroll">
        <table className="ad-t">
          <thead>
            <tr>
              <th scope="col">{t('detail.member')}</th>
              <th scope="col">{t('sdetail.speed')}</th>
              <th scope="col">{t('sdetail.outsped')}</th>
              <th scope="col">{t('sdetail.total')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={`${m.species}-${i}`}>
                <th scope="row"><span className="ad-mon"><Sprite species={m.species} size={40} />{m.species}</span></th>
                <td>{m.speed}</td>
                <td>{points(m.raw)}%</td>
                <td className="total">{totalCell(m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const speedTab = (
    <>
      <h4>{t('sdetail.speed')}</h4>
      <div className="ad-how">
        <p>{t(meta ? 'sdetail.speed.how1.meta' : 'sdetail.speed.how1.tier')}</p>
        <p>{t('sdetail.speed.how2')}</p>
        <p>{t('sdetail.speed.how3')}</p>
      </div>
      {conditionTable(ownPresent, m => m.raw, m => m.own, t('sdetail.raw'))}
    </>
  );

  const controlTab = (
    <>
      <h4>{t('sdetail.control')}</h4>
      <div className="ad-how">
        <p>{t('sdetail.control.how1')}</p>
        <p>{t('sdetail.control.how2')}</p>
      </div>
      {speed.sources.length ? (
        <div className="ad-scroll">
          <table className="ad-t">
            <thead>
              <tr>
                <th scope="col">{t('detail.member')}</th>
                <th scope="col" className="left">{t('sdetail.move')}</th>
                <th scope="col">{t('sdetail.helps')}</th>
                <th scope="col">{t('sdetail.points')}</th>
              </tr>
            </thead>
            <tbody>
              {speed.sources.map(src => (
                <tr key={`${src.condition}-${src.move}`}>
                  <th scope="row">
                    <span className="ad-mon">{src.by.map(name => <Sprite key={name} species={name} size={32} />)}{src.by.join(', ')}</span>
                  </th>
                  <td className="left">{src.move}</td>
                  <td>{t(src.helped === 1 ? 'sdetail.mates.one' : 'sdetail.mates.many', { n: src.helped })}</td>
                  <td className="total">+{src.plus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="ad-holes">{t('sdetail.control.none')}</p>}
    </>
  );

  return [
    { key: 'general', label: t('detail.tab.general'), value: speed.value, panel: general },
    { key: 'speed', label: t('sdetail.speed'), value: speed.speed, panel: speedTab },
    { key: 'control', label: t('sdetail.control'), value: `+${speed.control}`, panel: controlTab },
  ];
}

const ROLE_LEVELS_SHOWN = ['essential', 'important', 'minor'] as const;
const FAMILY_TABS: Family[] = ['attack', 'defense', 'field', 'disruption'];
const thousands = (n: number) => `${Math.round(n / 1000)}k`;

/** Il motivo di un sotto-ruolo in parole: quota del gruppo per Taunt, Encore e stati, indice per i muri, colpo per l'Attacco. */
function reasonText(r: SubRoleReason, pool: string, t: T): string {
  const pct = Math.round(100 * (r.share ?? 0));
  if (r.role === 'taunt' || r.role === 'encore') return t(r.prankster ? 'rdetail.reason.prankster' : 'rdetail.reason.outspeed', { move: r.source, pct, pool });
  if ((r.role === 'dot' || r.role === 'debuff') && r.share !== undefined) return t('rdetail.reason.status', { move: r.source, pct, pool });
  if ((r.role === 'physicalWall' || r.role === 'specialWall') && r.index !== undefined) {
    return t(r.role === 'physicalWall' ? 'rdetail.reason.wall.physical' : 'rdetail.reason.wall.special', { index: thousands(r.index), threshold: thousands(r.threshold ?? 0) });
  }
  if (FAMILIES.attack.includes(r.role)) return t('rdetail.reason.attack', { move: r.source });
  // 'set': fonte generica del solo set, senza una mossa da nominare
  return r.source === 'set' || r.source === 'wall' ? '—' : r.source;
}

/** Le schede dei Ruoli: Generale (livelli, base, extra, mancanze) e una per famiglia coi sotto-ruoli di ogni membro. */
function rolesTabs(rating: TeamRating, value: number | null, t: T): DetailTab[] {
  const roles: TeamRoles = rating.roles;
  const pool = t(rating.meta ? 'rdetail.pool.meta' : 'rdetail.pool.tier');
  const archetype = t(`archetype.${rating.teamType}`);
  const full = roles.members.length === 6;
  const levelOf = (key: LevelKey): Level => roles.rows.find(r => r.key === key)?.level ?? 'ignored';
  const keyLabel = (key: LevelKey) => (key === 'attacker' || key === 'fieldSetup' ? t(`need.${key}`) : t(`role.${key}`));
  const malus = roles.failures.reduce((a, f) => a + f.points, 0);
  const base = points(roles.base);
  const extra = points(roles.extra);
  const hasImportant = roles.rows.some(r => r.level === 'important');
  const essentialTip = !full ? t('rdetail.general.essentialIncomplete')
    : malus ? t('rdetail.general.essentialMissing') : t('rdetail.general.essentialOk');
  // Fonte e valore di chi porta la voce: le fonti generiche (set, muro: l'indice è nella scheda Difesa) non si mostrano,
  // il valore solo se non pieno
  // il valore solo se non pieno; il secondario (famiglia non principale) col suo segno
  const byNote = (source: string, v: number, secondary?: boolean) =>
    [secondary && t('rdetail.secondary'), source !== 'set' && source !== 'wall' && source, v < 1 && points(v)].filter(Boolean).join(' · ');

  const general = (
    <>
      <h4>{t('rdetail.title')}</h4>
      <p>{t('rdetail.lead', { archetype })}</p>
      <dl className="ad-subs">
        <div className="ad-sub">
          <dt>{t('rdetail.important')}</dt>
          <dd>
            <meter min={0} max={100} value={base} aria-hidden="true" />
            <strong>{base}</strong>
            <span>{t(hasImportant ? 'rdetail.general.important' : 'rdetail.general.importantNone')}</span>
          </dd>
        </div>
        {/* Minori ed essenziali non sono 0–100: un plus e un malus in punti, senza barra */}
        <div className="ad-sub">
          <dt>{t('rdetail.minor')}</dt>
          <dd>
            <strong className="ad-plus">+{extra}</strong>
            <span>{t('rdetail.general.minor')}</span>
          </dd>
        </div>
        <div className="ad-sub">
          <dt>{t('rdetail.essential')}</dt>
          <dd>
            <strong className={malus ? 'ad-minus' : 'ad-zero'}>{malus ? `−${malus}` : '0'}</strong>
            <span>{essentialTip}</span>
          </dd>
        </div>
      </dl>
      {roles.failures.length > 0 && (
        <ul className="ad-failures">
          {roles.failures.map(f => <li key={f.text}>{f.text} (−{f.points})</li>)}
        </ul>
      )}
      <div className="ad-scroll">
        <table className="ad-t ad-roles">
          <thead>
            <tr>
              <th scope="col">{t('rdetail.role')}</th>
              <th scope="col">{t('rdetail.value')}</th>
              <th scope="col" className="left gap">{t('rdetail.by')}</th>
            </tr>
          </thead>
          {ROLE_LEVELS_SHOWN.map(level => {
            const rows = roles.rows.filter(r => r.level === level);
            if (!rows.length) return null;
            return (
              <tbody key={level}>
                <tr className="ad-group"><th scope="rowgroup" colSpan={3}>{t(`rdetail.group.${level}`)}</th></tr>
                {rows.map(row => {
                  // Essenziale che manca in un team di 6: al posto del valore il suo malus
                  const missing = full && level === 'essential' && row.value < MISSING_BELOW;
                  return (
                    <tr key={row.key}>
                      <th scope="row">{keyLabel(row.key)}</th>
                      <td className="total">
                        {missing ? <span className="ad-minus" title={t('rdetail.missingTip', { n: ESSENTIAL_POINTS })}>−{ESSENTIAL_POINTS}</span> : points(row.value)}
                      </td>
                      <td className="left gap ad-by">
                        {row.by.length
                          ? row.by.map((b, i) => {
                            const note = byNote(b.source, b.value, b.secondary);
                            return (
                              <span key={`${b.species}-${i}`} className="ad-mon">
                                <Sprite species={b.species} size={28} />{b.species}
                                {note && <small className="ad-src"> ({note})</small>}
                              </span>
                            );
                          })
                          : <span className="ad-k none">{t('rdetail.nobody')}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </>
  );

  const familyTab = (family: Family): DetailTab => {
    const subs: SubRole[] = FAMILIES[family];
    // Valore col credito del secondario (come i valori di team), e il segno per chi lo porta da secondario
    const holdersOf = (role: SubRole) => roles.members
      .map(m => ({
        species: m.species, value: (m.credited ?? m.values)[role] ?? 0, reason: m.reasons.find(r => r.role === role),
        secondary: !!m.values[role] && secondaryRoles(m.primary).includes(role),
      }))
      // Anche un secondario che nell'archetipo vale 0 (stall) resta in tabella, col segno
      .filter(h => h.value > 0 || h.secondary)
      .sort((a, b) => b.value - a.value);
    // Coperto con la stessa soglia di carte, Analisi e bisogni (MISSING_BELOW); la tabella mostra anche i valori parziali
    const covered = subs.filter(role => (holdersOf(role)[0]?.value ?? 0) >= MISSING_BELOW).length;
    const panel = (
      <>
        <h4>{t(`family.${family}`)}</h4>
        <div className="ad-how">
          <p>{t(`rdetail.how.${family}`, { pool })}</p>
          <p>{t('rdetail.how.levels', { archetype })}</p>
        </div>
        <div className="ad-scroll">
          <table className="ad-t ad-roles">
            <thead>
              <tr>
                <th scope="col">{t('detail.member')}</th>
                <th scope="col" className="left gap">{t('rdetail.reason')}</th>
                <th scope="col">{t('rdetail.value')}</th>
              </tr>
            </thead>
            {subs.map(role => {
              const level = levelOf(role);
              const holders = holdersOf(role);
              return (
                <tbody key={role} className={level === 'ignored' ? 'ad-ignored' : undefined}>
                  <tr className="ad-group">
                    <th scope="rowgroup" colSpan={3}>
                      {t(`role.${role}`)}
                      <span className={`ad-level ${level}`}> {t(`rdetail.level.${level}`)} · {t('rdetail.teamValue', { n: points(holders[0]?.value ?? 0) })}</span>
                    </th>
                  </tr>
                  {holders.length ? holders.map((h, i) => (
                    <tr key={`${h.species}-${i}`}>
                      <th scope="row">
                        <span className="ad-mon"><Sprite species={h.species} size={32} />{h.species}</span>
                        {h.secondary && <small className="ad-src"> ({t('rdetail.secondary')})</small>}
                      </th>
                      <td className="left gap ad-reason">{h.reason ? reasonText(h.reason, pool, t) : '—'}</td>
                      <td className="total">{points(h.value)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="left"><span className="ad-k none">{t('rdetail.nobody')}</span></td></tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      </>
    );
    return { key: family, label: t(`family.${family}`), value: `${covered}/${subs.length}`, panel };
  };

  return [
    { key: 'general', label: t('detail.tab.general'), value, panel: general },
    ...FAMILY_TABS.map(familyTab),
  ];
}
