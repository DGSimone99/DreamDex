import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { speedStat, type SpeedRival } from '../../engine/speed';
import { speedOptions, type MemberSpeed, type SpeedOption } from '../../engine/speedArea';
import type { TeamSet } from '../../engine/sets';
import { formatPercent } from '../../i18n';
import { useLang, useT } from '../../i18n/react';
import { Icon } from '../icons';
import { ItemIcon } from '../ItemIcon';
import { PokemonIcon } from '../PokemonName';

/**
 * Una specie del gruppo nella lista: la versione normale e, se c'è, quella con la Sciarpa o la Booster. Chi usa lo
 * strumento su quasi tutti i set (da 80%) ha solo quella: `plain` è null e la riga con l'icona c'è sempre.
 */
interface RivalRow { species: string; plain: SpeedRival | null; boosted: SpeedRival | null }

/** Le specie del gruppo con le loro versioni, dalle celle del membro (una o due per specie; la propria specie pesa 0 e non c'è). */
function rivalRows(member: MemberSpeed): RivalRow[] {
  const rivals: SpeedRival[] = member.cells.filter(c => c.weight > 0)
    .map(c => ({ species: c.species, value: c.speed, scarf: c.scarf, booster: c.booster, webImmune: c.webImmune, weight: c.weight, itemShare: c.itemShare }));
  const species = [...new Set(rivals.map(r => r.species))];
  return species.map(name => {
    const versions = rivals.filter(r => r.species === name);
    const boosted = versions.find(r => r.scarf || r.booster) ?? null;
    const plain = versions.find(r => !r.scarf && !r.booster) ?? null;
    return { species: name, plain, boosted };
  });
}

/**
 * Il modale della Velocità di un membro: un calcolatore "e se". In alto la velocità reale e la quota superata; poi i check
 * che il membro e il team hanno davvero (setup, Booster, Sticky Web di un compagno, paralisi, Tailwind, Trick Room) e
 * l'interruttore "Strumenti avversari" (i rivali che usano spesso la Sciarpa o la Booster anche in quella versione); poi
 * la lista di tutti i rivali del gruppo dal più veloce, col membro al suo posto.
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
  // I rivali che usano spesso la Sciarpa o la Booster compaiono anche in quella versione (come nel voto): acceso di base
  const [versions, setVersions] = useState(true);
  // Il check ha senso solo se qualche rivale ha anche la versione normale: chi è sempre con lo strumento resta com'è
  const withVersions = rows.some(r => r.boosted && r.plain);
  const keyOf = (o: SpeedOption) => `${o.condition}|${o.source}`;
  const toggle = (key: string) => setOn(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  // Le velocità con i check accesi
  const active = options.filter(o => on.has(keyOf(o)));
  const trickRoom = active.some(o => o.trickRoom);
  const mySpeed = Math.floor(active.reduce((v, o) => v * o.memberFactor, member.speed));
  const rivalSpeed = (rival: SpeedRival) => Math.floor(active.reduce((v, o) => v * (o.rivalFactor?.(rival) ?? 1), rival.value));
  const beats = (rival: number): 'beats' | 'tie' | 'loses' =>
    (rival === mySpeed ? 'tie' : (trickRoom ? rival > mySpeed : rival < mySpeed) ? 'beats' : 'loses');
  const list = rows
    .flatMap(row => [
      ...(row.plain ? [{ row, rival: row.plain, boosted: false }] : []),
      ...(row.boosted && (versions || !row.plain) ? [{ row, rival: row.boosted, boosted: true }] : []),
    ])
    .map(x => ({ ...x, value: rivalSpeed(x.rival) }))
    .sort((a, b) => b.value - a.value);
  const beaten = list.filter(x => beats(x.value) === 'beats').length;
  const ties = list.filter(x => beats(x.value) === 'tie').length;
  // Il membro va inserito al suo posto, dal più veloce (con Trick Room l'ordine della lista non cambia: cambia chi vince)
  const myIndex = list.findIndex(x => x.value < mySpeed || (x.value === mySpeed));
  const insertAt = myIndex < 0 ? list.length : myIndex;
  const item = speedStat(set).scarf ? t('sdetail.mark.scarf') : null;
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
          {(options.length > 0 || withVersions) && (
            <fieldset className="sp-checks">
              <legend>{t('sdetail.dlg.checks')}</legend>
              {options.map(o => (
                <label key={keyOf(o)} className={`sp-check${on.has(keyOf(o)) ? ' on' : ''}`}>
                  <input type="checkbox" aria-label={o.source} checked={on.has(keyOf(o))} onChange={() => toggle(keyOf(o))} />
                  <span className="sp-check-name">{o.source}</span>
                  <small className="sp-check-effect">{optionLabel(o)}</small>
                </label>
              ))}
              {withVersions && (
                <label className={`sp-check sp-check-versions${versions ? ' on' : ''}`}>
                  <input type="checkbox" aria-label={t('sdetail.dlg.versions')} checked={versions} onChange={() => setVersions(v => !v)} />
                  <span className="sp-check-name">{t('sdetail.dlg.versions')}</span>
                </label>
              )}
            </fieldset>
          )}
          <p className="sp-dlg-count" aria-live="polite">{t('sdetail.dlg.count', { n: beaten, m: list.length })}{ties > 0 && ` · ${t('sdetail.dlg.ties', { n: ties })}`}{trickRoom && ` · ${t('sdetail.dlg.underRoom')}`}</p>
          <ul className="sp-list" aria-label={t('sdetail.dlg.list')}>
            {list.slice(0, insertAt).map(x => rivalItem(x.row, x.rival, x.boosted, x.value))}
            {memberRow}
            {list.slice(insertAt).map(x => rivalItem(x.row, x.rival, x.boosted, x.value))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );

  /** Una riga della lista; la versione con lo strumento ha l'icona accanto al nome e dice quale strumento e su quanti set. */
  function rivalItem(row: RivalRow, rival: SpeedRival, boosted: boolean, value: number) {
    const result = beats(value);
    const diff = mySpeed - value;
    const item = boosted ? (rival.scarf ? 'Choice Scarf' : 'Booster Energy') : '';
    const title = boosted ? t('sdetail.dlg.versionTip', { name: row.species, item, pct: formatPercent(lang, rival.itemShare ?? rival.weight, 0) }) : undefined;
    return (
      <li key={`${row.species}-${boosted}`} className={`sp-row sp-${result}${boosted ? ' sp-boosted' : ''}`} title={title}>
        <span className="def-box"><PokemonIcon name={row.species} /></span>
        <span className="sp-rival-name">{row.species}{boosted && <><ItemIcon item={item} size={16} /><span className="visually-hidden"> {item}</span></>}</span>
        <b className="sp-rival-speed">{value}</b>
        <span className="sp-rival-diff">{result === 'tie' ? t('sdetail.cell.tie') : `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`}</span>
      </li>
    );
  }
}
