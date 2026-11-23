import { battleSpecies } from '../../engine/dex';
import { formatPercent } from '../../i18n';
import { useLang, useT } from '../../i18n/react';
import { FloatTip, TipGo } from '../FloatTip';
import { typeColor } from '../Sprite';
import { TipHead, TipSec } from '../TipHead';

/** Il primo tipo della minaccia: dà il colore al fondo della carta e al tooltip. */
export function threatType(species: string): string {
  return battleSpecies({ species, item: '' })?.types[0] ?? '';
}

/** Una ragione della minaccia: la frase intera e se è scoperta (nessuno) o a fatica (uno solo). */
export interface ThreatLine { text: string; open: boolean }

/**
 * Il tooltip di una minaccia del meta, uguale ovunque si apra (le carte delle Minacce della Panoramica, la pillola del
 * problema nella testata delle aree e nel Coaching): il colore del primo tipo, la sprite in testata, "Minaccia scoperta" o
 * "Minaccia gestita a fatica" sotto il nome, a destra l'uso nel meta ("11,8%" con "nel meta" sotto), le ragioni a righe,
 * e dove porta il clic (`go`: TipGo) se l'elemento porta da qualche parte. Larghezza M.
 */
export function ThreatTip({ rect, species, status, usage, reasons, go }: {
  rect: DOMRect; species: string; status: 'open' | 'thin'; usage?: number | null; reasons: ThreatLine[]; go?: string;
}) {
  const t = useT();
  const lang = useLang();
  return (
    <FloatTip rect={rect} tone={typeColor(threatType(species))} className="thr-tip tip-w-m">
      <TipHead sprite={species} title={species} sub={t(status === 'open' ? 'tip.threat.open' : 'tip.threat.thin')}
        {...(usage !== undefined && usage !== null ? { num: formatPercent(lang, usage), qualifier: t('dash.threatUsageWord') } : {})} />
      <TipSec>
        <ul className="thr-tip-why">
          {reasons.map(line => <li key={line.text} className={line.open ? 'open' : 'thin'}>{line.text}</li>)}
        </ul>
      </TipSec>
      {go && <TipGo place={go} />}
    </FloatTip>
  );
}
