import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SpeedRival } from '../../engine/speed';
import { speedOptions, type MemberSpeed, type SpeedOption } from '../../engine/speedArea';
import type { TeamSet } from '../../engine/sets';
import { formatPercent } from '../../i18n';
import { useLang, useT } from '../../i18n/react';
import { Icon } from '../icons';
import { PokemonIcon } from '../PokemonName';

/** Una specie del gruppo nella lista: la versione normale e, se c'è, quella con la Sciarpa o la Booster. */
interface RivalRow { species: string; plain: SpeedRival; boosted: SpeedRival | null }

/** Le specie del gruppo con le loro versioni, dalle celle del membro (una o due per specie; la propria specie pesa 0 e non c'è). */
function rivalRows(member: MemberSpeed): RivalRow[] {
  const rivals: SpeedRival[] = member.cells.filter(c => c.weight > 0)
    .map(c => ({ species: c.species, value: c.speed, scarf: c.scarf, booster: c.booster, webImmune: c.webImmune, weight: c.weight }));
  const species = [...new Set(rivals.map(r => r.species))];
  return species.map(name => {
    const versions = rivals.filter(r => r.species === name);
    const boosted = versions.find(r => r.scarf || r.booster) ?? null;
    const plain = versions.find(r => !r.scarf && !r.booster) ?? versions[0];
    return { species: name, plain, boosted: boosted === plain ? null : boosted };
  });
}

/**
 * Il modale della Velocità di un membro: un calcolatore "e se". In alto la velocità reale e la quota superata; poi i check
 * che il membro e il team hanno davvero (setup, Booster, Sticky Web di un compagno, paralisi, Tailwind, Trick Room); la
 * riga delle priorità (dal calcolo vero del voto); la lista di tutti i rivali del gruppo dal più veloce, col membro al
 * suo posto, e sui rivali che usano spesso la Sciarpa o la Booster un check per vederli con quella.
 * I check non cambiano il voto: il voto resta quello della formula.
 */
