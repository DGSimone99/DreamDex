import { rulesOf, type FormatChoice } from '../engine/formatChoice';
import { GAME_GEN } from '../engine/games';
import type { MessageKey } from '../i18n';

type T = (key: MessageKey, values?: Record<string, string | number>) => string;

/** Il nome del formato scelto, in grande nella fascia: "National Dex OU", "Scarlatto e Violetto", "No Format". */
export function choiceName(choice: FormatChoice, t: T): string {
  if (choice.family === 'game') return t(`game.${choice.game}`);
  return t(`format.${rulesOf(choice).formatId}`);
}

/** Il riassunto breve sotto il nome, più le opzioni accese. */
export function choiceSummary(choice: FormatChoice, t: T): string[] {
  switch (choice.family) {
    case 'competitive':
      return [t('source.smogon'), t(`battle.${choice.battle}`),
        ...(choice.ignoreBans ? [t('rail.pillNoBans')] : []), ...(choice.multipleMegas ? [t('rail.pillMegas')] : [])];
    case 'game':
      return [t('formatDialog.gameGen', { n: GAME_GEN[choice.game] }),
        ...(choice.allPokedex ? [t('rail.pillAllPokedex')] : []), ...(choice.legendaries ? [t('rail.pillLegendaries')] : [])];
    case 'free':
      return [t('rail.pillUpTo', { n: choice.genLimit }), ...(choice.multipleMegas ? [t('rail.pillMegas')] : [])];
  }
}
