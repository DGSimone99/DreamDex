import { useState } from 'react';
import type { TeamRating } from '../../engine/rating';
import type { Level } from '../../engine/roleLevels';
import { useT } from '../../i18n/react';
import { ROLES_SUB, type AreaContext, type DetailTab, type T } from '../AreaDetail';
import { RolesGeneral, RolesHead } from './RolesGeneral';
import { RolesGuideSection, rolesGuidePages } from './RolesGuide';
import { RolesLevel } from './RolesLevel';
import { LEVEL_ORDER, roleLines } from './rolesRows';

/** Cosa mostra la sottoscheda Ruoli: tutto (cosa manca e chi copre ciò che conta) o un livello solo. */
export type RolesFilter = 'all' | Level;

/**
 * La sottoscheda Ruoli di Bonus/Malus (coperti/totale): i Ruoli non hanno un peso nel voto, contano coi loro bonus e malus.
 * Dentro, un filtro: Tutti (cosa manca e chi copre ciò che conta) e un livello alla volta (Essenziali, Importanti, Minori,
 * Non contano). La guida dei Ruoli sta sul suo "?": Come funziona, Ruoli per tipo di team, Come si ottiene un ruolo.
 */
export function rolesTab(rating: TeamRating, value: string, t: T, ctx: AreaContext): DetailTab {
  const archetype = rating.needs.archetype;
  const meta = !!rating.meta;
  return {
    key: ROLES_SUB, label: t('area.roles'), value, panel: <RolesPanel rating={rating} ctx={ctx} />,
    help: <RolesGuideSection section="general" archetype={archetype} meta={meta} typeRule={rating.needs.rules.typeRule} />,
    guidePages: rolesGuidePages(archetype, meta, t, rating.needs.rules.typeRule),
  };
}

/**
 * In cima una riga sola: il filtro a sinistra, a destra con che tipo di team si giudica e i punti dei Ruoli (la testata
 * della vecchia scheda Generale, uguale con ogni filtro); sotto la lista scelta. Ogni livello porta quante voci il team
 * copre ("3/5"; Non contano: solo quante sono); un livello senza voci per questo tipo di team non c'è.
 */
function RolesPanel({ rating, ctx }: { rating: TeamRating; ctx: AreaContext }) {
  const t = useT();
  const [picked, setPicked] = useState<RolesFilter>(ctx.rolesFilter ?? 'all');
  const pick = (next: RolesFilter) => { setPicked(next); ctx.onRolesFilter?.(next); };
  const lines = roleLines(rating);
  const levels = LEVEL_ORDER.map(level => {
    const rows = lines.filter(l => l.level === level);
    const covered = rows.filter(l => !l.missing).length;
    return { level, n: rows.length, value: level === 'ignored' ? String(rows.length) : `${covered}/${rows.length}` };
  }).filter(l => l.n > 0);
  // Un livello che non c'è più (es. cambiato il tipo di team): di nuovo Tutti
  const current: RolesFilter = picked === 'all' || levels.some(l => l.level === picked) ? picked : 'all';
  return (
    <div className="rl-frame rl-sub">
      <div className="rl-bar">
        <div className="rl-filter" role="group" aria-label={t('rdetail.filter')}>
          <button type="button" aria-pressed={current === 'all'} onClick={() => pick('all')}>{t('rdetail.filter.all')}</button>
          {levels.map(l => (
            <button key={l.level} type="button" className={l.level} aria-pressed={current === l.level} onClick={() => pick(l.level)}>
              <span>{t(`rdetail.group.${l.level}`)}</span> <b>{l.value}</b>
            </button>
          ))}
        </div>
        <RolesHead rating={rating} />
      </div>
      {current === 'all' ? <RolesGeneral rating={rating} ctx={ctx} head={false} /> : <RolesLevel rating={rating} level={current} ctx={ctx} />}
    </div>
  );
}
