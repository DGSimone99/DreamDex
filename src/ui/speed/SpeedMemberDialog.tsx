import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { speedStat, type SpeedRival } from '../../engine/speed';
import { speedOptions, type MemberSpeed, type SpeedOption } from '../../engine/speedArea';
import type { TeamSet } from '../../engine/sets';
import { formatPercent } from '../../i18n';
import { useLang, useT } from '../../i18n/react';
import { AnalysisSheet } from '../AnalysisSheet';
import { Icon } from '../icons';
import { ItemIcon } from '../ItemIcon';
import { ModalLock } from '../ModalLock';
import { PokemonIcon } from '../PokemonName';
import { Sprite } from '../Sprite';

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

/** I numeri della barra di un membro (gli stessi della carta e della riga): velocità pura, i guadagni suoi, il controllo del team, il totale (0-100). */
export interface SpeedParts { raw: number; own: number; team: number; total: number }

interface Props {
  member: MemberSpeed; set: TeamSet; team: TeamSet[]; meta: boolean; onClose: () => void;
  /** I numeri della carta: il totale grande della finestra è lo stesso numero, con le stesse parole. */
  parts: SpeedParts;
  /** Il colore del numero, come sulla carta (good, warn, bad; wall per i muri). */
  tone?: string;
  /** Aperta con l'interruttore Distortozona acceso: il check Distortozona parte già acceso. */
  room?: boolean;
}

const CREDIT = { beats: 1, tie: 0.5, loses: 0 } as const;

/**
 * La velocità di un membro: un calcolatore "e se", lo stesso nel foglio dal basso (telefono e tablet, `SpeedMemberSheet`)
 * e nella finestra del computer (`SpeedMemberDialog`). In alto il numero della carta con le sue parole ("87% del meta
 * superato") e sotto da dove viene: fra quanti rivali e quanti ne supera da solo (ogni specie conta uno; chi usa spesso la
 * Sciarpa o la Booster conta in parte anche in quella versione, come nel voto), più i pezzi dei guadagni ("+18 potenziamenti
 * e priorità", "+14 controllo del team", gli stessi della barra). Poi i check che il membro e il team hanno davvero (setup,
 * Booster, Sticky Web di un compagno, paralisi, Tailwind, Trick Room) e l'interruttore "Strumenti avversari"; poi la lista
 * dei rivali dal più veloce col membro al suo posto, e sopra quanti ne supera coi check scelti (sulle stesse specie).
 * I check non cambiano il voto: il voto resta quello della formula.
 */
