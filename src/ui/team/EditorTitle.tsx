import { useState, type RefObject } from 'react';
import type { TeamSet } from '../../engine/sets';
import { gameName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { gainText } from '../coaching/gainText';
import { Hint } from '../Hint';
import { Icon } from '../icons';
import { hint as bubble } from '../MoveTip';
import { Sprite, TypeChip, typePair } from '../Sprite';
import { EditorGrade } from './EditorGrade';
import type { EditorGradeShown, MoveProposal } from './slotTypes';

/**
 * La testata dell'editor aperto: il nome (cliccandolo si scrive il soprannome), i tipi, sul telefono lo sprite grande
 * e il voto, e il pulsante shiny.
 */
export function EditorTitle({ set, name, types, grade, onChange }: {
  set: TeamSet;
  /** Il nome della forma in battaglia (la Mega con la megapietra). */
  name: string;
  types: readonly string[] | undefined;
  grade: EditorGradeShown | null;
  onChange: (set: TeamSet) => void;
}) {
  const tr = useT();
  // Soprannome: si scrive cliccando il nome nell'editor; vuoto = il nome della specie
  const [naming, setNaming] = useState(false);
  const commitName = (value: string) => {
    setNaming(false);
    const next = value.trim();
    if (next !== (set.name ?? '')) onChange({ ...set, name: next || undefined });
  };
  return (
    <div className="editor-title">
      {/* Con un soprannome, la specie resta sopra come piccola etichetta (come Statistiche, Set e Mosse) */}
      {set.name && !naming && <span className="species-tag">{name}</span>}
      {naming ? (
        <input className="nickname-input" autoFocus aria-label={tr('team.nickname', { species: name })} maxLength={18}
          placeholder={name} defaultValue={set.name ?? ''}
          onBlur={e => commitName(e.currentTarget.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitName(e.currentTarget.value); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setNaming(false); }
          }} />
      ) : (
        // Il nome arriva via CSS (data-name): non è un secondo testo uguale a quello della carta
        <button type="button" className="nickname" aria-label={tr('team.nickname', { species: name })} {...bubble(tr('team.nicknameTitle'))}
          onClick={() => setNaming(true)}>
          <strong data-name={set.name || name} />
          {/* La matita compare col mouse o col fuoco: il nome si può cambiare */}
          <span className="nickname-pencil" aria-hidden="true"><Icon name="edit" /></span>
        </button>
      )}
      <span className="types" aria-hidden="true">{types?.map(type => <TypeChip key={type} type={type} />)}</span>
      {/* Telefono: la testata dell'editor come il riepilogo di un gioco, lo sprite grande a destra sul colore del tipo
          (sul computer non c'è: lo sprite animato sta già nella carta aperta) */}
      <span className="editor-hero" aria-hidden="true"
        style={typePair(types)}>
        <Sprite species={set.species} item={set.item} shiny={!!set.shiny} />
      </span>
      {grade && <EditorGrade grade={grade} />}
      <Hint label={tr('team.shiny')}>
        <button type="button" className="shiny-toggle" aria-pressed={!!set.shiny} aria-label={tr('team.shiny')}
          onClick={() => onChange({ ...set, shiny: set.shiny ? undefined : true })}>
          <Icon name="shiny" filled={!!set.shiny} />
        </button>
      </Hint>
    </div>
  );
}

/** La proposta di mossa del Coaching, sopra le mosse dell'editor: Applica (col fuoco, `applyRef`) o Annulla. */
export function MoveProposalNote({ proposal, applyRef, onDone }: {
  proposal: MoveProposal;
  applyRef: RefObject<HTMLButtonElement | null>;
  onDone?: (applied: boolean) => void;
}) {
  const lang = useLang();
  const tr = useT();
  return (
    <div className="move-proposal" role="note">
      <Icon name="spark" />
      <span>{proposal.from
        ? tr('team.moveProposal', { to: gameName('move', proposal.to, lang), from: gameName('move', proposal.from, lang), n: gainText(proposal.gain) })
        : tr('team.moveProposalEmpty', { to: gameName('move', proposal.to, lang), n: gainText(proposal.gain) })}</span>
      <button type="button" className="apply" ref={applyRef} onClick={() => onDone?.(true)}>{tr('team.moveProposalApply')}</button>
      <button type="button" onClick={() => onDone?.(false)}>{tr('team.moveProposalCancel')}</button>
    </div>
  );
}
