import { useId } from 'react';
/** Icone a tratto unico (24×24, stroke 2), ereditano il colore del testo. */
const paths = {
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  swap: 'M7 7h12m0 0-3.5-3.5M19 7l-3.5 3.5M17 17H5m0 0 3.5 3.5M5 17l3.5-3.5',
  undo: 'M9 7 4.5 11.5 9 16M4.5 11.5H15a4.5 4.5 0 0 1 0 9h-3',
  close: 'M6 6l12 12M18 6 6 18',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  // Svuota il team: un cestino
  trash: 'M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10 10.5v6M14 10.5v6',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5',
  paste: 'M8 5H6v15h12V5h-2M9 3h6v4H9zM9 12h6M9 16h4',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14m0 0-5-5m5 5-5 5',
  prev: 'M14.5 6 8.5 12l6 6',
  next: 'M9.5 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  unlock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 5.8-1.1M12 14.5v2',
  // Membro fisso del team: lo stesso lucchetto, chiuso
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3M12 14.5v2',
  warning: 'M12 3.5 22 20H2zM12 10v4.5M12 17.2v.3',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 1 0 0-13zM15.5 15.5 20 20',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.5M12 16.6v.4',
  // Categorie delle mosse (come su Showdown) e precisione
  physical: 'M12 2.5l2.3 5.2 5.4-1.6-2.6 5 4.4 3.3-5.6.6.3 5.6L12 17.3l-4.2 3.3.3-5.6-5.6-.6 4.4-3.3-2.6-5 5.4 1.6z',
  special: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zm0 4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9z',
  // Velocità: un fulmine
  speed: 'M13 2.5 5.5 13.5H11l-1 8 7.5-11H12z',
  status: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM12 3c-2.5 2.5-2.5 6.5 0 9s2.5 6.5 0 9',
  // Shiny: le due stelle a quattro punte dei giochi
  shiny: 'M10 6.5Q10.9 12.1 16.5 13Q10.9 13.9 10 19.5Q9.1 13.9 3.5 13Q9.1 12.1 10 6.5zM18 2.5Q18.5 5.5 21.5 6Q18.5 6.5 18 9.5Q17.5 6.5 14.5 6Q17.5 5.5 18 2.5z',
  // Salvare, sovrascrivere, rinominare un set
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  down: 'M6.5 9.5 12 15l5.5-5.5',
  // Box del PC: la scatola con il coperchio e la maniglia
  box: 'M3.5 9.5h17v10h-17zM2.5 5.5h19v4h-19zM10 13h4',
  overwrite: 'M5 4h11l3 3v13H5zM9 14.5a3 3 0 1 0 1-2.2M9 10.5v2.5h2.5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  // Liste dell'utente: preferito e bannato
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  ban: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM5.6 5.6l12.8 12.8',
  target: 'M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16zM12 2v5M12 17v5M2 12h5M17 12h5',
  // Aree dei problemi del Coaching: Difesa, Offesa, Ruoli, Regole, Meta, Condizioni (Ridondanza usa "copy")
  // Scudo come quello di Zamazenta (largo in alto con le tacche, appuntito in basso, nervatura al centro)
  shield: 'M4 4.5h4l1 1.5h6l1-1.5h4v5.5c0 5.2-3.6 8.8-8 11-4.4-2.2-8-5.8-8-11ZM12 7.5v11',
  // Spada lunga come quella di Zacian, simmetrica sul suo asse e girata in diagonale (punta in alto a destra)
  sword: 'M19.42 4.58L19.07 7.76L11.29 15.54L8.46 12.71L16.24 4.93ZM17.3 6.7L10.94 13.06M5.99 10.94L13.06 18.01M9.53 14.47L6.34 17.66M3.91 18.79a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0',
  // Famiglie del formato: competitivo (coppa), giochi (controller)
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 3.5M16 6h3a3 3 0 0 1-3 3.5M12 13v4M8.5 20h7M10 17h4',
  gamepad: 'M7 8h10a4 4 0 0 1 4 4v1.5a3.5 3.5 0 0 1-6.3 2.1L14 14.5h-4l-.7 1.1A3.5 3.5 0 0 1 3 13.5V12a4 4 0 0 1 4-4zM7.5 10.5v3M6 12h3M15.5 11.5v.1M17.5 13v.1',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  gavel: 'M13 4l7 7M10.5 6.5l7 7M8 9l5-5M15 16l5-5M11.7 11.7 4 19.5',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  // Righe del Riassunto della Panoramica
  team: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5',
  field: 'M3 19h18M5 19l3-8 3 5 3-9 3 12',
  // Immune: lo stesso scudo, barrato
  shieldx: 'M4 4.5h4l1 1.5h6l1-1.5h4v5.5c0 5.2-3.6 8.8-8 11-4.4-2.2-8-5.8-8-11ZM7.5 15.5L16.5 7.5',
  roles: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  cloud: 'M7 18h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 11.5 3.3 3.3 0 0 0 7 18z',
  // Legame tra due membri (Sinergie del Riassunto): due anelli di catena
  // Altre azioni (⋯), Espandi e Riduci le liste
  dots: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  shrink: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  chain: 'M9.8 14.2l4.4-4.4M7.5 10.5l-2.2 2.2a3.2 3.2 0 0 0 4.5 4.5L12 15M16.5 13.5l2.2-2.2a3.2 3.2 0 0 0-4.5-4.5L12 9',
} as const;

export type IconName = keyof typeof paths;

/** Icone che piene si riempiono solo in parte: il lucchetto chiuso ha pieno il corpo, l'arco resta un tratto. */
const filledPart: Partial<Record<keyof typeof paths, string>> = {
  lock: 'M6 11h12v9H6z',
};

