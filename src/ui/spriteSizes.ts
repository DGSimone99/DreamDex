/*
 * Misure delle sprite nei tooltip dell'Analisi (vedi DESIGN.md, "Icon and sprite sizes"): una per il Pokémon di cui parla
 * il tooltip (su un piedistallo, nel corpo), una per quelli in testata o in fila (righe, elenchi, scala della Velocità).
 * La carta del Pokémon (MemberCard) resta grande: è il profilo, non un tooltip di dettaglio.
 */
export const SPRITE_TIP = 48;
/** La sprite del soggetto quando la testata ha anche la riga sotto il titolo (più alta): la stessa soglia per uscire dal bordo. */
export const SPRITE_TIP_TALL = 64;
export const SPRITE_TIP_ROW = 40;