export function SpeedMemberDialog({ member, set, team, meta, onClose }: { member: MemberSpeed; set: TeamSet; team: TeamSet[]; meta: boolean; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const first = useRef<HTMLInputElement | HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const options = useMemo(() => speedOptions(set, team), [set, team]);
  const rows = useMemo(() => rivalRows(member), [member]);
  const [on, setOn] = useState<Set<string>>(() => new Set());
  const [boosted, setBoosted] = useState<Set<string>>(() => new Set());
  const keyOf = (o: SpeedOption) => `${o.condition}|${o.source}`;
  const toggle = (key: string) => setOn(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const toggleBoosted = (species: string) => setBoosted(prev => { const next = new Set(prev); if (next.has(species)) next.delete(species); else next.add(species); return next; });

  // Le velocità con i check accesi
  const active = options.filter(o => on.has(keyOf(o)));
  const trickRoom = active.some(o => o.trickRoom);
  const mySpeed = Math.floor(active.reduce((v, o) => v * o.memberFactor, member.speed));
  const rivalSpeed = (row: RivalRow) => {
    const base = boosted.has(row.species) && row.boosted ? row.boosted : row.plain;
    return Math.floor(active.reduce((v, o) => v * (o.rivalFactor?.(base) ?? 1), base.value));
  };
  const beats = (rival: number): 'beats' | 'tie' | 'loses' =>
    (rival === mySpeed ? 'tie' : (trickRoom ? rival > mySpeed : rival < mySpeed) ? 'beats' : 'loses');
  const list = rows.map(row => ({ row, value: rivalSpeed(row) })).sort((a, b) => b.value - a.value);
  const beaten = list.filter(x => beats(x.value) === 'beats').length;
  const ties = list.filter(x => beats(x.value) === 'tie').length;
  // Il membro va inserito al suo posto, dal più veloce (con Trick Room l'ordine della lista non cambia: cambia chi vince)
  const myIndex = list.findIndex(x => x.value < mySpeed || (x.value === mySpeed));
  const insertAt = myIndex < 0 ? list.length : myIndex;
  const priority = member.gains.find(g => g.condition === 'priority');
  const commonBoosted = rows.filter(r => r.boosted).map(r => `${r.species} (${r.boosted!.scarf ? t('sdetail.mark.scarf') : t('sdetail.mark.booster')} ${formatPercent(lang, r.boosted!.weight, 0)})`);
  const item = set.item.toLowerCase() === 'choice scarf' ? t('sdetail.mark.scarf') : null;
  const optionLabel = (o: SpeedOption) => {
    const effect = o.trickRoom ? t('sdetail.opt.trickroom') : o.rivalFactor ? t('sdetail.opt.rivals') : t('sdetail.opt.member', { x: String(o.memberFactor).replace('.', lang === 'it' ? ',' : '.') });
    return `${effect}${o.by ? ` · ${t('sdetail.opt.by', { by: o.by.join(', ') })}` : ''}`;
  };

  const memberRow = (
    <li key="me" className="sp-row sp-me" aria-current="true">
      <span className="def-box"><PokemonIcon name={member.species} /></span>
      <span className="sp-rival-name">{member.species}</span>
      <b className="sp-rival-speed">{mySpeed}</b>
      <span className="sp-rival-diff">{t('sdetail.dlg.you')}</span>
    </li>
  );

  return createPortal(
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-dialog sp-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onClick={e => e.stopPropagation()}>
        <header className="help-head">
          <h3 id={`${id}-title`}><span className="def-box"><PokemonIcon name={member.species} /></span>{t('sdetail.dlg.title', { name: member.species })}</h3>
          <button ref={first as React.RefObject<HTMLButtonElement>} type="button" className="help-close" aria-label={t('help.close')} onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="sp-dialog-body">
          <p className="sp-dlg-head">
            <b className="sp-dlg-speed">{member.speed}</b>{item && <small className="sp-mark">{item}</small>}
            <span>{t(meta ? 'sdetail.dlg.share.meta' : 'sdetail.dlg.share.tier', { pct: formatPercent(lang, member.raw, 0), n: rows.length })}</span>
          </p>
          <p className="sp-dlg-note">{t('sdetail.dlg.note')}</p>
          {options.length > 0 && (
            <fieldset className="sp-checks">
              <legend>{t('sdetail.dlg.checks')}</legend>
              {options.map(o => (
                <label key={keyOf(o)} className={`sp-check${on.has(keyOf(o)) ? ' on' : ''}`}>
                  <input type="checkbox" aria-label={o.source} checked={on.has(keyOf(o))} onChange={() => toggle(keyOf(o))} />
                  <span className="sp-check-name">{o.source}</span>
                  <small className="sp-check-effect">{optionLabel(o)}</small>
                </label>
              ))}
            </fieldset>
          )}
          {priority && <p className="sp-priority">{t('sdetail.dlg.priority', { move: priority.source, n: Math.round(100 * priority.gain) })}</p>}
          <p className="sp-dlg-count" aria-live="polite">{t('sdetail.dlg.count', { n: beaten, m: list.length })}{ties > 0 && ` · ${t('sdetail.dlg.ties', { n: ties })}`}{trickRoom && ` · ${t('sdetail.dlg.underRoom')}`}</p>
          <ul className="sp-list" aria-label={t('sdetail.dlg.list')}>
            {list.slice(0, insertAt).map(x => rivalItem(x.row, x.value))}
            {memberRow}
            {list.slice(insertAt).map(x => rivalItem(x.row, x.value))}
          </ul>
          {commonBoosted.length > 0 && <p className="sp-dlg-foot">{t('sdetail.dlg.boostedNote', { list: commonBoosted.join(', ') })}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );

  function rivalItem(row: RivalRow, value: number) {
    const result = beats(value);
    const diff = mySpeed - value;
    const mark = row.boosted ? (row.boosted.scarf ? t('sdetail.mark.scarf') : t('sdetail.mark.booster')) : '';
    return (
      <li key={row.species} className={`sp-row sp-${result}`}>
        <span className="def-box"><PokemonIcon name={row.species} /></span>
        <span className="sp-rival-name">{row.species}</span>
        {row.boosted && (
          <label className="sp-rival-boost">
            <input type="checkbox" aria-label={`${mark} ${formatPercent(lang, row.boosted.weight, 0)}`} checked={boosted.has(row.species)} onChange={() => toggleBoosted(row.species)} />
            <span aria-hidden="true">{mark} {formatPercent(lang, row.boosted.weight, 0)}</span>
          </label>
        )}
        <b className="sp-rival-speed">{value}</b>
        <span className="sp-rival-diff">{result === 'tie' ? t('sdetail.cell.tie') : `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`}</span>
      </li>
    );
  }
}
