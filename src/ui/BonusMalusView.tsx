import type { Lang } from '../i18n';
import { bonusMalusCatalog, type CatalogEntry, type Redundancy, type TeamRating } from '../engine/rating';
import { useT } from '../i18n/react';
import { Typed } from './TypeText';

type T = ReturnType<typeof useT>;
// Lo zero senza segno, come sulla scheda e nella scheda del voto
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** Una voce del catalogo attiva per il team: i punti in tutto e i casi concreti (es. "2 membri deboli a Ghiaccio"). */
interface ActiveEntry { entry: CatalogEntry; points: number; details: string[] }

/** Il caso concreto senza il nome della voce davanti ("Core a tre: X, Y, Z…" → "X, Y, Z…"). */
function detailOf(item: Redundancy, name: string): string {
  const prefix = `${name}:`.toLowerCase();
  const text = item.text.toLowerCase().startsWith(prefix) ? item.text.slice(prefix.length).trim().replace(/^./, c => c.toUpperCase()) : item.text;
  // E senza il nome dietro ("Pivot: ruolo minore coperto" → "Pivot")
  const at = text.lastIndexOf(': ');
  return at > 0 && text.slice(at + 2).toLowerCase() === name.toLowerCase() ? text.slice(0, at) : text;
}

function activeEntries(catalog: CatalogEntry[], kind: CatalogEntry['kind'], items: Redundancy[]): ActiveEntry[] {
  return catalog.filter(e => e.kind === kind).flatMap(entry => {
    const own = items.filter(i => i.catalog === entry.key && i.points > 0);
    return own.length ? [{ entry, points: own.reduce((n, i) => n + i.points, 0), details: own.map(i => detailOf(i, entry.name)) }] : [];
  });
}

/**
 * La scheda Bonus/Malus: in alto le barre di quanto tolgono i malus e aggiungono i bonus; poi le voci che valgono per
 * questo team, sempre in vista, in due colonne (cosa toglie, cosa aggiunge) col caso concreto; sotto le altre voci
 * possibili, a zero, come nomi in fila (quando scattano sta nel title): è l'unica parte che scorre. Le voci attive sono carte
 * affiancate (più per riga), così anche un team con tanti malus le mostra tutte senza scorrere.
 */
export function BonusMalusView({ rating, lang, t }: { rating: TeamRating; lang: Lang; t: T }) {
  const catalog = bonusMalusCatalog(lang);
  const malus = activeEntries(catalog, 'malus', rating.penalty.items);
  const bonus = activeEntries(catalog, 'bonus', rating.bonus.items);
  const active = new Set([...malus, ...bonus].map(a => a.entry.key));
  const rest = catalog.filter(e => !active.has(e.key));
  const malusTotal = rating.penalty.total;
  const bonusTotal = rating.bonus.total;
  // Le barre sulla stessa scala: la più lunga è la più grande delle due (almeno 10 punti, così 1–2 punti restano corti)
  const scale = Math.max(10, malusTotal, bonusTotal);
  const column = (kind: CatalogEntry['kind'], list: ActiveEntry[]) => (
    <section className={`bm-col ${kind}`} aria-label={t(kind === 'malus' ? 'catalogue.takes' : 'catalogue.adds')}>
      <h4 className="bm-head">{t(kind === 'malus' ? 'catalogue.takes' : 'catalogue.adds')}</h4>
      {list.length === 0 ? <p className="bm-none">{t(kind === 'malus' ? 'catalogue.noMalus' : 'catalogue.noBonus')}</p> : (
        <ul>
          {list.map(({ entry, points, details }) => (
            <li key={entry.key} className="bm-card" title={details.join(' · ')}>
              <b>{entry.name}</b>
              <span className="bm-points">{signed(kind === 'malus' ? -points : points)}</span>
              {/* I casi in una riga (al massimo due): il testo intero sta nel title */}
              <span className="bm-detail">{details.map((detail, i) => <span key={detail}>{i > 0 && ' · '}<Typed text={detail} /></span>)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <div className="bm">
      <div className="bm-bars">
        {([['malus', malusTotal], ['bonus', bonusTotal]] as const).map(([kind, total]) => (
          <div key={kind} className={`bm-bar ${kind}`}>
            <span>{t(`catalogue.${kind}`)}</span>
            {/* A zero la barra resta vuota (niente tacca) */}
            <span className="bm-track" aria-hidden="true">{total > 0 && <span style={{ width: `${(100 * total) / scale}%` }} />}</span>
            <b className={total === 0 ? 'zero' : undefined}>{signed(kind === 'malus' ? -total : total)}</b>
          </div>
        ))}
      </div>
      <div className="bm-cols">
        {column('malus', malus)}
        {column('bonus', bonus)}
      </div>
      {rest.length > 0 && (
        <section className="bm-rest" aria-label={t('catalogue.rest')}>
          <h4 className="bm-head">
            {t('catalogue.rest')}
            <small><i className="malus" />{t('catalogue.restTakes')} · <i className="bonus" />{t('catalogue.restAdds')}</small>
          </h4>
          {/* Solo i nomi, in fila: quando scatta una voce sta nel title (e nel testo nascosto per i lettori di schermo) */}
          <ul>
            {rest.map(entry => (
              <li key={entry.key} className={`bm-tile ${entry.kind}`} title={entry.when}>
                <i aria-hidden="true" />{entry.name}
                <span className="visually-hidden">: {entry.when}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
