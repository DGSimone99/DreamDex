import { dex, itemNames, moveNames, speciesNames } from '../engine/dex';

const SPECIES = speciesNames();
const MOVES = moveNames();
const ITEMS = itemNames();
const ABILITIES = dex.abilities.all().filter(a => a.exists && !a.isNonstandard).map(a => a.name).sort();

export function DataLists() {
  return (
    <>
      <datalist id="species-list">{SPECIES.map(name => <option key={name} value={name} />)}</datalist>
      <datalist id="move-list">{MOVES.map(name => <option key={name} value={name} />)}</datalist>
      <datalist id="ability-list">{ABILITIES.map(name => <option key={name} value={name} />)}</datalist>
      <datalist id="item-list">{ITEMS.map(name => <option key={name} value={name} />)}</datalist>
    </>
  );
}
