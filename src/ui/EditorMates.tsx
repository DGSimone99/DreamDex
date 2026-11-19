import type { CSSProperties } from 'react';
import { getSpecies, toID } from '../engine/dex';
import { formatPercent } from '../i18n';
import { useLang, useT } from '../i18n/react';
import { Icon } from './icons';
import { PokemonIcon } from './PokemonName';
import { typeColor } from './Sprite';

export interface Mate {
  name: string;
  /** Quota dei team col membro che usano anche questo Pokémon (0-1). */
  share: number;
  inTeam: boolean;
}

/** I compagni più usati col membro (dalle statistiche del meta), chi è già nel team segnato per specie. */
export function matesOf(teammates: Record<string, number> | undefined, team: string[], count = 6): Mate[] {
  if (!teammates) return [];
  const inTeam = new Set(team.map(toID));
  return Object.entries(teammates).sort((a, b) => b[1] - a[1])
    .filter(([name]) => !!getSpecies(name))
    .slice(0, count)
    .map(([name, share]) => ({ name: String(getSpecies(name)!.name), share, inTeam: inTeam.has(toID(name)) }));
}

/**
 * Riquadro dell'editor "Spesso usato con": i compagni più frequenti del membro nel meta, su due colonne, con la barra
 * della quota nel colore del primo tipo (come nel dettaglio dei candidati). Chi è già nel team ha la spunta; gli altri,
 * con `onOpen`, aprono il loro dettaglio nella lista Pokémon.
 */
export function EditorMates({ mates, onOpen }: { mates: Mate[]; onOpen?: (species: string) => void }) {
  const t = useT();
  const lang = useLang();
  if (!mates.length) return null;
  const top = mates[0].share || 1;
  return (
    <fieldset className="editor-group mates">
      <legend>{t('detail.metaWith')}</legend>
      <ol className="meta-mates editor-mates">
        {mates.map(mate => {
          const style = { '--mate-c': typeColor(getSpecies(mate.name)?.types[0] ?? ''), '--share': mate.share / top } as CSSProperties;
          const body = (
            <>
              <PokemonIcon name={mate.name} />
              <span className="mate-name">{mate.name}</span>
              <span className="mate-check">{mate.inTeam && <Icon name="check" />}</span>
              <span className="mate-bar" aria-hidden="true" />
              <strong>{formatPercent(lang, mate.share)}</strong>
            </>
          );
          return (
            <li key={mate.name} className={mate.inTeam ? 'in-team' : undefined} style={style}>
              {mate.inTeam || !onOpen ? (
                <span className="mate-row" title={mate.inTeam ? t('detail.metaInTeam', { name: mate.name }) : undefined}>{body}</span>
              ) : (
                <button type="button" className="mate-row" title={t('editor.mateOpen', { name: mate.name })}
                  aria-label={`${mate.name}, ${formatPercent(lang, mate.share)}. ${t('editor.mateOpen', { name: mate.name })}`}
                  onClick={() => onOpen(mate.name)}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
}
