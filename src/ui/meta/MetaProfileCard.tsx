import type { CSSProperties } from 'react';
import type { MetaProfile } from '../../engine/metaBoard';
import { formatPercent } from '../../i18n';
import { gameName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { formeParts } from '../candidateParts';
import { Sprite, TypeChip, typeColor } from '../Sprite';

/**
 * La scheda del Pokémon scelto nella scheda Meta: uso e posizione, strumento e abilità più usati con la loro %, le 4
 * mosse più usate (col colore del tipo) e i compagni più frequenti (quelli in classifica si aprono col clic).
 */
export function MetaProfileCard({ profile, inTop, onSelect }: { profile: MetaProfile; inTop: (name: string) => boolean; onSelect: (name: string) => void }) {
  const t = useT();
  const lang = useLang();
  const parts = formeParts(profile.name);
  const pct = (value: number) => formatPercent(lang, value, 0);
  return (
    <aside className="meta-profile" aria-label={t('meta.profile')}>
      <h3 className="meta-plate" aria-hidden="true">{t('meta.profile')}</h3>
      <div className="meta-hero" style={{ '--t1': typeColor(profile.types[0] ?? '') } as CSSProperties}>
        <Sprite species={profile.name} size={96} />
        <div className="meta-hero-id">
          <strong title={parts ? profile.name : undefined}>
            {parts ? <>{parts.base} <i className="forme">{parts.forme}</i><span className="visually-hidden"> ({profile.name})</span></> : profile.name}
          </strong>
          <span className="meta-hero-use"><b>{formatPercent(lang, profile.usage)}</b> <small>#{profile.rank}</small></span>
          <span className="meta-hero-types">{profile.types.map(type => <TypeChip key={type} type={type} />)}</span>
        </div>
      </div>
      <dl className="meta-kv">
        {profile.item && <><dt>{t('meta.item')}</dt><dd>{gameName('item', profile.item.name, lang)} <small>{pct(profile.item.pct)}</small></dd></>}
        {profile.ability && <><dt>{t('meta.ability')}</dt><dd>{gameName('ability', profile.ability.name, lang)} <small>{pct(profile.ability.pct)}</small></dd></>}
      </dl>
      {profile.moves.length > 0 && (
        <section className="meta-sub">
          <h4>{t('meta.moves')}</h4>
          <ul className="meta-moves">
            {profile.moves.map(move => (
              <li key={move.name} style={{ '--mc': typeColor(move.type) } as CSSProperties}>
                <span>{gameName('move', move.name, lang)}</span> <small>{pct(move.pct)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
      {profile.mates.length > 0 && (
        <section className="meta-sub">
          <h4>{t('meta.mates')}</h4>
          <ul className="meta-mates">
            {profile.mates.map(mate => (
              <li key={mate}>
                {inTop(mate)
                  ? <button type="button" aria-label={mate} title={mate} onClick={() => onSelect(mate)}><Sprite species={mate} size={40} /></button>
                  : <span title={mate}><Sprite species={mate} size={40} /><span className="visually-hidden">{mate}</span></span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
