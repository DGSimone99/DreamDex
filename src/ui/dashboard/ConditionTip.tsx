import { getMove, toID } from '../../engine/dex';
import type { ConditionRow } from '../../engine/teamSummary';
import type { TypeName } from '../../engine/types';
import type { MessageKey } from '../../i18n';
import { anyGameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { Sprite } from '../Sprite';
import { SPRITE_TIP, SPRITE_TIP_ROW } from '../spriteSizes';
import { typeIconUrl } from '../typeIcons';
import { MovePill } from '../MovePill';

/**
 * Il tipo che corrisponde a una condizione (meteo, campo, Trick Room, schermi, Ventoincoda): colore e icona della sua
 * chip e del tooltip. Chiavi: id della condizione o della mossa.
 */
export const CONDITION_TYPE: Record<string, TypeName> = {
  sun: 'Fire', rain: 'Water', sand: 'Rock', snow: 'Ice',
  electricterrain: 'Electric', psychicterrain: 'Psychic', grassyterrain: 'Grass', mistyterrain: 'Fairy',
  trickroom: 'Psychic', reflect: 'Psychic', lightscreen: 'Psychic', auroraveil: 'Ice', tailwind: 'Flying',
};

/** Un effetto della condizione: icona del tipo se c'è, frase, valore con la freccia e il tono (buono o cattivo per chi la porta). */
interface Effect { type?: TypeName; text: MessageKey; vars?: Record<string, string>; value?: string; dir?: 'up' | 'down'; tone: 'good' | 'bad' | 'plain' }

/** Gli effetti di ogni condizione, in breve (il dettaglio vero sta nelle schede). */
const EFFECTS: Record<string, Effect[]> = {
  rain: [{ type: 'Water', text: 'ctip.moves', value: '50%', dir: 'up', tone: 'good' }, { type: 'Fire', text: 'ctip.moves', value: '50%', dir: 'down', tone: 'bad' }],
  sun: [{ type: 'Fire', text: 'ctip.moves', value: '50%', dir: 'up', tone: 'good' }, { type: 'Water', text: 'ctip.moves', value: '50%', dir: 'down', tone: 'bad' }],
  sand: [{ type: 'Rock', text: 'ctip.typeSpd', value: '50%', dir: 'up', tone: 'good' }, { text: 'ctip.sandChip', value: '6%', tone: 'bad' }],
  snow: [{ type: 'Ice', text: 'ctip.typeDef', value: '50%', dir: 'up', tone: 'good' }],
  electricterrain: [{ type: 'Electric', text: 'ctip.movesGround', value: '30%', dir: 'up', tone: 'good' }, { text: 'ctip.noSleep', tone: 'plain' }],
  psychicterrain: [{ type: 'Psychic', text: 'ctip.movesGround', value: '30%', dir: 'up', tone: 'good' }, { text: 'ctip.noPriority', tone: 'plain' }],
  grassyterrain: [{ type: 'Grass', text: 'ctip.movesGround', value: '30%', dir: 'up', tone: 'good' }, { text: 'ctip.grassyHeal', value: '6%', dir: 'up', tone: 'good' }],
  mistyterrain: [{ type: 'Dragon', text: 'ctip.movesOnGround', value: '50%', dir: 'down', tone: 'bad' }, { text: 'ctip.noStatus', tone: 'plain' }],
  trickroom: [{ text: 'ctip.trickRoom', tone: 'plain' }],
  reflect: [{ text: 'ctip.physicalTaken', value: '50%', dir: 'down', tone: 'good' }],
  lightscreen: [{ text: 'ctip.specialTaken', value: '50%', dir: 'down', tone: 'good' }],
  auroraveil: [{ text: 'ctip.physicalTaken', value: '50%', dir: 'down', tone: 'good' }, { text: 'ctip.specialTaken', value: '50%', dir: 'down', tone: 'good' }],
  tailwind: [{ text: 'ctip.teamSpeed', value: '×2', dir: 'up', tone: 'good' }],
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

/** Abilità come lastra inclinata, mossa col nome nel colore del suo tipo. */
function Via({ via }: { via: string }) {
  const lang = useLang();
  const move = getMove(via);
  if (!move) return <span className="ctip-ab">{anyGameName(via, lang)}</span>;
  return (
<MovePill name={move.name} size="sm" className="ctip-mv" />
  );
}

/**
 * Il tooltip di una riga di Meteo e campo: testata nel colore della condizione (con una texture sua: la pioggia scende),
 * chi la porta e quanto dura; gli effetti come lastre inclinate; chi ne approfitta, con cosa e cosa ottiene.
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
  return (
    <>
      <div className={`ctip-head k-${row.key}`}>
        {type && <img className="ctip-ico" src={typeIconUrl(type)} alt="" draggable={false} />}
        <b className="ctip-name">{row.label}</b>
        <span className="ctip-sub">{duration}</span>
        <span className="ctip-setter">
          <span className="ctip-plinth"><Sprite species={row.member} size={SPRITE_TIP} /></span>
          <Via via={row.via} />
        </span>
      </div>
      <div className="ctip-fx">
        {(EFFECTS[row.key] ?? []).map((fx, i) => (
          <div key={i} className={`ctip-plate ${fx.tone}`}>
            {fx.type && <img src={typeIconUrl(fx.type)} alt="" draggable={false} />}
            <span><b>{t(fx.text, { type: fx.type ? typeName(fx.type, lang) : '' })}</b>{scope}</span>
            {fx.value && <strong>{fx.dir && <Arrow dir={fx.dir} />}{fx.value}</strong>}
          </div>
        ))}
      </div>
      {row.users.map(user => {
        // Senza via: chi si potenzia dietro uno schermo; via senza voce nella tabella: Trick Room ("velocità bassa")
        const benefit = user.via ? BENEFITS[toID(user.via)] : undefined;
        const text = !user.via ? t('ctip.b.setup') : benefit ? t(benefit.text) : t('ctip.b.slow');
        return (
          <div key={user.name} className="ctip-user">
            <span className="ctip-plinth good"><Sprite species={user.name} size={SPRITE_TIP_ROW} /></span>
            <span className="ctip-who"><b>{user.name}</b>{user.via && benefit && <span className="ctip-via"><Via via={user.via} /></span>}</span>
            <span className="ctip-eff">{benefit?.up && <Arrow dir="up" />}{text}</span>
          </div>
        );
      })}
    </>
  );
}
