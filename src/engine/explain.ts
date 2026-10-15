import { ROLE_LABELS, type Role } from './roles';
import type { TypeName } from './types';
import { WEIGHTS, type ComponentKey } from './weights';

export type Components = Record<ComponentKey, number>;

export interface Facts {
  defense: { immune: TypeName[]; covered: TypeName[]; sharedWeak: TypeName[] };
  threats: { checked: string[] };
  coverage: { types: TypeName[] };
  roles: { filled: Role[]; style: 'physical' | 'special' | null };
  synergy: { member: string; pct: number } | null;
  /** Legami meccanici con il team (meteo, campi, Trick Room). */
  mechanical: string[];
  /** Avvisi: meteo in conflitto, mosse indebolite dal meteo del team. */
  clashes: string[];
  strength: { usage: number };
}

export interface Reason {
  component: ComponentKey;
  weight: number;
  text: string;
}

const STYLE_LABELS = { physical: 'fisico', special: 'speciale' } as const;
const list = (items: string[]) => items.join(', ');
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function explain(facts: Facts, components: Components): Reason[] {
  const reasons: Reason[] = [];
  const add = (component: ComponentKey, text: string) =>
    reasons.push({ component, weight: WEIGHTS[component] * components[component], text });

  const { immune, covered } = facts.defense;
  if (immune.length || covered.length) {
    const parts = [
      immune.length ? `immune a ${list(immune)}` : '',
      covered.length ? `resiste a ${list(covered)}` : '',
    ].filter(Boolean);
    add('defense', `${capitalize(parts.join(' e '))}: debolezze del team`);
  }
  if (facts.threats.checked.length) add('threats', `Ferma ${list(facts.threats.checked)}`);
  if (facts.coverage.types.length) {
    add('coverage', `Colpisce super efficace ${list(facts.coverage.types)}, scoperti dal team`);
  }
  const roles = facts.roles.filled.map(role => ROLE_LABELS[role]);
  if (facts.roles.style) roles.push(`attaccante ${STYLE_LABELS[facts.roles.style]}`);
  if (roles.length) add('roles', `Porta ${list(roles)} (mancanti nel team)`);
  for (const text of facts.mechanical) add('synergy', text);
  // Gli avvisi vanno in fondo: peso negativo
  for (const text of facts.clashes) reasons.push({ component: 'synergy', weight: -1, text });
  if (facts.synergy && facts.synergy.pct >= 0.05) {
    add('synergy', `Usato con ${facts.synergy.member} nel ${Math.round(facts.synergy.pct * 100)}% dei team`);
  }
  if (facts.strength.usage > 0) add('strength', `Uso nel meta: ${(facts.strength.usage * 100).toFixed(1)}%`);

  return reasons.sort((a, b) => b.weight - a.weight);
}
