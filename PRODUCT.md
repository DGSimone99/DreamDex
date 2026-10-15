# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Simone and a few friends who play competitive Pokémon singles (Smogon National Dex on Showdown) and hackroms. They open DreamDex on a desktop PC, usually next to Showdown, while building or fixing a 6-Pokémon team. The interface is in Italian.

## Product Purpose
A team builder that tells you which Pokémon complete your team best, and why. You add one or more Pokémon; DreamDex ranks candidates by meta usage, types, coverage and roles, explains each suggestion, rates the team, flags weaknesses and meta threats, and coaches what to fix. Success: a better team in less time, with reasons the player understands.

## Positioning
Not a damage calculator or a plain team editor: it reasons about the whole team against real Smogon usage data (monthly stats) and explains every suggestion and grade in plain Italian.

## Operating Context
- Teams move in and out as Showdown text (import/export), so the app sits beside Showdown.
- Formats: National Dex OU, Ubers, UU, "Tutti i Pokémon (senza limiti)", with advanced options (Monotype, ignore bans, multiple Megas, gen limit).
- Hackrom use: per-member "Custom Skillset" unlocks any move/ability; illegal moves are flagged, never deleted.
- Data is local (`npm run fetch-data`), refreshed monthly; the app must still work for name search and type analysis without stats.

## Capabilities and Constraints
- Features: team panel with set editor (item, ability, moves, EVs, nature, tera), suggestions with score bars (Difesa, Coverage, Ruoli, Statistiche) and tags, replacement mode, team analysis, team rating (grade S–D across 4 areas), coaching, meta threats, meta usage, search and filters over the whole Pokédex, favourites, saved teams, session persistence.
- Stack: React 19 + TypeScript + Vite; tests with Testing Library rely on accessible names and Italian labels, which must be kept.
- Desktop first. Mobile is wanted later but out of scope for now.

## Brand Commitments
- Name: DreamDex.
- Pokémon sprites must appear in the interface.
- Pokémon type colors keep their classic, recognisable colors.
- Pokémon, move, ability and item names stay the official (English) names.

## Evidence on Hand
No logo, screenshots, testimonials or marketing material exist. Do not invent any.

## Product Principles
- Every function reachable and understandable without explanation: many features, one clear layout.
- Explain, don't just score: every number has a reason next to it.
- Never destroy the player's input: warn instead of blocking or deleting.
- Fast at a glance: the team, its grade and the best suggestions are readable in one look.
