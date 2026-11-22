import { Fragment, useId } from 'react';
import type { Core } from '../../engine/cores';
import type { Lang } from '../../i18n';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { Sprite } from '../Sprite';
import { typeIconUrl } from '../typeIcons';
import { hint } from '../MoveTip';

/** Vertici del triangolo nel riquadro 150×128 (come sinergie-trio, opzione A): in alto, in basso a sinistra, in basso a destra. */
const W = 150;
const H = 128;
const VERTICES = [[75, 26], [24, 98], [126, 98]] as const;
/** Quanto si accorciano le frecce vicino alle sprite: all'inizio e alla punta. */
const TRIM_FROM = 22;
const TRIM_TO = 25;

/** Il lato da `a` a `b`, accorciato alle due estremità; il punto di mezzo porta l'icona del tipo. */
function edge(a: readonly number[], b: readonly number[]) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy);
  const [ux, uy] = [dx / len, dy / len];
  const x1 = a[0] + ux * TRIM_FROM;
  const y1 = a[1] + uy * TRIM_FROM;
  const x2 = b[0] - ux * TRIM_TO;
  const y2 = b[1] - uy * TRIM_TO;
  return { x1, y1, x2, y2, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
}
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/** Il nome di un core: per membro i suoi tipi che parano, uniti col trattino; i membri separati da " / ". */
/** I tipi di ogni membro ("Buio-Acciaio"), uno per membro: nel titolo vanno a capo solo fra un membro e l'altro */
const coreParts = (core: Core, lang: Lang) => core.names.map(types => types.map(type => typeName(type, lang)).join('-'));
export const coreTitle = (core: Core, lang: Lang) => coreParts(core, lang).join(' / ');

/** Il solo disegno del triangolo (sprite, frecce e icone dei tipi), decorativo: lo usa anche la scheda Bonus/Malus. */
export function CoreArt({ core, sprite = 40 }: { core: Core; sprite?: number }) {
  const lang = useLang();
  const ownId = useId();
  // Senza i due punti (e simili) di useId: l'id va dentro url(#…)
  const marker = `${ownId.replace(/[^\w-]/g, '')}-arrow`;
  const edges = VERTICES.map((v, i) => edge(v, VERTICES[(i + 1) % 3]));
  return (
    <span className="sum-tri" aria-hidden="true">
      <svg className="sum-tri-edges" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" />
          </marker>
        </defs>
        {edges.map((e, i) => <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} markerEnd={`url(#${marker})`} />)}
      </svg>
      {core.members.map((name, i) => (
        <span key={name} className="sum-tri-v" title={name} style={{ left: pct(VERTICES[i][0], W), top: pct(VERTICES[i][1], H) }}>
          <Sprite species={name} size={sprite} />
        </span>
      ))}
      {core.sides.map((side, i) => (
        <span key={side.from} className="sum-tri-badge" {...hint(typeName(side.type, lang))} style={{ left: pct(edges[i].mx, W), top: pct(edges[i].my, H) }}>
          <img src={typeIconUrl(side.type)} alt="" draggable={false} />
        </span>
      ))}
    </span>
  );
}

/**
 * Core da 3 a triangolo: le tre sprite ai vertici su un piedistallo verde, le frecce che girano nel ciclo (A para a B,
 * B a C, C ad A) con l'icona tonda del tipo parato su ogni lato; a destra l'etichetta, il nome dei tipi e le tre righe
 * "Nome para Tipo". Il disegno è decorativo: il giro letto in parole è in `descId` (per l'aria-describedby della riga).
 */
export function CoreTriangle({ core, size, descId }: { core: Core; size: 'normal' | 'roomy'; descId?: string }) {
  const t = useT();
  const lang = useLang();
  return (
    <span className={`sum-tri-row ${size}`}>
      <CoreArt core={core} sprite={size === 'roomy' ? 52 : 40} />
      <span className="sum-syn-body">
        <span className="sum-syn-head"><em className="sum-syn-tag">{t('sum.link.core')}</em><strong className="sum-syn-title">{coreParts(core, lang).map((part, i) => <Fragment key={i}>{i > 0 && ' / '}<span className="sum-core-part">{part}</span></Fragment>)}</strong></span>
        <span className="sum-cover" aria-hidden="true">
          {core.sides.map(side => {
            const line = t('sum.parry', { name: side.from, type: typeName(side.type, lang) });
            return (
              <span key={side.from}>
                <img src={typeIconUrl(side.type)} alt="" draggable={false} />
                {/* Il testo in un suo span: nella riga flex lo spazio dopo il nome resterebbe fuori */}
                <span>{line.startsWith(side.from) ? <><b>{side.from}</b>{line.slice(side.from.length)}</> : line}</span>
              </span>
            );
          })}
        </span>
        {descId && (
          <span id={descId} className="visually-hidden">
            {core.sides.map(side => t('sum.parryTo', { name: side.from, type: typeName(side.type, lang), to: side.to })).join(', ')}
          </span>
        )}
      </span>
    </span>
  );
}
