import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { DashboardData, MetaThreat } from '../../engine/overviewDashboard';
import { battleSpecies } from '../../engine/dex';
import { formatPercent } from '../../i18n';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import type { KoFocus } from '../AreaDetail';
import { FloatTip, goText, TipGo, useFloatAnchor } from '../FloatTip';
import { Icon } from '../icons';
import { Sprite, typeColor } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { DashCard, DashLink } from './DashCard';

/**
 * Quante minacce stanno in fila: 5 se la carta è larga almeno THREATS_FIVE_FROM px (dentro, senza i margini), 4 sotto.
 * Misure: 1440×900 ≈ 798 · 1366×768 ≈ 750 · 1920×1080 ≈ 1135 (5); 1280×620 ≈ 706 (4). Il "+N" ha la sua colonna stretta
 * in più, così le carte restano larghe uguali.
 */
export const THREATS_FIVE_FROM = 740;
/** Il nome della minaccia: 13px; se non sta si rimpicciolisce fino a 11px, poi va a capo (mai i puntini). */
const NAME_PX = 13;
const NAME_MIN_PX = 11;

/** Le parole di una ragione: "Nessuno lo regge bene", "Lo regge solo Kingambit", "Lo manda KO solo Iron Valiant". */
/** Il primo tipo della minaccia: dà il colore al fondo della carta e al tooltip. */
function firstType(species: string): string {
  return battleSpecies({ species, item: '' })?.types[0] ?? '';
}

function useReasonText() {
  const t = useT();
  return (threat: MetaThreat) => threat.reasons.map(r => (r.side === 'defense'
    ? r.by.length ? t('dash.threatDefOne', { name: r.by[0] }) : t('dash.threatDefNone')
    : r.by.length ? t('dash.threatOffOne', { name: r.by[0] }) : t('dash.threatOffNone')));
}

/**
 * Minacce del meta: le N (5 o 4, secondo la larghezza) che il team gestisce peggio, in fila sotto la Copertura (regola
 * in `metaThreats`). Ogni carta, lavata nel colore del primo tipo: sprite, nome (mai tagliato) e la targhetta inclinata
 * "scoperta" (rossa) o "a fatica" (gialla), l'unico segno dello stato. Col mouse e col fuoco il tooltip DreamDex con le ragioni intere, l'uso nel meta e in fondo dove porta il clic (TipGo); il
 * clic apre la Coverage meta (Difesa, o Offesa se è il lato peggiore) con la colonna della minaccia accesa. Quelle che
 * non stanno vanno in un "+N" tratteggiato (tooltip coi nomi e lo stesso piede, clic sulla Coverage meta). Senza minacce una riga verde.
 */
