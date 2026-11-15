import type { CSSProperties } from 'react';
import { holdBand, type HoldBand } from '../../engine/defense';
import { getMove } from '../../engine/dex';
import type { TypeCell } from '../../engine/overviewDashboard';
import type { TypeName } from '../../engine/types';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { HOLD_BANDS } from '../defense/holds';
import { Icon } from '../icons';
import { Sprite, typeColor } from '../Sprite';
import { typeIconUrl } from '../typeIcons';

/** Il badge dei colpi (OHKO, 2HKO, 3HKO, 4HKO+) dal danno %, con le soglie della scheda Difesa. */
const bandOf = (pct: number): HoldBand => holdBand(pct / 100);

/** La testata: icona tonda del tipo, nome e a destra il valore del tipo nell'area, in %. */
function Head({ type, value }: { type: string; value: number }) {
  const lang = useLang();
  return (
    <div className="ftip-head">
      <img src={typeIconUrl(type)} alt="" draggable={false} />
      <b>{typeName(type as TypeName, lang)}</b>
      <em className="ftip-val">{value}<small>%</small></em>
    </div>
  );
}

/** La mossa: icona tonda e nome nel colore del suo tipo (alone leggero), poi categoria (fisico/speciale) e potenza. */
export function MoveLine({ name, type: shown }: { name: string; type?: string | null }) {
  const lang = useLang();
  const t = useT();
  const move = getMove(name);
  // `shown`: il tipo con cui colpisce davvero (Pixilate & co.), se diverso da quello scritto sulla mossa
  const type = shown ?? move?.type ?? 'Normal';
  const category = move?.category === 'Special' ? 'special' : move?.category === 'Physical' ? 'physical' : null;
  return (
    <span className="ftip-move" style={{ '--mc': typeColor(type) } as CSSProperties}>
      <img src={typeIconUrl(type)} alt="" draggable={false} />
      <span className="ftip-move-name">{gameName('move', name, lang)}</span>
      {category && (
        <span className="ftip-move-cat" title={t(`tip.${category}`)}>
          <Icon name={category} />{move?.basePower ? move.basePower : ''}
        </span>
      )}
    </span>
  );
}

/** Offesa: i tre migliori colpi del team sul Pokémon di prova del tipo, a podio; il badge dei colpi a nastro sulla sprite. */
export function OffenseTip({ cell }: { cell: TypeCell }) {
  const t = useT();
  const lang = useLang();
  const hits = cell.hits.filter(h => h.move).slice(0, 3);
  return (
    <>
      <Head type={cell.type} value={cell.offenseLevel} />
      {hits.length
        ? (
          <div className="ftip-podium" style={{ '--cols': hits.length } as CSSProperties}>
            {hits.map(hit => {
              const band = bandOf(hit.pct);
              return (
                <div key={hit.species} className="ftip-hit">
                  <span className={`ftip-ko off ${band}`}>{HOLD_BANDS[band].tag}</span>
                  <span className="ftip-plinth"><Sprite species={hit.species} size={56} /></span>
                  <span className={`ftip-pct ${band}`}>{hit.pct}<small>%</small></span>
                  <span className="ftip-name">{hit.species}</span>
                  <MoveLine name={hit.move!} />
                </div>
              );
            })}
          </div>
        )
        : <p className="ftip-empty">{t('tip.noHits')}</p>}
      <p className="ftip-foot">{t('tip.offFoot', { type: typeName(cell.type as TypeName, lang) })}</p>
    </>
  );
}

/** I gruppi della Difesa per moltiplicatore, dal migliore. */
const GROUPS = [
  { key: 'immune', test: (m: number) => m === 0, tone: 'good' },
  { key: 'resist', test: (m: number) => m > 0 && m < 1, tone: 'good' },
  { key: 'neutral', test: (m: number) => m === 1, tone: 'faint' },
  { key: 'weak', test: (m: number) => m > 1, tone: 'bad' },
] as const;

const multLabel = (m: number) => (m === 0 ? '×0' : m <= 0.25 ? '×¼' : m < 1 ? '×½' : m >= 4 ? '×4' : m > 1 ? '×2' : '×1');

/** Difesa: i membri per moltiplicatore (immuni, resistono, neutri, deboli), ognuno col danno % che subisce e il badge. */
export function DefenseTip({ cell }: { cell: TypeCell }) {
  const t = useT();
  const lang = useLang();
  return (
    <>
      <Head type={cell.type} value={cell.defenseLevel} />
      {GROUPS.map(group => {
        const members = cell.members.filter(m => group.test(m.mult)).sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999));
        if (!members.length) return null;
        const mults = [...new Set(members.map(m => multLabel(m.mult)))].join(' ');
        return (
          <div key={group.key} className="ftip-group">
            <span className={`ftip-group-label ${group.tone}`}>{t(`tip.${group.key}`)} <small>{mults}</small></span>
            <span className="ftip-group-mons">
              {members.map(m => {
                const band = m.pct === null ? null : bandOf(m.pct);
                return (
                  <span key={m.species} className="ftip-mon">
                    <Sprite species={m.species} size={34} />
                    <span className="ftip-mon-name">{m.species}</span>
                    {m.pct !== null && band && <>
                      <span className="ftip-mon-pct">{m.pct}%</span>
                      <span className={`ftip-ko def ${band}`}>{HOLD_BANDS[band].tag}</span>
                    </>}
                  </span>
                );
              })}
            </span>
          </div>
        );
      })}
      <p className="ftip-foot">{t('tip.defFoot', { type: typeName(cell.type as TypeName, lang) })}</p>
    </>
  );
}
