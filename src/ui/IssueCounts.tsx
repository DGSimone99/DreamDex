import { Icon } from './icons';

/** Triangoli di avviso con il numero: rosso per i gravi, blu per i minori. Gli zeri non compaiono. */
export function IssueCounts({ serious, minor, labels }: {
  serious: number;
  minor: number;
  /** Nomi per esteso (tooltip e screen reader), al singolare e al plurale. */
  labels: { serious: [string, string]; minor: [string, string] };
}) {
  const name = (n: number, [one, many]: [string, string]) => `${n} ${n === 1 ? one : many}`;
  return (
    <span className="issue-counts">
      {serious > 0 && (
        <span className="issue serious" title={name(serious, labels.serious)}>
          <Icon name="warning" /><span className="visually-hidden">{name(serious, labels.serious)}</span>
          <span aria-hidden="true">{serious}</span>
        </span>
      )}
      {minor > 0 && (
        <span className="issue minor" title={name(minor, labels.minor)}>
          <Icon name="warning" /><span className="visually-hidden">{name(minor, labels.minor)}</span>
          <span aria-hidden="true">{minor}</span>
        </span>
      )}
    </span>
  );
}

export const PROBLEM_LABELS = { serious: ['problema serio', 'problemi seri'], minor: ['problema minore', 'problemi minori'] } as {
  serious: [string, string]; minor: [string, string];
};
export const WEAKNESS_LABELS = { serious: ['mancanza grave', 'mancanze gravi'], minor: ['mancanza', 'mancanze'] } as {
  serious: [string, string]; minor: [string, string];
};
