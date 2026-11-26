import { battleAbility, battleSpecies, getMove, toID } from './dex';
import { orbStatus } from './damage';
import { memberPower } from './power';
import { detectRoles, hasSetup, isFast, isPassive, isStall, legacyRoles, shownRoles, type ShownRole } from './roles';
import { ATTACKER_ROLES, FAMILIES, primaryFamily, rolesListFor, setSubRoles, type SubRole, type SubRoleValues } from './subRoles';
import { isOneType, type FormatRules } from './formatRules';
import type { TeamSet } from './sets';
import { benefits, enables, usesCondition, type Condition } from './synergy';
import { isTank, TANK_BRAKE } from './tank';

/** Archetipi di Smogon, dal più offensivo al più difensivo; 'doubles' è il tipo unico del doppio (formatRules.ts, 'oneType'). */
export type Archetype = 'hyperOffense' | 'bulkyOffense' | 'balance' | 'semiStall' | 'stall' | 'doubles';
/** I cinque tipi del singolo: quelli che l'interfaccia elenca e fa scegliere. */
export type SinglesArchetype = Exclude<Archetype, 'doubles'>;
/**
 * Stili: meteo e Trick Room (Webs, Volt-turn e Screens tolti: non dicevano niente di più dei ruoli). I quattro campi e
 * Tailwind sono stili solo in doppio (doublesStyle).
 */
export type TeamStyle = 'rain' | 'sun' | 'sand' | 'snow' | 'trickroom'
  | 'grassyterrain' | 'psychicterrain' | 'electricterrain' | 'mistyterrain' | 'tailwind';

export interface TeamArchetype {
  archetype: Archetype;
  /** Al massimo MAX_STYLES stili (meteo, Trick Room); in doppio al massimo uno (anche un campo o Tailwind). */
  styles: TeamStyle[];
}

export const MAX_STYLES = 2;
/** Robustezza media (percentile) sotto cui un team offensivo non è "bulky". */
const BULKY = 55;
/** …e sotto cui un team senza muri passivi è Hyper Offense. */
const FRAIL = 65;
/** Membri veloci (o con un setup che alza la velocità) da cui un team senza muri passivi è Hyper Offense anche se robusto (Ubers). */
const HO_FAST_MEMBERS = 5;

const HEAL_MOVES = new Set([
  'recover', 'roost', 'softboiled', 'slackoff', 'wish', 'rest', 'moonlight', 'synthesis', 'morningsun',
  'strengthsap', 'shoreup', 'milkdrink',
]);
const HEAL_ABILITIES = new Set(['regenerator', 'poisonheal']);
const CONDITION_STYLES: [Condition, TeamStyle][] = [['rain', 'rain'], ['sun', 'sun'], ['sand', 'sand'], ['snow', 'snow'], ['trickroom', 'trickroom']];

const poisonHealer = (set: TeamSet) => toID(battleAbility(set)) === 'poisonheal' && orbStatus(set) === 'tox';
const heals = (set: TeamSet) => set.moves.some(m => HEAL_MOVES.has(toID(m))) || HEAL_ABILITIES.has(toID(battleAbility(set)));
/** Veloce di suo (statistica, Scarf, abilità) o con una mossa che gli alza la velocità (Dragon Dance, Quiver Dance…). */
const fastOrSpeedSetup = (set: TeamSet) => isFast(set)
  || set.moves.some(m => { const move = getMove(m); return move?.category === 'Status' && move.target === 'self' && (move.boosts?.spe ?? 0) > 0; });

