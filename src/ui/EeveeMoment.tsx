import down from '../assets/eevee/down.svg';
import happy from '../assets/eevee/happy.svg';
import thinking from '../assets/eevee/thinking.svg';
import wave from '../assets/eevee/wave.svg';

/** Le pose di Eevee per i momenti speciali (illustrazioni Dream World, dreamworld.svg). */
const POSES = { wave, thinking, happy, down } as const;

export type EeveePose = keyof typeof POSES;

/**
 * Eevee nei momenti speciali, solo dove la pagina sarebbe vuota: team vuoto (saluta), ricerca senza risultati (ci
 * pensa), Coaching senza problemi (contento), dati mancanti (giù di morale). Spunta dal basso una volta sola e poi
 * resta fermo. Solo decorazione: niente clic, nascosto ai lettori di schermo. Misure in blocks.css (.eevee-moment).
 */
export function EeveeMoment({ pose }: { pose: EeveePose }) {
  return <img className={`eevee-moment ${pose}`} src={POSES[pose]} alt="" aria-hidden="true" draggable={false} />;
}
