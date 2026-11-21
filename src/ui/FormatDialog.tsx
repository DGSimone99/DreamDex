import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  FAMILIES, normalizeCompetitive, rulesOf, tiersFor,
  type CompetitiveChoice, type CompetitiveGen, type Family, type FormatChoice, type FormatMemory, type FreeChoice, type GameChoice,
} from '../engine/formatChoice';
import { BATTLE_IDS } from '../engine/formats';
import { GAME_GEN, GAME_IDS, gameReady, type GameId } from '../engine/games';
import { useT } from '../i18n/react';
import { getSpecies } from '../engine/dex';
import { illegalReason } from '../engine/formats';
import type { TeamSet } from '../engine/sets';
import { choiceName } from './formatName';
import { Icon } from './icons';
import { ModalLock } from './ModalLock';

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/** I loghi di ogni gioco, una versione per lato (file in public/games, © Nintendo / The Pokémon Company). */
const GAME_LOGOS: Record<GameId, { file: string; version: 'scarlet' | 'violet' }[]> = {
  sv: [{ file: 'sv-scarlet.png', version: 'scarlet' }, { file: 'sv-violet.png', version: 'violet' }],
};
/** Giochi in arrivo: si vedono spenti, col nome scritto. */
const GAMES_SOON = [{ id: 'swsh', gen: 8 }, { id: 'bdsp', gen: 8 }] as const;

