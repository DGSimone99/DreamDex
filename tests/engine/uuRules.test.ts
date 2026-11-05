import { afterEach, describe, expect, it } from 'vitest';
import { loadTiers } from '../../src/data/load';
import type { EngineData } from '../../src/engine/data';
import { getSpecies, initTiers, natDexTier } from '../../src/engine/dex';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { isLegalIn } from '../../src/engine/formats';
import { DEFAULT_RULES, formatRules, NATDEX_OU_RULES, UU_RULES } from '../../src/engine/formatRules';
import { memberPower, teamPower } from '../../src/engine/power';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { unusedEnablers } from '../../src/engine/synergy';
import { fixtureData } from '../fixtures/data';
import { parseTiers } from '../../scripts/showdown-tiers';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), item, ability, moves });
const uu = { ...DEFAULT_FORMAT, formatId: 'uu' as const };

describe('tier National Dex di Showdown', () => {
  afterEach(() => initTiers(null));

  it('legge natDexTier, o tier quando natDexTier manca (come Showdown); per Gen 9 il tier', () => {
    const source = [
      'export const FormatsData = {',
      '\tslowbro: {',
      '\t\ttier: "RU",',
      '\t\tdoublesTier: "(DUU)",',
      '\t\tnatDexTier: "UU",',
      '\t},',
      '\tchansey: {',
      '\t\ttier: "RU",',
      '\t},',
      '\tmissingno: {',
      '\t\tisNonstandard: "Custom",',
      '\t},',
      '};',
    ].join('\n');
    expect(parseTiers(source)).toEqual({ natdex: { slowbro: 'UU', chansey: 'RU' }, gen9: { slowbro: 'RU', chansey: 'RU' } });
  });

  it('aggiornano quelli della libreria: Slowbro passa da OU a UU ed è legale in UU', () => {
    const slowbro = getSpecies('Slowbro')!;
    expect(natDexTier(slowbro)).toBe('OU');
    expect(isLegalIn(slowbro, uu)).toBe(false);
    initTiers({ natdex: { slowbro: 'UU' }, gen9: {} });
    expect(natDexTier(slowbro)).toBe('UU');
    expect(isLegalIn(slowbro, uu)).toBe(true);
  });

  it('solo dove la libreria ha già un tier: le forme senza tier restano come sono', () => {
    const forme = ['Venusaur-Gmax', 'Raichu-Mega-X', 'Pikachu-Cosplay'].map(getSpecies).find(s => s && natDexTier(s) === '');
    expect(forme).toBeDefined();
    initTiers({ natdex: { [forme!.id]: 'Illegal' }, gen9: {} });
    expect(natDexTier(forme!)).toBe('');
  });

  it('caricati da data/_tiers/tiers.json, null se non scaricati', async () => {
    const tiers = { natdex: { slowbro: 'UU' }, gen9: { slowbro: 'RU' } };
    expect(await loadTiers({ '/data/_tiers/tiers.json': async () => tiers })).toEqual(tiers);
    expect(await loadTiers({})).toBeNull();
  });
});

describe('regole di UU', () => {
  const uuData: EngineData = { ...fixtureData, formatId: 'uu' };
  const team = [
    set('Skarmory', 'Rocky Helmet', 'Sturdy', ['Brave Bird', 'Roost', 'Whirlwind', 'Iron Defense']),
    set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss', 'Toxic', 'Heal Bell']),
    set('Hydreigon', 'Choice Specs', 'Levitate', ['Draco Meteor', 'Dark Pulse', 'Flash Cannon', 'U-turn']),
    set('Keldeo', 'Choice Specs', 'Justified', ['Hydro Pump', 'Secret Sword', 'Scald', 'Vacuum Wave']),
    set('Scizor', 'Choice Band', 'Technician', ['Bullet Punch', 'U-turn', 'Knock Off', 'Close Combat']),
    set('Excadrill', 'Leftovers', 'Mold Breaker', ['Swords Dance', 'Earthquake', 'Iron Head', 'Rapid Spin']),
  ];

  it('UU ha le sue regole, OU le sue', () => {
    expect(formatRules('uu')).toBe(UU_RULES);
    expect(formatRules('ou')).toBe(NATDEX_OU_RULES);
  });

  it('un team completo senza hazard non ha un malus del formato in UU: gli hazard li chiedono i Ruoli', () => {
    const penalty = (data: EngineData) => rateTeam(team, data)!.penalty.items.find(i => i.text.startsWith('Nessun hazard'));
    expect(penalty(uuData)).toBeUndefined();
    // Team incompleto di hazard giudicato come Balance: lì gli hazard sono essenziali
    expect(rateTeam(team, uuData)!.roles.rows.find(r => r.key === 'hazards')).toMatchObject({ level: 'essential', value: 0 });
  });

  it('le statistiche si confrontano coi Pokémon legali in UU: un Pokémon di UU vale di più che contro tutti', () => {
    const scizor = team[4];
    expect(memberPower(scizor, 'uu')!.power).toBeGreaterThan(memberPower(scizor)!.power);
    expect(teamPower(team, [], UU_RULES).value).toBeGreaterThan(teamPower(team, [], DEFAULT_RULES).value!);
  });
});

describe('campi portati da un\'abilità', () => {
  it('Misty Surge di Tapu Fini non è "non sfruttato": il campo aiuta tutto il team', () => {
    const team = [
      set('Tapu Fini', 'Leftovers', 'Misty Surge', ['Scald', 'Moonblast', 'Taunt', 'Defog']),
      set('Scizor', 'Choice Band', 'Technician', ['Bullet Punch', 'U-turn', 'Knock Off', 'Close Combat']),
    ];
    expect(unusedEnablers(team)).toEqual([]);
  });

  it('un campo portato da una mossa senza nessuno che lo sfrutti resta segnalato', () => {
    const team = [
      set('Clefable', 'Leftovers', 'Magic Guard', ['Misty Terrain', 'Moonblast', 'Soft-Boiled', 'Calm Mind']),
      set('Scizor', 'Choice Band', 'Technician', ['Bullet Punch', 'U-turn', 'Knock Off', 'Close Combat']),
    ];
    // La mossa è una scelta: senza nessuno che sfrutti il campo, occupa uno slot per poco
    expect(unusedEnablers(team).map(i => i.condition)).toContain('mistyterrain');
  });
});
