import { useId, type CSSProperties, type ReactNode } from 'react';
import type { Core } from '../../engine/cores';
import { viaName } from '../../engine/synergy';
import type { TeamLink } from '../../engine/teamLinks';
import type { TeamSummary } from '../../engine/teamSummary';
import type { TypeName } from '../../engine/types';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { TeamTypeHelp } from '../CoachPanel';
import { Icon } from '../icons';
import type { Density } from '../OverviewDashboard';
import { Sprite, typeColor } from '../Sprite';
import { CoreTriangle, coreTitle } from './CoreTriangle';
import { DashCard } from './DashCard';
import { useFit } from './useFit';

/**
 * Colore di una condizione (meteo, campo, Trick Room, schermi, Ventoincoda) e degli stili di team: il colore del tipo
 * che le corrisponde, lo stesso delle icone di tipo. Chiavi: id della condizione, dello stile o della mossa.
 */
const CONDITION_TYPE: Record<string, TypeName> = {
  sun: 'Fire', rain: 'Water', sand: 'Rock', snow: 'Ice',
  electricterrain: 'Electric', psychicterrain: 'Psychic', grassyterrain: 'Grass', mistyterrain: 'Fairy',
  trickroom: 'Psychic', reflect: 'Psychic', lightscreen: 'Psychic', auroraveil: 'Ice', tailwind: 'Flying',
};
const conditionColor = (key: string) => typeColor(CONDITION_TYPE[key] ?? '');

/** Il "+N": a vista solo il numero, per intero nel tooltip e ai lettori di schermo. */
function More({ label, n }: { label: string; n: number }) {
  return (
    <span className="sum-more" title={label}>
      <span aria-hidden="true">+{n}</span><span className="visually-hidden">{label}</span>
    </span>
  );
}

/** Sprite sul piedistallo luminoso (come le corsie della Velocità). */
const Plinth = ({ name, size }: { name: string; size: number }) => <span className="sum-plinth"><Sprite species={name} size={size} /></span>;

/** Chip col bordo e il pallino colorato, come quelle dei ruoli. */
const Tag = ({ color, children }: { color: string; children: ReactNode }) => (
  <span className="sum-tag" style={{ '--c': color } as CSSProperties}><i aria-hidden="true" />{children}</span>
);

/**
 * Una sezione: intestazione in maiuscoletto e righe separate da una linea. Le righe che non stanno nell'altezza della card
 * finiscono nel "+N" (useFit), mai tagliate a metà; il "+N" sta accanto al titolo, così non toglie una riga alle altre.
 * Senza righe, la parola `empty` attenuata.
 */
function Section<T>({ title, empty, rows, rowKey, fitKey, more, render, className = '' }: {
  title: string; empty: string;
  rows: T[];
  rowKey: (row: T) => string;
  /** Cambia quando cambia ciò che occupa spazio (righe, lingua, densità): si rimisura. */
  fitKey: string;
  /** Il testo del "+N" (tooltip e lettori di schermo), dalle righe nascoste. */
  more: (n: number, hidden: T[]) => string;
  render: (row: T) => ReactNode;
  className?: string;
}) {
  // La lista è alta quanto il suo contenuto: si guarda anche la card, che cresce col team ridotto
  const fit = useFit<HTMLUListElement>(fitKey, rows.length, { min: 1, outer: '.dash-summary' });
  const shown = Math.min(fit.shown, rows.length);
  const hidden = rows.length - shown;
  return (
    <div className={`sum-sec${className ? ` ${className}` : ''}`}>
      <h4 className="sum-sec-h">{title}</h4>
      {rows.length === 0
        ? <p className="sum-none">{empty}</p>
        : (
          <ul ref={fit.ref} className="sum-lines sum-fit">
            {rows.slice(0, shown).map((row, i) => <li key={`${rowKey(row)}#${i}`} data-fit>{render(row)}</li>)}
          </ul>
        )}
      {/* Dopo la lista nell'ordine di lettura; a vista sta a destra del titolo (posizione assoluta) */}
      {hidden > 0 && <span className="sum-sec-more"><More n={hidden} label={more(hidden, rows.slice(shown))} /></span>}
    </div>
  );
}

