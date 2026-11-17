import type { MetaVersus as Versus } from '../../engine/overviewDashboard';
import { useT } from '../../i18n/react';
import { Icon } from '../icons';
import { Sprite } from '../Sprite';

/** Le sprite dei membri nelle due righe: la misura delle righe della Panoramica in piccolo (stanno in fila con le parole). */
const VS_SPRITE = 28;

/**
 * "Contro il tuo team", in fondo alla scheda Meta (sotto "Spesso con"): come se la cava il team col Pokémon scelto, con
 * gli stessi dati e le stesse parole della Coverage meta e delle minacce della Panoramica (`metaVersus`). In testa
 * l'etichetta e una targhetta inclinata: "scoperta" (rossa, un lato senza nessuno), "a fatica" (gialla, uno solo),
 * "gestito" (verde); per un tuo membro "nel tuo team" (ciano) e una riga che dice che i conti sono del resto del team.
 * Poi le righe dello scudo (chi lo regge) e della spada (chi lo manda KO in due colpi), con le sprite dei membri e il
 * conto colorato (0 rosso, 1 giallo, 2+ verde); un lato che non ha la riga (l'Offesa ha un bersaglio per combinazione di
 * tipi) non c'è, e nemmeno il suo link. I link aprono la Coverage meta di quell'area con la minaccia accesa.
 */
export function MetaVersus({ name, versus, onCoverage }: {
  name: string;
  versus: Versus;
  onCoverage: (side: 'defense' | 'offense') => void;
}) {
  const t = useT();
  const tag = versus.own
    ? { cls: 'own', word: t('meta.vsOwn') }
    : versus.status === 'open' ? { cls: 'open', word: t('dash.threatOpen') }
      : versus.status === 'thin' ? { cls: 'thin', word: t('dash.threatThin') }
        : { cls: 'held', word: t('meta.vsHeld') };
  const row = (side: 'defense' | 'offense', who: string[]) => {
    const label = side === 'defense'
      ? t(who.length > 1 ? 'meta.vsHoldsMany' : 'meta.vsHolds')
      : t(who.length > 1 ? 'meta.vsKosMany' : 'meta.vsKos');
    const level = who.length === 0 ? 'open' : who.length === 1 ? 'thin' : 'held';
    return (
      <li className={`mvs-row ${side}`}>
        <Icon name={side === 'defense' ? 'shield' : 'sword'} />
        <span className="mvs-who">
          {who.length === 0
            ? <b className="mvs-none">{t('meta.vsNobody')}</b>
            : who.map(member => (
              <span key={member} className="mvs-member" title={member}>
                <Sprite species={member} size={VS_SPRITE} />
                <span className="visually-hidden">{member}, </span>
              </span>
            ))}
          <span className="mvs-label">{label}</span>
        </span>
        <span className={`mvs-count ${level}`} aria-hidden="true">{who.length}</span>
      </li>
    );
  };
  return (
    <section className="meta-sub meta-vs" aria-label={`${t('meta.vs')}: ${tag.word}`}>
      <div className="mvs-head">
        <h4>{t('meta.vs')}</h4>
        <span className={`mvs-tag ${tag.cls}`}>{tag.word}</span>
      </div>
      {versus.own && <p className="mvs-note">{t('meta.vsOwnNote', { name })}</p>}
      <ul className="mvs-rows">
        {versus.defense && row('defense', versus.defense)}
        {versus.offense && row('offense', versus.offense)}
      </ul>
      <div className="mvs-links">
        {versus.defense && (
          <button type="button" className="dash-link" onClick={() => onCoverage('defense')} aria-label={t('meta.vsDefenseSr', { name })}>
            {t('meta.vsDefense')}<Icon name="next" />
          </button>
        )}
        {versus.offense && (
          <button type="button" className="dash-link" onClick={() => onCoverage('offense')} aria-label={t('meta.vsOffenseSr', { name })}>
            {t(versus.defense ? 'meta.vsOffense' : 'meta.vsOffenseAlone')}<Icon name="next" />
          </button>
        )}
      </div>
    </section>
  );
}
