import { useLayoutEffect, useState, type CSSProperties } from 'react';
import type { MetaProfile } from '../../engine/metaBoard';
import type { MetaVersus as Versus } from '../../engine/overviewDashboard';
import { formatPercent } from '../../i18n';
import { gameName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { formeParts } from '../candidateParts';
import { MoreBelow } from '../MoreBelow';
import { Sprite, TypeChip, typeColor } from '../Sprite';
import { MetaVersus } from './MetaVersus';

/**
 * La scheda del Pokémon scelto nella scheda Meta: uso e posizione, strumento e abilità più usati con la loro %, le 4
 * mosse più usate (col colore del tipo), i compagni più frequenti (quelli in classifica si aprono col clic) e, se il
 * Pokémon è fra le righe della Coverage meta, come se la cava contro il tuo team (MetaVersus, coi link alla Coverage meta).
 * Se la scheda non ci sta in altezza (schermi bassi col team aperto) e c'è `onMore`, le ultime parti (prima Contro il tuo
 * team, poi i compagni, poi le mosse) lasciano il posto al pulsante in fondo della Panoramica (MoreBelow) che riduce il
 * team: niente scorrimento dentro la scheda. Col team ridotto (niente `onMore`) si vede tutto, e se ancora non ci sta scorre.
 */
export function MetaProfileCard({ profile, inTop, onSelect, versus = null, onCoverage, onMore }: {
  profile: MetaProfile;
  inTop: (name: string) => boolean;
  onSelect: (name: string) => void;
  /** Contro il tuo team (null: il Pokémon non è nelle righe della Coverage meta, il blocco non c'è). */
  versus?: Versus | null;
  /** Apre la Coverage meta dell'area con questo Pokémon acceso. */
  onCoverage?: (side: 'defense' | 'offense', species: string) => void;
  /** Riduce il team (c'è solo col team aperto): le parti che non stanno vanno nel pulsante in fondo. */
  onMore?: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const parts = formeParts(profile.name);
  const pct = (value: number) => formatPercent(lang, value, 0);
  // Le parti che si possono togliere, dall'alto in basso (si tolgono dall'ultima)
  const cuttable = [
    ...(profile.moves.length > 0 ? [{ key: 'moves', title: t('meta.moves') }] : []),
    ...(profile.mates.length > 0 ? [{ key: 'mates', title: t('meta.mates') }] : []),
    ...(versus && onCoverage ? [{ key: 'vs', title: t('meta.vs') }] : []),
  ];
  const fit = useCut(`${lang}|${profile.name}|${cuttable.map(c => c.key).join()}|${JSON.stringify(versus)}`, onMore ? cuttable.length : 0);
  const hidden = cuttable.slice(cuttable.length - fit.cut);
  const shows = (key: string) => !hidden.some(c => c.key === key);
  return (
    <aside ref={fit.ref} className="meta-profile" aria-label={t('meta.profile')}>
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
      {profile.moves.length > 0 && shows('moves') && (
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
      {profile.mates.length > 0 && shows('mates') && (
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
      {versus && onCoverage && shows('vs') && <MetaVersus name={profile.name} versus={versus} onCoverage={side => onCoverage(side, profile.name)} />}
      {onMore && hidden.length > 0 && (
        <MoreBelow label={hidden.map(c => c.title).join(', ')} onClick={onMore}>+ {hidden.map(c => c.title).join(' · ')}</MoreBelow>
      )}
    </aside>
  );
}

/**
 * Quante parti in fondo togliere (al massimo `max`) perché la scheda non scorra: si mostra tutto e si misura; finché il
 * contenuto esce (scrollHeight oltre l'altezza) se ne toglie una. La scheda è alta quanto la colonna, non quanto il suo
 * contenuto: quando la sua misura cambia (finestra, team ridotto) si rimisura da capo. Senza layout (test) non esce niente.
 */
function useCut(key: string, max: number) {
  const [box, ref] = useState<HTMLElement | null>(null);
  const [state, setState] = useState({ cut: 0, done: false, key, max, round: 0 });
  if (state.key !== key || state.max !== max) setState(s => ({ cut: 0, done: false, key, max, round: s.round + 1 }));
  const { cut, done, round } = state;

  useLayoutEffect(() => {
    if (!box || done) return;
    const over = box.scrollHeight > box.clientHeight + 0.5;
    setState(s => (s.round !== round ? s : over && s.cut < s.max ? { ...s, cut: s.cut + 1 } : { ...s, done: true }));
  }, [box, cut, done, round]);

  useLayoutEffect(() => {
    if (!box || typeof ResizeObserver === 'undefined') return;
    let last: [number, number] | null = null;
    const observer = new ResizeObserver(() => {
      const size: [number, number] = [box.clientWidth, box.clientHeight];
      // Scheda nascosta (0×0, un'altra scheda aperta): si rimisura quando ricompare
      if (!size[0] && !size[1]) { last = null; return; }
      const prev = last;
      last = size;
      if (prev && prev[0] === size[0] && prev[1] === size[1]) return;
      setState(s => ({ ...s, cut: 0, done: false, round: s.round + 1 }));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);

  return { ref, cut: Math.min(cut, max) };
}
