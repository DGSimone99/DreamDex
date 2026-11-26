import { Icon } from '../icons';
import { useT } from '../../i18n/react';
import type { EditorGradeShown } from './slotTypes';

/**
 * Telefono: il voto nella testata dell'editor, perché lì il voto grande è coperto. Lettera e punteggio; appena cambia,
 * "74 → 76" col cambio in verde o rosso (il punto di partenza è il voto quando si è aperto il membro).
 */
export function EditorGrade({ grade }: { grade: EditorGradeShown }) {
  const tr = useT();
  const { from } = grade;
  const delta = grade.overall - from;
  return (
    <span className={`editor-grade grade-${grade.letter}${grade.illegal ? ' illegal' : ''}`}>
      <span className="visually-hidden">{tr('editor.gradeLabel')} </span>
      {/* Team non legale: il triangolo rosso delle carte prima della lettera grigia (il grigio da solo sembra "spento") */}
      {grade.illegal && <span className="editor-grade-alert"><Icon name="warning" /><span className="visually-hidden">{tr('editor.flagIllegal')}: </span></span>}
      <b>{grade.letter}</b>
      {delta === 0 ? <span>{grade.overall}</span> : (
        <span className={delta > 0 ? 'up' : 'down'}>{from}<Icon name="next" /><b>{grade.overall}</b></span>
      )}
    </span>
  );
}
