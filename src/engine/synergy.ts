import { battleAbility, battleName, battleSpecies, dex, getMove, isDefined, toID } from './dex';
import { attackStyle } from './roles';
import type { TeamSet } from './sets';
import { t, type Lang } from '../i18n';
import { anyGameName } from '../i18n/game';
import { attackingMoves, defensiveMultiplier, type TypeName } from './types';

export type Condition =
  | 'sun' | 'rain' | 'sand' | 'snow'
  | 'electricterrain' | 'psychicterrain' | 'grassyterrain' | 'mistyterrain'
  | 'trickroom';

/** Come la condizione compare nelle frasi: "il team non porta il sole". */
export const conditionLabel = (condition: Condition, lang: Lang = 'it'): string => t(lang, `condition.${condition}`);

/** Nome della condizione nei menu: "Sole", "Campo Erboso". */
export const conditionName = (condition: Condition, lang: Lang = 'it'): string => t(lang, `conditionName.${condition}`);

interface Rule {
  enablerAbilities: string[];
  enablerMoves: string[];
  benefitAbilities: string[];
  benefitMoves: string[];
}

const RULES: Record<Condition, Rule> = {
  sun: {
    enablerAbilities: ['drought', 'orichalcumpulse', 'desolateland'],
    enablerMoves: ['sunnyday'],
    benefitAbilities: ['chlorophyll', 'solarpower', 'protosynthesis', 'flowergift', 'harvest'],
    benefitMoves: ['solarbeam', 'solarblade', 'weatherball', 'hydrosteam'],
  },
  rain: {
    enablerAbilities: ['drizzle', 'primordialsea'],
    enablerMoves: ['raindance'],
    benefitAbilities: ['swiftswim', 'raindish', 'dryskin', 'hydration'],
    benefitMoves: ['thunder', 'hurricane', 'weatherball', 'electroshot'],
  },
  sand: {
    enablerAbilities: ['sandstream'],
    enablerMoves: ['sandstorm'],
    benefitAbilities: ['sandrush', 'sandforce'],
    benefitMoves: ['weatherball'],
  },
  snow: {
    enablerAbilities: ['snowwarning'],
    enablerMoves: ['snowscape', 'chillyreception'],
    benefitAbilities: ['slushrush', 'icebody'],
    benefitMoves: ['blizzard', 'auroraveil', 'weatherball'],
  },
  electricterrain: {
    enablerAbilities: ['electricsurge', 'hadronengine'],
    enablerMoves: ['electricterrain'],
    benefitAbilities: ['quarkdrive', 'surgesurfer'],
    benefitMoves: ['risingvoltage', 'terrainpulse'],
  },
  psychicterrain: {
    enablerAbilities: ['psychicsurge'],
    enablerMoves: ['psychicterrain'],
    benefitAbilities: [],
    benefitMoves: ['expandingforce', 'terrainpulse'],
  },
  grassyterrain: {
    enablerAbilities: ['grassysurge'],
    enablerMoves: ['grassyterrain'],
    benefitAbilities: [],
    benefitMoves: ['grassyglide', 'terrainpulse'],
  },
  mistyterrain: {
    enablerAbilities: ['mistysurge'],
    enablerMoves: ['mistyterrain'],
    benefitAbilities: [],
    benefitMoves: ['mistyexplosion', 'terrainpulse'],
  },
  trickroom: {
    enablerAbilities: [],
    enablerMoves: ['trickroom'],
    benefitAbilities: [],
    benefitMoves: [],
  },
};

export const CONDITIONS = Object.keys(RULES) as Condition[];

/** Attaccanti con velocità base fino a questa soglia beneficiano di Trick Room. */
export const TRICK_ROOM_SPEED = 50;
const SLOW = 'Velocità bassa';

/** Come si attiva o si sfrutta una condizione, nella lingua data: abilità, mossa o "velocità bassa". */
export const viaName = (via: string, lang: Lang = 'it'): string => (via === SLOW ? t(lang, 'synergy.slow') : anyGameName(via, lang));

