import { coachAdvice, coachTeam } from '../../src/engine/coach';
import type { EngineData } from '../../src/engine/data';
import type { Format } from '../../src/engine/format';
import type { TeamSet } from '../../src/engine/sets';
import type { Lang } from '../../src/i18n';

/** I consigli del Coaching (candidati e prima mossa) per i problemi di coachTeam, come li calcola l'app. */
export const adviceOf = (team: TeamSet[], format: Format, data: EngineData, lang: Lang = 'it') =>
  coachAdvice(team, format, data, coachTeam(team, format, data, lang).problems, lang);
