import type { ReactNode } from 'react';
import type { TeamSummary } from '../../engine/teamSummary';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { TeamTypeHelp } from '../CoachPanel';
import { Icon, type IconName } from '../icons';
import type { Density } from '../OverviewDashboard';
import { Sprite } from '../Sprite';
import { TypeIcons } from '../typeIcons';
import { DashCard } from './DashCard';

/** Quante icone di tipo e sprite stanno in una riga prima del "+N". */
const MAX_WEAK = 6;
const MAX_THREATS = 4;

/** Una riga: icona · voce · dato visivo. Cliccabile verso la scheda dell'area, o fissa (la riga Tipo ha già il suo "?"). */
function Row({ icon, label, onClick, children }: { icon: IconName; label: string; onClick?: () => void; children: ReactNode }) {
  const body = (
    <>
      <span className="sum-ic"><Icon name={icon} /></span>
      <span className="sum-k">{label}</span>
      <span className="sum-v">{children}</span>
    </>
  );
  return (
    <li>
      {onClick
        ? <button type="button" className="sum-row" onClick={onClick}>{body}</button>
        : <div className="sum-row">{body}</div>}
    </li>
  );
}

/** Sprite di membri o specie, col nome nel tooltip e per i lettori di schermo. */
function Sprites({ names }: { names: string[] }) {
  return (
    <>
      {names.map(name => (
        <span key={name} className="sum-sprite" title={name}>
          <Sprite species={name} size={30} />
          <span className="visually-hidden">{name}</span>
        </span>
      ))}
    </>
  );
}

const Pill = ({ tone, children }: { tone: 'ok' | 'bad' | 'neu'; children: ReactNode }) => <span className={`sum-pill ${tone}`}>{children}</span>;

/** Il Riassunto della Panoramica: poche righe schematiche, ognuna porta alla sua scheda. */
export function SummarySection({ summary, onView }: { summary: TeamSummary; density: Density; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const lang = useLang();
  const { archetype, styles, attackers, walls, field, hits, weak, missingRoles, threats } = summary;
  const missingHits = hits.total - hits.covered;
  const shownWeak = weak.slice(0, MAX_WEAK);
  return (
    <DashCard className="dash-summary" title={t('sum.title')}>
      <ul className="sum-rows">
        <Row icon="team" label={t('sum.type')}>
          {archetype
            ? <strong className="sum-arch" title={t(`archetype.${archetype}.note`)}>{t(`archetype.${archetype}`)}</strong>
            : <span className="sum-arch">—</span>}
          {styles.map(style => <span key={style} className="team-style" title={t(`teamStyle.${style}.note`)}>{t(`teamStyle.${style}`)}</span>)}
          <TeamTypeHelp />
        </Row>
        <Row icon="sword" label={t('sum.attackers')} onClick={() => onView('strength')}>
          <b className="sum-big">{attackers.length}</b><span className="sum-muted">{t('sum.top')}</span>
          <Sprites names={attackers} />
        </Row>
        {walls.length > 0 && (
          <Row icon="shield" label={t('sum.walls')} onClick={() => onView('defense')}>
            <b className="sum-big">{walls.length}</b>
            <Sprites names={walls} />
          </Row>
        )}
        {field.length > 0 && (
          <Row icon="field" label={t('sum.field')} onClick={() => onView('roles')}>
            {field.map(setter => (
              <span key={setter.member} className="sum-setter">
                <Sprites names={[setter.member]} />
                {setter.items.map(item => <Pill key={item} tone="neu">{gameName('move', item, lang)}</Pill>)}
              </span>
            ))}
          </Row>
        )}
        <Row icon="target" label={t('sum.hits')} onClick={() => onView('strength')}>
          <b className="sum-big">{hits.covered}</b><span className="sum-muted">{t('sum.ofTypes', { total: hits.total })}</span>
          {missingHits > 0 ? <Pill tone="bad">{t('sum.types', { n: missingHits })}</Pill> : <Pill tone="ok">{t('sum.allHit')}</Pill>}
        </Row>
        <Row icon="shieldx" label={t('sum.weak')} onClick={() => onView('defense')}>
          {weak.length === 0 && <Pill tone="ok">{t('sum.none')}</Pill>}
          {shownWeak.map(w => (
            <span key={w.type} className={`sum-weak${w.serious ? ' is-serious' : ''}`}>
              <TypeIcons types={[w.type]} title={typeName(w.type, lang)} />
              <span className="visually-hidden">{typeName(w.type, lang)}</span>
            </span>
          ))}
          {weak.length > MAX_WEAK && <span className="sum-more">+{weak.length - MAX_WEAK}</span>}
          {weak.length > 0 && <Pill tone="bad">{t('sum.types', { n: weak.length })}</Pill>}
        </Row>
        <Row icon="roles" label={t('sum.roles')} onClick={() => onView('roles')}>
          {missingRoles.length === 0 ? <Pill tone="ok">{t('sum.rolesOk')}</Pill> : <Pill tone="bad">{t('sum.rolesMissing', { n: missingRoles.length })}</Pill>}
        </Row>
        {threats && (
          <Row icon="warning" label={t('sum.threats')} onClick={() => onView('coaching')}>
            {threats.length === 0
              ? <Pill tone="ok">{t('sum.allHandled')}</Pill>
              : (
                <>
                  <Pill tone="bad">{t('sum.noCheck', { n: threats.length })}</Pill>
                  <Sprites names={threats.slice(0, MAX_THREATS).map(x => x.species)} />
                  {threats.length > MAX_THREATS && <span className="sum-more">+{threats.length - MAX_THREATS}</span>}
                </>
              )}
          </Row>
        )}
      </ul>
    </DashCard>
  );
}
