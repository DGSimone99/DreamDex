import { getMove, toID } from '../../engine/dex';
import type { ConditionRow } from '../../engine/teamSummary';
import type { TypeName } from '../../engine/types';
import type { MessageKey } from '../../i18n';
import { anyGameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { Sprite } from '../Sprite';
import { SPRITE_TIP_ROW, SPRITE_TIP_TALL } from '../spriteSizes';
import { MovePill } from '../MovePill';
import { TipGlyph, TipHead, TipSec, TipTypeIcon } from '../TipHead';

/**
 * Il tipo che corrisponde a una condizione (meteo, campo, Trick Room, schermi, Ventoincoda): colore e icona della sua
 * chip e del tooltip. Chiavi: id della condizione o della mossa.
 */
export const CONDITION_TYPE: Record<string, TypeName> = {
  sun: 'Fire', rain: 'Water', sand: 'Rock', snow: 'Ice',
  electricterrain: 'Electric', psychicterrain: 'Psychic', grassyterrain: 'Grass', mistyterrain: 'Fairy',
  trickroom: 'Psychic', reflect: 'Psychic', lightscreen: 'Psychic', auroraveil: 'Ice', tailwind: 'Flying',
};

/**
 * Un effetto della condizione, come una casella della scheda mossa di Champions: `label` sulla fascia in maiuscoletto
 * (col tipo, se c'è), sotto il valore grande con la freccia (`value`, `dir`) o una parola (`word`), e la nota piccola su
 * chi vale (`note`; senza: "per tutti" o "per il tuo team"). `tone`: buono o cattivo per chi la porta.
 */
interface Effect { type?: TypeName; label: MessageKey; value?: string; word?: MessageKey; dir?: 'up' | 'down'; note?: MessageKey; tone: 'good' | 'bad' | 'plain' }

/** Gli effetti di ogni condizione, in breve (il dettaglio vero sta nelle schede). */
const EFFECTS: Record<string, Effect[]> = {
  rain: [{ type: 'Water', label: 'ctip.moves', value: '50%', dir: 'up', tone: 'good' }, { type: 'Fire', label: 'ctip.moves', value: '50%', dir: 'down', tone: 'bad' }],
  sun: [{ type: 'Fire', label: 'ctip.moves', value: '50%', dir: 'up', tone: 'good' }, { type: 'Water', label: 'ctip.moves', value: '50%', dir: 'down', tone: 'bad' }],
  sand: [{ type: 'Rock', label: 'ctip.l.spd', value: '50%', dir: 'up', note: 'ctip.n.ofType', tone: 'good' }, { label: 'ctip.l.chip', value: '6%', note: 'ctip.n.notRGS', tone: 'bad' }],
  snow: [{ type: 'Ice', label: 'ctip.l.def', value: '50%', dir: 'up', note: 'ctip.n.ofType', tone: 'good' }],
  electricterrain: [{ type: 'Electric', label: 'ctip.moves', value: '30%', dir: 'up', note: 'ctip.n.ofGround', tone: 'good' }, { label: 'ctip.l.sleep', word: 'ctip.w.none', note: 'ctip.n.forGround', tone: 'plain' }],
  psychicterrain: [{ type: 'Psychic', label: 'ctip.moves', value: '30%', dir: 'up', note: 'ctip.n.ofGround', tone: 'good' }, { label: 'ctip.l.priority', word: 'ctip.w.none', note: 'ctip.n.onGround', tone: 'plain' }],
  grassyterrain: [{ type: 'Grass', label: 'ctip.moves', value: '30%', dir: 'up', note: 'ctip.n.ofGround', tone: 'good' }, { label: 'ctip.l.heal', value: '6%', dir: 'up', note: 'ctip.n.forGround', tone: 'good' }],
  mistyterrain: [{ type: 'Dragon', label: 'ctip.moves', value: '50%', dir: 'down', note: 'ctip.n.onGround', tone: 'bad' }, { label: 'ctip.l.status', word: 'ctip.w.none', note: 'ctip.n.forGround', tone: 'plain' }],
  trickroom: [{ label: 'ctip.l.order', word: 'ctip.w.slower', tone: 'plain' }],
  reflect: [{ label: 'ctip.l.physical', value: '50%', dir: 'down', note: 'ctip.n.taken', tone: 'good' }],
  lightscreen: [{ label: 'ctip.l.special', value: '50%', dir: 'down', note: 'ctip.n.taken', tone: 'good' }],
  auroraveil: [{ label: 'ctip.l.physical', value: '50%', dir: 'down', note: 'ctip.n.taken', tone: 'good' }, { label: 'ctip.l.special', value: '50%', dir: 'down', note: 'ctip.n.taken', tone: 'good' }],
  tailwind: [{ label: 'ctip.l.speed', value: '×2', dir: 'up', tone: 'good' }],
};

/** Chi ne approfitta: cosa ottiene con la sua abilità o mossa (id), in breve. */
const BENEFITS: Record<string, { text: MessageKey; up?: boolean }> = {
  swiftswim: { text: 'ctip.b.speed2', up: true }, chlorophyll: { text: 'ctip.b.speed2', up: true }, sandrush: { text: 'ctip.b.speed2', up: true },
  slushrush: { text: 'ctip.b.speed2', up: true }, surgesurfer: { text: 'ctip.b.speed2', up: true },
  solarpower: { text: 'ctip.b.spa', up: true }, protosynthesis: { text: 'ctip.b.paradox', up: true }, quarkdrive: { text: 'ctip.b.paradox', up: true },
  flowergift: { text: 'ctip.b.flowerGift', up: true }, harvest: { text: 'ctip.b.harvest' },
  raindish: { text: 'ctip.b.heal16' }, icebody: { text: 'ctip.b.heal16' }, dryskin: { text: 'ctip.b.heal8' }, hydration: { text: 'ctip.b.hydration' },
  sandforce: { text: 'ctip.b.sandForce', up: true },
  thunder: { text: 'ctip.b.neverMiss' }, hurricane: { text: 'ctip.b.neverMiss' }, blizzard: { text: 'ctip.b.neverMiss' },
  solarbeam: { text: 'ctip.b.noCharge' }, solarblade: { text: 'ctip.b.noCharge' }, electroshot: { text: 'ctip.b.noCharge' },
  weatherball: { text: 'ctip.b.ball', up: true }, terrainpulse: { text: 'ctip.b.ball', up: true }, hydrosteam: { text: 'ctip.b.hydroSteam', up: true },
  auroraveil: { text: 'ctip.b.veil' }, risingvoltage: { text: 'ctip.b.power2', up: true }, expandingforce: { text: 'ctip.b.power15', up: true },
  grassyglide: { text: 'ctip.b.priority', up: true }, mistyexplosion: { text: 'ctip.b.power15', up: true },
};

/** Le rocce e gli altri strumenti che allungano la durata (5 → 8 turni). */
const LONGER: Record<string, string[]> = {
  sun: ['heatrock'], rain: ['damprock'], sand: ['smoothrock'], snow: ['icyrock'],
  electricterrain: ['terrainextender'], psychicterrain: ['terrainextender'], grassyterrain: ['terrainextender'], mistyterrain: ['terrainextender'],
  reflect: ['lightclay'], lightscreen: ['lightclay'], auroraveil: ['lightclay'],
};
/** Meteo primordiali: durano finché chi li porta resta in campo. */
const PRIMAL = new Set(['desolateland', 'primordialsea']);
/** Gli effetti che valgono solo per il team di chi la porta (schermi, Ventoincoda); gli altri per tutti in campo. */
const TEAM_ONLY = new Set(['reflect', 'lightscreen', 'auroraveil', 'tailwind']);

const UP = 'M12 19V6M6 11.5 12 5.5l6 6';
const DOWN = 'M12 5v13M6 12.5l6 6 6-6';
const Arrow = ({ dir }: { dir: 'up' | 'down' }) => (
  <svg className="ctip-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d={dir === 'up' ? UP : DOWN} /></svg>
);

/** Abilità come lastra inclinata, mossa come pillola (MovePill). */
function Via({ via }: { via: string }) {
  const lang = useLang();
  const move = getMove(via);
  if (!move) return <span className="ctip-ab">{anyGameName(via, lang)}</span>;
  return <MovePill name={move.name} size="sm" tip={false} className="ctip-mv" />;
}

/**
 * Il tooltip di una riga di Meteo e campo (vedi DESIGN.md, "Tooltips"): la testata unica nel colore della condizione (con
 * una texture sua: la pioggia scende), la tessera del tipo, il nome, sotto quanto dura, a destra chi la porta (sprite e
 * abilità o mossa). Gli effetti come le caselle della scheda mossa (MoveTip: fascia tinta in maiuscoletto, valore grande
 * nello slot incassato, sotto per chi vale); chi ne approfitta a righe alterne come le statistiche dell'editor (sprite in
 * piedi, nome, sotto la mossa come pillola o l'abilità, a destra cosa ottiene).
 */
export function ConditionTip({ row }: { row: ConditionRow }) {
  const t = useT();
  const lang = useLang();
  const type = CONDITION_TYPE[row.key];
  const viaId = toID(row.via);
  const itemId = toID(row.item);
  const turns = row.key === 'tailwind' ? 4 : 5;
  const longer = LONGER[row.key]?.includes(itemId);
  const duration = PRIMAL.has(viaId)
    ? t('ctip.whileIn', { name: row.member })
    : longer ? t('ctip.turnsItem', { n: 8, item: anyGameName(row.item, lang) }) : t('ctip.turns', { n: turns });
  const scope = t(TEAM_ONLY.has(row.key) ? 'ctip.forTeam' : 'ctip.forAll');
  const effects = EFFECTS[row.key] ?? [];
  return (
    <>
      <TipHead className={`ctip-tex k-${row.key}`} lead={type ? <TipTypeIcon type={type} /> : <TipGlyph icon="cloud" />} title={row.label} sub={duration}
        badge={<span className="ctip-setter">
          <span className="ctip-plinth"><Sprite species={row.member} size={SPRITE_TIP_TALL} /></span>
          <Via via={row.via} />
        </span>} />
      {effects.length > 0 && (
        <div className="mtip-stats ctip-cells">
          {effects.map((fx, i) => {
            const typeLabel = fx.type ? typeName(fx.type, lang) : '';
            return (
              <span key={i} className={`ctip-cell ${fx.tone}`}>
                <small>{t(fx.label, { type: typeLabel })}</small>
                <b>
                  {fx.value
                    ? <span className="ctip-val">{fx.dir && <Arrow dir={fx.dir} />}{fx.value}</span>
                    : fx.word && <span className="ctip-val word">{t(fx.word)}</span>}
                  <span className="ctip-note">{fx.note ? t(fx.note, { type: typeLabel }) : scope}</span>
                </b>
              </span>
            );
          })}
        </div>
      )}
      {row.users.length > 0 && (
        <TipSec label={t('ctip.users')} className="ctip-users-sec">
          <ul className="ctip-users">
            {row.users.map(user => {
              // Senza via: chi si potenzia dietro uno schermo; via senza voce nella tabella: Trick Room ("velocità bassa")
              const benefit = user.via ? BENEFITS[toID(user.via)] : undefined;
              const text = !user.via ? t('ctip.b.setup') : benefit ? t(benefit.text) : t('ctip.b.slow');
              return (
                <li key={user.name} className="ctip-user">
                  <span className="ctip-mon"><Sprite species={user.name} size={SPRITE_TIP_ROW} /></span>
                  <span className="ctip-who"><b>{user.name}</b>{user.via && benefit && <span className="ctip-via"><Via via={user.via} /></span>}</span>
                  {/* Un numero ("Velocità ×2") forte come i valori; una parola ("Non manca mai") più quieta, non compete coi numeri */}
                  <span className={`ctip-eff${/\d/.test(text) ? '' : ' word'}`}>{benefit?.up && <Arrow dir="up" />}{text}</span>
                </li>
              );
            })}
          </ul>
        </TipSec>
      )}
    </>
  );
}
