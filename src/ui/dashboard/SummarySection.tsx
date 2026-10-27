import type { CSSProperties, ReactNode } from 'react';
import { needLabel } from '../../engine/needs';
import type { TeamSummary } from '../../engine/teamSummary';
import { formatPercent } from '../../i18n';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import { TeamTypeHelp } from '../CoachPanel';
import { Icon, type IconName } from '../icons';
import type { Density } from '../OverviewDashboard';
import { Sprite } from '../Sprite';
import { TypeIcons } from '../typeIcons';
import { DashCard } from './DashCard';
import { useFit } from './useFit';

/** Tetto fisso di icone di tipo e sprite di minacce prima del "+N" nelle righe compatte (anche se ce ne starebbero di più). */
const MAX_WEAK = 6;
const MAX_THREATS = 4;

/**
 * Una riga. Compatta (stretto, normale): icona · voce · dato visivo su una linea.
 * Ricca (ampia, team ridotto): un blocco a due linee, icona a sinistra; in alto voce e numero (`lead`), sotto le schede
 * che vanno a capo. `grow`: quanta altezza della colonna prende rispetto alle altre (circa le sue linee).
 * Cliccabile verso la scheda dell'area, o fissa (la riga Tipo ha già il suo "?").
 */
function Row({ icon, label, onClick, fit, lead, rich = false, grow = 0.05, children }: {
  icon: IconName; label: string; onClick?: () => void;
  /** Il dato visivo a misura (useFit): ref del contenitore; ciò che non sta finisce nel "+N". */
  fit?: (el: HTMLSpanElement | null) => void;
  lead?: ReactNode;
  rich?: boolean;
  grow?: number;
  children?: ReactNode;
}) {
  const value = <span ref={fit} className={fit ? 'sum-v sum-fit' : 'sum-v'}>{!rich && lead}{children}</span>;
  const body = rich
    ? (
      <>
        <span className="sum-ic"><Icon name={icon} /></span>
        <span className="sum-top"><span className="sum-k">{label}</span>{lead}</span>
        {value}
      </>
    )
    : (
      <>
        <span className="sum-ic"><Icon name={icon} /></span>
        <span className="sum-k">{label}</span>
        {value}
      </>
    );
  return (
    <li className={rich ? (children ? 'is-rich' : 'is-rich is-flat') : undefined} style={rich ? { '--grow': grow } as CSSProperties : undefined}>
      {onClick
        ? <button type="button" className="sum-row" onClick={onClick}>{body}</button>
        : <div className="sum-row">{body}</div>}
    </li>
  );
}

/** Sprite di un membro o di una specie, col nome nel tooltip e per i lettori di schermo. */
function MonSprite({ name }: { name: string }) {
  return (
    <span className="sum-sprite" title={name}>
      <Sprite species={name} size={30} />
      <span className="visually-hidden">{name}</span>
    </span>
  );
}

/** Scheda della vista ricca: sprite o icona, nome scritto, poi un numero o delle pill. */
function Chip({ tone, art, name, title, children }: { tone?: 'ok' | 'bad'; art?: ReactNode; name: string; title?: string; children?: ReactNode }) {
  return (
    <span className={`sum-chip${tone ? ` ${tone}` : ''}`} title={title ?? name}>
      {art}<span className="sum-chip-name">{name}</span>{children}
    </span>
  );
}

const MonArt = ({ name }: { name: string }) => <span className="sum-chip-sprite"><Sprite species={name} size={30} /></span>;
const TypeArt = ({ type }: { type: string }) => <span className="sum-chip-type"><TypeIcons types={[type]} /></span>;

/** Il "+N": a vista solo il numero, per intero nel tooltip e ai lettori di schermo. */
function More({ label, n }: { label: string; n: number }) {
  return (
    <span data-fit-more className="sum-more" title={label}>
      <span aria-hidden="true">+{n}</span><span className="visually-hidden">{label}</span>
    </span>
  );
}

/**
 * Una riga con voci che si contano (sprite, icone, schede): prima `lead` (numero, pill), poi le voci che stanno
 * (una linea nella riga compatta, l'altezza del blocco nella ricca), al massimo `cap`; le altre nel "+N" (useFit),
 * così nessuna voce resta tagliata a metà o sparisce in silenzio.
 */
function FitRow({ icon, label, onClick, lead, items, cap = items.length, min = 0, more, fitKey, rich = false, grow }: {
  icon: IconName; label: string; onClick: () => void;
  lead?: ReactNode;
  items: { key: string; node: ReactNode }[];
  cap?: number;
  min?: number;
  /** Testo intero del "+N" per n voci nascoste. */
  more: (n: number) => string;
  /** Cambia quando cambia ciò che occupa spazio (voci, lingua, densità): si rimisura. */
  fitKey: string;
  rich?: boolean;
  grow?: number;
}) {
  const capped = Math.min(cap, items.length);
  const fit = useFit<HTMLSpanElement>(fitKey, capped, { more: true, min });
  const shown = Math.min(fit.shown, capped);
  const hidden = items.length - shown;
  return (
    <Row icon={icon} label={label} onClick={onClick} fit={fit.ref} lead={lead} rich={rich} grow={grow}>
      {items.slice(0, shown).map(item => <span key={item.key} data-fit className="sum-item">{item.node}</span>)}
      {hidden > 0 && <More n={hidden} label={more(hidden)} />}
    </Row>
  );
}

