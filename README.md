# DreamDex

Team builder avanzato per Smogon **National Dex** (singolo 6v6): OU, Ubers, UU, Monotype e "Tutti i Pokémon".
Inserisci uno o più Pokémon e DreamDex suggerisce, in ordine, quelli che completano meglio il team, considerando meta, tipi, coverage e ruoli, con una motivazione per ciascuno. Interfaccia in inglese o italiano (interruttore EN | IT).

## Avvio

    npm install
    npm run fetch-data   # scarica statistiche, preset Smogon e nomi italiani in data/
    npm run dev

## Comandi

- `npm test`: test (Vitest)
- `npm run build`: controllo dei tipi + build di produzione
- `npm run fetch-data`: aggiorna i dati (rilancialo ogni mese); la cartella `data/` non è nel repository

## Cosa fa

- **Team:** card con sprite (idle animato quando apri il set), editor con preset Smogon, scelte "Più usati" in cima ai menu, spread EV pronti, Velocità finale e posto nel meta; Mega e Ultraesplosione seguono lo strumento.
- **Suggerimenti:** classifica con punteggi (difesa, coverage, ruoli, statistiche), filtri, modalità sostituzione e Annulla.
- **Analisi:** voto S–D con penalità e bonus (meteo, stall riconosciuto, avviso se il team viola le regole del formato), coaching, debolezze, coverage, minacce, uso nel meta.
- **Import/Export:** testo Showdown, team salvati e link condivisibile (`#team=...`, senza server).

## Struttura

- `src/engine/`: logica pura (tipi, ruoli, statistiche, punteggio, voto, sostituzione)
- `src/ui/`: componenti React
- `src/i18n/`: testi EN/IT e nomi del gioco
- `scripts/`: download dei dati Smogon e PokeAPI
- `docs/superpowers/`: spec e piani di implementazione
- `DESIGN.md`, `PRODUCT.md`: sistema di design e contesto del prodotto