/** Mosse che sfruttano qualunque meteo o campo: non bastano da sole a dire "manca la condizione". */
const GENERIC_MOVES = new Set(['weatherball', 'terrainpulse']);
/** Abilità Paradox: il meteo/campo è un bonus, funzionano anche senza (Booster Energy o nessun boost). */
const PARADOX = new Set(['protosynthesis', 'quarkdrive']);
/** Abilità passive che il meteo accende ma di cui il Pokémon non ha bisogno (Manaphy con Hydration): sinergia sì, dipendenza no. */
const PASSIVE_ABILITIES = new Set(['hydration', 'raindish', 'dryskin', 'icebody', 'harvest']);
/** Mosse a due turni che la Power Herb fa partire subito: con lo strumento non dipendono dal sole. */
const POWER_HERB_MOVES = new Set(['solarbeam', 'solarblade', 'meteorbeam', 'electroshot']);
/** Abilitatori che potenziano chi li ha (Attacco o Attacco Speciale col proprio meteo/campo): sfruttano da sé la condizione. */
const SELF_BOOST_ENABLERS = new Set(['orichalcumpulse', 'hadronengine']);
/** Mosse che il meteo migliora ma che funzionano bene anche senza (precisione o carica): sinergia sì, dipendenza no. */
const OPTIONAL_MOVES = new Set(['hurricane', 'thunder', 'electroshot', 'blizzard']);
/** Meteo che fa danno agli avversari a ogni turno: è sempre sfruttato. */
const CHIP: Condition[] = ['sand'];
/** Meteo primordiale: dura solo finché chi lo porta è in campo (non tocca i compagni, che entrano dopo). */
const PRIMAL = new Set(['desolateland', 'primordialsea']);
/** Abilitatori "di passaggio": la condizione è un effetto secondario (Chilly Reception serve a cambiare). */
const INCIDENTAL = new Set(['chillyreception']);
const isPrimal = (link: ConditionLink) => PRIMAL.has(toID(link.via));
const isIncidental = (link: ConditionLink) => INCIDENTAL.has(toID(link.via));
/**
 * Campo portato da un'abilità (Misty Surge di Tapu Fini): non è una scelta e aiuta comunque tutto il team
 * (niente stati, niente priorità, cure, niente sonno), anche senza compagni che lo sfruttino.
 */
const isTerrainAbility = (link: ConditionLink) =>
  link.condition.endsWith('terrain') && dex.abilities.get(link.via).exists;

export interface ConditionLink {
  condition: Condition;
  via: string;
}

const nameOf = (id: string) => getMove(id)?.name ?? id;

/** Abilità e mosse (id) che portano o sfruttano la condizione. */
export function conditionTools(condition: Condition): Rule {
  return RULES[condition];
}

export function enables(set: TeamSet): ConditionLink[] {
  const ability = battleAbility(set);
  const moveIds = set.moves.map(toID);
  const links: ConditionLink[] = [];
  for (const condition of CONDITIONS) {
    const rule = RULES[condition];
    if (rule.enablerAbilities.includes(toID(ability))) links.push({ condition, via: ability });
    else {
      const move = moveIds.find(id => rule.enablerMoves.includes(id));
      if (move) links.push({ condition, via: nameOf(move) });
    }
  }
  return links;
}

export function benefits(set: TeamSet): ConditionLink[] {
  const ability = battleAbility(set);
  const moveIds = set.moves.map(toID);
  const links: ConditionLink[] = [];
  for (const condition of CONDITIONS) {
    const rule = RULES[condition];
    if (rule.benefitAbilities.includes(toID(ability))) links.push({ condition, via: ability });
    else {
      const move = moveIds.find(id => rule.benefitMoves.includes(id));
      if (move) links.push({ condition, via: nameOf(move) });
    }
  }
  const species = battleSpecies(set);
  if (species && species.baseStats.spe <= TRICK_ROOM_SPEED && attackStyle(set) !== 'none') {
    links.push({ condition: 'trickroom', via: SLOW });
  }
  return links;
}

export interface MechanicalLink {
  text: string;
  /** "Abilita Venusaur", "Abilitato da Ninetales": per le caselle della lista. */
  short: string;
}