const Pill = ({ tone, children }: { tone: 'ok' | 'bad' | 'neu'; children: ReactNode }) => <span className={`sum-pill ${tone}`}>{children}</span>;

/**
 * Peso di una riga ricca: le linee di schede oltre la prima (`perLine` per linea, al massimo 3 linee). Lo spazio che avanza
 * va quasi tutto alle righe con più schede; un minimo (0,05) alle altre, perché senza righe lunghe si divida comunque.
 */
const linesOf = (n: number, perLine: number) => Math.min(3, Math.ceil(n / perLine)) - 1 + 0.05;

/** Il Riassunto della Panoramica: poche righe schematiche, ognuna porta alla sua scheda. */
export function SummarySection({ summary, members, density, rich = false, onView }: {
  summary: TeamSummary; members: number;
  /** Sprite e icone cambiano misura con la densità: le righe a misura si rimisurano. */
  density: Density;
  /** Righe ricche (nomi, numeri, schede su due linee): team ridotto e cruscotto alto (RICH_FROM). */
  rich?: boolean;
  onView: (v: AnalysisView) => void;
}) {
  const t = useT();
  const lang = useLang();
  const { archetype, styles, attackers, walls, field, hits, hitsMissing, weak, missingRoles, keyRoles, offenseOf, defenseOf, threats } = summary;
  // Singolare / plurale: chiavi One/Many come il resto dell'interfaccia
  const count = (key: 'sum.moreField' | 'sum.moreMons' | 'sum.moreTypes' | 'sum.moreThreats' | 'sum.types' | 'sum.missing' | 'sum.moreRoles', n: number) =>
    t(`${key}${n === 1 ? 'One' : 'Many'}`, { n });
  const keyOf = (parts: string[]) => `${lang}|${density}|${rich}|${parts.join()}`;
  const missingHits = hits.total - hits.covered;
  const names = missingRoles.map(need => needLabel(need, lang)).join(' · ');
  // Membri: sprite (compatta) o scheda con nome e numero (ricca)
  const mons = (list: string[], score: Record<string, number>) => list.map(name => ({
    key: name,
    node: rich
      ? <Chip art={<MonArt name={name} />} name={name}>{score[name] !== undefined && <b className="sum-chip-num">{score[name]}</b>}</Chip>
      : <MonSprite name={name} />,
  }));
  const setterPills = (items: string[], weather?: string) => (
    <>
      {items.map(item => <Pill key={item} tone="neu">{gameName('move', item, lang)}</Pill>)}
      {weather && <Pill tone="neu">{weather}</Pill>}
    </>
  );
  // Ruoli chiave: prima i mancanti, così il "+N" non nasconde mai un problema
  const roleItems = [...keyRoles].sort((a, b) => Number(a.covered) - Number(b.covered)).map(role => ({
    key: role.need,
    node: (
      <Chip tone={role.covered ? 'ok' : 'bad'} art={<Icon name={role.covered ? 'check' : 'close'} />} name={needLabel(role.need, lang)}
        title={`${needLabel(role.need, lang)}: ${t(role.covered ? 'sum.covered' : 'sum.uncovered')}`} />
    ),
  }));
  return (
    <DashCard className="dash-summary" title={t('sum.title')}>
      <ul className="sum-rows">
        {members >= 2 && <Row icon="team" label={t('sum.type')} rich={rich}>
          {archetype
            ? <strong className="sum-arch" title={t(`archetype.${archetype}.note`)}>{t(`archetype.${archetype}`)}</strong>
            : <span className="sum-arch">—</span>}
          {styles.map(style => <span key={style} className="team-style" title={t(`teamStyle.${style}.note`)}>{t(`teamStyle.${style}`)}</span>)}
          <TeamTypeHelp />
        </Row>}
        {attackers.length > 0 && (
          <FitRow icon="sword" label={t('sum.attackers')} onClick={() => onView('strength')} fitKey={keyOf(attackers)}
            rich={rich} grow={linesOf(attackers.length, 2)}
            lead={<><b className="sum-big">{attackers.length}</b><span className="sum-muted">{t('sum.top')}</span></>}
            items={mons(attackers, offenseOf)} more={n => count('sum.moreMons', n)} />
        )}
        {walls.length > 0 && (
          <FitRow icon="shield" label={t('sum.walls')} onClick={() => onView('defense')} fitKey={keyOf(walls)}
            rich={rich} grow={linesOf(walls.length, 2)}
            lead={<b className="sum-big">{walls.length}</b>}
            items={mons(walls, defenseOf)} more={n => count('sum.moreMons', n)} />
        )}
        {field.length > 0 && (
          // Campo: almeno un piazzatore; i nomi delle mosse cambiano larghezza con la lingua
          <FitRow icon="field" label={t('sum.field')} onClick={() => onView('roles')} min={1}
            rich={rich} grow={linesOf(field.length, 1)}
            fitKey={keyOf(field.map(f => `${f.member}:${f.items.join('+')}:${f.weather ?? ''}`))}
            items={field.map(setter => ({
              key: setter.member,
              node: rich
                ? <Chip art={<MonArt name={setter.member} />} name={setter.member}>{setterPills(setter.items, setter.weather)}</Chip>
                : <span className="sum-setter"><MonSprite name={setter.member} />{setterPills(setter.items, setter.weather)}</span>,
            }))}
            more={n => count('sum.moreField', n)} />
        )}
        {(() => {
          const lead = (
            <>
              <b className="sum-big">{hits.covered}</b><span className="sum-muted">{t('sum.ofTypes', { total: hits.total })}</span>
              {missingHits > 0 ? <Pill tone="bad">{count('sum.missing', missingHits)}</Pill> : <Pill tone="ok">{t('sum.allHit')}</Pill>}
            </>
          );
          // Ricca: i tipi che nessuno colpisce, per nome
          return rich && hitsMissing.length > 0
            ? <FitRow icon="target" label={t('sum.hits')} onClick={() => onView('strength')} rich grow={linesOf(hitsMissing.length, 3)}
                fitKey={keyOf(hitsMissing)} lead={lead} more={n => count('sum.moreTypes', n)}
                items={hitsMissing.map(type => ({ key: type, node: <Chip tone="bad" art={<TypeArt type={type} />} name={typeName(type, lang)} /> }))} />
            : <Row icon="target" label={t('sum.hits')} onClick={() => onView('strength')} lead={lead} rich={rich} />;
        })()}
        {weak.length === 0
          ? <Row icon="shieldx" label={t('sum.weak')} onClick={() => onView('defense')} rich={rich} lead={<Pill tone="ok">{t('sum.none')}</Pill>} />
          : (
            <FitRow icon="shieldx" label={t('sum.weak')} onClick={() => onView('defense')} cap={rich ? weak.length : MAX_WEAK}
              rich={rich} grow={linesOf(weak.length, 3)}
              fitKey={keyOf(weak.map(w => w.type))}
              lead={<Pill tone="bad">{count('sum.types', weak.length)}</Pill>}
              items={weak.map(w => ({
                key: w.type,
                node: rich
                  ? (
                    <Chip tone={w.serious ? 'bad' : undefined} art={<TypeArt type={w.type} />} name={typeName(w.type, lang)}>
                      {w.serious && w.resist === 0 && <small className="sum-flag">{t('sum.noResist')}</small>}
                    </Chip>
                  )
                  : (
                    <span className={`sum-weak${w.serious ? ' is-serious' : ''}`}>
                      <TypeIcons types={[w.type]} title={typeName(w.type, lang)} />
                      <span className="visually-hidden">{typeName(w.type, lang)}</span>
                    </span>
                  ),
              }))}
              more={n => count('sum.moreTypes', n)} />
          )}
        {rich && keyRoles.length > 0
          ? (
            <FitRow icon="roles" label={t('sum.roles')} onClick={() => onView('roles')} rich grow={linesOf(keyRoles.length, 2)}
              fitKey={keyOf(keyRoles.map(r => `${r.need}:${r.covered}`))}
              lead={missingRoles.length === 0 ? <Pill tone="ok">{t('sum.rolesOk')}</Pill> : <Pill tone="bad">{count('sum.missing', missingRoles.length)}</Pill>}
              items={roleItems} more={n => count('sum.moreRoles', n)} />
          )
          : (
            <Row icon="roles" label={t('sum.roles')} onClick={() => onView('roles')} rich={rich}>
              {missingRoles.length === 0 ? <Pill tone="ok">{t('sum.rolesOk')}</Pill> : <><Pill tone="bad">{count('sum.missing', missingRoles.length)}</Pill><span className="sum-names" title={names}>{names}</span></>}
            </Row>
          )}
        {threats && (threats.length === 0
          ? <Row icon="warning" label={t('sum.threats')} onClick={() => onView('coaching')} rich={rich} lead={<Pill tone="ok">{t('sum.allHandled')}</Pill>} />
          : (
            <FitRow icon="warning" label={t('sum.threats')} onClick={() => onView('coaching')} cap={rich ? threats.length : MAX_THREATS}
              rich={rich} grow={linesOf(threats.length, 2)}
              fitKey={keyOf(threats.map(x => x.species))}
              lead={<Pill tone="bad">{t('sum.noCheck', { n: threats.length })}</Pill>}
              items={threats.map(x => ({
                key: x.species,
                node: rich
                  ? <Chip art={<MonArt name={x.species} />} name={x.species}><span className="sum-chip-use">{formatPercent(lang, x.usage, 0)}</span></Chip>
                  : <MonSprite name={x.species} />,
              }))}
              more={n => count('sum.moreThreats', n)} />
          ))}
      </ul>
    </DashCard>
  );
}
