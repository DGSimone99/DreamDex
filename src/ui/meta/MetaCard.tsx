import type { CSSProperties } from 'react';
import type { MetaEntry } from '../../engine/metaBoard';
import { formatPercent } from '../../i18n';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { PickButton } from '../candidateParts';
import { Sprite, typeColor } from '../Sprite';
import { TypeIcons } from '../typeIcons';

/**
 * Un Pokémon del meta come le carte dei candidati (stesse classi: carta Pedana, targhetta, icone dei tipi, nome in
 * basso; la luce dall'alto solo sulla scelta): in alto a sinistra la posizione (#1–#3 coi colori del podio), in basso l'uso con la barretta.
 * I tuoi hanno l'etichetta "Tuo"; la scelta è quella della lista (cornice ciano). Clic su tutta la carta la sceglie.
 */
export function MetaCard({ entry, max, mine, selected, onSelect }: { entry: MetaEntry; max: number; mine: boolean; selected: boolean; onSelect: () => void }) {
  const t = useT();
  const lang = useLang();
  const typeNames = entry.types.map(type => typeName(type, lang)).join(' / ');
  const medal = entry.rank <= 3 ? `medal-${entry.rank}` : '';
  const className = ['card', 'meta-card', medal, mine && 'mine', selected && 'selected beam-on'].filter(Boolean).join(' ');
  return (
    <li className={className} style={{ '--t1': typeColor(entry.types[0] ?? ''), '--t2': typeColor(entry.types[1] ?? entry.types[0] ?? '') } as CSSProperties} onClick={onSelect}>
      <div className="card-face pedana-face">
        <span className="pedana-stripe" aria-hidden="true" />
        <span className="pedana-beam" aria-hidden="true" />
        <span className="pedana-stage" aria-hidden="true"><span className="pedana-disc" /></span>
        <span className="card-sprite" aria-hidden="true"><Sprite species={entry.name} size={96} /></span>
        <span className="tag" aria-hidden="true">#{entry.rank}</span>
        <TypeIcons types={entry.types} className="card-types" title={typeNames} />
        <span className="visually-hidden">{typeNames}</span>
        <span className="who">
          {mine && <span className="meta-mine">{t('meta.mine')}</span>}
          <span className="name-line"><PickButton rank={entry.rank} species={entry.name} selected={selected} onSelect={onSelect} /></span>
          <span className="meta-use">
            <b>{formatPercent(lang, entry.usage)}</b>
            <i aria-hidden="true" style={{ '--w': `${Math.round((entry.usage / (max || 1)) * 100)}%` } as CSSProperties} />
          </span>
        </span>
      </div>
    </li>
  );
}
