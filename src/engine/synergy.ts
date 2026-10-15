import { battleAbility, battleSpecies, getMove, toID } from './dex';
import { attackStyle } from './roles';
import type { TeamSet } from './sets';

export type Condition =
  | 'sun' | 'rain' | 'sand' | 'snow'
  | 'electricterrain' | 'psychicterrain' | 'grassyterrain' | 'mistyterrain'
  | 'trickroom';

/** Come la condizione compare nelle frasi: "il team non porta il sole". */
export const CONDITION_LABELS: Record<Condition, string> = {
  sun: 'il sole',
  rain: 'la pioggia',
  sand: 'la sabbia',
  snow: 'la neve',
  electricterrain: 'il Campo Elettrico',
  psychicterrain: 'il Campo Psichico',
  grassyterrain: 'il Campo Erboso',
  mistyterrain: 'il Campo Nebbioso',
  trickroom: 'Trick Room',
};

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

const CONDITIONS = Object.keys(RULES) as Condition[];

/** Attaccanti con velocità base fino a questa soglia beneficiano di Trick Room. */
export const TRICK_ROOM_SPEED = 50;
const SLOW = 'Velocità bassa';

/** Mosse che sfruttano qualunque meteo o campo: non bastano da sole a dire "manca la condizione". */
const GENERIC_MOVES = new Set(['weatherball', 'terrainpulse']);
/** Abilità Paradox: il meteo/campo è un bonus, funzionano anche senza (Booster Energy o nessun boost). */
const PARADOX = new Set(['protosynthesis', 'quarkdrive']);

export interface ConditionLink {
  condition: Condition;
  via: string;
}

const nameOf = (id: string) => getMove(id)?.name ?? id;

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
}

/** Legami meccanici tra un candidato e i membri: chi lo abilita e chi abilita lui. */
export function mechanicalLinks(candidate: TeamSet, team: TeamSet[]): MechanicalLink[] {
  const links: MechanicalLink[] = [];
  // Weather Ball e Terrain Pulse funzionano con qualunque meteo/campo: non bastano per un legame
  const specific = (set: TeamSet) => benefits(set).filter(b => !GENERIC_MOVES.has(toID(b.via)));
  const candidateBenefits = specific(candidate);
  for (const member of team) {
    const enabler = enables(member).find(e => candidateBenefits.some(b => b.condition === e.condition));
    if (enabler) {
      const benefit = candidateBenefits.find(b => b.condition === enabler.condition)!;
      links.push({ text: `Abilitato da ${member.species} (${enabler.via}): ${benefit.via}` });
    }
  }
  const candidateEnables = enables(candidate);
  for (const member of team) {
    const memberBenefits = specific(member);
    const enabler = candidateEnables.find(e => memberBenefits.some(b => b.condition === e.condition));
    if (enabler) {
      const benefit = memberBenefits.find(b => b.condition === enabler.condition)!;
      links.push({ text: `Abilita ${member.species}: ${enabler.via} → ${benefit.via}` });
    }
  }
  return links;
}

export interface TeamConditionIssue {
  member: string;
  condition: Condition;
  via: string;
}

/** Membri che portano un meteo/campo/Trick Room che nessuno nel team sfrutta. */
export function unusedEnablers(team: TeamSet[]): TeamConditionIssue[] {
  const used = new Set(team.flatMap(benefits).map(b => b.condition));
  return team.flatMap(member =>
    enables(member).filter(e => !used.has(e.condition)).map(e => ({ member: member.species, ...e })));
}

/** Membri che dipendono da una condizione che nessuno nel team porta. */
export function unmetBeneficiaries(team: TeamSet[]): TeamConditionIssue[] {
  const available = new Set(team.flatMap(enables).map(e => e.condition));
  return team.flatMap(member =>
    benefits(member)
      .filter(b => !available.has(b.condition))
      .filter(b => !GENERIC_MOVES.has(toID(b.via)))
      .filter(b => !PARADOX.has(toID(b.via)))
      .filter(b => b.via !== SLOW)
      .map(b => ({ member: member.species, ...b })));
}