/**
 * Soglie della regola di National Dex OU (typeRule 'recoverySpeed'), sul punteggio
 * membri con una mossa di recupero (o Poison Heal con Toxic Orb) − velocità base media / 15: sotto la prima Hyper Offense, poi Bulky Offense,
 * Balance e Semi-stall. Tarate il 2026-11-05 sui 102 team di National Dex OU del banco di cui l'autore ha scritto il tipo:
 * 83% di giusti (80% su team lasciati fuori dalla taratura), contro il 74% della regola dei muri. Il recupero spinge verso
 * la difesa; la velocità verso l'attacco. La robustezza media delle statistiche separava peggio di tutte:
 * Garchomp e Mega Gardevoir sono robusti di natura ma attaccano. La Scarf e il meteo provati: peggio.
 * Fra Balance e Semi-stall conta solo il recupero di chi non attacca: Dragonite con Dragon Dance e Roost o Gholdengo con
 * Recover non rendono un Balance un Semi-stall (sul banco gli stessi giusti; il Balance Tusk, Gholdengo, Toxapex,
 * Corviknight, Dragonite, Kingambit tornava Semi-stall). Per HO e BO conta tutto il recupero: tolto anche lì, peggio.
 */
const RECOVERY_SPEED_CUTS = { hyperOffense: -5.11, bulkyOffense: -3.69, balance: -1.31 };
/** Dove il freno dei tank porta un team che sarebbe Hyper Offense: a metà della fascia Bulky Offense. */
const TANK_BRAKE_SCORE = (RECOVERY_SPEED_CUTS.hyperOffense + RECOVERY_SPEED_CUTS.bulkyOffense) / 2;
/** Il membro attacca (famiglia principale Attacco, o un sotto-ruolo d'attacco da almeno 0,5): il suo recupero non fa un muro. */
function attacks(set: TeamSet, rules: FormatRules): boolean {
  const values = setSubRoles(set, rules);
  if (primaryFamily(set, values) === 'attack') return true;
  return [...FAMILIES.attack, ...ATTACKER_ROLES].some(role => (values[role] ?? 0) >= 0.5);
}

/** Velocità base che vale un recupero nel punteggio. */
const RECOVERY_SPEED_SCALE = 15;


/**
 * I due punteggi della regola di National Dex OU: `score` (tutto il recupero) separa HO, BO e il resto; `wallScore` (solo
 * il recupero di chi non attacca) separa Balance e Semi-stall.
 * La Focus Sash non conta più (2026-11-09, controllo 2 punto 3.4): degli attaccanti valeva una mossa di recupero in meno,
 * ma sul banco riconosceva un solo team in più (118 contro 117 su 137) e cambiare uno strumento cambiava il tipo
 * (Metagross Choice Band → Focus Sash in un Semi-stall: 85 → 77, di cui 3 dal tipo); salti di 4+ punti scambiando
 * Sash e altri strumenti nei team da torneo 49 → 16.
 */
function recoverySpeedScores(team: TeamSet[], rules: FormatRules): { score: number; wallScore: number } {
  // Recupero: una mossa, o Poison Heal col veleno di Toxic Orb (Gliscor si cura ogni turno come con una mossa)
  const healing = team.filter(set => set.moves.some(m => HEAL_MOVES.has(toID(m))) || poisonHealer(set));
  const speed = team.reduce((acc, set) => acc + (battleSpecies(set)?.baseStats.spe ?? 0), 0) / team.length;
  const speedPart = speed / RECOVERY_SPEED_SCALE;
  const raw = healing.length - speedPart;
  // Freno dei tank: con almeno 2 tank il team non è Hyper Offense e va a metà della fascia Bulky Offense
  const score = team.filter(isTank).length >= TANK_BRAKE ? Math.max(raw, TANK_BRAKE_SCORE) : raw;
  return { score, wallScore: healing.filter(set => !attacks(set, rules)).length - speedPart };
}

function pickRecoverySpeed({ score, wallScore }: { score: number; wallScore: number }): Archetype {
  if (score < RECOVERY_SPEED_CUTS.hyperOffense) return 'hyperOffense';
  if (score < RECOVERY_SPEED_CUTS.bulkyOffense) return 'bulkyOffense';
  // Fra Balance e Semi-stall: solo il recupero di chi non attacca
  if (wallScore < RECOVERY_SPEED_CUTS.balance) return 'balance';
  return 'semiStall';
}

/** National Dex OU: il tipo dal recupero e dalla velocità base media; lo stall resta tutti e 6 passivi. */
function recoverySpeedArchetype(team: TeamSet[], rules: FormatRules): Archetype {
  if (isStall(team, rules)) return 'stall';
  return pickRecoverySpeed(recoverySpeedScores(team, rules));
}

