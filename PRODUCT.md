# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Simone and a few friends who play competitive Pokémon singles (Smogon National Dex on Showdown) and hackroms. They open DreamDex on a desktop PC, usually next to Showdown, while building or fixing a 6-Pokémon team. The interface is in English by default, with Italian available from the EN | IT switch.

## Product Purpose
A team builder that tells you which Pokémon complete your team best, and why. You add one or more Pokémon; DreamDex ranks candidates by meta usage, types, coverage and roles, explains each suggestion, rates the team, flags weaknesses and meta threats, and coaches what to fix. Success: a better team in less time, with reasons the player understands.

## Positioning
Not a damage calculator or a plain team editor: it reasons about the whole team against real Smogon usage data (monthly stats) and explains every suggestion and grade in plain English or Italian.

## Operating Context
- Teams move in and out as Showdown text (import/export), so the app sits beside Showdown.
- Formats: chosen as Pokédex (Gen 9 = Scarlet/Violet only, National Dex, "Senza limiti") plus tier (Gen 9 OU, Ubers, UU, Anything Goes; National Dex OU, Ubers, UU; in development only, a Singolo | Doppio choice with National Dex Doubles, hidden in the published build until the doubles grade is done, and graded like National Dex OU for now), with advanced options (ignore bans, multiple Megas, minimum usage of suggestions) and a gen limit. In Gen 9 a declared Tera that resists a team weakness gives a small bonus (+1 each, max 3). Banned moves, abilities, items and species come from Showdown (npm run fetch-data) and show as rules problems.
- Hackrom use: per-member "Custom Skillset" unlocks any move/ability; illegal moves are flagged, never deleted.
- Data is local (`npm run fetch-data`), refreshed monthly; the app must still work for name search and type analysis without stats.

## Capabilities and Constraints
- Features: "Completa team" guide (proposals computed in the background, six per round with earlier rounds kept as pages (from page 2 already shown Pokémon may return, each proposal changing at least half of its new members against every earlier one, never-shown ones first), with kept or improved sets, any condition or a chosen one, favourites as off, priority or only, notes on what is still missing only when no proposal can cover it, and real tournament teams to load), team panel with set editor (item, ability, moves, EVs, nature, tera; Smogon presets, "Most used" choices on top of each menu, ready EV spreads, final Speed and its place in the meta), suggestions with score bars (Difesa, Coverage, Ruoli, Statistiche) and tags, replacement mode, undo for removed or replaced members, team analysis, team rating (grade S–D across 4 areas, stall teams recognised, rules warning), coaching, meta threats, meta usage, search and filters over the whole Pokédex, favourites and bans (Liste), saved teams, share link, session persistence, a settings dialog (palette that follows the chosen game or a fixed one, saved in the browser).
- Layout: a left rail (format, rules, sections, quick actions, language) and the team always on screen; each section fits one screen with inner scrolling, and opening a team card swaps the section for that member's editor. Compact mode for low laptop screens.
- Planned: lead recommendation, Analysis/Meta redesign, Compare, game selection (the rail's Pokédex field becomes the game; palettes per game), a doubles grade (field pairs, redirection, speed control) then Doubles OU and VGC, a format rules window, a logo, account settings; then the mobile/tablet layout.
- Stack: React 19 + TypeScript + Vite; tests with Testing Library rely on accessible names (Italian, rendered with `initialLang="it"`; dedicated tests cover English), which must be kept.
- Desktop first. Mobile is wanted later but out of scope for now.

## Brand Commitments
- Name: DreamDex.
- Pokémon sprites must appear in the interface.
- Pokémon type colors keep their classic, recognisable colors.
- Pokémon names stay the official English names; move, ability, item, type and nature names follow the chosen language (official Italian names from PokeAPI, English where missing). Team data, saves and Showdown import/export are always English.

## Evidence on Hand
No logo, screenshots, testimonials or marketing material exist. Do not invent any.

## Product Principles
- Every function reachable and understandable without explanation: many features, one clear layout.
- Explain, don't just score: every number has a reason next to it.
- Never destroy the player's input: warn instead of blocking or deleting.
- Fast at a glance: the team, its grade and the best suggestions are readable in one look.
