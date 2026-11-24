import type { ReactNode } from 'react';
import { dex, getMove } from '../../engine/dex';
import {
  PARADOX_SPEED, PARALYSIS, SETUP_PLUS_ONE, SETUP_PLUS_TWO, SPEED_DROP, WEATHER_SPEED, type TeamSpeed,
} from '../../engine/speedArea';
import { SPEED_POOL } from '../../engine/speed';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { Rows } from '../guideParts';
import { Ask } from '../offense/TargetsTip';
import { TipGlyph, TipHead, TipRow, TipRows, TipSec } from '../TipHead';
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
/** Il nome di una mossa per le etichette, nella lingua scelta. */
const moveLabel = (id: string, fallback: string, lang: ReturnType<typeof useLang>) => gameName('move', getMove(id)?.name ?? fallback, lang);

/** Una mossa, abilità o strumento come etichetta; `note` è il meteo o il campo che serve, scritto piccolo dentro. */
interface Chip { name: string; note?: string; move?: boolean }
/** Una riga del dettaglio: cosa conta, quanto vale, le etichette (mosse, abilità) e la regola breve sotto. */
interface Row { label: string; value?: string; chips?: Chip[]; text?: ReactNode; group?: string }

/** Quante righe e quanti esempi per riga ha il tooltip del "?" (corto: il resto si capisce dalla regola nella guida). */
const GAIN_ROWS = 4;
const GAIN_CHIPS = 3;

/**
 * Il dettaglio di una fonte nel tooltip del "?", corto (vedi DESIGN.md, "Tooltips"): la testata col tondo della
 * velocità, le prime righe (cosa conta e il moltiplicatore a destra; sotto i primi esempi coi nomi dei giochi e "e altre N", o
 * la regola breve) e la nota.
 */
function GainTip({ title, rows, grouped = false, foot }: { title: string; rows: Row[]; grouped?: boolean; foot?: string }) {
  const t = useT();
  const lang = useLang();
  const name = (chip: Chip) => gameName(chip.move ? 'move' : dex.items.get(chip.name).exists ? 'item' : 'ability', chip.name, lang);
  const sub = (row: Row): ReactNode => {
    const chips = row.chips ?? [];
    if (!chips.length) return row.text;
    // Quanti altri esempi in parole ("e altre 10"): un "+10" dopo i nomi sembrerebbe un bonus alle statistiche
    const rest = chips.length - GAIN_CHIPS;
    const names = chips.slice(0, GAIN_CHIPS).map(name).join(', ') + (rest > 0 ? ` ${rest === 1 ? t('tip.andMoreOne') : t('tip.andMoreMany', { n: rest })}` : '');
    return row.text ? <>{names}<br />{row.text}</> : names;
  };
  return (
    <>
      <TipHead lead={<TipGlyph icon="speed" />} title={title} />
      {/* Coi gruppi (Lunghi, Brevi) una sezione per gruppo, col suo nome; una riga col gruppo ne apre uno nuovo */}
      {rows.slice(0, GAIN_ROWS).reduce<Row[][]>((groups, row, i) => {
        if (i === 0 || (grouped && row.group)) groups.push([row]); else groups[groups.length - 1].push(row);
        return groups;
      }, []).map((group, g) => (
        <TipSec key={g} label={grouped ? group[0].group : undefined}>
          <TipRows>
            {group.map((row, i) => <TipRow key={i} title={row.label} value={row.value} sub={sub(row)} />)}
          </TipRows>
        </TipSec>
      ))}
      {foot && <p className="ftip-foot">{foot}</p>}
    </>
  );
}

/**
 * La guida della Velocità, come quelle di Offesa e Difesa: cosa misura, le tre fonti di velocità in più (ognuna con una
 * riga e il "?" col dettaglio nel tooltip: mosse, abilità, moltiplicatori dalle tabelle del motore), dal membro al team.
 * Schematica e senza quote né pesi: le fonti aggiungono un bonus.
 */
export function SpeedGuideSection({ speed, meta, doubles = false }: { speed: TeamSpeed; meta: boolean; doubles?: boolean }) {
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
        { label: gameName('ability', abilityName('unburden'), lang), value: times(2), text: g('d.boost.unburden.rule') },
      ],
    },
    priority: {
      rows: [
        { label: g('d.prio.how'), text: g('d.prio.how.rule') },
        { label: g('d.prio.moves'), chips: moveChips(PRIORITY_EXAMPLES), text: g('d.prio.moves.rule', { glide: moveLabel('grassyglide', 'Grassy Glide', lang) }) },
        { label: g('d.prio.field'), text: g('d.prio.field.rule') },
      ],
    },
    control: {
      rows: [
        { group: g('d.ctrl.long'), label: moveLabel('stickyweb', 'Sticky Web', lang), value: '−1', text: g('d.ctrl.web.rule') },
        { label: moveLabel('trickroom', 'Trick Room', lang), text: g('d.ctrl.room.rule') },
        // In doppio Tailwind conta come Trick Room (un compagno lo mette mentre l'altro attacca); in singolo fra i brevi
        { ...(!doubles && { group: g('d.ctrl.short') }), label: moveLabel('tailwind', 'Tailwind', lang), value: times(2), text: g('d.ctrl.tail.rule') },
        { ...(doubles && { group: g('d.ctrl.short') }), label: g('d.ctrl.para'), value: '×½', chips: moveChips(PARALYSIS, immune), text: g('d.ctrl.para.rule') },
        { label: g('d.ctrl.drop'), value: '×⅔', chips: moveChips(SPEED_DROP, immune) },
      ],
      foot: g('d.ctrl.foot'),
      grouped: true,
    },
  };
  // Il tooltip del "?" in parole per i lettori di schermo: ogni riga col moltiplicatore, tutti gli esempi e la regola
  const chipName = (chip: Chip) => gameName(chip.move ? 'move' : dex.items.get(chip.name).exists ? 'item' : 'ability', chip.name, lang);
  const describe = (rows: Row[]) => rows.map(row => [row.label, row.value, row.chips?.map(chipName).join(', '), typeof row.text === 'string' ? row.text : '']
    .filter(Boolean).join(' ')).join('; ');
  const gain = (key: GainKey): [ReactNode, ReactNode] => [
    g(`gains.${key}`),
    <>{g(`gains.${key}.rule`)} <Ask label={g(`gains.${key}`)} short describe={describe(details[key].rows)}><GainTip title={g(`gains.${key}`)} {...details[key]} /></Ask></>,
  ];

  return (
    <>
      <h4>{g('what')}</h4>
      <ul className="guide-lines">
        <li>{g('what.rule')}</li>
        <li>{rivals}</li>
        <li>{g('pct')}</li>
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