/**
 * Mezza larghezza della zona di passaggio fra due tipi vicini, in unità del punteggio (1 = una mossa di recupero).
 * Provate il 2026-11-07 sui 541 team National Dex OU del banco: 0,5 / 1 / 1,5 tolgono un quarto, metà e due terzi dei
 * salti di 4 o più punti quando cambia il tipo (587 → 452 / 301 / 211); partite vere 54,6% uguale, distacco torneo −
 * ladder uguale. Anche i pesi delle aree a passi uguali sono stati provati: 587 → 494 da soli, e il Magikarp come
 * sesto alzava il voto più spesso; scartati.
 */
export const TYPE_BLEND_ZONE = 1.5;

/** Un tipo vicino e la sua quota nel voto (da 0 a 0,5: metà proprio sulla soglia). */
export interface TypeBlend { near: Archetype; share: number }

/**
 * I tipi vicini con la loro quota (`blends`, dal più vicino). `near` e `share` sono il più vicino; `shown` i tipi da
 * mostrare nella riga "Vicino a…": il più vicino, tutti e due se sono alla stessa distanza.
 */
export interface TypeMix { archetype: Archetype; near: Archetype; share: number; blends: TypeBlend[]; shown: Archetype[] }

/**
 * Vicino a una soglia della regola di National Dex OU il team è anche un po' dei tipi accanto: un po' di velocità o una mossa di
 * recupero in più non fanno più saltare il voto di colpo. Lo Stall (6 passivi) resta un tipo a parte: una quota di Stall
 * con 5 passivi faceva salire il voto aggiungendo un sesto membro inutile (Magikarp con Splash è passivo).
 */
export function typeMix(team: TeamSet[], rules: FormatRules): TypeMix | null {
  if (rules.typeRule !== 'recoverySpeed' || team.length < 6 || team.some(set => !battleSpecies(set))) return null;
  if (isStall(team, rules)) return null;
  const scores = recoverySpeedScores(team, rules);
  const { score, wallScore } = scores;
  const archetype = pickRecoverySpeed(scores);
  const C = RECOVERY_SPEED_CUTS;
  // Le soglie vicine: tipo dall'altra parte e distanza
  const sides: { near: Archetype; distance: number }[] =
    archetype === 'hyperOffense' ? [{ near: 'bulkyOffense', distance: C.hyperOffense - score }]
      : archetype === 'bulkyOffense' ? [
        { near: 'hyperOffense', distance: score - C.hyperOffense },
        { near: pickRecoverySpeed({ score: C.bulkyOffense, wallScore }), distance: C.bulkyOffense - score },
      ]
        : [
          { near: archetype === 'balance' ? 'semiStall' : 'balance', distance: Math.abs(wallScore - C.balance) },
          { near: 'bulkyOffense', distance: score - C.bulkyOffense },
        ];
  // Tutti i vicini a portata, non solo il più vicino (2026-11-09, controllo 2 punto 3.3): la fascia Bulky Offense è larga
  // 1,42, meno di due zone, e col solo vicino più vicino a metà fascia il voto saltava da "quasi Balance" a "quasi HO"
  // togliendo un Roost (Charizard-Mega-Y: 75 → 79 con aree identiche)
  const blends = sides
    .filter(side => side.near !== archetype)
    .map(side => ({ near: side.near, share: 0.5 * (1 - side.distance / TYPE_BLEND_ZONE) }))
    .filter(blend => blend.share > 0)
    .sort((a, b) => b.share - a.share);
  if (!blends.length) return null;
  const [closest] = blends;
  const shown = blends.filter(blend => Math.round(100 * blend.share) === Math.round(100 * closest.share)).map(blend => blend.near);
  return { archetype, near: closest.near, share: closest.share, blends, shown };
}