export function ThreatsSection({ threats, onView }: {
  threats: DashboardData['threats'];
  onView: (v: AnalysisView, sub?: string, focus?: KoFocus) => void;
}) {
  const t = useT();
  const lang = useLang();
  const reasonText = useReasonText();
  const tip = useFloatAnchor<string>();
  const moreTip = useFloatAnchor<true>();
  // Dove porta il clic (il piede TipGo dei tooltip), anche ai lettori di schermo: una descrizione per tutte le carte
  const goId = useId();
  const place = t('dash.threatFoot');
  const box = useRef<HTMLDivElement>(null);
  // La larghezza della carta (0 = non misurata, come nei test senza layout: 5)
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const apply = () => { if (el.clientWidth > 0) setWidth(el.clientWidth); };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const slots = width > 0 && width < THREATS_FIVE_FROM ? 4 : 5;
  const list = threats.list;
  const shown = list.slice(0, slots);
  const hidden = list.slice(slots);
  const word = (x: MetaThreat) => t(x.status === 'open' ? 'dash.threatOpen' : 'dash.threatThin');
  const usage = (x: MetaThreat) => t('dash.threatUsage', { pct: formatPercent(lang, x.usage) });
  const open = (x?: MetaThreat) => (x
    ? onView(x.side === 'defense' ? 'defense' : 'strength', 'coverageMeta', { kind: 'threat', side: x.side, species: x.species })
    : onView('defense', 'coverageMeta'));

  // Il nome sta su una riga: se non ci sta si rimpicciolisce (fino a NAME_MIN_PX), poi va a capo; si rifà se cambia la misura
  useLayoutEffect(() => {
    for (const el of box.current?.querySelectorAll<HTMLElement>('.thr-name') ?? []) {
      el.style.fontSize = '';
      el.classList.remove('wrap');
      if (!el.clientWidth || el.scrollWidth <= el.clientWidth) continue;
      const px = Math.floor(NAME_PX * (el.clientWidth / el.scrollWidth) * 10) / 10;
      if (px >= NAME_MIN_PX) el.style.fontSize = `${px}px`;
      else { el.style.fontSize = `${NAME_MIN_PX}px`; el.classList.add('wrap'); }
    }
  }, [width, slots, list, lang]);

  const tipThreat = tip.anchor ? list.find(x => x.species === tip.anchor!.key) : undefined;
  return (
    <DashCard className="dash-threats" title={t('dash.threats')}
      meta={list.length > 0 ? t('dash.threatsMeta', { n: Math.min(slots, list.length) }) : undefined}
      links={<DashLink label={t('detail.coverageMeta')} area={t('detail.coverageMeta')} onClick={() => open()} />}>
      <div ref={box} className="thr-box">
        {list.length === 0
          ? <p className="dash-note good"><Icon name="check" />{t('dash.threatsNone')}</p>
          : (
            <ul className="thr-row" style={{ '--thr-n': slots, '--thr-more': hidden.length ? '44px' : '0px' } as CSSProperties}>
              {shown.map(x => (
                <li key={x.species}>
                  <button type="button" className={`thr-card ${x.status}`} onClick={() => { tip.close(); open(x); }} {...tip.bind(x.species)}
                    style={{ '--t1': typeColor(firstType(x.species)) } as CSSProperties}
                    aria-label={t('dash.threatLabel', { species: x.species, word: word(x), reasons: reasonText(x).join('. '), usage: usage(x) })} aria-describedby={goId}>
                    <Sprite species={x.species} size={48} />
                    <span className="thr-text" aria-hidden="true">
                      <b className="thr-name">{x.species}</b>
                      <small className="thr-word">{word(x)}</small>
                    </span>
                  </button>
                </li>
              ))}
              {hidden.length > 0 && (
                <li>
                  <button type="button" className="thr-more" onClick={() => { moreTip.close(); open(); }} {...moreTip.bind(true)}
                    aria-label={t('dash.threatsMoreSr', { n: hidden.length, list: hidden.map(x => `${x.species} (${word(x)})`).join(', ') })} aria-describedby={goId}>
                    <span aria-hidden="true">{t('dash.threatsMore', { n: hidden.length })}</span>
                  </button>
                </li>
              )}
            </ul>
          )}
        {/* Dove porta il clic, per i lettori di schermo: nascosto dentro la carta (non nel body: niente nodi fuori dall'albero della carta) */}
        {list.length > 0 && <span id={goId} hidden>{goText(t, place)}</span>}
      </div>
      {tip.anchor && tipThreat && (
        <FloatTip rect={tip.anchor.rect} tone={typeColor(firstType(tipThreat.species))} className="thr-tip">
          <div className="ftip-head">
            <Sprite species={tipThreat.species} size={SPRITE_TIP_ROW} />
            <b>{tipThreat.species}</b>
            <span className="thr-tip-use">{usage(tipThreat)}</span>
          </div>
          <ul className="thr-tip-why">
            {reasonText(tipThreat).map((line, i) => (
              <li key={line} className={tipThreat.reasons[i].by.length ? 'thin' : 'open'}>{line}</li>
            ))}
          </ul>
          <TipGo place={place} />
        </FloatTip>
      )}
      {moreTip.anchor && (
        <FloatTip rect={moreTip.anchor.rect} tone={hidden.some(x => x.status === 'open') ? 'var(--bad)' : 'var(--warn)'} className="thr-tip">
          <div className="ftip-head"><b>{t('dash.threatsMoreHead', { n: hidden.length })}</b></div>
          <ul className="thr-tip-why">
            {hidden.map(x => <li key={x.species} className={x.status === 'open' ? 'open' : 'thin'}><b>{x.species}</b> {word(x)}</li>)}
          </ul>
          <TipGo place={place} />
        </FloatTip>
      )}
    </DashCard>
  );
}
