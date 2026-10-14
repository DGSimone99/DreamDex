# DreamDex

Team builder avanzato per Smogon **National Dex OU** (singolo 6v6).
Inserisci uno o più Pokémon e DreamDex suggerisce, in ordine, quelli che completano meglio il team, considerando meta, tipi, coverage e ruoli, con una motivazione per ciascuno.

## Avvio

    npm install
    npm run fetch-data   # scarica le statistiche Smogon del mese più recente in data/
    npm run dev

## Comandi

- `npm test`: test (Vitest)
- `npm run build`: controllo dei tipi + build di produzione
- `npm run fetch-data`: aggiorna le statistiche (rilancialo ogni mese)

## Struttura

- `src/engine/`: logica pura (tipi, ruoli, statistiche, punteggio, sostituzione)
- `src/ui/`: componenti React
- `scripts/`: download dei dati Smogon
- `docs/superpowers/`: spec e piano di implementazione
