import type { ReactNode } from 'react';
import type { Archetype } from '../../engine/archetype';
import { MISSING_BELOW } from '../../engine/needs';
import { ESSENTIAL_POINTS, MINOR_CAP, MINOR_STEP, ONE_STYLE_POINTS } from '../../engine/rolesArea';
import { LEVEL_KEYS, levelOf, type Level, type LevelKey } from '../../engine/roleLevels';
import { BREAKER_WALLBREAKING, SWEEPER_OFFENSE, SWEEPER_SPEED } from '../../engine/subRoles';
import { useLang, useT } from '../../i18n/react';
import { keyLabel, LevelTag } from './RoleParts';
import { FAMILY_ORDER, familyOf } from './rolesRows';

type Key = Parameters<ReturnType<typeof useT>>[0];
export type RolesSection = 'general' | 'types' | 'earnA' | 'earnB' | 'earnC';

const ARCHETYPES: { key: Archetype; short: string }[] = [
  { key: 'hyperOffense', short: 'HO' }, { key: 'bulkyOffense', short: 'BO' }, { key: 'balance', short: 'Balance' },
  { key: 'semiStall', short: 'Semi-stall' }, { key: 'stall', short: 'Stall' },
];
const LEVEL_TILES: Level[] = ['essential', 'important', 'minor', 'ignored'];

/** Un gettone della guida: chi o cosa dà il ruolo e quanto vale (vuoto: solo la condizione). */
type Chip = { label: string; value?: string; key?: boolean };
/**
 * Come si ottiene ogni ruolo, coi valori del motore (subRoles.ts): mosse e abilità col loro valore; `share`: il valore
 * si moltiplica per la quota del meta (o del tier) che lo subisce o che il membro supera in velocità.
 * Le etichette con `key` sono chiavi di traduzione (guide.roles.c.*), le altre nomi di mosse e abilità.
 */
const HOW: Record<'earnA' | 'earnB' | 'earnC', { role: LevelKey; chips: Chip[]; share?: 'status' | 'outspeed' }[]> = {
  earnA: [
    { role: 'anySweeper', chips: [{ label: 'c.offense', key: true, value: `≥ ${SWEEPER_OFFENSE}` }, { label: 'c.speed', key: true, value: `≥ ${Math.round(100 * SWEEPER_SPEED)}%` }, { label: 'c.speedSetup', key: true }, { label: 'c.setupPriority', key: true }] },
    { role: 'anyBreaker', chips: [{ label: 'c.wallbreaking', key: true, value: `≥ ${BREAKER_WALLBREAKING}` }, { label: 'c.withSetup', key: true }] },
    { role: 'anyPhysical', chips: [{ label: 'c.physical', key: true }] },
    { role: 'anySpecial', chips: [{ label: 'c.special', key: true }] },
    { role: 'physicalWall', chips: [{ label: 'c.wallPhys', key: true }, { label: 'Eviolite · Fur Coat · Marvel Scale' }] },
    { role: 'specialWall', chips: [{ label: 'c.wallSpec', key: true }, { label: 'Assault Vest · Eviolite · Ice Scales' }] },
    { role: 'recovery', chips: [{ label: 'Recover · Roost · Slack Off · Wish · Regenerator…', value: '1' }, { label: 'Rest · Pain Split', value: '0,5' }, { label: 'Leech Seed', value: '0,25' }] },
  ],
  earnB: [
    { role: 'support', chips: [{ label: 'Wish · Healing Wish · Lunar Dance · Revival Blessing', value: '1' }, { label: 'Heal Bell · Aromatherapy', value: '0,75' }] },
    { role: 'removal', chips: [{ label: 'Defog · Rapid Spin · Mortal Spin · Tidy Up · Court Change', value: '1' }, { label: 'Magic Bounce', value: '0,5' }] },
    { role: 'screens', chips: [{ label: 'Reflect + Light Screen', value: '1' }, { label: 'c.veilSnow', key: true, value: '1' }, { label: 'c.oneScreen', key: true, value: '0,6' }, { label: 'c.noClay', key: true, value: '×0,75' }] },
    { role: 'speedControl', chips: [{ label: 'Sticky Web · Tailwind · Trick Room', value: '1' }] },
    { role: 'debuff', share: 'status', chips: [{ label: 'c.sleep', key: true, value: '1' }, { label: 'Yawn', value: '0,5' }, { label: 'Will-O-Wisp · Thunder Wave', value: '0,25' }] },
    { role: 'phazer', chips: [{ label: 'Haze · Clear Smog · Whirlwind · Roar · Dragon Tail · Circle Throw · Unaware', value: '1' }] },
  ],
  earnC: [
    { role: 'hazards', chips: [{ label: 'Stealth Rock · Spikes · Stone Axe · Ceaseless Edge', value: '1' }, { label: 'Toxic Spikes', value: '0,75' }] },
    { role: 'pivot', chips: [{ label: 'U-turn · Volt Switch · Flip Turn · Parting Shot · Teleport · Shed Tail · Chilly Reception', value: '1' }] },
    { role: 'dot', share: 'status', chips: [{ label: 'Toxic · Salt Cure', value: '1' }, { label: 'Will-O-Wisp · Leech Seed', value: '0,5' }] },
    { role: 'taunt', share: 'outspeed', chips: [{ label: 'Taunt', value: '1' }, { label: 'c.prankster', key: true }] },
    { role: 'encore', share: 'outspeed', chips: [{ label: 'Encore', value: '1' }, { label: 'c.prankster', key: true }] },
    { role: 'itemRemoval', chips: [{ label: 'Knock Off', value: '1' }, { label: 'Trick · Switcheroo + Choice', value: '1' }, { label: 'c.trickNoChoice', key: true, value: '0,5' }] },
  ],
};

