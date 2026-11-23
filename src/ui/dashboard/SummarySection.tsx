import { Fragment, useId, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import type { Core } from '../../engine/cores';
import { viaName } from '../../engine/synergy';
import type { TeamLink } from '../../engine/teamLinks';
import type { ConditionRow, HazardRow, TeamSummary } from '../../engine/teamSummary';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { SHORT_SCREEN, useMediaQuery } from '../useMediaQuery';
import type { AnalysisView } from '../analysisView';
import type { BonusMalusPiece } from '../BonusMalusView';
import { TeamTypeHelp } from '../CoachPanel';
import { Icon } from '../icons';
import type { Density } from '../OverviewDashboard';
import { Sprite, typeColor } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { ConditionTip, CONDITION_TYPE } from './ConditionTip';
import { CoreTip } from './CoreTip';
import { CoreArt, CoreTriangle, coreParts, coreTitle } from './CoreTriangle';
import { FloatTip, goText, TipGo, useFloatAnchor } from '../FloatTip';
import { DashCard } from './DashCard';
import { useFit } from './useFit';
import { MoreBelow } from '../MoreBelow';
import { MovePill } from '../MovePill';
import { hint } from '../MoveTip';
import { typeIconUrl } from '../typeIcons';

/**
 * Colore di una condizione (meteo, campo, Trick Room, schermi, Ventoincoda) e degli stili di team: il colore del tipo
 * che le corrisponde, lo stesso delle icone di tipo. Chiavi: id della condizione, dello stile o della mossa.
 */
const conditionColor = (key: string) => typeColor(CONDITION_TYPE[key] ?? '');

/** Il "+N": a vista solo il numero, per intero nel tooltip e ai lettori di schermo. */
function More({ label, n, plain = false }: { label: string; n: number; plain?: boolean }) {
  return (
    <span className="sum-more more-n" {...(plain ? {} : hint(label))}>
      <span aria-hidden="true">+{n}</span><span className="visually-hidden">{label}</span>
    </span>
  );
}

/** Sprite sul piedistallo luminoso (come le corsie della Velocità). */
const Plinth = ({ name, size }: { name: string; size: number }) => <span className="sum-plinth"><Sprite species={name} size={size} /></span>;

/**
 * Una condizione (meteo, campo, stile) come le pillole delle mosse delle Trappole accanto: la tessera con l'icona del suo
 * tipo (la stessa di CONDITION_TYPE delle icone dello stile) e il nome, senza la coda.
 */
const CondPill = ({ cond, children }: { cond: string; children: ReactNode }) => (
  <span className="mvp mvp-sm sum-cond" style={{ '--c': conditionColor(cond) } as CSSProperties}>
    <span className="mvp-ic" aria-hidden="true">{CONDITION_TYPE[cond] && <img src={typeIconUrl(CONDITION_TYPE[cond])} alt="" draggable={false} />}</span>
    <span className="mvp-nm">{children}</span>
  </span>
);

/**
 * Una sezione: intestazione in maiuscoletto e righe separate da una linea. Le righe che non stanno nell'altezza della card
 * finiscono nel "+N" (useFit), mai tagliate a metà; il "+N" sta accanto al titolo, così non toglie una riga alle altre.
 * Senza righe, la parola `empty` attenuata.
 */
function Section<T>({ title, empty, emptyBelow = false, rows, rowKey, rowClass, fitKey, more, render, onMore, moreTip, className = '' }: {
  title: string; empty: string;
  /** Una frase vuota lunga ("Nessuna sinergia: …"): sulla sua riga sotto il titolo, non a destra sulla riga del titolo. */
  emptyBelow?: boolean;
  rows: T[];
  rowKey: (row: T) => string;
  /** Una classe in più sulla riga (es. la pillola larga due colonne). */
  rowClass?: (row: T) => string | undefined;
  /** Cambia quando cambia ciò che occupa spazio (righe, lingua, densità): si rimisura. */
  fitKey: string;
  /** Il testo del "+N" (tooltip e lettori di schermo), dalle righe nascoste. */
  more: (n: number, hidden: T[]) => string;
  render: (row: T) => ReactNode;
  /**
   * Se c'è: le righe nascoste non vanno nel "+N" accanto al titolo ma in un pulsante in fondo (+N sopra due frecce
   * verso il basso) che riduce il team, così la card si allunga e le mostra.
   */
  onMore?: () => void;
  /** Se c'è: il "+N" è colorato e al passaggio apre il tooltip DreamDex con le righe nascoste (questo contenuto). */
  moreTip?: (hidden: T[]) => ReactNode;
  className?: string;
}) {
  const tip = useFloatAnchor<true>();
  // La lista è alta quanto il suo contenuto: si guarda anche la card, che cresce col team ridotto
  const fit = useFit<HTMLUListElement>(fitKey, rows.length, { min: 1, outer: '.dash-summary' });
  const shown = Math.min(fit.shown, rows.length);
  const hidden = rows.length - shown;
  const hover = moreTip ? { onMouseEnter: (e: { currentTarget: Element }) => tip.open(true, e.currentTarget), onMouseLeave: tip.close } : {};
  const tipped = moreTip ? ' tipped' : '';
  return (
    <div className={`sum-sec${className ? ` ${className}` : ''}`}>
      <h4 className="sum-sec-h">{title}</h4>
      {rows.length === 0
        ? <p className={`sum-none${emptyBelow ? ' below' : ''}`}>{empty}</p>
        : (
          <ul ref={fit.ref} className="sum-lines sum-fit">
            {rows.slice(0, shown).map((row, i) => <li key={`${rowKey(row)}#${i}`} className={rowClass?.(row)} data-fit>{render(row)}</li>)}
          </ul>
        )}
      {/* Dopo la lista nell'ordine di lettura; a vista sta a destra del titolo (posizione assoluta) */}
      {hidden > 0 && (onMore
        ? (
          <MoreBelow label={more(hidden, rows.slice(shown))} onClick={() => { tip.close(); onMore(); }} tipped={!!moreTip} hover={hover}>
            <span className="more-n">+{hidden}</span>
          </MoreBelow>
        )
        : <span className={`sum-sec-more${tipped}`} {...hover}><More n={hidden} label={more(hidden, rows.slice(shown))} plain={!!moreTip} /></span>)}
      {moreTip && hidden > 0 && tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone="var(--good)" className="syn-more">{moreTip(rows.slice(shown))}</FloatTip>
      )}
    </div>
  );
}

