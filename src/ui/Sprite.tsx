import type { CSSProperties } from 'react';
import { useState } from 'react';
import { battleSpecies, getSpecies, toID } from '../engine/dex';
import type { TypeName } from '../engine/types';
import { typeName } from '../i18n/game';
import { useLang } from '../i18n/react';
import { FEET_ROW, FEET_X, SPRITE_FEET } from './spriteFeet';
import { typeIconUrl } from './typeIcons';
import { reducedMotion } from './useMediaQuery';

/** Colori classici dei tipi. */
export const TYPE_COLORS: Record<TypeName, string> = {
  Normal: '#A8A878', Fire: '#F08030', Water: '#6890F0', Electric: '#F8D030', Grass: '#78C850', Ice: '#98D8D8',
  Fighting: '#C03028', Poison: '#A040A0', Ground: '#E0C068', Flying: '#A890F0', Psychic: '#F85888', Bug: '#A8B820',
  Rock: '#B8A038', Ghost: '#705898', Dragon: '#7038F8', Dark: '#705848', Steel: '#B8B8D0', Fairy: '#EE99AC',
};

const DARK_INK = '#10142b';
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/**
 * Il testo sul colore del tipo: bianco o scuro, quello che si legge meglio (contrasto più alto). Prima si sceglieva con
 * una soglia fissa e Acqua e Psico restavano col bianco a 3,1:1; ora hanno il testo scuro (oltre 5,5:1).
 */
export function inkFor(hex: string): string {
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (luminance(DARK_INK) + 0.05);
  return onDark > onWhite ? DARK_INK : '#ffffff';
}

export const typeColor = (type: string): string => TYPE_COLORS[type as TypeName] ?? '#8890b0';

/** I colori dei due tipi per lo sfondo delle carte (--t1, --t2; un tipo solo: lo stesso due volte). */
export const typePair = (types: readonly string[] | undefined): CSSProperties =>
  ({ '--t1': typeColor(types?.[0] ?? ''), '--t2': typeColor(types?.[1] ?? types?.[0] ?? '') } as CSSProperties);

/** Il tipo come in Pokémon Champions: tessera con l'icona ufficiale nel colore del tipo, poi il nome su una lastra scura. */
/**
 * Nomi dei tipi divisi in corti, medi e lunghi (misurati in maiuscolo, Kanit 700 a 11px), per lingua: nelle carte del
 * team, quando la larghezza unica non entra, ogni gruppo ha la sua larghezza fissa (team.css, --tw-s/m/l).
 * Si guarda il nome scritto (inglese o italiano): finché i nomi italiani non sono arrivati vale il gruppo inglese.
 */
const TYPE_WIDTH: Record<string, 's' | 'm' | 'l'> = {
  // Inglese: corti fino a FLYING, medi fino a NORMAL, lunghi ELECTRIC e FIGHTING
  ice: 's', bug: 's', fire: 's', rock: 's', dark: 's', steel: 's', fairy: 's', grass: 's', ghost: 's', water: 's', flying: 's',
  poison: 'm', psychic: 'm', dragon: 'm', ground: 'm', normal: 'm', electric: 'l', fighting: 'l',
  // Italiano: corti fino a ACQUA, medi fino a SPETTRO, lunghi da VOLANTE (COLEOTTERO col suo carattere più piccolo)
  buio: 's', erba: 's', psico: 's', lotta: 's', terra: 's', fuoco: 's', drago: 's', acqua: 's',
  roccia: 'm', veleno: 'm', acciaio: 'm', elettro: 'm', spettro: 'm',
  volante: 'l', ghiaccio: 'l', normale: 'l', folletto: 'l', coleottero: 'l',
};

export function TypeChip({ type }: { type: string }) {
  const lang = useLang();
  const label = typeName(type, lang);
  const icon = typeIconUrl(type);
  // Tutti larghi uguali (il nome più lungo), così si allineano in colonna; "Coleottero" ha le lettere più piccole per starci
  return (
    <span className={`type-chip tw-${TYPE_WIDTH[label.toLowerCase()] ?? 's'}${label.length > 8 ? ' long' : ''}`} style={{ '--chip': typeColor(type) } as CSSProperties}>
      <i aria-hidden="true">{icon && <img src={icon} alt="" draggable={false} />}</i>
      <span>{label}</span>
    </span>
  );
}

