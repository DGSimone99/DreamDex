import type { ReactNode } from 'react';

/** Tasti dei punti: il moltiplicatore (o chi) sopra, i punti sotto nel colore del segno. */
export function Keys({ items }: { items: { label: string; value: string; title?: string }[] }) {
  const tone = (value: string) => (value.startsWith('+') ? 'good' : value.startsWith('−') ? 'bad' : 'even');
  return (
    <ul className="guide-keys">
      {items.map(item => <li key={item.label} className={tone(item.value)} title={item.title}><span>{item.label}{item.title && <span className="visually-hidden"> {item.title}</span>}</span><b>{item.value}</b></li>)}
    </ul>
  );
}

/** Righe termine / regola della guida; `stacked`: la regola sotto il termine. */
export function Rows({ rows, stacked = false, compact = false }: { rows: [ReactNode, ReactNode][]; stacked?: boolean; compact?: boolean }) {
  return (
    <dl className={`guide-rows${stacked ? ' stacked' : ''}${compact ? ' compact' : ''}`}>
      {rows.map(([term, rule], i) => <div key={i}><dt>{term}</dt><dd>{rule}</dd></div>)}
    </dl>
  );
}
