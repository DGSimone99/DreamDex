import type { ReactNode } from 'react';
import { dex, getMove } from '../../engine/dex';
import {
  PARADOX_SPEED, PARALYSIS, SETUP_PLUS_ONE, SETUP_PLUS_TWO, SPEED_DROP, WEATHER_SPEED, type TeamSpeed,
} from '../../engine/speedArea';
import { SPEED_POOL } from '../../engine/speed';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { Rows } from '../guideParts';
import { MovePill } from '../MovePill';
import { Ask } from '../offense/TargetsTip';
type Key = Parameters<ReturnType<typeof useT>>[0];

/** Le tre fonti di velocità in più. */
const GAINS = ['boost', 'priority', 'control'] as const;
type GainKey = typeof GAINS[number];

/** Esempi di mosse prioritarie (il motore non ha una lista: conta ogni mossa d'attacco con priorità). */
const PRIORITY_EXAMPLES = ['extremespeed', 'suckerpunch', 'aquajet', 'bulletpunch', 'iceshard', 'shadowsneak', 'machpunch', 'jetpunch'];

/** I tipi immuni a una mossa che rallenta, oltre agli Elettro per la paralisi (le stesse eccezioni di slowFactor nel motore). */
const SLOW_IMMUNE: Record<string, string> = { thunderwave: 'Ground', nuzzle: 'Ground', stunspore: 'Grass', bulldoze: 'Flying', electroweb: 'Ground', lowsweep: 'Ghost' };

const moveChips = (ids: Iterable<string>, note?: (id: string) => string | undefined): Chip[] =>
  [...ids].map(id => ({ name: getMove(id)?.name ?? id, note: note?.(id), move: true }));
const abilityName = (id: string) => dex.abilities.get(id).name;

/** Una mossa, abilità o strumento come etichetta; `note` è il meteo o il campo che serve, scritto piccolo dentro. */
interface Chip { name: string; note?: string; move?: boolean }
/** Una riga del dettaglio: cosa conta, quanto vale, le etichette (mosse, abilità) e la regola breve sotto. */
interface Row { label: string; value?: string; chips?: Chip[]; text?: ReactNode; group?: string }

/** Il dettaglio di una fonte nel tooltip del "?": le righe (cosa conta, il moltiplicatore, le mosse o abilità) e la nota. */
function GainTip({ title, rows, grouped, foot }: { title: string; rows: Row[]; grouped?: boolean; foot?: string }) {
  const lang = useLang();
  return (
    <>
      <div className="ftip-head"><b>{title}</b></div>
      <div className="sp-gd-tip">
        <div className={`sp-gd-rows${grouped ? ' grouped' : ''}`}>
          {rows.map((row, i) => (
            <div key={i} className={`sp-gd-row${row.group && i > 0 ? ' next-group' : ''}`}>
              {grouped && <span className="sp-gd-group">{row.group}</span>}
              <b>{row.label}</b>
              <span className="sp-gd-val">{row.value}</span>
              <span className="sp-gd-body">
                {row.chips?.map(chip => (chip.move
                  // Le mosse come pillole (nome tradotto, potenza nella coda); la nota sul tipo immune dentro, piccola
                  ? <MovePill key={chip.name} name={chip.name} size="sm" className="sp-gd-move"
                    label={chip.note ? <>{gameName('move', chip.name, lang)}<small>{chip.note}</small></> : undefined} />
                  : <span key={chip.name} className="sp-gd-chip">{chip.name}{chip.note && <small>{chip.note}</small>}</span>))}
                {row.text && <span className="sp-gd-text">{row.text}</span>}
              </span>
            </div>
          ))}
        </div>
        {foot && <p className="ftip-foot">{foot}</p>}
      </div>
    </>
  );
}

/**
 * La guida della Velocità, come quelle di Offesa e Difesa: cosa misura, le tre fonti di velocità in più (ognuna con una
 * riga e il "?" col dettaglio nel tooltip: mosse, abilità, moltiplicatori dalle tabelle del motore), dal membro al team.
 * Schematica e senza quote né pesi: le fonti aggiungono un bonus.
 */
