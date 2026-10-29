import type { CSSProperties, ReactNode } from 'react';
import type { TeamSummary } from '../../engine/teamSummary';
import type { TypeName } from '../../engine/types';
import { gameName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { TeamTypeHelp } from '../CoachPanel';
import { Icon } from '../icons';
import type { Density } from '../OverviewDashboard';
import { Sprite, typeColor } from '../Sprite';
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
 * finiscono nel "+N" (useFit), mai tagliate a metà; senza righe, la parola `empty` attenuata.
 */
function Section<T>({ title, empty, rows, rowKey, fitKey, more, render }: {
  title: string; empty: string;
  rows: T[];
  rowKey: (row: T) => string;
  /** Cambia quando cambia ciò che occupa spazio (righe, lingua, densità): si rimisura. */
  fitKey: string;
  more: (n: number) => string;
  render: (row: T) => ReactNode;
}) {
  // La lista è alta quanto il suo contenuto: si guarda anche la card, che cresce col team ridotto
  const fit = useFit<HTMLUListElement>(fitKey, rows.length, { more: true, min: 1, outer: '.dash-summary' });
  const shown = Math.min(fit.shown, rows.length);
  const hidden = rows.length - shown;
  return (
    <div className="sum-sec">
      <h4 className="sum-sec-h">{title}</h4>
      {rows.length === 0
        ? <p className="sum-none">{empty}</p>
        : (
          <ul ref={fit.ref} className="sum-lines sum-fit">
            {rows.slice(0, shown).map(row => <li key={rowKey(row)} data-fit>{render(row)}</li>)}
            {hidden > 0 && <li data-fit-more className="sum-lines-more"><More n={hidden} label={more(hidden)} /></li>}
          </ul>
        )}
    </div>
  );
}

/**
 * Il Riassunto della Panoramica, ritratto del team: in alto (eroe) il tipo di team e chi lo rende tale, sotto chi porta
 * meteo e campo e chi piazza le trappole. In fondo resta posto per le Sinergie.
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
  const { archetype, styles, attackers, walls, offenseOf, defenseOf, conditions, hazards } = summary;
  const count = (key: 'sum.moreMons' | 'sum.moreField' | 'sum.moreHazards', n: number) => t(`${key}${n === 1 ? 'One' : 'Many'}`, { n });
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
  const maker = (m: (typeof makers)[number], first = false) => (
    <span key={m.name} data-fit className={`sum-maker ${m.side}${first ? ' first' : ''}`}>
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
                  ? <strong className="sum-arch" title={t(`archetype.${archetype}.note`)}>{t(`archetype.${archetype}`)}</strong>
                  : <span className="sum-arch">—</span>}
                {styles.map(style => (
                  <span key={style} className="sum-style" title={t(`teamStyle.${style}.note`)} style={{ '--c': conditionColor(style) } as CSSProperties}>
                    {t(`teamStyle.${style}`)}
                  </span>
                ))}
                <TeamTypeHelp />
              </div>
            )}
            {makers.length > 0 && (
              <div ref={crew.ref} className="sum-crew sum-fit">
                {shownAtk.length > 0 && <span role="group" aria-label={t('sum.attack')} className="sum-side">{shownAtk.map(m => maker(m))}</span>}
                {/* Una linea sottile separa i muri dagli attaccanti */}
                {shownDef.length > 0 && <span role="group" aria-label={t('sum.hold')} className="sum-side">{shownDef.map((m, i) => maker(m, i === 0 && shownAtk.length > 0))}</span>}
                {hiddenMakers > 0 && <span data-fit-more className="sum-crew-more"><More n={hiddenMakers} label={count('sum.moreMons', hiddenMakers)} /></span>}
              </div>
            )}
          </div>
        )}
        <Section title={t('sum.weather')} empty={t('sum.noneM')} rows={conditions}
          rowKey={row => `${row.member}:${row.key}`}
          fitKey={keyOf(conditions.map(c => `${c.member}:${c.key}:${c.users.join('+')}`))}
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
                    {row.users.map(user => (
                      <span key={user} className="sum-user" title={user}><Sprite species={user} size={mini} /><span className="visually-hidden">{user}</span></span>
                    ))}
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
      </div>
    </DashCard>
  );
}
