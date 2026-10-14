export type StatID = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export const STAT_IDS: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export interface TeamSet {
  species: string;
  item: string;
  ability: string;
  moves: string[];
  nature: string;
  evs: Partial<Record<StatID, number>>;
  teraType?: string;
}
