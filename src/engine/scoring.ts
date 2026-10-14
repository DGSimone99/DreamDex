import { analyzeTeam, checksThreat, type TeamAnalysis } from './analysis';
import type { EngineData } from './data';
import { battleName, getSpecies, isAllowed, isDefined, isMega, toID } from './dex';
import { explain, type Components, type Facts, type Reason } from './explain';
import type { Format } from './format';
import { attackStyle, detectRoles, ESSENTIAL_ROLES, type Role } from './roles';
import { defaultSet, type TeamSet } from './sets';
import { teammatePct, usageOf } from './stats';
import { defensiveMultiplier, superEffectiveMove } from './types';
import { COMPONENT_KEYS, WEIGHTS } from './weights';

export type { Components, Facts, Reason };

export interface Suggestion {
  species: string;
  set: TeamSet;
  score: number;
  components: Components;
  facts: Facts;
  reasons: Reason[];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function candidatePool(team: TeamSet[], format: Format, data: EngineData): string[] {
  if (!data.stats) return [];
  const teamNumbers = new Set(team.map(set => getSpecies(set.species)?.num).filter(isDefined));
  return Object.entries(data.stats.pokemon)
    .filter(([, entry]) => entry.usage >= format.minUsage)
    .map(([name]) => getSpecies(name))
    .filter(isDefined)
    .filter(species => isAllowed(species, format) && !teamNumbers.has(species.num))
    .map(species => species.name);
}

function defenseComponent(set: TeamSet, analysis: TeamAnalysis) {
  const facts: Facts['defense'] = { immune: [], covered: [], sharedWeak: [] };
  let raw = 0;
  for (const row of analysis.weakness) {
    const mult = defensiveMultiplier(row.type, set);
    if (row.pressure > 0) {
      if (mult < 1) {
        raw += row.pressure;
        (mult === 0 ? facts.immune : facts.covered).push(row.type);
      } else if (mult > 1) {
        raw -= row.pressure;
        facts.sharedWeak.push(row.type);
      }
    } else if (mult > 1 && row.weak > 0 && row.weak >= row.resist) {
      raw -= 0.5;
      facts.sharedWeak.push(row.type);
    }
  }
  const total = sum(analysis.weakness.map(row => row.pressure));
  return { value: clamp01(0.5 + (0.5 * raw) / Math.max(1, total)), facts };
}

function threatsComponent(set: TeamSet, analysis: TeamAnalysis, data: EngineData) {
  const open = analysis.threats.filter(t => t.handledBy.length === 0 && toID(t.name) !== toID(battleName(set)));
  const checked = open.filter(t => checksThreat(data, set, t.name));
  const total = sum(open.map(t => t.usage));
  return {
    value: total > 0 ? sum(checked.map(t => t.usage)) / total : 0,
    facts: { checked: checked.map(t => t.name) },
  };
}

function coverageComponent(set: TeamSet, analysis: TeamAnalysis) {
  const open = analysis.coverage.filter(row => row.hitters.length === 0).map(row => row.type);
  const types = open.filter(type => superEffectiveMove(set, type) !== null);
  const total = sum(open.map(type => analysis.typeWeights[type]));
  return {
    value: total > 0 ? sum(types.map(type => analysis.typeWeights[type])) / total : 0,
    facts: { types },
  };
}

function rolesComponent(set: TeamSet, analysis: TeamAnalysis) {
  const roleWeight = (role: Role) => (ESSENTIAL_ROLES.includes(role) ? 1 : 0.5);
  const { missingRoles, needStyle } = analysis.needs;
  const candidateRoles = detectRoles(set);
  const filled = missingRoles.filter(role => candidateRoles.includes(role));
  const style = needStyle && attackStyle(set) === needStyle ? needStyle : null;
  const total = sum(missingRoles.map(roleWeight)) + (needStyle ? 0.5 : 0);
  const gained = sum(filled.map(roleWeight)) + (style ? 0.5 : 0);
  return { value: total > 0 ? gained / total : 0, facts: { filled, style } };
}

function synergyRaw(set: TeamSet, team: TeamSet[], data: EngineData) {
  if (team.length === 0) return { raw: 0, best: null };
  const pcts = team.map(member => ({ member: member.species, pct: teammatePct(data.stats, battleName(member), battleName(set)) }));
  const best = pcts.reduce((a, b) => (b.pct > a.pct ? b : a));
  return { raw: sum(pcts.map(p => p.pct)) / team.length, best: best.pct > 0 ? best : null };
}

const LOG_MIN = Math.log(0.001);
const LOG_MAX = Math.log(0.5);
export function strengthComponent(usage: number): number {
  return usage > 0 ? clamp01((Math.log(usage) - LOG_MIN) / (LOG_MAX - LOG_MIN)) : 0;
}

const NO_FACTS = (usage: number): Facts => ({
  defense: { immune: [], covered: [], sharedWeak: [] },
  threats: { checked: [] },
  coverage: { types: [] },
  roles: { filled: [], style: null },
  synergy: null,
  strength: { usage },
});

export function scoreCandidates(team: TeamSet[], format: Format, data: EngineData, extraSets: TeamSet[] = []): Suggestion[] {
  const analysis = analyzeTeam(team, data);
  const megaTaken = !format.allowMultipleMegas && team.some(isMega);
  const extraIds = new Set(extraSets.map(set => toID(battleName(set))));
  const entries = [
    ...candidatePool(team, format, data)
      .filter(species => !extraIds.has(toID(species)))
      .map(species => ({ species, set: defaultSet(data, species) }))
      .filter(({ set }) => !(megaTaken && isMega(set))),
    ...extraSets.map(set => ({ species: set.species, set })),
  ];
  const partial = entries.map(({ species, set }) => {
    const usage = usageOf(data.stats, battleName(set));
    if (team.length === 0) return { species, set, usage, empty: true as const };
    return {
      species, set, usage, empty: false as const,
      defense: defenseComponent(set, analysis),
      threats: threatsComponent(set, analysis, data),
      coverage: coverageComponent(set, analysis),
      roles: rolesComponent(set, analysis),
      synergy: synergyRaw(set, team, data),
    };
  });
  const maxSynergy = Math.max(0, ...partial.map(p => (p.empty ? 0 : p.synergy.raw)));

  return partial
    .map((p): Suggestion => {
      const strength = strengthComponent(p.usage);
      if (p.empty) {
        const components: Components = { defense: 0, threats: 0, coverage: 0, roles: 0, synergy: 0, strength };
        const facts = NO_FACTS(p.usage);
        return { species: p.species, set: p.set, score: Math.round(100 * strength), components, facts, reasons: explain(facts, components) };
      }
      const components: Components = {
        defense: p.defense.value,
        threats: p.threats.value,
        coverage: p.coverage.value,
        roles: p.roles.value,
        synergy: maxSynergy > 0 ? p.synergy.raw / maxSynergy : 0,
        strength,
      };
      const facts: Facts = {
        defense: p.defense.facts,
        threats: p.threats.facts,
        coverage: p.coverage.facts,
        roles: p.roles.facts,
        synergy: p.synergy.best,
        strength: { usage: p.usage },
      };
      const score = Math.round(100 * sum(COMPONENT_KEYS.map(key => WEIGHTS[key] * components[key])));
      return { species: p.species, set: p.set, score, components, facts, reasons: explain(facts, components) };
    })
    .sort((a, b) => b.score - a.score || usageOf(data.stats, battleName(b.set)) - usageOf(data.stats, battleName(a.set)));
}

export function suggest(team: TeamSet[], format: Format, data: EngineData, limit = 20): Suggestion[] {
  if (team.length >= 6) return [];
  return scoreCandidates(team, format, data).slice(0, limit);
}
