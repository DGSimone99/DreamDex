import { roleLabel, type Role } from './roles';
import { formatPercent, t, type Lang } from '../i18n';
import { typeName } from '../i18n/game';
import type { TypeName } from './types';
import { WEIGHTS, type ComponentKey } from './weights';

export type Components = Record<ComponentKey, number>;

export interface Facts {
  defense: { immune: TypeName[]; covered: TypeName[]; sharedWeak: TypeName[] };
  threats: { checked: string[] };
  coverage: { types: TypeName[] };
  roles: { filled: Role[] };
  synergy: { member: string; pct: number } | null;
  /** Legami meccanici con il team (meteo, campi, Trick Room): testo lungo e breve, e il segno per le caselle. */
  mechanical: { text: string; short: string; symbol?: ReasonSymbol }[];
  /** Avvisi: meteo in conflitto, mosse indebolite dal meteo del team. */
  clashes: string[];
  strength: { usage: number };
}

/**
 * La forma a segni di una ragione, per le caselle della lista (al posto delle parole, che non ci entrano):
 * ⚔️ + icone dei tipi colpiti, 🛡️ + icone dei tipi retti (gli immuni a parte), "vs" + chi ferma, 🔗 + il membro legato.
 * Tipi in inglese e nomi dei Pokémon: niente lingua qui, le parole le mette chi disegna.
 */
export type ReasonSymbol =
  | { kind: 'coverage'; types: TypeName[] }
  | { kind: 'defense'; immune: TypeName[]; resists: TypeName[] }
  | { kind: 'threats'; species: string[] }
  | { kind: 'link'; species: string };

export interface Reason {
  component: ComponentKey;
  weight: number;
  text: string;
  /** La forma breve, per le caselle della lista (una riga): "Resiste ad Acqua", "Abilita Venusaur". */
  short: string;
  /** La forma a segni per le caselle (il testo lungo resta come testo nascosto e tooltip); senza, la forma breve. */
  symbol?: ReasonSymbol;
  /** "Usato con X nel N% dei team": nelle caselle della lista lo dice già il segno ciano, nel dettaglio va in fondo. */
  usedWith?: true;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const list = (items: string[]) => items.join(', ');
/** In italiano "ad" davanti alla A: "resiste ad Acqua", "immune ad Acciaio". */
const euphony = (text: string, lang: Lang) => (lang === 'it' ? text.replace(/\b(immune|resiste) a (?=A)/g, '$1 ad ') : text);

/** La ragione che pesa di più (il bonus principale di un candidato da aggiungere). */
export const topReason = (reasons: Reason[]): Reason | undefined =>
  reasons.reduce<Reason | undefined>((best, reason) => (!best || reason.weight > best.weight ? reason : best), undefined);

export function explain(facts: Facts, components: Components, lang: Lang = 'it'): Reason[] {
  const reasons: Reason[] = [];
  const add = (component: ComponentKey, text: string, short = text, symbol?: ReasonSymbol) =>
    reasons.push({ component, weight: WEIGHTS[component] * components[component], text, short, ...(symbol && { symbol }) });
  const types = (items: string[]) => list(items.map(type => typeName(type, lang)));

  const { immune, covered } = facts.defense;
  if (immune.length || covered.length) {
    const parts = [
      immune.length ? t(lang, 'explain.immune', { types: types(immune) }) : '',
      covered.length ? t(lang, 'explain.resists', { types: types(covered) }) : '',
    ].filter(Boolean);
    const text = capitalize(euphony(parts.length === 2 ? t(lang, 'explain.and', { a: parts[0], b: parts[1] }) : parts[0], lang));
    add('defense', t(lang, 'explain.defense', { text }), text, { kind: 'defense', immune, resists: covered });
  }
  if (facts.threats.checked.length) {
    const text = t(lang, 'explain.threats', { list: list(facts.threats.checked) });
    add('threats', text, text, { kind: 'threats', species: facts.threats.checked });
  }
  if (facts.coverage.types.length) {
    const hit = types(facts.coverage.types);
    add('coverage', t(lang, 'explain.coverage', { types: hit }), t(lang, 'explain.coverage.short', { types: hit }), { kind: 'coverage', types: facts.coverage.types });
  }
  const roles = facts.roles.filled.map(role => roleLabel(role, lang));
  if (roles.length) add('roles', t(lang, 'explain.roles', { list: list(roles) }), t(lang, 'explain.roles.short', { list: list(roles) }));
  for (const link of facts.mechanical) add('synergy', link.text, link.short, link.symbol);
  // Gli avvisi vanno in fondo: peso negativo
  for (const text of facts.clashes) reasons.push({ component: 'synergy', weight: -1, text, short: text });
  if (facts.synergy && facts.synergy.pct >= 0.05) {
    const text = t(lang, 'explain.synergy', { member: facts.synergy.member, pct: Math.round(facts.synergy.pct * 100) });
    reasons.push({ component: 'synergy', weight: WEIGHTS.synergy * components.synergy, text, short: text, usedWith: true });
  }
  if (facts.strength.usage > 0) add('strength', t(lang, 'explain.usage', { pct: formatPercent(lang, facts.strength.usage) }));

  return reasons.sort((a, b) => b.weight - a.weight);
}
