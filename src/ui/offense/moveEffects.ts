import { battleAbility, getMove, toID } from '../../engine/dex';
import type { TeamSet } from '../../engine/sets';
import { battleMoveType, type TypeName } from '../../engine/types';
import { gameName, typeName } from '../../i18n/game';
import type { Lang, MessageKey } from '../../i18n';

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;
type Boosts = Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;

/** Quanto il campo alza le mosse del suo tipo (i meteo che non alzano danni d'attacco non ci sono). */
const FIELD_TYPE: Record<string, { type: TypeName; mult: number }> = {
  sun: { type: 'Fire', mult: 1.5 }, rain: { type: 'Water', mult: 1.5 },
  electricterrain: { type: 'Electric', mult: 1.3 }, psychicterrain: { type: 'Psychic', mult: 1.3 }, grassyterrain: { type: 'Grass', mult: 1.3 },
};
/** Mosse che il campo cambia in altro modo. */
const NO_CHARGE: Record<string, string> = { solarbeam: 'sun', solarblade: 'sun' };
const ALWAYS_HITS: Record<string, string[]> = { thunder: ['rain'], hurricane: ['rain'], blizzard: ['snow'] };
const FIELD_MOVES: Record<string, { condition: string; mult: number }> = {
  hydrosteam: { condition: 'sun', mult: 1.5 }, risingvoltage: { condition: 'electricterrain', mult: 2 },
  expandingforce: { condition: 'psychicterrain', mult: 1.5 }, psyblade: { condition: 'electricterrain', mult: 1.5 },
};
const WEATHER_BALL = new Set(['sun', 'rain', 'sand', 'snow']);
const TERRAIN_PULSE = new Set(['electricterrain', 'psychicterrain', 'grassyterrain', 'mistyterrain']);

/**
 * Gli effetti di una danza e del meteo/campo del team su UNA mossa, a parole corte per il tooltip: "Att ×2" solo se la
 * mossa usa l'Attacco, "Fuoco ×1,5" solo per una mossa Fuoco, "niente turno di carica" per Solarlama col sole, le
 * abilità di chi attacca che si accendono col campo (Solar Power, Protosynthesis, Quark Drive, Sand Force).
 */
export function moveEffects(set: TeamSet, moveName: string | null, opts: { boosts?: Boosts | null; conditions?: string[] }, t: T, lang: Lang): string {
  if (!moveName) return '';
  const move = getMove(moveName);
  if (!move) return '';
  const id = toID(move.name);
  const num = (x: number) => x.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US', { maximumFractionDigits: 2 });
  const notes: string[] = [];
  // La danza: solo la statistica che la mossa usa (Body Press la Difesa)
  const stat = id === 'bodypress' ? 'def' : move.category === 'Physical' ? 'atk' : move.category === 'Special' ? 'spa' : null;
  const stage = stat ? opts.boosts?.[stat] ?? 0 : 0;
  if (stat && stage > 0) notes.push(`${t(`stat.${stat}` as MessageKey)} ×${num((2 + stage) / 2)}`);
  // Il meteo o il campo del team su questa mossa
  const type = battleMoveType(set, move.name);
  const ability = toID(battleAbility(set));
  for (const c of opts.conditions ?? []) {
    if (NO_CHARGE[id] === c) notes.push(t('tht.eff.noCharge'));
    else if (ALWAYS_HITS[id]?.includes(c)) notes.push(t('tht.eff.alwaysHits'));
    else if (id === 'weatherball' && WEATHER_BALL.has(c)) notes.push(t('tht.eff.typeAndPower'));
    else if (id === 'terrainpulse' && TERRAIN_PULSE.has(c)) notes.push(t('tht.eff.typeAndPower'));
    else if (FIELD_MOVES[id]?.condition === c) notes.push(`×${num(FIELD_MOVES[id].mult)}`);
    else if (FIELD_TYPE[c] && type === FIELD_TYPE[c].type) notes.push(`${typeName(type, lang)} ×${num(FIELD_TYPE[c].mult)}`);
    // Le abilità di chi attacca accese dal campo del compagno
    if (c === 'sun' && ability === 'solarpower' && move.category === 'Special') notes.push(`${gameName('ability', 'Solar Power', lang)} ${t('stat.spa')} ×${num(1.5)}`);
    // Protosynthesis / Quark Drive: col Booster Energy sono già accese, il campo non aggiunge niente
    const booster = toID(set.item) === 'boosterenergy';
    if (!booster && ((c === 'sun' && ability === 'protosynthesis') || (c === 'electricterrain' && ability === 'quarkdrive'))) {
      notes.push(`${gameName('ability', ability === 'protosynthesis' ? 'Protosynthesis' : 'Quark Drive', lang)} ×${num(1.3)}`);
    }
    if (c === 'sand' && ability === 'sandforce' && type && ['Rock', 'Ground', 'Steel'].includes(type)) notes.push(`${gameName('ability', 'Sand Force', lang)} ×${num(1.3)}`);
  }
  return [...new Set(notes)].join(' · ');
}
