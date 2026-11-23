import { formatPercent } from '../../i18n';
import { useLang, useT } from '../../i18n/react';
import { FloatTip, TipGo } from '../FloatTip';
import { Icon } from '../icons';
import { typeColor } from '../Sprite';
import { TipHead, TipSec } from '../TipHead';
import { firstType } from './threatText';

/**
 * Una ragione della minaccia: la frase intera e il suo stato (scoperta: nessuno; a fatica: uno solo; gestita: due o più).
 * `side`: il lato della ragione (scudo Difesa, spada Offesa), col nome del lato davanti alla frase.
 */
export interface ThreatLine { text: string; state: 'open' | 'thin' | 'ok'; side?: 'defense' | 'offense' }

/**
 * Il tooltip di una minaccia del meta, uguale ovunque si apra (le piastrelle della scheda Meta della Copertura nella
 * Panoramica, la pillola del problema nella testata delle aree e nel Coaching): il colore del primo tipo, la sprite in
 * testata, "Minaccia senza check" o "Minaccia con un solo check" sotto il nome, a destra l'uso nel meta ("11,8%" con "nel
 * meta" sotto), le ragioni a righe (col lato, se c'è: scudo Difesa, spada Offesa), e dove porta il clic (`go`: TipGo) se
 * l'elemento porta da qualche parte. Larghezza M.
 */
export function ThreatTip({ rect, species, status, usage, reasons, go }: {
  rect: DOMRect; species: string; status: 'open' | 'thin'; usage?: number | null; reasons: ThreatLine[]; go?: string;
}) {
  const t = useT();
  const lang = useLang();
  const sided = reasons.some(line => line.side);
  return (
    <FloatTip rect={rect} tone={typeColor(firstType(species))} className="thr-tip tip-w-m">
      <TipHead sprite={species} title={species} sub={t(status === 'open' ? 'tip.threat.open' : 'tip.threat.thin')}
        {...(usage !== undefined && usage !== null ? { num: formatPercent(lang, usage), qualifier: t('dash.threatUsageWord') } : {})} />
      <TipSec>
        <ul className={`thr-tip-why${sided ? ' sided' : ''}`}>
          {reasons.map(line => (
            <li key={`${line.side ?? ''}:${line.text}`} className={line.state}>
              {line.side && <><Icon name={line.side === 'defense' ? 'shield' : 'sword'} /><b>{t(line.side === 'defense' ? 'area.defense' : 'area.strength')}</b> </>}
              {line.text}
            </li>
          ))}
        </ul>
      </TipSec>
      {go && <TipGo place={go} />}
    </FloatTip>
  );
}
