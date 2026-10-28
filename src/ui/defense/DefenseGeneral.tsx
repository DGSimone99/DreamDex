import type { ReactNode } from 'react';
import { weaknessSeverity } from '../../engine/coach';
import type { SustainParts, TeamDefense } from '../../engine/defense';
import { useLang, useT } from '../../i18n/react';
import { typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { Sprite } from '../Sprite';
import { TypeIcons } from '../typeIcons';
import { HOLD_TAGS } from './DefenseRobustness';

/** Il colore della tessera dal valore: buono da 80, medio da 50, scarso sotto. */
const tone = (value: number) => (value >= 80 ? 'good' : value >= 50 ? 'warn' : 'bad');

/** Sotto questo valore il membro con la Difesa più bassa è l'anello debole. */
const WEAK_LINK_BELOW = 50;
/** Quante minacce senza risposta si mostrano come sprite nella tessera del meta. */
const UNANSWERED_SPRITES = 6;

/** Una barra con il numero accanto (0-100), del colore della soglia del valore. */
function Bar({ value, total }: { value: number; total?: boolean }) {
  return (
    <span className="def-cell">
      <span className={`def-bar ${tone(value)}${total ? ' total' : ''}`} aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>
      <span className={`def-num ${tone(value)}${total ? ' total' : ''}`}>{value}</span>
    </span>
  );
}

/** Le due colonne in più a squadra chiusa: il colpo più duro che il membro riceve e come recupera. */
function WorstAndRecovery({ hit, parts }: { hit: { species: string; pct: number; step: number } | null; parts: SustainParts }) {
  const t = useT();
  const hold = hit ? HOLD_TAGS[hit.step] : undefined;
  return (
    <>
      <td>
        {hit && hold && (
          <span className="def-hit">
            <Sprite species={hit.species} size={28} />
            <span className={`hold-chip ${hold.cls}`} title={`${hit.species}: ${hold.tag}`}>{hit.pct}%<span className="visually-hidden"> {hold.tag}</span></span>
          </span>
        )}
      </td>
      <td className="def-rec">
        <span>{parts.sources.length ? parts.sources.join(' + ') : '—'}</span>
        {parts.halved && <small className="ad-halved" title={t('ddetail.halvedTip')}>{t('ddetail.halved')}</small>}
      </td>
    </>
  );
}

/**
 * La scheda Generale della Difesa: una tessera per sottostatistica (valore e il fatto più importante, un clic apre la
 * sottoscheda) e sotto i membri con Fisica / Speciale / Sostenibilità / Difesa come barre.
 * Con la squadra chiusa (`ctx.roomy`) le righe riempiono il pannello e compaiono il colpo peggiore e il recupero.
 */
export function DefenseGeneral({ defense, meta, ctx }: { defense: TeamDefense; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { coverageMeta, members } = defense;
  const roomy = !!ctx.roomy;
  const recoverers = members.filter(m => m.sustainParts.recovery > 0).length;

  // Tipi scoperti, i gravi per primi
  const exposed = ctx.analysis.weakness
    .map(row => ({ type: row.type, severity: weaknessSeverity(row) }))
    .filter(row => row.severity !== null)
    .sort((a, b) => Number(b.severity === 'serious') - Number(a.severity === 'serious'));

  // L'ordine è quello delle sottoschede: Coverage tipi, Robustezza, Sostenibilità, Coverage meta
  const tiles: { key: string; label: string; value: number; fact: ReactNode }[] = [
    {
      key: 'coverageTypes', label: t('detail.coverageTypes'), value: defense.coverageTypes.value,
      fact: exposed.length
        ? <><em>{t('ddetail.tile.exposed')}</em>{exposed.map(row => (
          <span key={row.type} className="def-exposed"><TypeIcons types={[row.type]} />{typeName(row.type, lang)}</span>
        ))}</>
        : t('ddetail.types.noWeak'),
    },
    {
      key: 'robustness', label: t('ddetail.robustness'), value: defense.robustness,
      fact: t('ddetail.tile.robustness', { physical: defense.physical, special: defense.special }),
    },
    {
      key: 'sustain', label: t('ddetail.sustain'), value: defense.sustain,
      fact: recoverers === 1 ? t('ddetail.tile.recoveryOne', { m: members.length }) : t('ddetail.tile.recovery', { n: recoverers, m: members.length }),
    },
  ];
  if (meta && coverageMeta) {
    tiles.push({
      key: 'coverageMeta', label: t('detail.coverageMeta'), value: coverageMeta.value,
      fact: coverageMeta.unanswered.length
        ? <>
          <em>{t('ddetail.tile.unanswered')}</em>
          {coverageMeta.unanswered.slice(0, UNANSWERED_SPRITES).map(name => (
            <span key={name} className="def-open-mon" title={name}><Sprite species={name} size={24} /><span className="visually-hidden">{name}</span></span>
          ))}
          {coverageMeta.unanswered.length > UNANSWERED_SPRITES && <span className="def-more">+{coverageMeta.unanswered.length - UNANSWERED_SPRITES}</span>}
          <span>{t('ddetail.tile.unansweredCount', { n: coverageMeta.unanswered.length, total: coverageMeta.rows.length })}</span>
        </>
        : t('ddetail.meta.allAnswered'),
    });
  }

  // L'anello debole: la Difesa più bassa (a parità, il primo), solo se sotto soglia
  const lowest = members.reduce((best, m, i) => (m.value < members[best].value ? i : best), 0);
  const weakLink = members.length > 0 && members[lowest].value < WEAK_LINK_BELOW ? lowest : -1;

  // Squadra chiusa: il colpo più duro tra gli attaccanti per ogni membro (a parità, il primo)
  const worstHit = (i: number) => defense.matrix.reduce<{ species: string; pct: number; step: number } | null>(
    (best, row) => (!best || row.cells[i].pct > best.pct ? { species: row.species, ...row.cells[i] } : best), null);

  return (
    <div className={`def-general${roomy ? ' roomy' : ''}`}>
      <div className="def-tiles">
        {tiles.map(tile => (
          <button key={tile.key} type="button" className={`def-tile ${tone(tile.value)}`}
            onClick={() => ctx.open?.(tile.key)}>
            <span className="def-tile-head"><span>{tile.label}</span><b>{tile.value}</b></span>
            <span className="def-tile-fact">{tile.fact}</span>
          </button>
        ))}
      </div>
      <div className="ad-scroll">
        <table className="def-members">
          {/* Larghezze fisse: i nomi in una colonna, le quattro barre in colonne uguali */}
          <colgroup>
            <col className="def-col-mon" /><col /><col /><col /><col />
            {roomy && <><col className="def-col-hit" /><col className="def-col-rec" /></>}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{t('detail.member')}</th>
              <th scope="col">{t('ddetail.physical')}</th>
              <th scope="col">{t('ddetail.special')}</th>
              <th scope="col">{t('ddetail.sustain')}</th>
              <th scope="col">{t('area.defense')}</th>
              {roomy && <><th scope="col">{t('ddetail.worstHit')}</th><th scope="col">{t('ddetail.recoveryCol')}</th></>}
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={`${m.species}-${i}`}>
                <th scope="row">
                  <span className="ad-mon"><Sprite species={m.species} size={roomy ? 44 : 30} />{m.species}
                    {i === weakLink && <span className="def-weak">{t('ddetail.weakLink')}</span>}
                  </span>
                </th>
                <td><Bar value={m.physical} /></td>
                <td><Bar value={m.special} /></td>
                <td><Bar value={m.sustain} /></td>
                <td>
                  <Bar value={m.value} total />
                  {/* Quanto aggiunge il setup difensivo (metà del guadagno entra nel voto) */}
                  {m.setupGain > 0 && m.setupMove && <small className="ad-gain" title={t('ddetail.withSetup', { move: m.setupMove })}> (+{m.setupGain})</small>}
                </td>
                {roomy && <WorstAndRecovery hit={worstHit(i)} parts={m.sustainParts} />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
