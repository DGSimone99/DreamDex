import type { CSSProperties, ReactNode } from 'react';
import { getMove } from '../../engine/dex';
import type { TypeName } from '../../engine/types';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { Sprite } from '../Sprite';
import { typeIconUrl } from '../typeIcons';

/** Le due fasce che contano per la Coverage: KO in un colpo e in due (il 3HKO quasi non conta: ignorato). */
export type KoBand = 'ohko' | 'two';
const bandOf = (pct: number): KoBand | null => (pct >= 100 ? 'ohko' : pct >= 50 ? 'two' : null);

/** Un bersaglio (tipo o minaccia del meta) col danno del colpo semplice, dopo una danza e con Tera/Z (null se non c'è). */
export interface KoTarget { label: string; kind: 'type' | 'mon'; plain: number; setup: number | null; once: number | null }

/** Le fasce di un membro: i bersagli del colpo semplice e quelli che entrano solo col setup o con Tera/Z. */
export interface KoBands { plain: Record<KoBand, KoTarget[]>; setup: Record<KoBand, KoTarget[]>; once: Record<KoBand, KoTarget[]> }

/** Per fascia: il colpo semplice; col setup (o Tera/Z) quelli che salgono a quella fascia da una più bassa. */
export function koBands(targets: KoTarget[]): KoBands {
  const empty = (): Record<KoBand, KoTarget[]> => ({ ohko: [], two: [] });
  const out: KoBands = { plain: empty(), setup: empty(), once: empty() };
  const rank = (b: KoBand | null) => (b === 'ohko' ? 2 : b === 'two' ? 1 : 0);
  for (const target of targets) {
    const base = bandOf(target.plain);
    if (base) out.plain[base].push(target);
    for (const key of ['setup', 'once'] as const) {
      const value = target[key];
      const up = value === null ? null : bandOf(value);
      if (up && rank(up) > rank(base)) out[key][up].push(target);
    }
  }
  return out;
}

/** Un bersaglio nel tooltip: icona tonda e nome del tipo, o la sprite col nome. */
export function Target({ target }: { target: KoTarget }) {
  const lang = useLang();
  return target.kind === 'type'
    ? <span className="kot-type"><img src={typeIconUrl(target.label)} alt="" draggable={false} />{typeName(target.label as TypeName, lang)}</span>
    : <span className="kot-mon" title={target.label}><Sprite species={target.label} size={40} /></span>;
}

const TAG: Record<KoBand, string> = { ohko: 'OHKO', two: '2HKO' };

/**
 * I badge OHKO e 2HKO di una casella col loro numero (a zero spenti); col setup un piccolo "▴+N" accanto. Passando su un
 * badge il tooltip DreamDex elenca i bersagli (tipi o minacce), poi in righe a parte quelli in più dopo la danza o con
 * Tera/Z. `who`: il nome nella testata (il membro o il team); `of`: "tipi su 18" / "minacce su 37".
 */
export function KoBadges({ bands, who, of, total, setupMove, onceName }: { bands: KoBands; who: string; of: string; total: number; setupMove?: string | null; onceName?: string | null }) {
  const t = useT();
  const lang = useLang();
  const tip = useFloatAnchor<KoBand>();
  const band = tip.anchor?.key;
  const list = (items: KoTarget[]) => <div className={`kot-list${items[0]?.kind === 'mon' ? ' mons' : ''}`}>{items.map(x => <Target key={x.label} target={x} />)}</div>;
  return (
    <span className="kob-row">
      {(['ohko', 'two'] as const).map(b => {
        const n = bands.plain[b].length;
        const extra = bands.setup[b].length;
        return (
          // Una tessera a larghezza fissa (le colonne restano allineate riga per riga): il numero e, nel suo posto, il "+N"
          // del setup col triangolo nell'angolo come nelle tabelle dell'Offesa; l'etichetta OHKO / 2HKO sta nella testata
          // --k: quanto è piena (il numero sui bersagli in tutto): il verde si fa più intenso con il conto
          <span key={b} className={`kob ${b}${n === 0 ? ' zero' : ''}${extra > 0 ? ' has-setup' : ''}`} style={{ '--k': total ? Math.min(1, n / total) : 0 } as CSSProperties}
            onMouseEnter={e => tip.open(b, e.currentTarget)} onMouseLeave={tip.close}
            aria-label={`${TAG[b]} ${n}${extra ? `, ${t('kob.setupAria', { n: extra })}` : ''}`}>
            <b>{n}</b>
            {extra > 0 && <small className="kob-setup" aria-hidden="true">+{extra}</small>}
          </span>
        );
      })}
      {band && (
        <FloatTip rect={tip.anchor!.rect} tone="var(--good)" className="kot">
          <div className="kot-head"><b>{who}</b><span className={`kob labeled ${band}`}><em>{TAG[band]}</em><b>{bands.plain[band].length}</b></span><small>{of}</small></div>
          {bands.plain[band].length ? list(bands.plain[band]) : <p className="kot-none">{t('kob.none')}</p>}
          {bands.setup[band].length > 0 && <Extra icon={<i className="kob-tri" aria-hidden="true" />} label={setupMove ? t('kob.afterSetup', { move: gameName('move', getMove(setupMove)?.name ?? setupMove, lang) }) : t('kob.afterSetupAny')}>{list(bands.setup[band])}</Extra>}
          {bands.once[band].length > 0 && onceName && <Extra label={onceName}>{list(bands.once[band])}</Extra>}
        </FloatTip>
      )}
    </span>
  );
}

function Extra({ icon, label, children }: { icon?: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="kot-extra">
      <span className="kot-extra-h">{icon}{label}</span>
      {children}
    </div>
  );
}
