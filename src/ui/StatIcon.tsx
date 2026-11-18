import type { StatID } from '../engine/sets';

/*
 * Icone delle statistiche come in Pokémon Champions (schermata dell'allenamento), ridisegnate in SVG dallo screenshot:
 * PS il cuore; Attacco e Attacco Speciale la stella e gli anelli delle categorie; Difesa e Difesa Speciale lo scudo con la
 * stella o gli anelli scavati; Velocità le barre a "<". Riquadro 48x48 del gioco (stesse proporzioni fra loro), pieni nel
 * colore intorno (`currentColor`). Originali e confronto in Modifiche da proporre/icone.
 */
const PATHS: Record<StatID, { d: string; evenOdd: boolean }> = {
  hp: { d: 'M24.88 38.55L12.84 27.15A7.67 7.67 0 1 1 24.88 17.97A7.67 7.67 0 1 1 36.91 27.15Z', evenOdd: false },
  atk: { d: 'M24.89 7.21L27.91 17.86L40.04 12.01L32.23 21.11L46.55 23.38L32.23 25.64L40.04 34.74L27.91 28.9L24.89 39.55L21.88 28.9L9.74 34.74L17.56 25.64L3.24 23.38L17.56 21.11L9.74 12.01L21.88 17.86Z', evenOdd: false },
  def: { d: 'M6.28 8.48L43.53 8.48L43.53 31.59Q44.83 32.53 24.9 41.53Q4.98 32.53 6.28 31.59ZM24.93 10.82L27.29 19.13L36.79 14.57L30.67 21.67L41.88 23.43L30.67 25.2L36.79 32.3L27.29 27.74L24.93 36.04L22.57 27.74L13.06 32.3L19.18 25.2L7.97 23.43L19.18 21.67L13.06 14.57L22.57 19.13Z', evenOdd: true },
  spa: { d: 'M6.85 23.48A18.04 12.02 0 1 1 42.93 23.48A18.04 12.02 0 1 1 6.85 23.48ZM10.9 22.51A13.99 8.06 0 1 1 38.88 22.51A13.99 8.06 0 1 1 10.9 22.51ZM12.9 22.45A11.98 6.98 0 1 1 36.87 22.45A11.98 6.98 0 1 1 12.9 22.45ZM15.55 21.33A9.34 4.64 0 1 1 34.23 21.33A9.34 4.64 0 1 1 15.55 21.33ZM18.88 21.47A6.01 2.97 0 1 1 30.9 21.47A6.01 2.97 0 1 1 18.88 21.47Z', evenOdd: true },
  spd: { d: 'M6.28 8.63L43.55 8.63L43.55 32.52Q42.27 33.61 24.92 41.96Q7.57 33.61 6.28 32.52ZM10.67 23.59A14.24 9.41 0 1 1 39.16 23.59A14.24 9.41 0 1 1 10.67 23.59ZM13.87 22.83A11.04 6.31 0 1 1 35.96 22.83A11.04 6.31 0 1 1 13.87 22.83ZM15.45 22.78A9.46 5.47 0 1 1 34.38 22.78A9.46 5.47 0 1 1 15.45 22.78ZM17.54 21.91A7.38 3.63 0 1 1 32.29 21.91A7.38 3.63 0 1 1 17.54 21.91ZM20.17 22.02A4.75 2.32 0 1 1 29.66 22.02A4.75 2.32 0 1 1 20.17 22.02Z', evenOdd: true },
  spe: { d: 'M18.27 9.86L15.51 12.62L30.01 12.62L32.77 9.86ZM37.13 9.86L34.38 12.62L41.76 12.62L44.51 9.86ZM13.36 14.77L10.6 17.52L25.1 17.52L27.86 14.77ZM32.23 14.77L29.47 17.52L36.85 17.52L39.61 14.77ZM8.45 19.67L5.69 22.43L20.2 22.43L22.95 19.67ZM27.32 19.67L24.56 22.43L31.94 22.43L34.7 19.67ZM5.75 24.58L8.51 27.34L23.01 27.34L20.25 24.58ZM24.62 24.58L27.38 27.34L34.76 27.34L32 24.58ZM10.66 29.49L13.42 32.25L27.92 32.25L25.16 29.49ZM29.53 29.49L32.29 32.25L39.67 32.25L36.91 29.49ZM15.56 34.4L18.32 37.16L32.83 37.16L30.07 34.4ZM34.43 34.4L37.19 37.16L44.57 37.16L41.81 34.4Z', evenOdd: false },
};

/** L'icona di una statistica (decorativa: il nome della statistica va nel testo o nel title vicino). */
export function StatIcon({ stat }: { stat: StatID }) {
  const { d, evenOdd } = PATHS[stat];
  return (
    <svg className="stat-icon" viewBox="1 1 46 46" width="14" height="14" aria-hidden="true" focusable="false">
      <path fill="currentColor" fillRule={evenOdd ? 'evenodd' : undefined} d={d} />
    </svg>
  );
}