export function SpeedGuideSection({ speed, meta }: { speed: TeamSpeed; meta: boolean }) {
  const t = useT();
  const lang = useLang();
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.speed.${key}` as Key, params);
  const times = (x: number) => `×${String(x).replace('.', lang === 'it' ? ',' : '.')}`;
  const rivals = meta ? g('rivals.meta', { n: SPEED_POOL }) : g('rivals.tier');
  void speed;

  const field = (need: { weather?: string; terrain?: string }) =>
    need.weather ? t(`conditionName.${need.weather}` as Key).toLowerCase() : t(`conditionName.${need.terrain}terrain` as Key);
  const weather: Chip[] = Object.entries(WEATHER_SPEED).map(([ability, need]) => ({ name: abilityName(ability), note: field(need) }));
  const immune = (id: string) => (SLOW_IMMUNE[id] ? g('d.ctrl.not', { type: typeName(SLOW_IMMUNE[id], lang) }) : undefined);
  const paradox: Chip[] = [
    { name: dex.items.get('boosterenergy').name },
    { name: abilityName('protosynthesis'), note: field({ weather: 'sun' }) },
    { name: abilityName('quarkdrive'), note: field({ terrain: 'electric' }) },
  ];
  const details: Record<GainKey, { rows: Row[]; foot?: string; grouped?: boolean }> = {
    boost: {
      rows: [
        { label: g('d.boost.plus1'), value: times(1.5), chips: [...moveChips(SETUP_PLUS_ONE), { name: abilityName('speedboost') }] },
        { label: g('d.boost.plus2'), value: times(2), chips: moveChips(SETUP_PLUS_TWO) },
        { label: g('d.boost.weather'), value: times(2), chips: weather },
        { label: g('d.boost.paradox'), value: times(PARADOX_SPEED), chips: paradox, text: g('d.boost.paradox.rule') },
        { label: abilityName('unburden'), value: times(2), text: g('d.boost.unburden.rule') },
      ],
    },
    priority: {
      rows: [
        { label: g('d.prio.how'), text: g('d.prio.how.rule') },
        { label: g('d.prio.moves'), chips: moveChips(PRIORITY_EXAMPLES), text: g('d.prio.moves.rule', { glide: getMove('grassyglide')?.name ?? 'Grassy Glide' }) },
        { label: g('d.prio.field'), text: g('d.prio.field.rule') },
      ],
    },
    control: {
      rows: [
        { group: g('d.ctrl.long'), label: getMove('stickyweb')?.name ?? 'Sticky Web', value: '−1', text: g('d.ctrl.web.rule') },
        { label: getMove('trickroom')?.name ?? 'Trick Room', text: g('d.ctrl.room.rule') },
        { group: g('d.ctrl.short'), label: getMove('tailwind')?.name ?? 'Tailwind', value: times(2), text: g('d.ctrl.tail.rule') },
        { label: g('d.ctrl.para'), value: '×½', chips: moveChips(PARALYSIS, immune), text: g('d.ctrl.para.rule') },
        { label: g('d.ctrl.drop'), value: '×⅔', chips: moveChips(SPEED_DROP, immune) },
      ],
      foot: g('d.ctrl.foot'),
      grouped: true,
    },
  };
  const gain = (key: GainKey): [ReactNode, ReactNode] => [
    g(`gains.${key}`),
    <>{g(`gains.${key}.rule`)} <Ask label={g(`gains.${key}`)}><GainTip title={g(`gains.${key}`)} {...details[key]} /></Ask></>,
  ];

  return (
    <>
      <h4>{g('what')}</h4>
      <ul className="guide-lines">
        <li>{g('what.rule')}</li>
        <li>{rivals}</li>
      </ul>

      <h4>{g('gains')}</h4>
      <Rows compact rows={GAINS.map(gain)} />
      <ul className="guide-lines"><li>{g('gains.foot')}</li><li>{g('room')}</li><li>{g('walls')}</li></ul>

      <h4>{g('toteam')}</h4>
      <ul className="guide-lines">
        <li>{g('team.rule')}</li>
        <li>{g('tank')}</li>
        <li>{g('scale')}</li>
      </ul>
    </>
  );
}