/** Archetipo dal numero di muri passivi (e dal recupero e dalla robustezza per distinguere i team offensivi). */
function archetypeOf(team: TeamSet[], rules: FormatRules): Archetype {
  if (isOneType(rules)) return 'doubles';
  if (rules.typeRule === 'recoverySpeed') return recoverySpeedArchetype(team, rules);
  if (isStall(team, rules)) return 'stall';
  const passive = team.filter(set => isPassive(set, rules)).length;
  if (passive === 4 || passive === 5) return 'semiStall';
  const healers = team.filter(heals).length;
  if (passive === 3 || (passive === 2 && healers >= 2)) return 'balance';
  const bulk = team.reduce((acc, set) => acc + (memberPower(set)?.bulk ?? 0), 0) / team.length;
  const sash = team.some(set => toID(set.item) === 'focussash');
  if (bulk < BULKY || (passive === 0 && (bulk < FRAIL || sash))) return 'hyperOffense';
  // Webs e lead con Focus Sash: con al massimo un passivo è Hyper Offense anche se gli altri sono robusti (Gen 9)
  if (passive <= 1 && (sash || team.some(set => set.moves.some(m => toID(m) === 'stickyweb')))) return 'hyperOffense';
  // In Ubers anche gli HO sono robusti: li distingue la velocità di quasi tutti i membri
  if (passive === 0 && team.filter(fastOrSpeedSetup).length >= HO_FAST_MEMBERS) return 'hyperOffense';
  return 'bulkyOffense';
}

/**
 * Quanti membri portano o sfruttano la condizione, se è uno stile; altrimenti 0. Meteo e Trick Room contano come stile
 * solo se qualcun altro li sfrutta (due membri lenti per Trick Room). `terrain`: chi sfrutta un campo è chi lo usa
 * davvero (usesCondition: anche chi attacca a terra col tipo che il campo potenzia).
 */
function styleMembers(team: TeamSet[], condition: Condition, terrain = false): number {
  const setters = team.filter(set => enables(set).some(e => e.condition === condition && toID(e.via) !== 'chillyreception'));
  const users = team.filter(set => !setters.includes(set)
    && (terrain ? usesCondition(set, condition) : benefits(set).some(b => b.condition === condition && toID(b.via) !== 'weatherball')));
  return setters.length > 0 && users.length >= (condition === 'trickroom' ? 2 : 1) ? setters.length + users.length : 0;
}

function conditionStyles(team: TeamSet[]): TeamStyle[] {
  return CONDITION_STYLES.filter(([condition]) => styleMembers(team, condition) > 0).map(([, style]) => style);
}

/** Gli stili del doppio nell'ordine che decide i pari merito: meteo, campi, Trick Room, Tailwind. */
export const DOUBLES_STYLES: TeamStyle[] = ['sun', 'rain', 'sand', 'snow', 'grassyterrain', 'psychicterrain', 'electricterrain', 'mistyterrain', 'trickroom', 'tailwind'];

/**
 * Doppio (2026-11-21): una sola etichetta di stile, quella con più membri che la portano o la sfruttano; a pari merito
 * il meteo, poi il campo, poi Trick Room, poi Tailwind. Uno stile esiste con la regola di sempre (chi lo porta più
 * almeno un altro che lo sfrutta); Tailwind esiste appena un membro ha la mossa e conta solo chi la porta, così compare
 * quando non c'è altro.
 */
function doublesStyle(team: TeamSet[]): TeamStyle[] {
  const counts = doublesStyleCounts(team);
  // Il primo col conto più alto: l'ordine della lista decide i pari merito
  const best = counts.reduce<{ style: TeamStyle; n: number } | null>((a, s) => (!a || s.n > a.n ? s : a), null);
  return best ? [best.style] : [];
}

/** Quanti membri contano per ogni stile del doppio che il team ha (almeno uno), nell'ordine di DOUBLES_STYLES. */
function doublesStyleCounts(team: TeamSet[]): { style: TeamStyle; n: number }[] {
  const count = (style: TeamStyle): number =>
    style === 'tailwind' ? team.filter(set => set.moves.some(m => toID(m) === 'tailwind')).length : styleMembers(team, style, style.endsWith('terrain'));
  return DOUBLES_STYLES.map(style => ({ style, n: count(style) })).filter(s => s.n > 0);
}

