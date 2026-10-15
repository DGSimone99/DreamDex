/** Icone a tratto unico (24×24, stroke 2), ereditano il colore del testo. */
const paths = {
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  swap: 'M7 7h12m0 0-3.5-3.5M19 7l-3.5 3.5M17 17H5m0 0 3.5 3.5M5 17l3.5-3.5',
  close: 'M6 6l12 12M18 6 6 18',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14m0 0-5-5m5 5-5 5',
} as const;

export function Icon({ name, filled = false }: { name: keyof typeof paths; filled?: boolean }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}
