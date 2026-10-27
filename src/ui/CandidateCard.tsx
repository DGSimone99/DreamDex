import type { CSSProperties } from 'react';
import { getSpecies } from '../engine/dex';
import { typeName } from '../i18n/game';
import { useLang } from '../i18n/react';
import { typeColor } from './Sprite';
import { TypeIcons } from './typeIcons';
import { CandidateMarks, OutMark, PickButton, QuickButton, Reasons, ResultCell, candidateHandlers, stateClasses, type CandidateProps } from './candidateParts';

/**
 * Stile "Carte": una casella a forma di carta Masters. Targhetta col +N in alto a sinistra (#1 su magenta),
 * icone dei tipi in colonna a destra, sprite in alto al centro, nome e motivi in basso; chi esce sotto le icone.
 */
export function CandidateCard(props: CandidateProps) {
  const { rank, item, reasons, sprite, usage, out, format, lists, selected, onSelect } = props;
  const lang = useLang();
  const types = getSpecies(item.species)?.types ?? [];
  // Magenta solo per il #1 che migliora davvero il team: un −N o ±0 resta nei suoi colori
  const lead = rank === 1 && !(item.teamGain && item.teamGain.gain <= 0);
  const className = ['card', lead && 'first', stateClasses(props)].filter(Boolean).join(' ');
  return (
    // Bordo inferiore nel colore del tipo primario
    <li className={className} style={{ '--t1': typeColor(types[0] ?? '') } as CSSProperties} {...candidateHandlers(props)}>
      <span className="card-sprite" aria-hidden="true">{sprite}</span>
      <ResultCell item={item} usage={usage} className="tag" />
      <TypeIcons types={types} className="card-types" title={types.map(type => typeName(type, lang)).join(' / ')} />
      {out && <OutMark member={out} />}
      <span className="who">
        <span className="name-line">
          <PickButton rank={rank} species={item.species} selected={selected} onSelect={onSelect} />
          <CandidateMarks item={item} format={format} lists={lists} />
        </span>
        <Reasons reasons={reasons} />
      </span>
      <QuickButton {...props} />
    </li>
  );
}