/**
 * La guida dei Ruoli (schematica, senza i valori del team): come funziona l'area, i livelli di ogni voce per tipo di
 * team (la colonna del team in evidenza) e come si ottiene ogni ruolo, in tre pagine (attacco e difesa, support, utility).
 */
export function RolesGuideSection({ section, archetype, meta }: { section: RolesSection; archetype: Archetype; meta: boolean }) {
  const t = useT();
  const lang = useLang();
  // Decimali alla maniera della lingua (0,5 in italiano, 0.5 in inglese)
  const dec = (text: string) => (lang === 'it' ? text : text.replace(/,/g, '.'));
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.roles.${key}` as Key, params);
  const pool = t(meta ? 'rdetail.pool.meta' : 'rdetail.pool.tier');

  if (section === 'general') {
    const tile: Record<Level, { value: string; rule: string }> = {
      essential: { value: `−${ESSENTIAL_POINTS}`, rule: g('essential.rule') },
      important: { value: g('important.value'), rule: g('important.rule') },
      minor: { value: `+${Math.round(100 * MINOR_STEP)}%`, rule: g('minor.rule', { cap: Math.round(100 * MINOR_CAP) }) },
      ignored: { value: '0', rule: g('ignored.rule') },
    };
    return (
      <>
        <h5>{g('what')}</h5>
        <ul className="guide-lines">
          <li>{g('what.level', { archetype: t(`archetype.${archetype}`) })}</li>
          <li>{g('what.value', { pct: Math.round(100 * MISSING_BELOW) })}</li>
        </ul>
        <h5>{g('levels')}</h5>
        <ul className="guide-tiles rl-guide-tiles">
          {LEVEL_TILES.map(level => (
            <li key={level} className={level}>
              <span className="guide-tile-head"><LevelTag level={level} t={t} /><b className="rl-tile-val">{tile[level].value}</b></span>
              <small>{tile[level].rule}</small>
            </li>
          ))}
        </ul>
        <p className="guide-foot">{g('levels.foot')}</p>
        <h5>{g('extra')}</h5>
        <ul className="guide-lines">
          <li>{g('extra.style', { n: ONE_STYLE_POINTS })}</li>
          <li>{g('extra.secondary')}</li>
        </ul>
      </>
    );
  }

  if (section === 'types') {
    // Le voci che contano almeno in un tipo di team, per famiglia; quelle che non contano mai in una riga sotto
    const counts = LEVEL_KEYS.filter(key => ARCHETYPES.some(a => levelOf(a.key, key) !== 'ignored'));
    const never = LEVEL_KEYS.filter(key => !counts.includes(key));
    return (
      <>
        <table className="rl-types">
          <thead>
            <tr>
              <th scope="col">{t('rdetail.role')}</th>
              {ARCHETYPES.map(a => (
                <th key={a.key} scope="col" title={t(`archetype.${a.key}`)} className={a.key === archetype ? 'now' : undefined}>{a.short}</th>
              ))}
            </tr>
          </thead>
          {FAMILY_ORDER.map(family => {
            const rows = counts.filter(key => familyOf(key) === family);
            if (!rows.length) return null;
            return (
              <tbody key={family}>
                <tr className="rl-fam"><th scope="rowgroup" colSpan={6}>{t(`family.${family}`)}</th></tr>
                {rows.map(key => (
                  <tr key={key}>
                    <th scope="row">{keyLabel(key, t)}</th>
                    {ARCHETYPES.map(a => {
                      const level = levelOf(a.key, key);
                      return (
                        <td key={a.key} className={a.key === archetype ? 'now' : undefined}>
                          {level === 'ignored' ? <span className="rl-dash" aria-label={t('rdetail.level.ignored')}>—</span> : <LevelTag level={level} t={t} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
        <p className="guide-foot">{g('types.never', { list: never.map(key => keyLabel(key, t)).join(', ') })}</p>
      </>
    );
  }

  const items = HOW[section];
  const label = (c: Chip) => (c.key ? g(c.label) : c.label);
  return (
    <>
      <ul className="rl-how">
        {items.map(item => (
          <li key={item.role}>
            <b className="rl-how-role">{keyLabel(item.role, t)}</b>
            <span className="rl-chips">
              {item.chips.map(c => (
                <span key={c.label} className={`rl-chip${c.value ? '' : ' cond'}`}>
                  {label(c)}{c.value && <b>{dec(c.value)}</b>}
                </span>
              ))}
              {item.share && <span className="rl-chip share">{g(`share.${item.share}`, { pool })}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="guide-foot">{g(section === 'earnA' ? 'earnA.foot' : 'earnB.foot', { pool })}</p>
    </>
  );
}

/** Le pagine della guida dei Ruoli dopo Come funziona: tipi di team e come si ottiene un ruolo. */
export function rolesGuidePages(archetype: Archetype, meta: boolean, t: ReturnType<typeof useT>): { key: string; label: string; content: ReactNode }[] {
  const page = (key: Exclude<RolesSection, 'general'>) => ({
    key, label: t(`guide.roles.page.${key}` as Key), content: <RolesGuideSection section={key} archetype={archetype} meta={meta} />,
  });
  return [page('types'), page('earnA'), page('earnB'), page('earnC')];
}