/** Legami meccanici tra un candidato e i membri: chi lo abilita e chi abilita lui. */
export function mechanicalLinks(candidate: TeamSet, team: TeamSet[], lang: Lang = 'it'): MechanicalLink[] {
  const links: MechanicalLink[] = [];
  // Weather Ball e Terrain Pulse funzionano con qualunque meteo/campo: non bastano per un legame
  const specific = (set: TeamSet) => benefits(set).filter(b => !GENERIC_MOVES.has(toID(b.via)));
  const candidateBenefits = specific(candidate);
  for (const member of team) {
    const enabler = enables(member).find(e => candidateBenefits.some(b => b.condition === e.condition));
    if (enabler) {
      const benefit = candidateBenefits.find(b => b.condition === enabler.condition)!;
      links.push({
        text: t(lang, 'synergy.enabledBy', { member: battleName(member), via: viaName(enabler.via, lang), benefit: viaName(benefit.via, lang) }),
        short: t(lang, 'synergy.enabledBy.short', { member: battleName(member) }),
      });
    }
  }
  const candidateEnables = enables(candidate);
  for (const member of team) {
    const memberBenefits = specific(member);
    const enabler = candidateEnables.find(e => memberBenefits.some(b => b.condition === e.condition));
    if (enabler) {
      const benefit = memberBenefits.find(b => b.condition === enabler.condition)!;
      links.push({
        text: t(lang, 'synergy.enables', { member: battleName(member), via: viaName(enabler.via, lang), benefit: viaName(benefit.via, lang) }),
        short: t(lang, 'synergy.enables.short', { member: battleName(member) }),
      });
    }
  }
  return links;
}

export interface TeamConditionIssue {
  member: string;
  condition: Condition;
  via: string;
}

/** Tipo di mossa potenziato dalla condizione (il sole potenzia Fire, la pioggia Water…). */
const BOOSTED_TYPE: Partial<Record<Condition, TypeName>> = {
  sun: 'Fire', rain: 'Water', electricterrain: 'Electric', psychicterrain: 'Psychic', grassyterrain: 'Grass',
};

/** Sabbia e neve rinforzano le difese dei tipi Roccia (Dif. Sp.) e Ghiaccio (Dif.). */
const DEFENDED_TYPE: Partial<Record<Condition, string>> = { sand: 'Rock', snow: 'Ice' };

/** L'abilitatore sfrutta da sé la condizione (mosse potenziate, difese, Weather Ball, Solar Beam, velocità bassa in Trick Room). */
function boostsItself(set: TeamSet, condition: Condition): boolean {
  if (benefits(set).some(b => b.condition === condition)) return true;
  if (SELF_BOOST_ENABLERS.has(toID(battleAbility(set)))) return true;
  const defended = DEFENDED_TYPE[condition];
  if (defended && ((battleSpecies(set)?.types ?? []) as readonly string[]).includes(defended)) return true;
  const boosted = BOOSTED_TYPE[condition];
  return !!boosted && attackingMoves(set).some(m => m.type === boosted);
}

/** Membri che portano un meteo/campo/Trick Room che nessuno sfrutta, nemmeno loro stessi. */
export function unusedEnablers(team: TeamSet[]): TeamConditionIssue[] {
  const specific = (set: TeamSet) => benefits(set).filter(b => !GENERIC_MOVES.has(toID(b.via)));
  return team.flatMap(member => {
    const usedByOthers = new Set(team.filter(o => o !== member).flatMap(specific).map(b => b.condition));
    return enables(member)
      .filter(e => !isPrimal(e) && !isIncidental(e) && !isTerrainAbility(e))
      .filter(e => !usedByOthers.has(e.condition) && !CHIP.includes(e.condition) && !boostsItself(member, e.condition))
      .map(e => ({ member: battleName(member), ...e }));
  });
}

/** Membri che dipendono da una condizione che nessuno nel team porta. */
export function unmetBeneficiaries(team: TeamSet[]): TeamConditionIssue[] {
  const available = new Set(team.flatMap(enables).map(e => e.condition));
  return team.flatMap(member =>
    benefits(member)
      .filter(b => !available.has(b.condition))
      .filter(b => !GENERIC_MOVES.has(toID(b.via)))
      .filter(b => !PARADOX.has(toID(b.via)) && !OPTIONAL_MOVES.has(toID(b.via)) && !PASSIVE_ABILITIES.has(toID(b.via)))
      .filter(b => !(POWER_HERB_MOVES.has(toID(b.via)) && toID(member.item) === 'powerherb'))
      .filter(b => b.via !== SLOW)
      .map(b => ({ member: battleName(member), ...b })));
}