export function Icon({ name, filled = false }: { name: keyof typeof paths; filled?: boolean }) {
  const part = filled ? filledPart[name] : undefined;
  return (
    <svg className="icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"
      fill={filled && !part ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {part && <path d={part} fill="currentColor" />}
      <path d={paths[name]} />
    </svg>
  );
}

/** Simbolo della Mega Evoluzione (la "S" al centro, senza cerchio), ricalcato dall'icona dei giochi, coi colori
 *  dell'arcobaleno come nei giochi (fill-rule evenodd: barre e triangoli sono vuoti). Sulle carte per Mega e Primal. */
export const MEGA_PATH = 'M10.44 23.95C9.95 24.09 10.24 24.09 10.23 23.79C10.21 23.49 10.34 22.64 10.33 22.16C10.33 21.69 10.32 21.48 10.19 20.94C10.06 20.41 9.88 19.61 9.55 18.93C9.22 18.25 8.84 17.61 8.20 16.87C7.56 16.13 6.40 15.21 5.72 14.48C5.05 13.74 4.54 13.04 4.15 12.46C3.77 11.88 3.60 11.59 3.42 10.98C3.24 10.36 3.02 9.52 3.08 8.76C3.14 8.00 3.52 7.03 3.80 6.41C4.08 5.78 4.47 5.38 4.78 5.00C5.10 4.61 5.01 4.61 5.68 4.10C6.35 3.59 7.56 2.60 8.80 1.92C10.03 1.25 12.35 0.32 13.11 0.05C13.86 -0.22 13.24 -0.27 13.31 0.31C13.38 0.90 13.39 2.70 13.55 3.57C13.72 4.45 14.05 5.03 14.31 5.55C14.57 6.07 14.63 6.21 15.12 6.70C15.60 7.20 16.47 7.80 17.21 8.54C17.95 9.28 19.00 10.35 19.58 11.13C20.15 11.91 20.43 12.51 20.65 13.21C20.87 13.91 20.98 14.62 20.92 15.33C20.86 16.03 20.55 16.84 20.28 17.42C20.02 18.01 19.63 18.43 19.30 18.83C18.98 19.23 18.99 19.30 18.32 19.81C17.65 20.33 16.14 21.38 15.29 21.91C14.43 22.43 13.99 22.62 13.18 22.96C12.37 23.30 10.94 23.81 10.44 23.95ZM12.55 6.95C11.91 6.76 9.47 5.79 8.79 5.52C8.11 5.25 8.53 5.40 8.48 5.32C8.42 5.25 8.22 5.30 8.46 5.07C8.69 4.85 9.50 4.23 9.91 3.97C10.31 3.71 10.66 3.60 10.90 3.51C11.14 3.43 11.23 3.43 11.35 3.47C11.47 3.51 11.38 3.21 11.59 3.74C11.80 4.27 12.45 6.12 12.61 6.65C12.77 7.19 13.18 7.14 12.55 6.95ZM18.33 13.84C18.29 13.96 19.18 14.39 17.99 13.82C16.81 13.25 13.22 11.32 11.22 10.43C9.21 9.55 6.89 8.88 5.96 8.52C5.03 8.15 5.67 8.38 5.62 8.26C5.57 8.13 5.58 7.94 5.66 7.75C5.74 7.57 5.93 7.26 6.09 7.16C6.26 7.06 6.13 6.99 6.66 7.14C7.18 7.29 8.13 7.60 9.24 8.05C10.36 8.50 11.93 9.13 13.35 9.84C14.77 10.54 16.94 11.71 17.76 12.26C18.58 12.81 18.17 12.86 18.27 13.12C18.36 13.38 18.38 13.72 18.33 13.84ZM17.01 17.64C16.80 17.74 17.11 17.83 16.58 17.54C16.05 17.26 14.76 16.43 13.84 15.93C12.91 15.43 12.10 15.03 11.05 14.53C9.99 14.03 8.26 13.35 7.53 12.93C6.79 12.51 6.85 12.32 6.64 12.02C6.43 11.72 6.25 11.27 6.26 11.12C6.27 10.97 5.87 10.83 6.70 11.10C7.54 11.38 9.74 12.10 11.28 12.76C12.83 13.42 14.87 14.46 15.96 15.08C17.06 15.71 17.55 16.21 17.86 16.51C18.17 16.81 17.94 16.71 17.79 16.90C17.65 17.09 17.21 17.53 17.01 17.64ZM12.90 20.53C12.59 20.63 12.81 20.84 12.57 20.36C12.33 19.88 11.61 18.14 11.44 17.65C11.26 17.15 11.39 17.40 11.52 17.40C11.65 17.39 11.66 17.33 12.21 17.64C12.77 17.94 14.43 18.93 14.86 19.23C15.29 19.53 14.88 19.37 14.80 19.46C14.73 19.55 14.73 19.57 14.41 19.75C14.09 19.93 13.20 20.43 12.90 20.53Z';
export function MegaIcon() {
  // Arcobaleno in diagonale come nei giochi (arancio in alto a sinistra, magenta in basso a destra); un id per icona
  const id = `mega-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <svg className="mega-icon" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0.1" y1="0.2" x2="0.9" y2="0.85">
          <stop offset="0" stopColor="#ff4d00" />
          <stop offset="0.22" stopColor="#ffd000" />
          <stop offset="0.42" stopColor="#17ff00" />
          <stop offset="0.62" stopColor="#00a8ff" />
          <stop offset="0.8" stopColor="#7a2cff" />
          <stop offset="1" stopColor="#fd01b8" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} fillRule="evenodd" d={MEGA_PATH} />
    </svg>
  );
}