type SourceId = 'smogon' | 'vgc' | 'champions';
const SOURCES: { id: SourceId; file: string; ready: boolean }[] = [
  { id: 'smogon', file: 'formats/smogon.svg', ready: true },
  { id: 'vgc', file: 'formats/vgc.png', ready: false },
  { id: 'champions', file: 'formats/champions.webp', ready: false },
];
/** Le generazioni Smogon passate, dalla più recente, con la sigla che si usa su Smogon. */
const PAST_GENS = [[8, 'SS'], [7, 'SM'], [6, 'ORAS'], [5, 'BW'], [4, 'DPP'], [3, 'ADV'], [2, 'GSC'], [1, 'RBY']] as const;
const GEN_LIMITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Un'immagine; se il file non c'è, il nome scritto al suo posto. */
function Logo({ src, alt, fallback, className }: { src: string; alt: string; fallback: ReactNode; className?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return <span className="fmt-logo-text">{fallback}</span>;
  return <img className={className ?? 'fmt-logo'} src={src} alt={alt} onError={() => setMissing(true)} />;
}

/** Un interruttore della finestra (stesso aspetto delle opzioni di oggi). */
function Toggle({ label, note, checked, onChange }: { label: string; note?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="format-toggle">
      <input type="checkbox" className="switch" aria-label={label} checked={checked} onChange={e => onChange(e.target.checked)} />
      <b>{label}</b>
      {note && <small>{note}</small>}
    </label>
  );
}

/**
 * Scegli il formato: tre linguette (Competitivo, Giochi, No Format) e sotto le scelte della famiglia mostrata.
 * Le scelte sono una bozza (una per famiglia, partendo dal formato attivo o dall'ultima scelta di quella famiglia): il formato
 * cambia solo con Conferma, e diventa la scelta della linguetta aperta. ×, Esc, Annulla o il clic fuori chiudono senza cambiare.
 * La finestra ha misure fisse: passando da una linguetta all'altra non cambia forma.
 */
export function FormatDialog({ choice, memory, family, team = [], onPick, onClose }: {
  choice: FormatChoice;
  /** Il team, per dire prima di confermare quanti membri non sarebbero ammessi. */
  team?: TeamSet[];
  memory: FormatMemory;
  /** La famiglia mostrata all'apertura (aprire non cambia il formato). */
  family: Family;
  onPick: (choice: FormatChoice) => void;
  onClose: () => void;
}) {
  const t = useT();
  const titleId = useId();
  // Giochi senza dati non si mostra: si parte da Competitivo
  const [shown, setShown] = useState<Family>(family === 'game' && !GAME_IDS.some(gameReady) ? 'competitive' : family);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Alla chiusura la tastiera torna dove era prima (la targa del formato)
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    body.current?.querySelector<HTMLInputElement>('input[name="format-family"]:checked')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      // Il Tab resta dentro la finestra: dall'ultimo elemento si torna al primo e viceversa
      if (e.key !== 'Tab' || !body.current) return;
      const items = [...body.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')]
        .filter(el => el.tabIndex >= 0 && !(el instanceof HTMLInputElement && el.type === 'radio' && !el.checked));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const inside = body.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, [onClose]);
  const gamesReady = GAME_IDS.some(gameReady);
  // La bozza di ogni famiglia: quella attiva parte dal formato di adesso, le altre dall'ultima scelta fatta lì
  const [drafts, setDrafts] = useState<FormatMemory>(() => ({ ...memory, [choice.family]: choice }));
  // Com'era ogni famiglia all'apertura: una scheda diversa da così ha modifiche non confermate
  const [initial] = useState(drafts);
  const changed = (f: Family) => JSON.stringify(drafts[f]) !== JSON.stringify(initial[f]);
  const { competitive, game, free } = drafts;
  const pickCompetitive = (patch: Partial<CompetitiveChoice>) =>
    setDrafts(d => ({ ...d, competitive: normalizeCompetitive({ ...d.competitive, ...patch }) }));
  const setGame = (next: GameChoice) => setDrafts(d => ({ ...d, game: next }));
  const setFree = (next: FreeChoice) => setDrafts(d => ({ ...d, free: next }));
  const confirm = () => { onPick(drafts[shown]); onClose(); };
  // Quanti membri del team non sarebbero ammessi col formato che si sta per usare
  const target = rulesOf(drafts[shown]);
  const notAllowed = team.filter(set => { const species = getSpecies(set.species); return species && illegalReason(species, target); }).length;

  return createPortal(
    <div className="help-backdrop" onClick={onClose}>
      <ModalLock />
      <div ref={body} className="help-dialog format-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
        <header className="help-head">
          <h3 id={titleId}>{t('formatDialog.title')}</h3>
          <button type="button" className="help-close" aria-label={t('settings.close')} onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="fmt-families" role="radiogroup" aria-label={t('formatDialog.familyAria')}>
          {FAMILIES.map(f => {
            const off = f === 'game' && !gamesReady;
            return (
              <label key={f} className={`${shown === f ? 'on' : ''}${choice.family === f ? ' active' : ''}${off ? ' off' : ''}`.trim() || undefined}>
                <input type="radio" className="visually-hidden" name="format-family" value={f} checked={shown === f} disabled={off}
                  onChange={() => setShown(f)} />
                {t(`family.${f}`)}
                {changed(f) && <span className="fmt-dirty"><span className="visually-hidden">{t('formatDialog.unsaved')}</span></span>}
              </label>
            );
          })}
        </div>
        <div className="fmt-body">
          {shown === 'competitive' && <>
            <div className="fmt-sources" role="radiogroup" aria-label={t('formatDialog.source')}>
              {SOURCES.map(s => (
                <label key={s.id} className={`fmt-tile${s.id === 'smogon' ? ' on' : ''}${s.ready ? '' : ' off'}`}>
                  <input type="radio" className="visually-hidden" name="format-source" value={s.id} checked={s.id === 'smogon'} disabled={!s.ready}
                    aria-label={s.ready ? t(`source.${s.id}`) : `${t(`source.${s.id}`)}, ${t('top.soon')}`} onChange={() => {}} />
                  <span className="fmt-art" aria-hidden="true">
                    <Logo src={asset(s.file)} alt="" fallback={t(`source.${s.id}`)} />
                  </span>
                  <b>{t(`source.${s.id}`)}</b>
                  <small>{s.ready ? t('source.smogonNote') : t('top.soon')}</small>
                </label>
              ))}
            </div>
            <section className="fmt-sec">
              <p className="rail-label" id={`${titleId}-gen`}>{t('formatDialog.gen')}</p>
              <div className="fmt-gens" role="radiogroup" aria-labelledby={`${titleId}-gen`}>
                {(['natdex', 9] as CompetitiveGen[]).map(gen => (
                  <label key={gen} className={`fmt-tile${competitive.gen === gen ? ' on' : ''}`}>
                    <input type="radio" className="visually-hidden" name="format-gen" value={String(gen)} checked={competitive.gen === gen}
                      onChange={() => pickCompetitive({ gen })} />
                    <b>{gen === 'natdex' ? t('dex.natdex') : t('dex.gen9')}</b>
                    <small>{gen === 'natdex' ? t('formatDialog.natdexNote') : t('formatDialog.gen9Note')}</small>
                  </label>
                ))}
              </div>
            </section>
            <section className="fmt-sec">
              <p className="rail-label">{t('top.battle')}</p>
              <div className="format-chips" role="radiogroup" aria-label={t('top.battleAria')}>
                {BATTLE_IDS.map(id => {
                  const none = tiersFor(competitive.gen, id).length === 0;
                  return (
                    <label key={id} className={`${id === competitive.battle ? 'on' : ''}${none ? ' soon' : ''}`.trim() || undefined}>
                      <input type="radio" className="visually-hidden" name="format-battle" value={id} checked={id === competitive.battle} disabled={none}
                        onChange={() => pickCompetitive({ battle: id })} />
                      {t(`battle.${id}`)}
                    </label>
                  );
                })}
              </div>
            </section>
            <section className="fmt-sec">
              <p className="rail-label">{t('top.tier')}</p>
              <div className="format-chips" role="radiogroup" aria-label={t('top.tierAria')}>
                {tiersFor(competitive.gen, competitive.battle).map(x => (
                  <label key={x.formatId} className={x.tier === competitive.tier ? 'on' : undefined}>
                    <input type="radio" className="visually-hidden" name="format-tier" value={x.formatId} checked={x.tier === competitive.tier}
                      onChange={() => pickCompetitive({ tier: x.tier })} />
                    {x.tier}
                  </label>
                ))}
              </div>
            </section>
            {/* Le generazioni Smogon passate, non ancora pronte: dopo le scelte che si usano davvero */}
            <section className="fmt-sec">
              <p className="fmt-past-label first">{t('formatDialog.pastGens')} <span className="fmt-soon">{t('top.soon')}</span></p>
              <div className="fmt-scale">
                {PAST_GENS.map(([n, abbr]) => (
                  <label key={n} className="off">
                    <input type="radio" className="visually-hidden" name="format-gen" value={String(n)} disabled
                      aria-label={t('formatDialog.pastGenAria', { n, abbr })} />
                    <b>{n}</b><small>{abbr}</small>
                  </label>
                ))}
              </div>
            </section>
            <section className="fmt-sec">
              <p className="rail-label">{t('top.advanced')}</p>
              <Toggle label={t('top.ignoreBans')} note={t('top.ignoreBansNote')} checked={competitive.ignoreBans} onChange={on => pickCompetitive({ ignoreBans: on })} />
              <Toggle label={t('top.multipleMegas')} note={t('top.multipleMegasNote')} checked={competitive.multipleMegas} onChange={on => pickCompetitive({ multipleMegas: on })} />
            </section>
          </>}

          {shown === 'game' && <>
            {[...new Set([...GAME_IDS.map(id => GAME_GEN[id]), ...GAMES_SOON.map(g => g.gen)])].sort((a, b) => b - a).map(gen => (
              <section key={gen} className="fmt-sec">
                <p className="rail-label">{t('formatDialog.gameGen', { n: gen })}</p>
                <div className="fmt-games" role="radiogroup" aria-label={t('formatDialog.gameGen', { n: gen })}>
                  {GAME_IDS.filter(id => GAME_GEN[id] === gen).map(id => (
                    <label key={id} className={`fmt-tile fmt-game game-${id}${game.game === id ? ' on' : ''}${gameReady(id) ? '' : ' off'}`}>
                      <input type="radio" className="visually-hidden" name="format-game" value={id} checked={game.game === id} disabled={!gameReady(id)}
                        aria-label={t(`game.${id}`)} onChange={() => setGame({ ...game, game: id })} />
                      <span className="fmt-art">
                        {GAME_LOGOS[id].map(logo => (
                          <Logo key={logo.file} src={asset(`games/${logo.file}`)} alt={t(`game.logoAlt.${logo.version}`)}
                            fallback={t(`game.version.${logo.version}`)} />
                        ))}
                      </span>
                      <b>{t(`game.${id}`)}</b>
                      <small>{t(`game.note.${id}`)}</small>
                    </label>
                  ))}
                  {GAMES_SOON.filter(g => g.gen === gen).map(g => (
                    <label key={g.id} className="fmt-tile fmt-game off">
                      <input type="radio" className="visually-hidden" name="format-game" value={g.id} disabled
                        aria-label={`${t(`gameSoon.${g.id}`)}, ${t('top.soon')}`} />
                      <b>{t(`gameSoon.${g.id}`)}</b>
                      <small>{t('top.soon')}</small>
                    </label>
                  ))}
                </div>
              </section>
            ))}
            <section className="fmt-sec">
              <p className="rail-label">{t('rail.gameOptions')}</p>
              <Toggle label={t('top.allPokedex')} note={t('top.allPokedexNote')} checked={game.allPokedex} onChange={on => setGame({ ...game, allPokedex: on })} />
              <Toggle label={t('top.legendaries')} note={t('top.legendariesNote')} checked={game.legendaries} onChange={on => setGame({ ...game, legendaries: on })} />
            </section>
          </>}

          {shown === 'free' && <>
            <p className="fmt-note">{t('formatDialog.freeNote')}</p>
            <section className="fmt-sec">
              <p className="rail-label" id={`${titleId}-limit`}>{t('formatDialog.genLimit')}</p>
              <div className="format-gens" role="radiogroup" aria-labelledby={`${titleId}-limit`}>
                {GEN_LIMITS.map(n => (
                  <label key={n} className={n === free.genLimit ? 'on' : n < free.genLimit ? 'in' : undefined}>
                    <input type="radio" className="visually-hidden" name="format-genlimit" value={n} checked={n === free.genLimit}
                      aria-label={t('formatDialog.genLimitAria', { n })} onChange={() => setFree({ ...free, genLimit: n })} />
                    {n}
                  </label>
                ))}
              </div>
            </section>
            <section className="fmt-sec">
              <p className="rail-label">{t('top.advanced')}</p>
              <Toggle label={t('top.multipleMegas')} note={t('top.multipleMegasNote')} checked={free.multipleMegas} onChange={on => setFree({ ...free, multipleMegas: on })} />
            </section>
          </>}
          <p className="note">{t('formatDialog.logosCredit')}</p>
        </div>
        <footer className="fmt-actions">
          {notAllowed > 0 && <p className="fmt-warning" role="status">
            {t(notAllowed === 1 ? 'formatDialog.notAllowedOne' : 'formatDialog.notAllowedMany', { n: notAllowed, format: choiceName(drafts[shown], t) })}</p>}
          <button type="button" onClick={onClose}>{t('formatDialog.cancel')}</button>
          {/* Il pulsante dice quale formato userà: la scelta della scheda aperta */}
          <button type="button" className="primary" onClick={confirm}>{t('formatDialog.use', { format: choiceName(drafts[shown], t) })}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