/** Sinergie già attive nel team, una riga per abilitatore: "Ninetales (Drought) → Leafeon (Chlorophyll)". */
export function teamSynergies(team: TeamSet[], lang: Lang = 'it'): string[] {
  const lines: string[] = [];
  for (const member of team) {
    for (const enabler of enables(member)) {
      const beneficiaries = team
        .filter(other => other !== member)
        .map(other => ({
          other,
          benefit: benefits(other).find(b => b.condition === enabler.condition && !GENERIC_MOVES.has(toID(b.via))),
        }))
        .filter(x => x.benefit)
        .map(x => `${battleName(x.other)} (${viaName(x.benefit!.via, lang)})`);
      if (beneficiaries.length) lines.push(`${battleName(member)} (${viaName(enabler.via, lang)}) → ${beneficiaries.join(', ')}`);
    }
  }
  return lines;
}

/** Condizioni che dimezzano i danni di un tipo: il sole Water, la pioggia Fire, i campi su chi tocca terra. */
const MITIGATIONS: Partial<Record<Condition, { type: TypeName; groundedOnly: boolean }>> = {
  sun: { type: 'Water', groundedOnly: false },
  rain: { type: 'Fire', groundedOnly: false },
  grassyterrain: { type: 'Ground', groundedOnly: true },
  mistyterrain: { type: 'Dragon', groundedOnly: true },
};

function isGrounded(set: TeamSet): boolean {
  const species = battleSpecies(set);
  return !(species?.types as readonly string[] | undefined)?.includes('Flying')
    && toID(battleAbility(set)) !== 'levitate' && toID(set.item) !== 'airballoon';
}

export interface WeatherMitigation {
  condition: Condition;
  /** Chi porta la condizione, es. "Ninetales (Drought)". */
  source: string;
  type: TypeName;
  members: { species: string; from: number; to: number }[];
}

/** Debolezze del team smorzate dal meteo o dal campo che il team stesso porta. */
export function weatherMitigations(team: TeamSet[]): WeatherMitigation[] {
  const seen = new Set<Condition>();
  return team.flatMap(enabler => enables(enabler).map(e => {
    const effect = MITIGATIONS[e.condition];
    if (!effect || seen.has(e.condition)) return null;
    seen.add(e.condition);
    const members = team
      .filter(m => !isPrimal(e) || m === enabler)
      .filter(m => !effect.groundedOnly || isGrounded(m))
      .map(m => ({ species: battleName(m), from: defensiveMultiplier(effect.type, m) }))
      .filter(m => m.from > 1)
      .map(m => ({ ...m, to: m.from / 2 }));
    return members.length ? { condition: e.condition, source: `${battleName(enabler)} (${e.via})`, type: effect.type, members } : null;
  })).filter(isDefined);
}

const WEATHERS: Condition[] = ['sun', 'rain', 'sand', 'snow'];
const TERRAINS: Condition[] = ['electricterrain', 'psychicterrain', 'grassyterrain', 'mistyterrain'];

export interface ConditionConflict {
  kind: 'meteo' | 'campi';
  /** Chi porta le condizioni in conflitto, es. "Ninetales (Drought)". */
  setters: string[];
}

/**
 * Meteo (o campi) diversi nello stesso team si sovrascrivono a vicenda. È un conflitto solo se qualcuno nel team
 * sfrutta una delle condizioni (Swift Swim, Hurricane, Solar Beam…): due meteo automatici che si annullano senza
 * nessuno che ne dipenda (Kyogre + Koraidon) sono una scelta normale, non un errore (2026-10-30).
 */
export function conditionConflicts(team: TeamSet[], lang: Lang = 'it'): ConditionConflict[] {
  const groups: [ConditionConflict['kind'], Condition[]][] = [['meteo', WEATHERS], ['campi', TERRAINS]];
  const used = new Set(team.flatMap(benefits).filter(b => !GENERIC_MOVES.has(toID(b.via))).map(b => b.condition));
  return groups.flatMap(([kind, group]) => {
    const setters = team.flatMap(member =>
      enables(member)
        .filter(e => group.includes(e.condition) && !isIncidental(e))
        .map(e => ({ condition: e.condition, primal: isPrimal(e), label: `${battleName(member)} (${viaName(e.via, lang)})` })));
    // Due meteo primordiali non si incontrano mai (ognuno sparisce quando esce chi lo porta)
    const clash = setters.some(a => setters.some(b => a.condition !== b.condition && !(a.primal && b.primal)));
    const dependent = setters.some(s => used.has(s.condition));
    return clash && dependent ? [{ kind, setters: setters.map(s => s.label) }] : [];
  });
}