/**
 * Doppio: TUTTI gli stili che il team ha, non solo quello dell'etichetta (un team di pioggia con Tailwind li ha tutti
 * e due). Lo usa Completa team per dire se il team ha lo stile chiesto; l'etichetta mostrata resta una (doublesStyle).
 */
export const doublesStyles = (team: TeamSet[]): TeamStyle[] => doublesStyleCounts(team).map(s => s.style);

/** Archetipi per cui ha senso cercare un singolo Pokémon (Balance: ci rientrerebbero quasi tutti). */
export type FitArchetype = 'stall' | 'hyperOffense' | 'bulkyOffense';
/** Offesa (percentile) da cui un membro passivo è un attaccante (Kyurem con Roost), non un muro da stall. */
const STALL_MAX_OFFENSE = 85;
/** Offesa minima di un attaccante veloce da Hyper Offense. */
const FAST_ATTACKER_OFFENSE = 65;
/** Offesa e robustezza minime di un membro da Bulky Offense. */
const BULKY_MEMBER = 60;

/** Il Pokémon, col suo set, è adatto a un team dell'archetipo dato. */
export function fitsArchetype(set: TeamSet, archetype: FitArchetype, rules: FormatRules): boolean {
  const power = memberPower(set);
  if (!power) return false;
  // Ruoli legacy: l'adattamento a un archetipo non cambia coi sotto-ruoli
  const roles = legacyRoles(set, rules);
  const stall = isPassive(set, rules) && power.offense < STALL_MAX_OFFENSE;
  if (archetype === 'stall') return stall;
  if (stall) return false;
  if (archetype === 'bulkyOffense') return power.offense >= BULKY_MEMBER && power.bulk >= BULKY_MEMBER;
  const fast = (battleSpecies(set)?.baseStats.spe ?? 0) >= 100 || toID(set.item) === 'choicescarf';
  const sweeper = roles.includes('physicalSweeper') || roles.includes('specialSweeper');
  const lead = toID(set.item) === 'focussash' && roles.includes('hazards');
  return (sweeper && (fast || roles.includes('setup'))) || (power.offense >= FAST_ATTACKER_OFFENSE && fast) || lead;
}

/** Il Pokémon aiuta a costruire un team del tipo dato: semi-stall vuole muri passivi, il balance accetta tutti. */
export function fitsTeamType(set: TeamSet, archetype: Archetype, rules: FormatRules): boolean {
  if (archetype === 'balance' || archetype === 'doubles') return true;
  if (archetype === 'semiStall') return isPassive(set, rules);
  return fitsArchetype(set, archetype, rules);
}

/** Ruoli della carta del team: i ruoli mostrati (in doppio anche "Attaccante" e "Muro"), più il meteo e il setup, che compaiono solo lì. */
export type CardRole = ShownRole | 'weather' | 'setup';
const WEATHERS: Condition[] = ['rain', 'sun', 'sand', 'snow'];

/** Il meteo che il membro porta, con abilità o mossa (non la neve di passaggio di Chilly Reception). */
export function weatherOf(set: TeamSet): { condition: Condition; via: string } | null {
  const link = enables(set).find(e => WEATHERS.includes(e.condition) && toID(e.via) !== 'chillyreception');
  return link ? { condition: link.condition, via: link.via } : null;
}

/**
 * Ruoli da mostrare sulla carta del team (al massimo 2). Il principale: il primo della famiglia principale (Attacco o
 * muri, primaryFamily, la stessa decisione dei bisogni), altrimenti il primo di Campo e Disturbo; poi il meteo, gli altri supporti, il Recupero (mai
 * principale se c'è altro: lo hanno quasi tutti) e il setup, che si salta per uno sweeper, che lo implica.
 * `measured`: i sotto-ruoli misurati del membro nel team (gli stessi del voto); senza, quelli del solo set.
 * In doppio (doublesCardRoles): "Attaccante" o "Muro", poi le voci del doppio, con Protect per ultimo.
 */