/** Id degli sprite di Showdown: "landorus-therian", "charizard-megay". */
function spriteId(name: string): string | null {
  const species = getSpecies(name);
  if (!species) return null;
  const base = toID(species.baseSpecies);
  return species.forme ? `${base}-${toID(species.forme)}` : base;
}


/**
 * Sprite del Pokémon (la forma Mega se tiene la sua pietra). Se manca, resta lo spazio vuoto.
 * Con `animated` sopra lo statico va l'idle animato di Showdown (gen5ani): lo statico resta visibile finché l'animato non
 * è caricato, poi si danno il cambio con una dissolvenza breve, l'animato appoggiato dove stava lo statico. Chi non ha
 * l'animazione (spriteFeet.ts lo sa, senza chiederla a Showdown) o la perde per strada "respira" da fermo (.idle).
 * Col sistema che riduce le animazioni resta lo statico, fermo.
 */
export function Sprite({ species, item = '', size = 96, animated = false, shiny = false }: { species: string; item?: string; size?: number; animated?: boolean; shiny?: boolean }) {
  const name = battleSpecies({ species, item })?.name ?? species;
  const id = spriteId(name);
  const [failed, setFailed] = useState<string | null>(null);
  const [ani, setAni] = useState<{ id: string; ready: boolean; failed: boolean; height?: number } | null>(null);
  if (!id || failed === id) return <span className="sprite missing" style={{ width: size, height: size }} aria-hidden="true" />;
  const state = ani?.id === id ? ani : { id, ready: false, failed: false };
  // [riga dei piedi, centro del corpo, (se c'è la GIF) altezza, spostamento di lato, righe sotto i piedi]; chi non è in
  // tabella (Pokémon nuovi) prova la GIF
  const feet = SPRITE_FEET[id];
  const hasAni = feet === undefined || feet.length > 2;
  const motion = animated && !reducedMotion();
  const showAni = motion && hasAni && !state.failed;
  // Quanto spostare lo statico perché i piedi stiano alla riga FEET_ROW e il corpo al centro (FEET_X), in frazioni del suo
  // lato: lo usano solo le carte con la pedana (suggestions.css). La GIF è il riquadro ritagliato su tutta l'animazione:
  // --ani-dx e --ani-lift la spostano perché il suo primo fotogramma abbia corpo e piedi dove li ha lo statico
  const feetStyle = feet === undefined ? undefined : { '--feet-dy': (FEET_ROW - feet[0]) / 96, '--feet-dx': (FEET_X - feet[1]) / 96 } as CSSProperties;
  // Altezza vera della GIF (ritagliata sul Pokémon, da ~40 a 143 px): il CSS la usa per farla grande quanto lo statico. Dalla
  // tabella è nota prima che arrivi, così la GIF non cambia misura quando compare
  const aniHeight = state.height ?? feet?.[2];
  const aniStyle = { ...(aniHeight ? { '--ani-h': aniHeight } : {}), ...(feet?.length === 5 ? { '--ani-dx': feet[3] / 96, '--ani-lift': feet[4] / 96 } : {}) } as CSSProperties;
  return (
    <>
      <img
        className={`sprite${showAni && state.ready ? ' covered' : ''}${motion && !showAni ? ' idle' : ''}`}
        src={`https://play.pokemonshowdown.com/sprites/gen5${shiny ? '-shiny' : ''}/${id}.png`}
        alt=""
        width={size}
        height={size}
        style={feetStyle}
        // Subito, non "lazy": lo statico pesa ~1 KB, e col caricamento pigro il browser lo chiedeva solo dopo il resto della
        // pagina (team all'avvio ~720 ms invece di ~240) e nei tooltip solo dopo averli messi al loro posto
        onError={() => setFailed(id)}
      />
      {showAni && (
        <img
          className={`sprite-ani${state.ready ? ' ready' : ''}`}
          src={`https://play.pokemonshowdown.com/sprites/gen5ani${shiny ? '-shiny' : ''}/${id}.gif`}
          alt=""
          style={aniStyle}
          onLoad={e => setAni({ id, ready: true, failed: false, height: e.currentTarget.naturalHeight || undefined })}
          onError={() => setAni({ id, ready: false, failed: true })}
        />
      )}
    </>
  );
}
