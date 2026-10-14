import { itemNames, moveNames, speciesNames } from '../engine/dex';

const SPECIES = speciesNames();
const MOVES = moveNames();
const ITEMS = itemNames();

export function DataLists() {
  return (
    <>
      <datalist id="species-list">{SPECIES.map(name => <option key={name} value={name} />)}</datalist>
      <datalist id="move-list">{MOVES.map(name => <option key={name} value={name} />)}</datalist>
      <datalist id="item-list">{ITEMS.map(name => <option key={name} value={name} />)}</datalist>
    </>
  );
}
