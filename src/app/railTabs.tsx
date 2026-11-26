import type { CoachProblem } from '../engine/coach';
import { battleName } from '../engine/dex';
import type { EffectiveLists } from '../engine/lists';
import type { TeamRating } from '../engine/rating';
import type { TeamSet } from '../engine/sets';
import { formatPercent, t, type Lang } from '../i18n';
import type { TabId, TabInfo } from '../ui/Tabs';

/**
 * Le tessere delle sezioni nella barra: sotto il nome lo stato della sezione, leggibile senza aprirla. Sul computer la
 * riga mostra solo il numero a destra (count); lo stato intero resta la descrizione della scheda (hint).
 * Con l'editor aperto la sezione sotto non si vede: la sua riga dice chi stai modificando, col nome che ha sulla carta.
 */
export function railTabs({ lang, team, replaceIndex, problems, rating, grading, metaOn, metaAverage, userLists, editing, shownTab }: {
  lang: Lang;
  team: TeamSet[];
  replaceIndex: number | null;
  problems: CoachProblem[];
  rating: TeamRating | null;
  grading: boolean;
  metaOn: boolean;
  metaAverage: number | null;
  userLists: EffectiveLists;
  editing: TeamSet | undefined;
  shownTab: TabId;
}): TabInfo[] {
  const teamText = t(lang, team.length ? 'rail.teamCount' : 'rail.teamEmpty', { n: team.length });
  const replacing = replaceIndex !== null ? team[replaceIndex] : undefined;
  const problemsText = problems.length ? t(lang, problems.length === 1 ? 'tabs.problemsOne' : 'tabs.problemsMany', { n: problems.length }) : null;
  const serious = problems.some(p => p.severity === 'serious');
  const noGrade = t(lang, grading ? 'rating.calculating' : 'rail.noGrade');
  const metaText = !metaOn ? t(lang, 'rail.metaOff')
    : team.length > 0 && metaAverage !== null ? t(lang, 'meta.average', { pct: formatPercent(lang, metaAverage) })
    : t(lang, 'rail.metaUsage');
  const fav = userLists.favorites.size;
  const ban = userLists.bans.size;
  const listsText = fav || ban ? [
    fav ? t(lang, fav === 1 ? 'rail.favOne' : 'rail.favMany', { n: fav }) : null,
    ban ? t(lang, ban === 1 ? 'rail.banOne' : 'rail.banMany', { n: ban }) : null,
  ].filter(Boolean).join(' · ') : t(lang, 'rail.listsEmpty');

  const tabs: TabInfo[] = [
    { id: 'pokemon', label: t(lang, 'tabs.pokemon'), icon: 'team',
      count: team.length ? { text: `${team.length}/6`, level: 'info' } : null,
      hint: teamText,
      status: replacing
        ? <span className="info">{t(lang, 'suggest.replaceTitle', { species: replacing.name || battleName(replacing) })}</span>
        : teamText },
    { id: 'analysis', label: t(lang, 'tabs.analysis'), icon: 'roles',
      // Col team incompleto il numero resta neutro: giallo o rosso solo a team completo (un team a metà non è «rotto»)
      count: problems.length ? { text: String(problems.length), level: team.length < 6 ? 'info' : serious ? 'serious' : 'warn' } : null,
      hint: rating ? [`${rating.grade} ${rating.overall}`, ...(problemsText ? [problemsText] : [])].join(' · ') : noGrade,
      status: rating ? <>
        {/* Team non legale nel formato: il voto in grigio, come nella carta del voto */}
        <b className={`grade grade-${rating.grade}${problems.some(p => p.category === 'rules') ? ' illegal' : ''}`}>{rating.grade} {rating.overall}</b>
        {problemsText && <>{' · '}<span className={serious ? 'serious' : 'minor'}>{problemsText}</span></>}
      </> : noGrade },
    { id: 'meta', label: t(lang, 'tabs.meta'), icon: 'globe', disabled: !metaOn, note: metaOn ? undefined : t(lang, 'tabs.metaOff'),
      hint: metaText, status: metaText },
    { id: 'lists', label: t(lang, 'tabs.lists'), icon: 'star',
      count: fav || ban ? { text: fav && ban ? `${fav}·${ban}` : String(fav || ban), level: 'info' } : null,
      hint: listsText, status: listsText },
    // Confronto (in arrivo) non si mostra finché non c'è: quando arriva, si torna ad aggiungere qui
    // { id: 'compare', label: t(lang, 'tabs.compare'), icon: 'search', disabled: true, note: t(lang, 'tabs.soon'), status: t(lang, 'rail.soon') },
  ];
  if (!editing) return tabs;
  const editingText = t(lang, 'rail.editing', { species: editing.name || battleName(editing) });
  return tabs.map(tab => (tab.id === shownTab ? { ...tab, status: <span className="info">{editingText}</span>, hint: editingText } : tab));
}