export function cardRoles(set: TeamSet, rules: FormatRules, measured?: SubRoleValues): CardRole[] {
  const roles = measured ? rolesListFor(measured, rules) : detectRoles(set, rules);
  if (isOneType(rules)) return doublesCardRoles(set, roles, measured ?? setSubRoles(set, rules), rules);
  // Liste costruite qui e non al caricamento: subRoles.ts e questo modulo si importano a vicenda
  const walls: SubRole[] = ['physicalWall', 'specialWall'];
  // Famiglia principale: la stessa decisione dei bisogni (primaryFamily: verdetto degli EV, poi il valore migliore)
  const values = measured ?? setSubRoles(set, rules);
  const primary = primaryFamily(set, values);
  const order = primary === 'wall' ? [...walls, ...FAMILIES.attack] : [...FAMILIES.attack, ...walls];
  // Il supporto sulla carta nell'ordine di sempre (hazard prima di tutto), non in quello delle famiglie Support e Utility
  const CARD_SUPPORT: SubRole[] = ['hazards', 'removal', 'pivot', 'screens', 'speedControl', 'support', 'dot', 'disruptor', 'phazer', 'itemRemoval'];
  const support = CARD_SUPPORT.filter(role => roles.includes(role));
  const main = order.find(role => roles.includes(role)) ?? support[0] ?? (roles.includes('recovery') ? 'recovery' : undefined);
  const sweeper = main === 'physicalSweeper' || main === 'specialSweeper';
  const weather: CardRole[] = weatherOf(set) ? ['weather'] : [];
  const setup: CardRole[] = hasSetup(set) && !sweeper ? ['setup'] : [];
  const supportMember = !order.includes(main as SubRole);
  const recovery: CardRole[] = supportMember && roles.includes('recovery') ? ['recovery'] : [];
  return [...(main ? [main] : []), ...weather, ...support, ...setup, ...recovery].filter((role, i, all) => all.indexOf(role) === i).slice(0, 2);
}

/**
 * La carta in doppio: il principale è "Attaccante" o "Muro" (la stessa decisione primaryFamily; se il membro non ha
 * quello, l'altro), poi nell'ordine Fake Out, Redirector, il meteo che porta, mossa a più bersagli, priorità (non per
 * chi mostra già Fake Out, che la implica), pivot, hazard, setup (non per uno sweeper) e Protect per ultimo: lo ha
 * quasi metà dei Pokémon, sulla carta dice poco.
 */
function doublesCardRoles(set: TeamSet, roles: SubRole[], values: SubRoleValues, rules: FormatRules): CardRole[] {
  const shown = shownRoles(roles, rules);
  const primary = primaryFamily(set, values);
  const mains: ShownRole[] = primary === 'wall' ? ['anyWall', 'anyAttacker'] : ['anyAttacker', 'anyWall'];
  const main = mains.find(role => shown.includes(role));
  const sweeper = roles.includes('physicalSweeper') || roles.includes('specialSweeper');
  const has = (role: SubRole) => roles.includes(role);
  const rest: CardRole[] = [
    ...(has('fakeOut') ? ['fakeOut' as const] : []),
    ...(has('redirector') ? ['redirector' as const] : []),
    ...(weatherOf(set) ? ['weather' as const] : []),
    ...(has('spread') ? ['spread' as const] : []),
    ...(has('firstStrike') && !has('fakeOut') ? ['firstStrike' as const] : []),
    ...(has('pivot') ? ['pivot' as const] : []),
    ...(has('hazards') ? ['hazards' as const] : []),
    ...(hasSetup(set) && !sweeper ? ['setup' as const] : []),
    ...(has('protect') ? ['protect' as const] : []),
  ];
  return [...(main ? [main] : []), ...rest].slice(0, 2);
}

/** Tipo di team con archetipo e stili, solo per un team completo; in doppio (tipo unico) per qualunque team non vuoto. */
export function teamArchetype(team: TeamSet[], rules: FormatRules): TeamArchetype | null {
  if (isOneType(rules)) return team.length ? { archetype: archetypeOf(team, rules), styles: doublesStyle(team) } : null;
  if (team.length < 6 || team.some(set => !battleSpecies(set))) return null;
  return { archetype: archetypeOf(team, rules), styles: conditionStyles(team).slice(0, MAX_STYLES) };
}