/** Il sole dimezza le mosse Water, la pioggia le Fire (Hydro Steam fa eccezione). */
const WEAKENED_TYPE: Partial<Record<Condition, TypeName>> = { sun: 'Water', rain: 'Fire' };

export interface WeakenedMove {
  condition: Condition;
  setter: string;
  member: string;
  type: TypeName;
  /** Vero se le mosse indebolite sono del tipo del membro (STAB). */
  stab: boolean;
}

/**
 * Membri le cui mosse sono indebolite dal meteo portato dal team stesso. Chi porta un altro meteo (Groudon con
 * Kyogre nel team) non conta: quando è in campo ha il suo.
 */
export function weakenedMoves(team: TeamSet[]): WeakenedMove[] {
  const seen = new Set<Condition>();
  const result: WeakenedMove[] = [];
  for (const setter of team) {
    for (const e of enables(setter)) {
      const type = WEAKENED_TYPE[e.condition];
      if (!type || seen.has(e.condition)) continue;
      seen.add(e.condition);
      for (const member of team) {
        if (isPrimal(e) && member !== setter) continue;
        if (enables(member).some(own => WEATHERS.includes(own.condition) && own.condition !== e.condition)) continue;
        const hit = attackingMoves(member).some(m => m.type === type && toID(m.name) !== 'hydrosteam');
        if (!hit) continue;
        const stab = ((battleSpecies(member)?.types ?? []) as readonly string[]).includes(type);
        result.push({ condition: e.condition, setter: battleName(setter), member: battleName(member), type, stab });
      }
    }
  }
  return result;
}

export interface NeededCondition {
  condition: Condition;
  beneficiaries: { species: string; via: string }[];
}

/**
 * Condizioni portate da team[index] di cui altri membri hanno davvero bisogno
 * (es. il sole di Ninetales per il Chlorophyll di Leafeon). Weather Ball, Terrain Pulse
 * e i Paradox non contano: funzionano anche senza.
 */
export function neededConditions(team: TeamSet[], index: number): NeededCondition[] {
  const others = team.filter((_, i) => i !== index);
  // Se un altro membro porta già la condizione (anche chi ne beneficia, come Charizard Mega Y con Drought), non dipende da questo
  const kept = new Set(others.flatMap(member => enables(member).map(e => e.condition)));
  return enables(team[index])
    .filter(e => !kept.has(e.condition))
    .map(e => ({
      condition: e.condition,
      beneficiaries: others.flatMap(member => {
        const benefit = benefits(member).find(b =>
          b.condition === e.condition && !GENERIC_MOVES.has(toID(b.via)) && !PARADOX.has(toID(b.via)));
        return benefit ? [{ species: battleName(member), via: benefit.via }] : [];
      }),
    }))
    .filter(n => n.beneficiaries.length > 0);
}

/** Vero se il set porta tutte le condizioni richieste. */
export function providesAll(set: TeamSet, needed: NeededCondition[]): boolean {
  const provided = new Set(enables(set).map(e => e.condition));
  return needed.every(n => provided.has(n.condition));
}

/**
 * Il set va contro il meteo `weather`: ne porta un altro, o ha un'abilità che dipende da un altro meteo
 * (Swift Swim in un team neve). Protosynthesis e Quark Drive no: funzionano con la Booster Energy.
 */
export function opposesWeather(set: TeamSet, weather: Condition): boolean {
  if (!WEATHERS.includes(weather)) return false;
  const ability = toID(battleAbility(set));
  return enables(set).some(e => WEATHERS.includes(e.condition) && e.condition !== weather)
    || benefits(set).some(b => WEATHERS.includes(b.condition) && b.condition !== weather && toID(b.via) === ability && !PARADOX.has(ability));
}

/** Setter del team il cui meteo (o campo) è diverso da quello che porterebbe il candidato. */
export function clashesWith(candidate: TeamSet, team: TeamSet[], lang: Lang = 'it'): string[] {
  const groups = [WEATHERS, TERRAINS];
  const result: string[] = [];
  for (const own of enables(candidate)) {
    const group = groups.find(g => g.includes(own.condition));
    if (!group) continue;
    for (const member of team) {
      for (const other of enables(member)) {
        if (group.includes(other.condition) && other.condition !== own.condition) {
          result.push(`${battleName(member)} (${viaName(other.via, lang)})`);
        }
      }
    }
  }
  return [...new Set(result)];
}
