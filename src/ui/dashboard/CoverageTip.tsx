import { holdBand, type HoldBand } from '../../engine/defense';
import type { TypeCell } from '../../engine/overviewDashboard';
import type { TypeName } from '../../engine/types';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { Sprite } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { TipDmg, TipHead, TipRow, TipRows, TipSec, TipTypeIcon } from '../TipHead';
import { MovePill } from '../MovePill';

/** Il badge dei colpi (OHKO, 2HKO, 3HKO, 4HKO+) dal danno %, con le soglie della scheda Difesa. */
const bandOf = (pct: number): HoldBand => holdBand(pct / 100);

/**
 * La testata unica: la tessera del tipo, il nome, sotto cosa misura il danno; a destra quanto è coperto il tipo nell'area,
 * in %, con sotto la parola che lo dice ("copertura").
 */
function Head({ type, value, sub }: { type: string; value: number; sub: string }) {
  const t = useT();
  const lang = useLang();
  return <TipHead lead={<TipTypeIcon type={type} />} title={typeName(type as TypeName, lang)} sub={sub} num={<>{value}<small>%</small></>} qualifier={t('tip.covQual')} />;
}

/** La mossa: icona tonda e nome nel colore del suo tipo (alone leggero), poi categoria (fisico/speciale) e potenza. */
export function MoveLine({ name, type }: { name: string; type?: string | null }) {
  // `type`: il tipo con cui colpisce davvero (Pixilate & co.), se diverso da quello scritto sulla mossa
  return <MovePill name={name} type={type} size="sm" tip={false} className="ftip-move" />;
}

/** Offesa: i tre migliori colpi del team sul Pokémon medio del tipo, uno per riga (sprite, nome e mossa, la riga di danno). */
export function OffenseTip({ cell }: { cell: TypeCell }) {
  const t = useT();
  const lang = useLang();
  const hits = cell.hits.filter(h => h.move).slice(0, 3);
  return (
    <>
      <Head type={cell.type} value={cell.offenseLevel} sub={t('tip.offFoot', { type: typeName(cell.type as TypeName, lang) })} />
      <TipSec>
        {hits.length
          ? (
            <TipRows className="cov-rows">
              {hits.map(hit => (
                <TipRow key={hit.species} className="cov-hit" lead={<Sprite species={hit.species} size={SPRITE_TIP_ROW} />} title={hit.species}
                  sub={<MoveLine name={hit.move!} />}
                  value={<TipDmg pct={hit.pct} range={hit.range} side="off" band={bandOf(hit.pct)} />} />
              ))}
            </TipRows>
          )
          : <p className="ftip-empty">{t('tip.noHits')}</p>}
      </TipSec>
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

/** Difesa: i membri per moltiplicatore (immuni, resistono, neutri, deboli), una sezione per gruppo, ognuno con la riga di danno. */
export function DefenseTip({ cell }: { cell: TypeCell }) {
  const t = useT();
  const lang = useLang();
  return (
    <>
      <Head type={cell.type} value={cell.defenseLevel} sub={t('tip.defFoot', { type: typeName(cell.type as TypeName, lang) })} />
      {GROUPS.map(group => {
        const members = cell.members.filter(m => group.test(m.mult)).sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999));
        if (!members.length) return null;
        const mults = [...new Set(members.map(m => multLabel(m.mult)))].join(' ');
        return (
          <TipSec key={group.key} className={`cov-group ${group.tone}`} label={<>{t(`tip.${group.key}`)} <small>{mults}</small></>}>
            <TipRows className="cov-rows">
              {members.map(m => (
                <TipRow key={m.species} className="cov-mon" lead={<Sprite species={m.species} size={SPRITE_TIP_ROW} />} title={m.species}
                  value={m.pct !== null ? <TipDmg pct={m.pct} range={m.range} side="def" band={bandOf(m.pct)} /> : undefined} />
              ))}
            </TipRows>
          </TipSec>
        );
      })}
    </>
  );
}
