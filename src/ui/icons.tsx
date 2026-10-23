/** Icone a tratto unico (24×24, stroke 2), ereditano il colore del testo. */
const paths = {
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  swap: 'M7 7h12m0 0-3.5-3.5M19 7l-3.5 3.5M17 17H5m0 0 3.5 3.5M5 17l3.5-3.5',
  undo: 'M9 7 4.5 11.5 9 16M4.5 11.5H15a4.5 4.5 0 0 1 0 9h-3',
  close: 'M6 6l12 12M18 6 6 18',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5',
  paste: 'M8 5H6v15h12V5h-2M9 3h6v4H9zM9 12h6M9 16h4',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14m0 0-5-5m5 5-5 5',
  prev: 'M14.5 6 8.5 12l6 6',
  next: 'M9.5 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  unlock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 5.8-1.1M12 14.5v2',
  warning: 'M12 3.5 22 20H2zM12 10v4.5M12 17.2v.3',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 1 0 0-13zM15.5 15.5 20 20',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.5M12 16.6v.4',
  // Categorie delle mosse (come su Showdown) e precisione
  physical: 'M12 2.5l2.3 5.2 5.4-1.6-2.6 5 4.4 3.3-5.6.6.3 5.6L12 17.3l-4.2 3.3.3-5.6-5.6-.6 4.4-3.3-2.6-5 5.4 1.6z',
  special: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zm0 4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9z',
  status: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM12 3c-2.5 2.5-2.5 6.5 0 9s2.5 6.5 0 9',
  target: 'M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16zM12 2v5M12 17v5M2 12h5M17 12h5',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, filled = false }: { name: keyof typeof paths; filled?: boolean }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}
