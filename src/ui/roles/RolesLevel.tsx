import type { TeamRating } from '../../engine/rating';
import { ESSENTIAL_POINTS, IMPORTANT_POINTS, MINOR_POINTS } from '../../engine/rolesArea';
import type { Level } from '../../engine/roleLevels';
import { useT } from '../../i18n/react';
import type { AreaContext } from '../AreaDetail';
import { tone } from '../defense/DefenseGeneral';
import { holderReason, keyLabel, RoleMon } from './RoleParts';
import { byFamily, points, roleLines, type RoleLine } from './rolesRows';

/**
 * Una sottoscheda di livello (Essenziali, Importanti, Minori, Non contano): una riga per voce, raggruppate per famiglia,
 * prima quelle che mancano. Ogni riga: nome, valore del team in pillola, chi la copre (icona e valore, dal migliore;
 * il secondario segnato) e il motivo del migliore. La lista scorre dentro la sua cornice, mai la pagina.
 */
export function RolesLevel({ rating, level, ctx }: { rating: TeamRating; level: Level; ctx: AreaContext }) {
  const t = useT();
  const { roles } = rating;
  const full = roles.members.length === 6;
  const pool = t(rating.meta ? 'rdetail.pool.meta' : 'rdetail.pool.tier');
  const groups = byFamily(roleLines(rating).filter(l => l.level === level));

  const pill = (l: RoleLine) => {
    const n = points(l.value);
    // Essenziale o importante che manca in un team di 6: al posto del valore il suo malus
    if (full && l.missing && (level === 'essential' || level === 'important')) {
      const malus = level === 'essential' ? ESSENTIAL_POINTS : IMPORTANT_POINTS;
      return <span className="ct-pill bad" title={t('rdetail.missingTip', { n: malus })}>−{malus}</span>;
    }
    // Minore coperta: al posto del valore il suo bonus (il valore resta nel titolo)
    if (level === 'minor' && !l.missing) {
      return <span className="ct-pill good" title={t('rdetail.bonusTip', { v: n, n: MINOR_POINTS })}>+{MINOR_POINTS}</span>;
    }
    // Le voci che non contano: valore in grigio, senza il colore del voto
    const cls = n === 0 ? 'zero' : level === 'ignored' ? 'quiet' : tone(n);
    return <span className={`ct-pill ${cls}`}>{n}</span>;
  };

  return (
    <div className={`rl-frame rl-level rl-level-${level}`}>
      <div className="rl-scroll">
        <table className="rl-table">
          <colgroup><col className="rl-col-role" /><col className="rl-col-val" /><col className="rl-col-by" /><col /></colgroup>
          <thead>
            <tr>
              <th scope="col">{t('rdetail.role')}</th>
              <th scope="col">{t('rdetail.value')}</th>
              <th scope="col">{t('rdetail.by')}</th>
              <th scope="col">{t('rdetail.reason')}</th>
            </tr>
          </thead>
          {groups.map(g => (
            <tbody key={g.family}>
              <tr className="rl-fam"><th scope="rowgroup" colSpan={4}>{t(`family.${g.family}`)}</th></tr>
              {g.lines.map(l => {
                const best = l.by[0];
                const state = l.missing ? (level === 'essential' ? 'bad' : level === 'important' ? 'warn' : 'soft') : '';
                return (
                  <tr key={l.key} className={state || undefined}>
                    <th scope="row">{keyLabel(l.key, t)}</th>
                    <td>{pill(l)}</td>
                    <td className="rl-by">
                      {l.by.length
                        ? l.by.map(h => <RoleMon key={h.slot} h={h} t={t} mark why={holderReason(l.key, h, roles, ctx.team, pool, t)} />)
                        : <span className="rl-nobody">{t('rdetail.nobody')}</span>}
                    </td>
                    <td className="rl-reason">{best ? holderReason(l.key, best, roles, ctx.team, pool, t) || '—' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
