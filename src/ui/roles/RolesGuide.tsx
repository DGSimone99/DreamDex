import type { ReactNode } from 'react';
import type { Archetype } from '../../engine/archetype';
import type { FormatRules } from '../../engine/formatRules';
import { MISSING_BELOW } from '../../engine/needs';
import { ESSENTIAL_POINTS, IMPORTANT_POINTS, MINOR_POINTS } from '../../engine/rolesArea';
import { LEVEL_KEYS, levelFor, type Level, type LevelKey } from '../../engine/roleLevels';
import { useT } from '../../i18n/react';
import { keyLabel, LevelTag } from './RoleParts';
import { FAMILY_ORDER, familyOf } from './rolesRows';

type Key = Parameters<ReturnType<typeof useT>>[0];
export type RolesSection = 'general' | 'types';

const ARCHETYPES: { key: Archetype; short: string }[] = [
  { key: 'hyperOffense', short: 'HO' }, { key: 'bulkyOffense', short: 'BO' }, { key: 'balance', short: 'Balance' },
  { key: 'semiStall', short: 'Semi-stall' }, { key: 'stall', short: 'Stall' },
];
const LEVEL_TILES: Level[] = ['essential', 'important', 'minor', 'ignored'];

/**
 * La guida dei Ruoli (schematica, senza i valori del team): come funziona l'area e i livelli di ogni voce per tipo di
 * team (la colonna del team in evidenza).
 */
export function RolesGuideSection({ section, archetype, typeRule }: { section: RolesSection; archetype: Archetype; typeRule?: FormatRules['typeRule'] }) {
  const t = useT();
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.roles.${key}` as Key, params);

  if (section === 'general') {
    const tile: Record<Level, { value: string; rule: string }> = {
      essential: { value: `−${ESSENTIAL_POINTS}`, rule: g('essential.rule') },
      important: { value: `−${IMPORTANT_POINTS}`, rule: g('important.rule') },
      minor: { value: `+${MINOR_POINTS}`, rule: g('minor.rule') },
      ignored: { value: '0', rule: g('ignored.rule') },
    };
    return (
      <>
        <h4>{g('what')}</h4>
        <ul className="guide-lines">
          <li>{g('what.level', { archetype: t(`archetype.${archetype}`) })}</li>
          <li>{g('what.value', { pct: Math.round(100 * MISSING_BELOW) })}</li>
          <li>{g('what.points')}</li>
        </ul>
        <h4>{g('levels')}</h4>
        <ul className="guide-tiles rl-guide-tiles">
          {LEVEL_TILES.map(level => (
            <li key={level} className={level}>
              <span className="guide-tile-head"><LevelTag level={level} t={t} /><b className="rl-tile-val">{tile[level].value}</b></span>
              <small>{tile[level].rule}</small>
            </li>
          ))}
        </ul>
      </>
    );
  }

  // Ruoli per tipo di team: le voci che contano almeno in un tipo di team, per famiglia; quelle che non contano mai in una riga sotto
  const counts = LEVEL_KEYS.filter(key => ARCHETYPES.some(a => levelFor(a.key, key, typeRule) !== 'ignored'));
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
                    const level = levelFor(a.key, key, typeRule);
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

/** Le pagine della guida dei Ruoli dopo Come funziona: Ruoli per tipo di team. */
export function rolesGuidePages(archetype: Archetype, t: ReturnType<typeof useT>, typeRule?: FormatRules['typeRule']): { key: string; label: string; content: ReactNode }[] {
  return [{ key: 'types', label: t('guide.roles.page.types'), content: <RolesGuideSection section="types" archetype={archetype} typeRule={typeRule} /> }];
}