/** Elenco a parole: "A", "A e B", "A, B e C" ("and" in inglese, senza virgola prima). */
const joinList = (items: string[], lang: string) => {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${lang === 'en' ? 'and' : 'e'} ${items[items.length - 1]}`;
};

/** Una riga di Meteo e campo: una condizione o, a sezione unita, chi piazza le trappole. */
type FieldRow = { cond: ConditionRow; haz?: undefined } | { haz: HazardRow; cond?: undefined };

/** Una sinergia: un core difensivo (da 2 o 3) o un legame tra membri. */
type Synergy = { core: Core; link?: undefined; duo?: undefined } | { link: TeamLink; core?: undefined; duo?: undefined }
  /** Due core a tre affiancati in una riga sola: solo triangolo e titolo, chi para cosa nel tooltip. */
  | { duo: [Core, Core]; core?: undefined; link?: undefined };

/** Colore dell'etichetta e dell'anello: core verde, pivot e Baton Pass azzurro, Desiderio Accent Ink (azzurro come i link), trappole giallo. */
const LINK_COLOR: Record<TeamLink['kind'], string> = {
  pivot: 'var(--accent)', batonpass: 'var(--accent)', wish: 'var(--accent-ink)', phazer: 'var(--warn)',
};

interface SynergyView { key: string; tag: string; color: string; title: string; text: string; mons: string[]; trio: boolean }

/** Ciò che una riga di sinergia mostra: etichetta, titolo corto, frase, le sprite (una o due). */
function useSynergyView() {
  const t = useT();
  const lang = useLang();
  return (syn: Synergy): SynergyView => {
    if (syn.duo) {
      return {
        key: `duo:${syn.duo.map(core => core.members.join('+')).join('|')}`, tag: t('sum.link.core'), color: 'var(--good)',
        title: syn.duo.map(core => coreTitle(core, lang)).join(' · '), text: '', mons: [], trio: true,
      };
    }
    if (syn.core) {
      const { core } = syn;
      return {
        key: `core:${core.members.join('+')}`, tag: t('sum.link.core'), color: 'var(--good)', title: coreTitle(core, lang),
        text: core.sides.map(side => t('sum.parry', { name: side.from, type: joinList(side.types.map(ty => typeName(ty, lang)), lang) })).join(', '),
        mons: core.members, trio: core.members.length === 3,
      };
    }
    const { link } = syn;
    const move = gameName('move', link.move, lang);
    const [from] = link.from;
    const to = link.to[0];
    const base = { key: `${link.kind}:${link.from.join('+')}>${link.to.join('+')}:${link.move}`, tag: t(`sum.link.${link.kind}`), color: LINK_COLOR[link.kind], trio: false };
    switch (link.kind) {
      case 'pivot':
        return { ...base, title: t('sum.pivotTitle', { move }),
          text: to ? t('sum.pivotText', { n: link.from.length, target: to }) : t('sum.pivotTextAlone', { n: link.from.length }),
          mons: [from, to ?? link.from[1]] };
      case 'batonpass':
        return { ...base, title: t('sum.batonTitle', { move }),
          text: to ? t('sum.batonText', { from, to }) : t('sum.batonTextAlone', { from }), mons: to ? [from, to] : [from] };
      case 'wish':
        return { ...base, title: t('sum.wishTitle'), text: t('sum.wishText', { from, move }), mons: [from] };
      case 'phazer':
        return { ...base, title: t('sum.phazerTitle'), text: t('sum.phazerText', { from, to, move }), mons: [from, to] };
    }
  };
}

/** La frase con i nomi dei Pokémon in grassetto 600, dritti come i nomi delle righe (e come nelle righe dei tipi parati). */
function NamesIn({ text, names }: { text: string; names: string[] }) {
  const unique = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!unique.length || !text) return <>{text}</>;
  const pattern = new RegExp(`(${unique.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return <>{text.split(pattern).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}</>;
}

/**
 * Una riga delle Sinergie. Il core da 3 è il triangolo; il resto due sprite unite da un anello "catena" nel colore del
 * legame (una sola per Desiderio), l'etichetta, il titolo e la frase in grigio. Nome: etichetta e titolo; descrizione:
 * la frase (o il giro del triangolo letto in parole). `flat`: senza posto per un triangolo leggibile il core da 3 è una
 * riga come quella da 2 (tre sprite unite dalla catena, CORE e il titolo); chi para cosa resta nel tooltip del core.
 */
function SynergyRow({ syn, view, rich, small, onClick, hover, goId, second = false, flat = false }: { syn: Synergy; view: SynergyView; rich: boolean; small: number; onClick: () => void;
  /** I gestori del tooltip del core (mouse e fuoco da tastiera); senza, le sprite hanno il fumetto col nome. */
  hover?: HTMLAttributes<HTMLButtonElement>;
  /** La descrizione di dove porta il clic (col tooltip: il suo piede TipGo), dopo la frase. */
  goId?: string;
  /** Un core da 3 dopo il primo: triangolo piccolo anche col team ridotto. */
  second?: boolean;
  flat?: boolean }) {
  const t = useT();
  const lang = useLang();
  const desc = useId();
  const trioRow = view.trio && !!syn.core && flat;
  return (
    <button type="button" className={`sum-syn${view.trio && !flat ? ' trio' : ''}${trioRow ? ' trio-row' : ''}`} style={{ '--c': view.color } as CSSProperties}
      aria-label={`${view.tag} ${view.title}`} aria-describedby={goId ? `${desc} ${goId}` : desc} onClick={onClick} {...hover}>
      {view.trio && syn.core && !flat
        ? <CoreTriangle core={syn.core} size={rich && !second ? 'roomy' : 'normal'} descId={desc} />
        : (
          <>
            <span className="sum-pair" aria-hidden="true">
              {view.mons.map((name, i) => (
                <span key={`${name}:${i}`} className="sum-pair-ring">
                  {i > 0 && <span className="sum-link"><Icon name="chain" /></span>}
                  <span className="sum-pair-mon" {...(hover ? {} : hint(name))}><Sprite species={name} size={small} /></span>
                </span>
              ))}
            </span>
            {trioRow && syn.core
              ? (
                <span className="sum-syn-body">
                  {/* A capo solo fra un membro e l'altro, come nel triangolo */}
                  <span className="sum-syn-head"><em className="sum-syn-tag">{view.tag}</em><strong className="sum-syn-title">{coreParts(syn.core, lang).map((part, i) => <Fragment key={i}>{i > 0 && ' / '}<span className="sum-core-part">{part}</span></Fragment>)}</strong></span>
                  <span id={desc} className="visually-hidden">
                    {syn.core.sides.map(side => t('sum.parryTo', { name: side.from, type: typeName(side.type, lang), to: side.to })).join(', ')}
                  </span>
                </span>
              )
              : (
                <span className="sum-syn-body">
                  <span className="sum-syn-head"><em className="sum-syn-tag">{view.tag}</em><strong className="sum-syn-title">{view.title}</strong></span>
                  <span id={desc} className="sum-syn-text"><NamesIn text={view.text} names={view.mons} /></span>
                </span>
              )}
          </>
        )}
    </button>
  );
}

/**
 * Un core a tre nella riga dei due core affiancati: il triangolo e sotto il titolo, senza le righe "Nome para Tipo" (sono nel
 * tooltip del core e, a parole, nella descrizione per i lettori di schermo).
 */
function DuoCore({ core, goId, onClick, hover }: { core: Core; goId: string; onClick: () => void; hover: HTMLAttributes<HTMLButtonElement> }) {
  const t = useT();
  const lang = useLang();
  const desc = useId();
  const title = coreTitle(core, lang);
  return (
    <button type="button" className="sum-syn trio sum-duo-core" style={{ '--c': 'var(--good)' } as CSSProperties}
      aria-label={`${t('sum.link.core')} ${title}`} aria-describedby={`${desc} ${goId}`} onClick={onClick} {...hover}>
      <CoreArt core={core} />
      {/* A capo solo fra un membro e l'altro: "/" resta in fondo alla riga (spazio fisso prima), ogni "Terra-Acciaio" intero */}
      <span className="sum-duo-title" aria-hidden="true">{coreParts(core, lang).map((part, i) => <Fragment key={i}>{i > 0 && '\u00a0/ '}<span className="sum-core-part">{part}</span></Fragment>)}</span>
      <span id={desc} className="visually-hidden">
        {core.sides.map(side => t('sum.parryTo', { name: side.from, type: typeName(side.type, lang), to: side.to })).join(', ')}
      </span>
    </button>
  );
}

/**
 * Il tooltip DreamDex del "+N" delle Sinergie: le sinergie che non stanno nella card, ognuna con le sue sprite (unite dalla
 * catena nel colore del legame), l'etichetta, il titolo e la frase.
 */
function MoreSynergies({ items, label }: { items: SynergyView[]; label: string }) {
  return (
    <>
      <div className="ftip-head"><b>{label}</b></div>
      <ul className="syn-more-list">
        {items.map(view => (
          <li key={view.key} style={{ '--c': view.color } as CSSProperties}>
            <span className="syn-more-mons" aria-hidden="true">
              {view.mons.map((name, i) => (
                <span key={`${name}:${i}`} className="syn-more-mon">
                  {i > 0 && <span className="sum-link"><Icon name="chain" /></span>}
                  <Sprite species={name} size={SPRITE_TIP_ROW} />
                </span>
              ))}
            </span>
            <span className="syn-more-body">
              <span className="sum-syn-head"><em className="sum-syn-tag">{view.tag}</em><strong className="sum-syn-title">{view.title}</strong></span>
              <span className="sum-syn-text">{view.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Altezza della riga Bonus/Malus (px, come in CSS `.sum-bm`). */
export const BM_LINE = 28;
const signedPts = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/**
 * La riga Bonus/Malus in fondo al Riassunto: "Bonus/Malus +6 · 2 core +6 · Rete di sicurezza +1 · Tipi doppioni −1", le
 * voci dalla più pesante (bonusMalusLine) finché stanno su una riga, le altre in "+N". Tutta la riga apre la scheda Ruoli e
 * Bonus (Bonus/Malus); il nome per i lettori di schermo dice tutte le voci.
 */
function BonusMalusRow({ net, pieces: all, skip = [], lang, onOpen }: { net: number; pieces: BonusMalusPiece[];
  /** Voci già a vista come pillola sotto il tipo di team: qui non si ripetono (restano nel nome per i lettori di schermo). */
  skip?: string[];
  lang: string; onOpen: () => void }) {
  const t = useT();
  // A vista bonus e malus alternati, ognuno dal più pesante: anche con una o due voci in riga il netto si spiega (il core
  // e il malus più pesante), mai solo i bonus
  const rest = all.filter(p => !skip.includes(p.key));
  const bonuses = rest.filter(p => p.points > 0);
  const maluses = rest.filter(p => p.points <= 0);
  const pieces = Array.from({ length: Math.max(bonuses.length, maluses.length) }, (_, i) => [bonuses[i], maluses[i]]).flat().filter((p): p is BonusMalusPiece => !!p);
  const fit = useFit<HTMLSpanElement>(`${lang}|${pieces.map(p => `${p.key}${p.points}`).join()}`, pieces.length, { more: true });
  const shown = pieces.slice(0, Math.min(fit.shown, pieces.length));
  const hidden = pieces.length - shown.length;
  const tone = (n: number) => (n > 0 ? 'good' : n < 0 ? 'bad' : 'zero');
  return (
    <button type="button" className="sum-bm" onClick={onOpen}
      aria-label={t('sum.bmLabel', { net: signedPts(net), list: all.map(p => `${p.name} ${signedPts(p.points)}`).join(', ') })}>
      <span className="sum-bm-label" aria-hidden="true">{t('area.bonusMalus')}</span>
      <em className={`sum-bm-net ${tone(net)}`} aria-hidden="true">{signedPts(net)}</em>
      <span ref={fit.ref} className="sum-bm-list" aria-hidden="true">
        {shown.map(p => <span key={p.key} data-fit className="sum-bm-item">{p.name} <b className={tone(p.points)}>{signedPts(p.points)}</b></span>)}
        {/* Con la parola ("+3 altre"), così non si legge come punti accanto ai +N delle voci; al passaggio le voci nascoste */}
        {hidden > 0 && <span data-fit-more className="sum-bm-more more-n" {...hint(pieces.slice(shown.length).map(p => `${p.name} ${signedPts(p.points)}`).join(' · '))}>{t('sum.bmMore', { n: hidden })}</span>}
      </span>
    </button>
  );
}

/**
 * Il Riassunto della Panoramica, ritratto del team: in alto (eroe) il tipo di team e chi lo rende tale, sotto chi porta
 * meteo e campo, chi piazza le trappole e, in fondo, le Sinergie (core difensivi e legami), che prendono lo spazio che resta.
 */
export function SummarySection({ summary, members, grade, density, rich = false, bonusMalus, onView, onShowAll }: {
  summary: TeamSummary; members: number;
  /** La riga Bonus/Malus in fondo (sempre, se ci sono voci o un netto): le Sinergie le cedono il posto, col loro "+N". */
  bonusMalus?: { net: number; pieces: BonusMalusPiece[] };
  /** La lettera del voto del team: il nome del tipo e la sfumatura dell'eroe ne prendono il colore (come la carta del voto). */
  grade?: string;
  /** Sprite e righe cambiano misura con la densità: le parti a misura si rimisurano. */
  density: Density;
  /** Team ridotto e cruscotto alto (RICH_FROM): sprite più grandi, sezioni distribuite su tutta l'altezza. */
  rich?: boolean;
  onView: (v: AnalysisView) => void;
  /** Riduce il team: le sinergie che non stanno col team aperto si vedono nella card più alta. */
  onShowAll?: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const { archetype, styles, attackers, walls, offenseOf, defenseOf, conditions, hazards, cores, links } = summary;
  const count = (key: 'sum.moreField' | 'sum.moreHazards' | 'sum.moreSyn', n: number) => t(`${key}${n === 1 ? 'One' : 'Many'}`, { n });
  const synergyView = useSynergyView();
  const condTip = useFloatAnchor<ConditionRow>();
  const coreTip = useFloatAnchor<Core>();
  // Dove porta il clic degli elementi col tooltip (il piede TipGo), anche ai lettori di schermo: una descrizione per destinazione
  const goIds = { roles: useId(), bonusMalus: useId() };
  const places = { roles: t('area.roles'), bonusMalus: t('analysis.view.bonusMalus') };
  // Tutti i core: prima quelli da 3 (il primo col triangolo grande), poi quelli da 2 (riga piccola). Poi i legami, senza i pivot
  const trios = cores.filter(core => core.members.length === 3);
  // Cruscotto basso su uno schermo basso (1280×620, 1366×657 col team aperto): niente posto per un triangolo leggibile, i
  // core a tre sono righe come quelli a due (tre sprite unite dalla catena); il triangolo resta nelle altre densità
  const short = useMediaQuery(SHORT_SCREEN);
  const flat = density === 'tight' && short;
  // Due o più core a tre: i primi due affiancati in una riga (solo triangolo e titolo), così stanno entrambi nella card;
  // nel Riassunto ricco (cruscotto alto) c'è posto per ognuno intero, con le righe di chi para cosa
  const duo: Synergy[] = trios.length >= 2 && !flat && !rich ? [{ duo: [trios[0], trios[1]] }] : [];
  const synergies: Synergy[] = [
    ...duo,
    ...trios.slice(duo.length * 2).map(core => ({ core })),
    ...cores.filter(core => core.members.length !== 3).map(core => ({ core })),
    ...links.filter(link => link.kind !== 'pivot').map(link => ({ link })),
  ];
  const keyOf = (parts: string[]) => `${lang}|${density}|${rich}|${flat}|${parts.join()}`;
  const small = rich ? 44 : 34;
  // Chi ne approfitta: grandi come le sprite delle righe (due misure sole nel Riassunto: righe e vertici del triangolo)
  const mini = small;

  // Chi rende il team tale (attaccanti con l'Offesa, muri con la Difesa): niente riga di sprite (ripeteva la squadra in alto),
  // sta nel suggerimento sul nome del tipo di team
  const who = (names: string[], of: Record<string, number>) => names.map(name => (of[name] === undefined ? name : `${name} ${of[name]}`)).join(', ');
  const makersHint = [
    attackers.length > 0 ? `${t('sum.attack')}: ${who(attackers, offenseOf)}` : '',
    walls.length > 0 ? `${t('sum.hold')}: ${who(walls, defenseOf)}` : '',
  ].filter(Boolean).join(' · ');
  // Tante condizioni (3 o più): pillole su due colonne con chi le porta, l'etichetta e "+N" per chi ne approfitta (i nomi
  // nel tooltip), e le trappole nella stessa sezione, così restano spazio e righe per le Sinergie
  const packed = conditions.length >= 3;
  const fieldRows: FieldRow[] = [
    ...conditions.map(cond => ({ cond })),
    ...(packed ? hazards.map(haz => ({ haz })) : []),
  ];
  const conditionLine = (row: ConditionRow) => {
    // Con l'abilità o la mossa con cui la sfrutta: "Barraskewda · Nuotovelox"
    const userLabel = (user: ConditionRow['users'][number]) => (user.via ? `${user.name} · ${viaName(user.via, lang)}` : user.name);
    return (
      // Al passaggio (o col fuoco) il tooltip della condizione: effetti e chi ne approfitta
      <button type="button" className={`sum-line${packed ? ' sum-pill' : ''}`} onClick={() => onView('roles')}
        // Il nome a pezzi separati da virgole (niente "PelipperPioggia"; la freccia è solo a vista)
        aria-label={[row.member, row.label, row.users.length ? t('sum.helps', { names: row.users.map(userLabel).join(', ') }) : ''].filter(Boolean).join(', ')}
        onMouseEnter={e => condTip.open(row, e.currentTarget)} onMouseLeave={condTip.close}
        onFocus={e => condTip.open(row, e.currentTarget)} onBlur={condTip.close} aria-describedby={goIds.roles}>
        <Plinth name={row.member} size={small} />
        <span className="sum-name">{row.member}</span>
        <CondPill cond={row.key}>{row.label}</CondPill>
        {row.users.length > 0 && (packed
          ? (
            <span className="sum-pill-n more-n">
              <span aria-hidden="true">+{row.users.length}</span>
            </span>
          )
          : (
            <>
              <span className="sum-to" aria-hidden="true">→</span>
              <span className="sum-users">
                {row.users.map((user, i) => (
                  <span key={`${user.name}#${i}`} className="sum-user"><Sprite species={user.name} size={mini} /><span className="visually-hidden">{userLabel(user)}</span></span>
                ))}
              </span>
            </>
          ))}
      </button>
    );
  };
  const hazardLine = (row: HazardRow) => (
    <button type="button" className={`sum-line${packed ? ' sum-pill' : ''}`} onClick={() => onView('roles')}
      aria-label={[row.member, ...row.moves.map(move => gameName('move', move, lang))].join(', ')}>
      <Plinth name={row.member} size={small} />
      <span className="sum-name">{row.member}</span>
      <span className="sum-tags">{row.moves.map(move => <MovePill key={move} name={move} size="sm" />)}</span>
    </button>
  );
  const showBm = !!bonusMalus && (bonusMalus.pieces.length > 0 || bonusMalus.net !== 0);
  /** I malus da −4 in giù: una pillola rossa sotto il tipo di team (solo a team completo: prima mancano per forza pezzi). */
  const heavyAll = members >= 6 ? (bonusMalus?.pieces ?? []).filter(p => p.points <= -4) : [];
  // Schermo basso o stretto: la pillola sta sulla riga del tipo, una sola (la più pesante) perché il nome del tipo non si
  // tronchi; le altre restano nella riga Bonus/Malus
  const heavy = density === 'tight' || short ? heavyAll.slice(0, 1) : heavyAll;

  return (
    <DashCard className="dash-summary" title={t('sum.title')}>
      <div className="sum-body">
        {members >= 2 && (
          <div className={`sum-hero${grade ? ` grade-${grade}` : ''}`}>
            {members >= 2 && (
              <div className="sum-type">
                {archetype
                  ? (
                    <span className="sum-arch-box">
                      <strong className="sum-arch" {...hint(makersHint ? `${t(`archetype.${archetype}.note`)}\n${makersHint}` : t(`archetype.${archetype}.note`))}>{t(`archetype.${archetype}`)}</strong>
                      {/* Sul confine col tipo accanto: una riga piccola sotto il nome, che non lo accorcia */}
                    </span>
                  )
                  // Senza tipo riconosciuto: a team incompleto "Incompleto · 5/6", a team completo "Misto" (non somiglia a nessun tipo)
                  : <strong className="sum-arch pending" {...hint(t(members < 6 ? 'sum.archBuildingNote' : 'sum.archMixedNote'))}>
                    {members < 6 ? t('sum.archBuilding', { n: members }) : t('sum.archMixed')}
                  </strong>}
                {/* Con due o più stili solo l'icona su un quadratino del suo colore, così il nome del tipo non si tronca;
                    il nome resta nel tooltip e ai lettori di schermo (e nella sezione Meteo e campo sotto) */}
                {styles.map(style => (styles.length > 1
                  ? (
                    <span key={style} className="sum-style mini" {...hint(`${t(`teamStyle.${style}`)}: ${t(`teamStyle.${style}.note`)}`)} style={{ '--c': conditionColor(style) } as CSSProperties}>
                      {CONDITION_TYPE[style] && <img src={typeIconUrl(CONDITION_TYPE[style])} alt="" draggable={false} />}
                      <span className="visually-hidden">{t(`teamStyle.${style}`)}</span>
                    </span>
                  )
                  : (
                    <span key={style} className="sum-style" {...hint(t(`teamStyle.${style}.note`))} style={{ '--c': conditionColor(style) } as CSSProperties}>
                      {t(`teamStyle.${style}`)}
                    </span>
                  )))}
                {/* In doppio c'è un tipo solo: la guida ai tipi di team non serve */}
                {summary.typeRule !== 'oneType' && <TeamTypeHelp />}
              </div>
            )}
            {/* I malus pesanti (−4 e oltre) in vista sotto il tipo: tolgono molto al voto e in fondo, nella riga Bonus/Malus,
                passerebbero inosservati. Il clic apre Bonus/Malus */}
            {heavy.length > 0 && (
              <div className="sum-alerts">
                {heavy.map(p => (
                  <button key={p.key} type="button" className="sum-alert" onClick={() => onView('bonusMalus')} {...hint(p.name)}
                    aria-label={`${p.name} ${signedPts(p.points)}, ${goText(t, places.bonusMalus)}`}>
                    <Icon name="warning" /><span className="sum-alert-name">{p.name}</span><b>{signedPts(p.points)}</b>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <Section title={t(packed ? 'sum.fieldAll' : 'sum.weather')} empty={t('sum.noneM')} rows={fieldRows}
          className={packed ? 'sum-field sum-packed' : 'sum-field'}
          rowKey={row => (row.cond ? `${row.cond.member}:${row.cond.key}` : `haz:${row.haz.member}`)}
          rowClass={row => (row.haz ? 'haz' : undefined)}
          fitKey={keyOf(fieldRows.map(row => (row.cond ? `${row.cond.member}:${row.cond.key}:${row.cond.users.map(u => u.name).join('+')}` : `haz:${row.haz.member}:${row.haz.moves.join('+')}`)))}
          more={n => count('sum.moreField', n)}
          render={row => (row.cond ? conditionLine(row.cond) : hazardLine(row.haz))} />
        {!packed && (
          <Section className="sum-haz" title={t('sum.hazards')} empty={t('sum.noneF')} rows={hazards}
            rowKey={row => row.member}
            fitKey={keyOf(hazards.map(h => `${h.member}:${h.moves.join('+')}`))}
            more={n => count('sum.moreHazards', n)}
            render={hazardLine} />
        )}
        <Section className="sum-syn-sec" title={t('sum.synergies')} empty={t(members === 1 ? 'sum.noSynergiesOne' : 'sum.noSynergies')} emptyBelow rows={synergies}
          rowKey={syn => synergyView(syn).key}
          fitKey={keyOf(synergies.map(syn => synergyView(syn).key))}
          more={(n, hidden) => `${count('sum.moreSyn', n)}: ${hidden.map(syn => {
            // Per ogni sinergia nascosta etichetta e titolo; per i legami anche la frase
            const view = synergyView(syn);
            return `${view.tag} ${view.title}: ${syn.core ? view.mons.join(', ') : view.text}`;
          }).join('; ')}`}
          // Cruscotto basso con la riga Bonus/Malus: il "+N" accanto al titolo (il pulsante in fondo toglierebbe una riga)
          onMore={showBm && density === 'tight' ? undefined : onShowAll}
          render={syn => {
            if (syn.duo) {
              return (
                <div className="sum-duo">
                  {syn.duo.map(core => (
                    <DuoCore key={core.members.join('+')} core={core} goId={goIds.bonusMalus} onClick={() => onView('bonusMalus')}
                      hover={coreTip.bind(core)} />
                  ))}
                </div>
              );
            }
            const view = synergyView(syn);
            // Sui core (a tre e a due): il tooltip con quanto regge chi para ogni tipo e chi protegge, anche col fuoco da tastiera
            const hover = syn.core ? coreTip.bind(syn.core) : undefined;
            return <SynergyRow syn={syn} view={view} rich={rich} small={small} hover={hover} goId={hover && goIds.bonusMalus} second={!rich && !!syn.core && syn.core !== trios[0]} flat={flat} onClick={() => onView(syn.core ? 'bonusMalus' : 'roles')} />;
          }}
          moreTip={hidden => <MoreSynergies items={hidden.map(syn => synergyView(syn))} label={count('sum.moreSyn', hidden.length)} />} />
      </div>
      {showBm && bonusMalus && <BonusMalusRow net={bonusMalus.net} pieces={bonusMalus.pieces} skip={heavy.map(p => p.key)} lang={lang} onOpen={() => onView('bonusMalus')} />}
      {coreTip.anchor && (
        <FloatTip rect={coreTip.anchor.rect} tone="var(--good)" className="core">
          <CoreTip core={coreTip.anchor.key} taken={summary.typedTaken ?? {}} />
          <TipGo place={places.bonusMalus} />
        </FloatTip>
      )}
      {condTip.anchor && (
        <FloatTip rect={condTip.anchor.rect} tone={conditionColor(condTip.anchor.key.key)} className="cond">
          <ConditionTip row={condTip.anchor.key} />
          <TipGo place={places.roles} />
        </FloatTip>
      )}
      {/* Dove porta il clic, per i lettori di schermo: nascosto dentro la carta, non nel body */}
      {(Object.keys(goIds) as (keyof typeof goIds)[]).map(k => <span key={k} id={goIds[k]} hidden>{goText(t, places[k])}</span>)}
    </DashCard>
  );
}
