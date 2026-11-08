import { battleSpecies } from '../../engine/dex';
import type { MemberOffense, MemberShare, TeamOffense } from '../../engine/offense';
import { useLang, useT } from '../../i18n/react';
import { gameName, typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { Bar } from '../defense/DefenseGeneral';
import { MemberMon } from '../defense/MemberMon';
import { offenseSlots } from './slots';

/** I tipi del membro per fascia, coi colori della scheda Coverage tipi: KO in un colpo, forti (oltre 66%), contano (oltre 33%). */
function TypeBands({ share }: { share: MemberShare }) {
  const t = useT();
  return (
    <span className="og-detail og-bands">
      <span className="og-band"><i className="ok-ohko" aria-hidden="true" />{t('odetail.gen.ohko', { n: share.types.ohko })}</span>
      <span className="og-band"><i className="ok-full" aria-hidden="true" />{t('odetail.gen.strong', { n: share.types.strong })}</span>
      <span className="og-band"><i className="ok-half" aria-hidden="true" />{t('odetail.gen.counts', { n: share.types.counts })}</span>
    </span>
  );
}

/**
 * La scheda Generale dell'Offesa, nella stessa cornice della Difesa (`def-frame`). Per ogni membro tre barre col numero, come
 * la riga Team Coverage in fondo: il voto tipi, il voto meta e il voto del membro da solo (70/30). Con la squadra chiusa
 * (`ctx.roomy`) sotto le barre compaiono i tipi per fascia, i Pokémon del meta mandati KO in due colpi e i punti che il
 * membro porta al team (sommati fanno il voto). Le righe seguono il team; chi il motore ha scartato resta con "—".
 */
export function OffenseGeneral({ offense, meta, ctx }: { offense: TeamOffense; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const roomy = !!ctx.roomy;
  const { members, shares } = offense;
  const slots = offenseSlots(ctx.team, members);
  // Setup e Tera/Z sono già dentro il voto tipi (un terzo e un quarto): lo dice il titolo
  const extras = (m: MemberOffense) => [
    m.setupMove && m.setupGain > 0 ? t('detail.setupExtra', { move: gameName('move', m.setupMove, lang), n: m.setupGain }) : null,
    m.oneUse && m.oneUseGain > 0 ? `${m.oneUse.kind === 'tera' ? t('detail.withTera', { type: typeName(m.oneUse.name, lang) }) : t('detail.withZ', { item: gameName('item', m.oneUse.name, lang) })}: +${m.oneUseGain}` : null,
  ].filter(Boolean) as string[];
  const typesTitle = (m: MemberOffense) => [t('odetail.gen.typesTitle'), ...extras(m)].join(' · ');
  const pointsTitle = (m: MemberOffense, s: MemberShare) => [t('odetail.gen.pointsTitle', { n: s.points }), ...extras(m)].join(' · ');

  return (
    <div className={`def-frame off-frame def-general off-general${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid def-members">
          <colgroup><col className="def-col-mon" /><col />{meta && <col />}<col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              <th scope="col">{t('detail.coverageTypes')}</th>
              {meta && <th scope="col">{t('detail.coverageMeta')}</th>}
              <th scope="col">{t('area.strength')}</th>
            </tr>
          </thead>
          <tbody>
            {ctx.team.map((set, slot) => {
              const name = battleSpecies(set)?.name ?? set.species;
              const index = slots[slot];
              const m = index === null ? null : members[index];
              const s = index === null ? null : shares[index];
              return (
                <tr key={`${name}-${slot}`}>
                  <th scope="row"><MemberMon name={name} set={set} stats="offense" /></th>
                  {m && s
                    ? <>
                      <td>
                        <span className="og-stack" title={typesTitle(m)}><Bar value={m.value} /></span>
                        {roomy && <TypeBands share={s} />}
                      </td>
                      {meta && (
                        <td>
                          <span className="og-stack" title={t('odetail.gen.metaTitle', { n: s.meta?.covered ?? 0, total: s.meta?.total ?? 0 })}><Bar value={m.coverMeta ?? 0} unit="%" /></span>
                          {roomy && <span className="og-detail og-meta">{t('odetail.gen.metaCount', { n: s.meta?.covered ?? 0, total: s.meta?.total ?? 0 })}</span>}
                        </td>
                      )}
                      <td>
                        <span className="og-stack og-own" title={m.coverMeta === null ? t('odetail.gen.ownTitleNoMeta', { n: m.total }) : t('odetail.gen.ownTitle', { types: m.value, meta: m.coverMeta, n: m.total })}><Bar value={m.total} total /></span>
                        {roomy && <span className="og-detail">{t('odetail.gen.points')} <b className="og-points" title={pointsTitle(m, s)}>+{s.points}</b></span>}
                      </td>
                    </>
                    : <><td>—</td>{meta && <td>—</td>}<td>—</td></>}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="og-total">
              <th scope="row">{t('odetail.gen.total')}</th>
              <td><Bar value={offense.types.value} total /></td>
              {meta && <td><Bar value={offense.coverageMeta?.value ?? 0} unit="%" total /></td>}
              <td><Bar value={offense.value} total /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
