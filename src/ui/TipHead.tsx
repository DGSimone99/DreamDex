import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { Sprite } from './Sprite';
import { SPRITE_TIP, SPRITE_TIP_TALL } from './spriteSizes';
import { tileStyle, typeIconUrl } from './typeIcons';

/**
 * La testata unica dei tooltip DreamDex (vedi DESIGN.md, "Tooltips"): righe su una sfumatura nel colore del tooltip
 * (--tc), filo in basso nello stesso colore. Da sinistra: `lead` (l'icona del tipo, un tondo con un simbolo o niente),
 * `title` (il nome, corsivo), sotto il titolo una riga `sub` facoltativa; a destra il valore, o un numero (`num`) o un
 * badge (`badge`, es. la fascia OHKO), mai tutti e due; sotto il valore un `qualifier` piccolo e spento (mai accanto al
 * titolo). `sprite`: il tooltip parla di un Pokémon, la sua sprite (SPRITE_TIP, SPRITE_TIP_TALL con la riga sotto) al posto di
 * `lead`, in piedi sul fondo della testata (spriteFeet.ts): esce dal bordo alto solo se il Pokémon è grande davvero.
 */
export type TipHeadProps = {
  lead?: ReactNode;
  sprite?: string;
  title: ReactNode;
  sub?: ReactNode;
  qualifier?: ReactNode;
  className?: string;
} & ({ num?: ReactNode; badge?: never } | { badge?: ReactNode; num?: never });

export function TipHead({ lead, sprite, title, sub, num, badge, qualifier, className = '' }: TipHeadProps) {
  const value = num ?? badge;
  const cls = ['tip-head', sprite ? 'has-sprite' : '', lead || sprite ? 'has-lead' : '', sub ? 'has-sub' : '', qualifier ? 'has-qual' : '', className].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      {sprite ? <span className="tip-lead tip-mon"><Sprite species={sprite} size={sub ? SPRITE_TIP_TALL : SPRITE_TIP} /></span> : lead && <span className="tip-lead">{lead}</span>}
      <b className="tip-title">{title}</b>
      {sub && <span className="tip-sub">{sub}</span>}
      {value !== undefined && value !== null && value !== false && <span className={num !== undefined ? 'tip-num' : 'tip-badge'}>{value}</span>}
      {qualifier && <small className="tip-qual">{qualifier}</small>}
    </div>
  );
}

/** L'icona quadrata di un tipo in testata (22px, `--ti-tip`). */
export function TipTypeIcon({ type }: { type: string }) {
  return <img className="ti-sq tip-ti" style={tileStyle(type)} src={typeIconUrl(type)} alt="" draggable={false} />;
}

/** Un tondo da 22px nel colore del tooltip con un simbolo (velocità, strumento, abilità, meteo, spada, scudo...). */
export function TipGlyph({ icon, children }: { icon?: IconName; children?: ReactNode }) {
  return <span className="tip-glyph">{icon ? <Icon name={icon} /> : children}</span>;
}

/**
 * Una sezione del corpo del tooltip: padding 10/12, separata dalla precedente da un filo Line Soft; `label` facoltativa
 * in maiuscoletto spento (come STRUMENTO e RUOLI nella carta del Pokémon). Le righe dentro distano 6px.
 */
export function TipSec({ label, className = '', children }: { label?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`tip-sec${className ? ` ${className}` : ''}`}>
      {label && <span className="tip-sec-label">{label}</span>}
      {children}
    </div>
  );
}

/**
 * Le righe di un elenco nel corpo (dentro una TipSec): a sinistra l'icona (sprite piccola, tipo, medaglia), il nome con
 * sotto la frase facoltativa, a destra il valore (`tone`: verde o rosso). Righe 6px l'una dall'altra.
 */
export function TipRows({ className = '', children }: { className?: string; children: ReactNode }) {
  return <ul className={`tip-rows${className ? ` ${className}` : ''}`}>{children}</ul>;
}

export function TipRow({ lead, title, sub, value, tone, className = '' }: {
  lead?: ReactNode; title: ReactNode; sub?: ReactNode; value?: ReactNode; tone?: 'good' | 'bad'; className?: string;
}) {
  return (
    <li className={`tip-row${className ? ` ${className}` : ''}`}>
      {lead && <span className="tip-row-lead">{lead}</span>}
      <span className="tip-row-main">
        <b className="tip-row-title">{title}</b>
        {sub && <span className="tip-row-sub">{sub}</span>}
      </span>
      {value !== undefined && value !== null && <span className={`tip-row-val${tone ? ` ${tone}` : ''}`}>{value}</span>}
    </li>
  );
}
