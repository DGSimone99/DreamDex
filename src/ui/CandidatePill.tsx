import type { CSSProperties } from 'react';
import { getSpecies } from '../engine/dex';
import { typeName } from '../i18n/game';
import { useLang } from '../i18n/react';
import { typeColor } from './Sprite';
import { TypeIcons } from './typeIcons';
import { CandidateMarks, OutMark, PickButton, Reasons, ResultCell, candidateHandlers, isFavoriteCandidate, isLead, stateClasses, type CandidateProps } from './candidateParts';

/**
 * Stile "Menu": una pillola scura come i menu di Spada e Scudo, 6 per pagina su un rullo: la selezionata è dritta e
 * grande, le altre rimpiccioliscono e si inclinano allontanandosi. Tondo dello sprite che sporge a sinistra (lo
 * sprite ne esce), nome e motivi al centro, a destra i segni, le icone dei tipi e il +N (#1 in una pillola magenta).
 * La selezionata diventa ciano, col cursore ▶ fuori dalla pillola.
 */
export function CandidatePill(props: CandidateProps) {
  const { rank, item, reasons, sprite, usage, out, format, lists, selected, onSelect, depth = 0 } = props;
  const lang = useLang();
  const types = getSpecies(item.species)?.types ?? [];
  const typeNames = types.map(type => typeName(type, lang)).join(' / ');
  const className = ['pill', isLead(rank, item) && 'first', stateClasses(props)].filter(Boolean).join(' ');
  return (
    // Sfumatura del tondo nel colore del tipo primario; --d e --ad (distanza dalla selezionata) piegano il rullo
    <li className={className} style={{ '--t1': typeColor(types[0] ?? ''), '--d': depth, '--ad': Math.abs(depth) } as CSSProperties} {...candidateHandlers(props)}>
      <span className="pill-sprite" aria-hidden="true">{sprite(false)}</span>
      {out && <OutMark member={out} />}
      <span className="who">
        <span className="name-line">
          <PickButton rank={rank} species={item.species} selected={selected} onSelect={onSelect} />
        </span>
        <Reasons reasons={reasons} />
      </span>
      {/* A destra: i segni prima delle icone dei tipi, poi il voto */}
      <span className="pill-end">
        <CandidateMarks item={item} format={format} lists={lists} />
        <TypeIcons types={types} className="pill-types" title={typeNames} />
        {/* Le icone sono decorative: i tipi agli screen reader come testo */}
        <span className="visually-hidden">{typeNames}</span>
        <ResultCell item={item} usage={usage} favorite={isFavoriteCandidate(item.set, lists)} className="score" />
      </span>
    </li>
  );
}
