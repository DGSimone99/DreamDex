import { Icon } from './icons';
import type { MessageKey } from '../i18n';
import { useT } from '../i18n/react';

/** Triangoli di avviso con il numero: rosso per i gravi, blu per i minori. Gli zeri non compaiono. */
export function IssueCounts({ serious, minor, labels }: {
  serious: number;
  minor: number;
  /** Nomi per esteso (tooltip e screen reader), al singolare e al plurale. */
  labels: { serious: [MessageKey, MessageKey]; minor: [MessageKey, MessageKey] };
}) {
  const t = useT();
  const name = (n: number, [one, many]: [MessageKey, MessageKey]) => `${n} ${t(n === 1 ? one : many)}`;
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

export const PROBLEM_LABELS: { serious: [MessageKey, MessageKey]; minor: [MessageKey, MessageKey] } = {
  serious: ['issues.seriousOne', 'issues.seriousMany'], minor: ['issues.minorOne', 'issues.minorMany'],
};
export const WEAKNESS_LABELS: { serious: [MessageKey, MessageKey]; minor: [MessageKey, MessageKey] } = {
  serious: ['issues.shortfallSeriousOne', 'issues.shortfallSeriousMany'], minor: ['issues.shortfallOne', 'issues.shortfallMany'],
};