/** Elenco a parole: "A", "A e B", "A, B e C" ("and" in inglese, senza virgola prima). */
const joinList = (items: string[], lang: string) => {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${lang === 'en' ? 'and' : 'e'} ${items[items.length - 1]}`;
};

/** Una sinergia: un core difensivo (da 2 o 3) o un legame tra membri. */
type Synergy = { core: Core; link?: undefined } | { link: TeamLink; core?: undefined };

/** Colore dell'etichetta e dell'anello: core verde, pivot e Baton Pass azzurro, Desiderio magenta, trappole giallo. */
const LINK_COLOR: Record<TeamLink['kind'], string> = {
  pivot: 'var(--accent)', batonpass: 'var(--accent)', wish: 'var(--accent-2-ink)', phazer: 'var(--warn)',
};

interface SynergyView { key: string; tag: string; color: string; title: string; text: string; mons: string[]; trio: boolean }

/** Ciò che una riga di sinergia mostra: etichetta, titolo corto, frase, le sprite (una o due). */
function useSynergyView() {
  const t = useT();
  const lang = useLang();
  return (syn: Synergy): SynergyView => {
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

/**
 * Una riga delle Sinergie. Il core da 3 è il triangolo; il resto due sprite unite da un anello "catena" nel colore del
 * legame (una sola per Desiderio), l'etichetta, il titolo e la frase in grigio. Nome: etichetta e titolo; descrizione:
 * la frase (o il giro del triangolo letto in parole).
 */
function SynergyRow({ syn, view, rich, small, onClick }: { syn: Synergy; view: SynergyView; rich: boolean; small: number; onClick: () => void }) {
  const desc = useId();
  return (
    <button type="button" className={`sum-syn${view.trio ? ' trio' : ''}`} style={{ '--c': view.color } as CSSProperties}
      aria-label={`${view.tag} ${view.title}`} aria-describedby={desc} onClick={onClick}>
      {view.trio && syn.core
        ? <CoreTriangle core={syn.core} size={rich ? 'roomy' : 'normal'} descId={desc} />
        : (
          <>
            <span className="sum-pair" aria-hidden="true">
              {view.mons.map((name, i) => (
                <span key={`${name}:${i}`} className="sum-pair-ring">
                  {i > 0 && <span className="sum-link"><Icon name="chain" /></span>}
                  <span className="sum-pair-mon" title={name}><Sprite species={name} size={small} /></span>
                </span>
              ))}
            </span>
            <span className="sum-syn-body">
              <span className="sum-syn-head"><em className="sum-syn-tag">{view.tag}</em><strong className="sum-syn-title" title={view.title}>{view.title}</strong></span>
              <span id={desc} className="sum-syn-text">{view.text}</span>
            </span>
          </>
        )}
    </button>
  );
}

/**
 * Il Riassunto della Panoramica, ritratto del team: in alto (eroe) il tipo di team e chi lo rende tale, sotto chi porta
 * meteo e campo, chi piazza le trappole e, in fondo, le Sinergie (core difensivi e legami), che prendono lo spazio che resta.
 */
export function SummarySection({ summary, members, density, rich = false, onView }: {
  summary: TeamSummary; members: number;
  /** Sprite e righe cambiano misura con la densità: le parti a misura si rimisurano. */
  density: Density;
  /** Team ridotto e cruscotto alto (RICH_FROM): sprite più grandi, sezioni distribuite su tutta l'altezza. */
  rich?: boolean;
  onView: (v: AnalysisView) => void;
}) {
  const t = useT();
  const lang = useLang();
  const { archetype, nearType, styles, attackers, walls, offenseOf, defenseOf, conditions, hazards, cores, links } = summary;
  const count = (key: 'sum.moreMons' | 'sum.moreField' | 'sum.moreHazards' | 'sum.moreSyn', n: number) => t(`${key}${n === 1 ? 'One' : 'Many'}`, { n });
  const synergyView = useSynergyView();
  // Solo i core da 3; quelli da 2 solo se il team non ne ha da 3. Poi i legami, senza i pivot
  const trios = cores.filter(core => core.members.length === 3);
  const synergies: Synergy[] = [
    ...(trios.length ? trios : cores).map(core => ({ core })),
    ...links.filter(link => link.kind !== 'pivot').map(link => ({ link })),
  ];
  const keyOf = (parts: string[]) => `${lang}|${density}|${rich}|${parts.join()}`;
  const big = rich ? 56 : 40;
  const small = rich ? 44 : 34;
  const mini = rich ? 38 : 28;

  // Chi rende il team tale: prima gli attaccanti, poi i muri, in una riga; chi non sta va nel "+N"
  const makers = [
    ...attackers.map(name => ({ name, side: 'atk' as const, score: offenseOf[name] })),
    ...walls.map(name => ({ name, side: 'def' as const, score: defenseOf[name] })),
  ];
  const crew = useFit<HTMLDivElement>(keyOf(makers.map(m => `${m.side}:${m.name}`)), makers.length, { more: true });
  const shown = makers.slice(0, Math.min(crew.shown, makers.length));
  const hiddenMakers = makers.length - shown.length;
  const maker = (m: (typeof makers)[number], i: number, first = false) => (
    <span key={`${m.name}#${i}`} data-fit className={`sum-maker ${m.side}${first ? ' first' : ''}`}>
      <button type="button" className="sum-mon" title={m.name} onClick={() => onView(m.side === 'atk' ? 'strength' : 'defense')}
        aria-label={m.score === undefined ? m.name : t(m.side === 'atk' ? 'sum.offenseOf' : 'sum.defenseOf', { name: m.name, n: m.score })}>
        <Plinth name={m.name} size={big} />
        {m.score !== undefined && <span className="sum-score" aria-hidden="true"><Icon name={m.side === 'atk' ? 'sword' : 'shield'} />{m.score}</span>}
      </button>
    </span>
  );
  const shownAtk = shown.filter(m => m.side === 'atk');
  const shownDef = shown.filter(m => m.side === 'def');

  return (
    <DashCard className="dash-summary" title={t('sum.title')}>
      <div className="sum-body">
        {(members >= 2 || makers.length > 0) && (
          <div className="sum-hero">
            {members >= 2 && (
              <div className="sum-type">
                {archetype
                  ? (
                    <span className="sum-arch-box">
                      <strong className="sum-arch" title={t(`archetype.${archetype}.note`)}>{t(`archetype.${archetype}`)}</strong>
                      {/* Sul confine col tipo accanto: una riga piccola sotto il nome, che non lo accorcia */}
                      {nearType && <span className="sum-near" title={t('catalog.typeBlend.when')}>{t('sum.nearType', { type: t(`archetype.${nearType}`) })}</span>}
                    </span>
                  )
                  : <span className="sum-arch">—</span>}
                {styles.map(style => (
                  <span key={style} className="sum-style" title={t(`teamStyle.${style}.note`)} style={{ '--c': conditionColor(style) } as CSSProperties}>
                    {t(`teamStyle.${style}`)}
                  </span>
                ))}
                <TeamTypeHelp rule={summary.typeRule} />
              </div>
            )}
            {makers.length > 0 && (
              <div ref={crew.ref} className="sum-crew sum-fit">
                {shownAtk.length > 0 && <span role="group" aria-label={t('sum.attack')} className="sum-side">{shownAtk.map((m, i) => maker(m, i))}</span>}
                {/* Una linea sottile separa i muri dagli attaccanti */}
                {shownDef.length > 0 && <span role="group" aria-label={t('sum.hold')} className="sum-side">{shownDef.map((m, i) => maker(m, i, i === 0 && shownAtk.length > 0))}</span>}
                {hiddenMakers > 0 && <span data-fit-more className="sum-crew-more"><More n={hiddenMakers} label={count('sum.moreMons', hiddenMakers)} /></span>}
              </div>
            )}
          </div>
        )}
        <Section title={t('sum.weather')} empty={t('sum.noneM')} rows={conditions}
          rowKey={row => `${row.member}:${row.key}`}
          fitKey={keyOf(conditions.map(c => `${c.member}:${c.key}:${c.users.map(u => u.name).join('+')}`))}
          more={n => count('sum.moreField', n)}
          render={row => (
            <button type="button" className="sum-line" onClick={() => onView('roles')}>
              <Plinth name={row.member} size={small} />
              <span className="sum-name">{row.member}</span>
              <Tag color={conditionColor(row.key)}>{row.label}</Tag>
              {row.users.length > 0 && (
                <>
                  <span className="sum-to" aria-hidden="true">→</span>
                  <span className="sum-users">
                    {row.users.map((user, i) => {
                      // Con l'abilità o la mossa con cui la sfrutta: "Barraskewda · Nuotovelox"
                      const label = user.via ? `${user.name} · ${viaName(user.via, lang)}` : user.name;
                      return <span key={`${user.name}#${i}`} className="sum-user" title={label}><Sprite species={user.name} size={mini} /><span className="visually-hidden">{label}</span></span>;
                    })}
                  </span>
                </>
              )}
            </button>
          )} />
        <Section title={t('sum.hazards')} empty={t('sum.noneF')} rows={hazards}
          rowKey={row => row.member}
          fitKey={keyOf(hazards.map(h => `${h.member}:${h.moves.join('+')}`))}
          more={n => count('sum.moreHazards', n)}
          render={row => (
            <button type="button" className="sum-line" onClick={() => onView('roles')}>
              <Plinth name={row.member} size={small} />
              <span className="sum-name">{row.member}</span>
              <span className="sum-tags">{row.moves.map(move => <Tag key={move} color="var(--warn)">{gameName('move', move, lang)}</Tag>)}</span>
            </button>
          )} />
        <Section className="sum-syn-sec" title={t('sum.synergies')} empty={t('sum.noSynergies')} rows={synergies}
          rowKey={syn => synergyView(syn).key}
          fitKey={keyOf(synergies.map(syn => synergyView(syn).key))}
          more={(n, hidden) => `${count('sum.moreSyn', n)}: ${hidden.map(syn => {
            // Per ogni sinergia nascosta etichetta e titolo; per i legami anche la frase
            const view = synergyView(syn);
            return `${view.tag} ${view.title}: ${syn.core ? view.mons.join(', ') : view.text}`;
          }).join('; ')}`}
          render={syn => {
            const view = synergyView(syn);
            return <SynergyRow syn={syn} view={view} rich={rich} small={small} onClick={() => onView(syn.core ? 'defense' : 'roles')} />;
          }} />
      </div>
    </DashCard>
  );
}