function SpeedMemberBody({ member, set, team, meta, parts, tone = '', room = false }: Omit<Props, 'onClose'>) {
  const t = useT();
  const lang = useLang();
  const options = useMemo(() => speedOptions(set, team), [set, team]);
  const rows = useMemo(() => rivalRows(member), [member]);
  const [on, setOn] = useState<Set<string>>(() => new Set(room ? options.filter(o => o.trickRoom).map(o => `${o.condition}|${o.source}`) : []));
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
  // Quanti ne supera, sulle stesse specie del numero in alto: ogni specie conta uno (le sue versioni per la loro quota; a
  // versioni spente la sola versione in lista), il pareggio a metà
  const beaten = Math.round(list.reduce((acc, x) => acc + (versions ? x.rival.weight : 1) * CREDIT[beats(x.value)], 0));
  const ties = list.filter(x => beats(x.value) === 'tie').length;
  // Il membro va inserito al suo posto, dal più veloce (con Trick Room l'ordine della lista non cambia: cambia chi vince)
  const myIndex = list.findIndex(x => x.value < mySpeed || (x.value === mySpeed));
  const insertAt = myIndex < 0 ? list.length : myIndex;
  const optionLabel = (o: SpeedOption) => {
    const effect = o.trickRoom ? t('sdetail.opt.trickroom') : o.rivalFactor ? t('sdetail.opt.rivals') : t('sdetail.opt.member', { x: String(o.memberFactor).replace('.', lang === 'it' ? ',' : '.') });
    return `${effect}${o.by ? ` · ${t('sdetail.opt.by', { by: o.by.join(', ') })}` : ''}`;
  };
  // Da dove viene il numero in alto: fra quanti rivali, quanti ne supera da solo (in Distortozona prima di quanti muove)
  const base = Math.round((room ? 1 - member.raw : member.raw) * rows.length);
  const baseText = t(room ? (meta ? 'sdetail.dlg.base.roomMeta' : 'sdetail.dlg.base.roomTier') : meta ? 'sdetail.dlg.base.meta' : 'sdetail.dlg.base.tier', { m: rows.length, n: base });
  const pieces = room ? [] : [
    parts.own > 0 ? t('sdetail.dlg.plusOwn', { n: parts.own }) : '',
    parts.team > 0 ? t('sdetail.dlg.plusTeam', { n: parts.team }) : '',
  ].filter(Boolean);

  const memberRow = (
    <li key="me" className="sp-row sp-me" aria-current="true">
      <span className="def-box"><PokemonIcon name={member.species} /></span>
      <span className="sp-rival-name">{member.species}</span>
      <b className="sp-rival-speed">{mySpeed}</b>
      <span className="sp-rival-diff">{t('sdetail.dlg.you')}</span>
    </li>
  );

  return (
    <>
      <div className="sp-dlg-head">
        <p className={`sp-dlg-total ${tone}`}><b>{parts.total}<i>%</i></b> <span>{t(room ? 'sdetail.cards.beatsRoom' : 'sdetail.cards.beats')}</span></p>
        <p className="sp-dlg-base">{[baseText, ...pieces].join(' · ')}</p>
      </div>
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
      <section className="sp-rivals">
        <p className="sp-dlg-count" aria-live="polite">{t('sdetail.dlg.count', { n: beaten, m: rows.length })}{ties > 0 && ` · ${t('sdetail.dlg.ties', { n: ties })}`}{trickRoom && ` · ${t('sdetail.dlg.underRoom')}`}</p>
        <ul className="sp-list" aria-label={t('sdetail.dlg.list')}>
          {list.slice(0, insertAt).map(x => rivalItem(x.row, x.rival, x.boosted, x.value))}
          {memberRow}
          {list.slice(insertAt).map(x => rivalItem(x.row, x.rival, x.boosted, x.value))}
        </ul>
      </section>
    </>
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
        <span className="sp-rival-name"><span className="sp-rival-sp">{row.species}</span>{boosted && <><ItemIcon item={item} size={16} tip /><small className="sp-rival-item"> {t(rival.scarf ? 'stip.scarf' : 'stip.booster')}</small></>}</span>
        <b className="sp-rival-speed">{value}</b>
        <span className="sp-rival-diff">{result === 'tie' ? t('sdetail.cell.tie') : `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`}</span>
      </li>
    );
  }
}

/** La Velocità vera, come sulla carta ("Vel 300", con "Scarf" se la porta). */
function useStatLine(set: TeamSet): string {
  const t = useT();
  const stat = speedStat(set);
  return `${t('sdetail.mon.speed')} ${stat.value}${stat.scarf ? ` · ${t('sdetail.mark.scarf')}` : ''}`;
}

/**
 * Il computer: la finestra al centro, aperta dalla barra del membro (Offesa e Difesa da computer non hanno un foglio: lì la
 * riga resta una tabella). Lo stesso contenuto del foglio.
 */
export function SpeedMemberDialog({ onClose, ...props }: Props) {
  const t = useT();
  const id = useId();
  const first = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const stat = useStatLine(props.set);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return createPortal(
    <div className="help-backdrop" onClick={onClose}>
      <ModalLock />
      <div className="help-dialog sp-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onClick={e => e.stopPropagation()}>
        <header className="help-head">
          <h3 id={`${id}-title`}><span className="def-box"><PokemonIcon name={props.member.species} /></span>{t('sdetail.dlg.title', { name: props.member.species })}</h3>
          <span className="sp-dlg-stat">{stat}</span>
          <button ref={first} type="button" className="help-close" aria-label={t('help.close')} onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="sp-dialog-body"><SpeedMemberBody {...props} /></div>
      </div>
    </div>,
    document.body,
  );
}

/** Telefono e tablet: il foglio dal basso, come le carte di Offesa e Difesa (la sprite, il nome e sotto "Vel 300"). */
export function SpeedMemberSheet({ onClose, ...props }: Props) {
  const stat = useStatLine(props.set);
  return (
    <AnalysisSheet title={props.member.species} lead={<Sprite species={props.set.species} item={props.set.item} size={56} />} sub={stat}
      onClose={onClose} className="sp-sheet">
      <SpeedMemberBody {...props} />
    </AnalysisSheet>
  );
}
