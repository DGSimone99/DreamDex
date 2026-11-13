---
name: DreamDex
description: Team builder for Smogon National Dex, styled as the PC Box and summary screens of Pokémon Sword and Shield, with the team as six Pokémon Masters EX cards.
colors:
  ground: "#101219"
  band: "#14172a"
  panel: "#1a1d2a"
  raised: "#272b3d"
  field: "#0c0e15"
  line: "#363b52"
  line-soft: "#262a3b"
  text: "#f2f4ff"
  muted: "#aeb3cc"
  faint: "#9095b0"
  accent: "#00d1ff"
  accent-ink: "#00d1ff"
  accent-soft: "#0b3a4d"
  accent-wash: "#0a2a38"
  on-accent: "#001b24"
  accent-2: "#ff2d8a"
  accent-2-ink: "#ff5ca3"
  accent-2-soft: "#4a1430"
  accent-2-wash: "#3a1030"
  on-accent-2: "#22000f"
  sv-accent: "#ff7a1a"
  sv-accent-ink: "#ff8f3d"
  sv-accent-soft: "#4a2410"
  sv-accent-wash: "#33190a"
  sv-on-accent: "#1f0b00"
  sv-accent-2: "#a35cff"
  sv-accent-2-ink: "#c09aff"
  sv-accent-2-soft: "#2f1d52"
  sv-accent-2-wash: "#241640"
  sv-on-accent-2: "#12002a"
  bad: "#ff8a8a"
  bad-bg: "#3a1426"
  warn: "#ffc857"
  warn-bg: "#362a0d"
  good: "#63e3a8"
  good-bg: "#0f3229"
typography:
  grade:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "76px"
    fontWeight: 800
    lineHeight: 0.9
  score:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 0.9
    fontFeature: "tnum"
  display:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.01em"
  title:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "0.01em"
  rail-section:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.01em"
  section-head:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.2
  button-primary:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
  body:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  body-small:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
  chip:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.04em"
rounded:
  square: "0px"
  chip: "2px"
  tag: "3px"
  control: "4px"
  floating: "6px"
  count: "10px"
  pill: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  gutter: "22px"
components:
  button:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  button-pressed:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.text}"
  button-primary:
    backgroundColor: "{colors.accent-2}"
    textColor: "{colors.on-accent-2}"
    typography: "{typography.button-primary}"
    rounded: "{rounded.control}"
  button-primary-hover:
    backgroundColor: "{colors.accent-2-ink}"
  quick-add-top:
    backgroundColor: "{colors.accent-2}"
    textColor: "{colors.on-accent-2}"
    rounded: "{rounded.control}"
    size: "34px"
  quick-add:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    size: "34px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  section-head:
    backgroundColor: "{colors.accent-2}"
    textColor: "{colors.on-accent-2}"
    typography: "{typography.section-head}"
    rounded: "{rounded.square}"
    padding: "4px 24px 4px 12px"
  rail-tab:
    textColor: "{colors.muted}"
    typography: "{typography.rail-section}"
    padding: "9px 16px"
  rail-tab-active:
    backgroundColor: "{colors.accent-2}"
    textColor: "{colors.on-accent-2}"
  block:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.square}"
    padding: "12px 16px"
  team-card:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.square}"
    padding: "8px 12px 14px"
    height: "268px"
  grade-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.accent}"
    typography: "{typography.grade}"
    width: "196px"
  box-row:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.square}"
    padding: "8px 12px 8px 14px"
  box-row-first:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
  type-chip:
    typography: "{typography.chip}"
    rounded: "{rounded.chip}"
    width: "66px"
  tag:
    backgroundColor: "{colors.good-bg}"
    textColor: "{colors.good}"
    rounded: "{rounded.tag}"
    padding: "1px 7px"
  tag-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn}"
  tag-banned:
    backgroundColor: "{colors.bad-bg}"
    textColor: "{colors.bad}"
  floating:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
---

# Design System: DreamDex

## Overview

**Creative North Star: "The Trainer's PC Box"**

DreamDex looks like a modern Pokémon game interface, not a dashboard. The working surface is the PC Box and the summary screens of Sword and Shield: a deep blue-black ground, square panels in two tonal steps, two bright "version colours" and slanted tab heads with a fine diagonal stripe. The team sits on top as six Pokémon Masters EX style cards, each washed in its first type's colour, beside a big grade card. The world is a game menu that still reads like a tool: numbers, names and reasons come first, and the costume never gets in the way of reading them.

The app is one screen. A left rail carries the logo, the format, the sections and the global actions; the team band is always on screen; every section scrolls inside its own areas, the page never does. Density is medium: one tool row, then a ranked Box list beside a summary screen, with generous 22px gutters and 10-16px gaps.

Kanit carries the whole voice: italic 600-800 for headings, Pokémon names, big numbers and rail sections, upright 400-600 for text and data, tabular figures everywhere. The previous navy-and-gold "World Final Team Preview" broadcast look and the generic grey dashboard are both rejected.

**Key Characteristics:**
- Deep blue-black ground (#101219) with square panels; depth is tonal, shadows only for floating things.
- Two version colours per game: cyan works and informs, magenta marks the best next action and "you are here" (the open section or tab); section heads are neutral plates.
- Slanted, striped parallelogram heads; everything else stays square.
- Masters EX team cards: type-colour gradient, diagonal light streak, big sprite, italic name, type stripe.
- One screen, inner scrolling, team always visible; desktop first.

## Colors

A dark, cool ground with two saturated version colours that swap per game, plus status and type colours that never swap.

### Primary
- **Box Cyan** (accent, #00d1ff in Sword and Shield): the working colour. Hover and focus borders, the 2px focus ring, pressed toggles and segments (on Accent Soft #0b3a4d), selected Box rows (1px inset ring), meters and EV sliders, the grade letter and its bars for B (S magenta, A green, C yellow, D red), info marks, the "Più usati" markers and usage shares in the editor menus, the lead label, the selected card's bottom stripe and the editor's 3px top rule, the undo timer. Accent Ink is the text form; Accent Wash (#0a2a38) tints the chosen setting.

### Secondary
- **Version Magenta** (accent-2, #ff2d8a in Sword and Shield): the best next action, the open section/tab and the S grade (letter, card tint and its bars: the special grade) (no longer every head: heads are neutral `--plate` since 2026-11-10). Since 2026-11-13 it is rare: at most one magenta action per work area. It takes the main button of the best choice ("AGGIUNGI AL TEAM" on the #1 candidate, uppercase; "USA" on the best Completa team proposal), the active rail section and the open Analisi and editor tab. The guide button (Completa team / Migliora i set) is Accent Soft with a cyan spark, the #1 candidate's +N tag is Accent Ink on Accent Soft, and the #1's big grade change in the summary screen is plain Text: the #1 is marked by its magenta button alone. Text on it is On Accent 2 (#22000f); Accent 2 Ink (#ff5ca3) is its hover and its text form.

### Tertiary (status only)
- **Alarm Red** (#ff8a8a on #3a1426): legality or serious problems, banned tags, falling grade, nature-lowered stat, EV overflow, remove and destructive hovers.
- **Caution Yellow** (#ffc857 on #362a0d): "check this" (warn marks, warn tags, grade C).
- **Pitch Green** (#63e3a8 on #0f3229): strengths and gains (rising grade, nature-raised stat, setup gains, default tags).

### Neutral
- **Ground** (#101219): page, floating surfaces (menus, tooltips, dialogs, paste panel).
- **Band** (#14172a): the team band; with the stripe texture, the summary plate and dialog heads.
- **Panel** (#1a1d2a): rail, blocks, Box list, summary screen, editor, grade card, team card base.
- **Raised** (#272b3d): buttons, hovered rows, active options, the selected Box row.
- **Field** (#0c0e15): inputs, code, set text, meter tracks.
- **Line** (#363b52) and **Line Soft** (#262a3b): button borders and panel/row dividers. **Control Line** (`--control-line`, #646b90): borders of fields (selects, text inputs), 3.7:1 on Field so they read as places to type or choose.
- Information is never dimmed with opacity (it drops below 4.5:1): muted or faint text colours instead; opacity is only for disabled controls and sprites.
- **Text** (#f2f4ff), **Muted** (#aeb3cc), **Faint** (#9095b0): primary, secondary and tertiary text; Faint is still at least 4.6:1 on Raised.

### Type colours
The 18 classic type colours (Normal #A8A878, Fire #F08030, Water #6890F0, and the rest, defined in `src/ui/Sprite.tsx`) fill type chips with whichever ink (dark #10142b or white) has the higher contrast (every type ≥5.6:1; Water and Psychic take the dark ink), colour card gradients and bottom stripes, type dots and type filter buttons, and are lightened toward white for type and move names in text.

### Per-game palettes
The two version colours follow the game. `:root` is Sword and Shield (cyan #00d1ff, magenta #ff2d8a); `:root[data-palette='sv']` is Scarlet and Violet (orange #ff7a1a, violet #a35cff), each with its own ink, soft, wash and on-colour steps (the `sv-*` tokens). Only the accent tokens change: ground, panels, lines, text, status and type colours are identical in both. "Segue il gioco" (the default) picks Scarlet and Violet for the Gen 9 Pokédex and Sword and Shield otherwise; the Settings dialog can pin one. Every pair is contrast-checked in `tokens.css` (on-accent text at least 5.2:1, ink at least 4.8:1 on Raised).

### Named Rules
**The Two Version Colours Rule.** Cyan (accent) is work, info, selection, meters, the grade letter and focus. Magenta (accent-2) is the one best next action on screen (the #1 candidate's "Aggiungi al team" and its + button, the best proposal's "Usa") and "you are here" (the open rail section, the open Analisi and editor tab). Tags, frames, scores and toolbar buttons around that action stay cyan or neutral, so a screen never shows more than the rail and one magenta action. Section and panel heads are neutral slanted plates (`--plate` / `--on-plate`). Nothing else takes magenta; a second "main" button on the same surface is an ordinary button.

**The Only Accents Change Rule.** A palette swaps the accent tokens and nothing else. Never hard-code an accent hex in a component (the Settings swatches are the one exception, because they show the palettes themselves).

**The Status Means Status Rule.** Red, yellow and green never decorate. Red is a legality or serious problem, yellow is "check this", green is a strength or a gain. They are never tied to the palette.

**The Classic Types Rule.** Type colours keep their classic hues. Lighten them for text legibility; never re-hue them to fit the palette.

## Typography

**Display Font:** Kanit italic 600-800 (with system-ui, sans-serif), self-hosted through `@fontsource/kanit`
**Body Font:** Kanit upright 400-600

**Character:** One rounded, slightly technical sans in two postures: italic for anything that should feel like the game (names, heads, numbers, sections), upright for reading. Tabular figures are on from the body down.

### Hierarchy
- **Grade** (800 italic, 76px, 0.85; 58px in compact mode, 46px on screens under 800px tall): the grade letter only, in magenta for S (the special one), green for A, cyan for B, yellow for C, red for D; the "Come funziona" help opens with the same five letters as coloured tiles. A team with an illegal member shows its letter, verbal label and the rail's grade in Faint (the score stays readable in Muted) until it is legal again; the red "Non legale: N Pokémon" tag under the label says why (the format and who in its tooltip; no warning triangle on the badge; in compact mode the tag drops its icon so it stays on one line).
- **Score** (700 italic, 44px, 0.9): the grade change on the summary plate; 24px for the result in Box rows, 22px for "76 / 100".
- **Display** (800 italic, 26px, 1): the logo and the open member's name in the editor.
- **Headline** (700 italic, 22px, 1.1): page-level h2 and the summary plate name (24px).
- **Title** (800 italic, 17px, 1.05): Pokémon names on team cards (two lines at most); 700 italic 16-17px for Box row names, swaps and member rows; 600 italic 17px for rail sections.
- **Section head** (700 italic, 14-15px, 1.2; 12-13px for in-panel heads): text inside the slanted heads, On Accent 2.
- **Body** (400, 15px, 1.45, tabular): default text; 13-14px for notes, explanations and options.
- **Label** (600, 11-12px, 0.05-0.08em, uppercase): field labels ("POKÉDEX", "TIER", "STRUMENTO", "PALETTE"), stat column heads, group rows. Never used as a decorative kicker above a heading.
- **Chip** (600, 11px, 0.04em, uppercase): type chips; tags are 600 12px in sentence case.

### Named Rules
**The 11px Floor Rule.** No text is smaller than 11px.

**The Official Names Rule.** UI copy follows the EN | IT switch (English by default). Pokémon names always stay official English. Move, ability, item, type and nature names, and move/ability/item descriptions, use the official Italian text from PokeAPI in Italian (English where a translation is missing) and Showdown's English data in English. Team data, saves and Showdown import/export are always English.

**The Names In Text Rule.** A Pokémon name inside prose is bold Text (#f2f4ff) preceded by a 9px type dot (split vertically for dual types). Type names inside prose take their lightened type colour, weight 600. Move names take their type's text colour.

## Layout

Desktop first, one screen at 1440×900 and above 1100px wide.

- **Shell:** a two-column grid, a 214px left rail and the main column, exactly the viewport height (100dvh) with overflow hidden. The page never scrolls; each section's long content scrolls inside its own area (Box list, summary screen, Analisi and Meta columns, Pokédex grid, editor).
- **Left rail** (Panel, 1px Line Soft right border, 16px side padding, 14px gaps), top to bottom: the "DreamDex" logo ("Dex" in cyan); the Pokédex and Tier fields under uppercase labels; the Rules popover ("Regole: col meta · fino a gen 9", opening to the right of the rail); the sections as a vertical tab list (Pokémon, Analisi, Meta, Liste, Confronto disabled) with status count pills (red for serious problems, cyan-soft for minor, yellow for open threats); then Import / Export, "Team salvati (n)" and "Impostazioni"; at the foot the EN | IT segmented switch and the stats month in Muted 12px.
- **Team band** (Band, 14px 22px padding): always on screen. A head row: the "Team (n/6)" slanted neutral plate (28px, as tall as the "Voto" plate) carrying the guide inside it as the slanted Accent Soft button with a cyan spark and Text label (the band's featured tab, not magenta: magenta stays with the best next action; open: the cyan line under it like the other open tabs) ("Completa team" while members are missing, empty team included; "Migliora i set" with six: a 540px dialog with one vague sentence, the result plate (old grade small and faded → new grade 26px, both in grade colours, a radial wash of the new grade, "N Pokémon cambiano set", the green +N, and the team's box icons with the changing ones lit and underlined green; while computing, the thinking Eevee and "Calcolo…"; the calculation runs on the last background worker and is prepared after 1.5s of an idle full team, on hover and on focus, so the dialog usually opens ready); "Controlla cambiamenti" (cyan outline, chevron) widens it to 1360px with one column per member and no scrolling down to 1100×700, kept orderly: a neutral striped 42px head (checkbox, small sprite dropped under 1200px, italic name, the member-only +N as a green or red number, "uguale" when unchanged), the current set in Muted, a 26px green "↓ Dopo" band (Good on Good Bg, italic 800 uppercase, solid green-tinted rules), the new set in Text on a light Raised wash; both sets on fixed rows that line up across columns (item, ability · nature, EVs, then always four 19px move rows, an empty slot as a dash), every changed part in green 600 (changed moves on Good Bg), kept moves in their slot; rows tighten below 680px tall; the "+N may not add up" note sits in the action row; unticked columns fade to 50%, the plate counts "n di N cambi scelti" and the magenta button becomes "Applica n cambi"; three columns under 1000px, one on phones), then "Team salvati (n)" right beside it as a transparent bordered button; at the right, always in the same place, the shortcuts "Import / Export", then a 1px Line divider and "Svuota team" as a drawn bin (red on hover and focus) with the same hover/focus bubble as Esporta ("Svuota il team · si può annullare"); cleared from the keyboard, focus goes to the toast's Annulla. The head menus (Team salvati, Import / Export) match the Completa team panel: Ground, 4px, Float shadow, 0.14s fade; Import / Export opens right-aligned at 420px; saved teams are rows of six fixed sprite places (a free place is a faint dashed circle, so every name starts on the same column), the name beside them wrapping to two lines at most (the full name in the row's tooltip), 34px × right; when the loaded team has unsaved changes a small Warn line with a warning icon at the top of the menu says so (loading another team stays possible and can be undone); "Salva team" disabled without a name or with an empty team. Below 1280px wide only the guide keeps its label; then six cards in a 6-column grid with 10px gaps beside the 196px grade card (18px gap).
- **Completa team panel** (the guide's popover when members are missing; Ground, 4px, Float shadow, `width: min(1000px, calc(100vw - 340px))` and a fixed `height: min(780px, calc(100dvh - 56px))` (85dvh on phones), so it never changes size while proposals load or when switching choices and tabs; scrolling inside when the content is taller): two tabs in the Analisi pattern, "Proposte" and "Team da torneo" (with a count pill), the open one underlined in cyan, and at the right of the tab row the current grade on a Raised chip ("Ora C 65", the letter in 18px italic Text; the whole sentence for screen readers), because the panel covers the grade card and the proposals are compared with it; the Proposte pane stays mounted while the other is open so the calculation goes on. At the top the "I tuoi Pokémon" row: one chip per member (box icon, italic name, "Tieni il set" checkbox, all ticked); an unticked chip turns dashed cyan with a drawn pencil icon and its set may change. Left, a 208px column: the team type as radios, the "Condizione" pills ("Qualsiasi" first: no condition required, its meaning in the tooltip and accessible description), and the "Pokémon preferiti" select (Disattivato, Priorità ai preferiti, Solo preferiti) with the sentence of the current choice under it. Right, the proposals, always sorted by grade: each row shows the whole team (current members at full opacity with no ground and Muted names, "already yours"; new ones on a Raised tile with the name in Text 600), a cyan pencil badge on a current member whose set changes (its tooltip lists what changes), a small filled cyan heart badge on the sprite of new favourites (its accessible name says it is a favourite), the type tag with the "why" under it (one item per line, 12px Muted, right-aligned: the area that gains the most, "Difesa +20" with the number in green, then "Ruoli 13/14" when more roles are covered, otherwise the second gain; with an empty team the two strongest areas, "Difesa 80"; read from the proposal's own rating, nothing recomputed), the grade with the change from now, and "Usa". The list always holds exactly six rows (76px, 4px apart, so at 1440×900 they fit without a scrollbar; on shorter screens the panel scrolls): while computing, the empty places are skeleton rows built from the same parts as a real row (your members already in place and dimmed, round shapes and bars for the new ones, kind, grade and button shapes, a soft light passing over them, none with reduced motion), each replaced in place by a proposal that fades in (0.32s, opacity and a small slide, never a height change); after the calculation, unused places are dashed outlines of the same height. The status line and the "Altre proposte" row always keep their space. Magenta only on the best proposal's primary "USA" button; the row itself just takes a Line border. Every proposal covers hazards, hazard removal and shared weaknesses whenever some completion can; only when none can (usually because of the current members) do the best ones show, each with a gap note under the row in yellow with a warning icon. "Altre proposte" asks for the next round and shows it as a new page (page 1 never repeats a new Pokémon; from page 2 ones already shown may return, but each proposal changes at least half of its new members against every earlier one, and never-shown Pokémon come first); left of it the candidate-list pager (‹ 1/3 ›, 32px steps, 44px on phones, "Proposte precedenti" / "Proposte successive", the page read out politely) leafs through the rounds already computed without recomputing them (both arrows off at the start, › off on the last page), and changing the team or a choice starts again from one page; earlier pages show their free places as dashed outlines, and the best (Line border, magenta "USA") stays on page 1 row 1 only. "Team da torneo": a short note ("Team da torneo pubblicati su Smogon", then the order rule), then a grid of equal cards that scrolls inside the panel's height (one line of italic name, or "Team di {author}" when it has none, with ellipsis and the full name in its title, and at its right "{n} dei tuoi Pokémon" as a green pill or a faint "nessuno in comune"; six 48px sprites in Field wells, the shared ones with a green inset ring on Good Bg, favourites with the cyan heart badge; at the bottom the team type as a kind tag, "di {author}" in Muted and the ordinary "Carica" button, which replaces the team and can be undone). Cards sharing members have a faint green border, and a "Gli altri team" divider separates them from the rest. The team type is computed only when the tab is first opened. Under 800px tall the type notes are not shown (`display: none`; screen readers still get them as each type's description through `aria-describedby`); on phones the columns stack, the tab row (with the current grade) is sticky and the members and types rows scroll sideways.
- **Section body** (16px 22px padding): one tool row (modes as a segmented control, search, then in Pokémon the "Tipo di team" select and Filtri), then the content. In Pokémon, the Box list (2fr) beside the summary screen (3fr, 16px gap), the pager sticky at the list's bottom; active filters sit as chips on a row under the tools. Analisi has its own row of inner tabs (Panoramica · Difesa · Offesa · Ruoli · Velocità) and below it one view at a time (see Analisi); Meta is two independently scrolling columns at 5fr / 6fr; Liste is the Pokédex grid beside favourites and bans.
- **Editor:** opening a card replaces the section body with the set editor (the section body is hidden, the team stays put); one card is open at a time. The head reads in two rows. Row one is identity: the italic name (a click gives a nickname; a cyan pencil appears beside it on hover and focus, like the rail's FORMATO ✎, and stays faint on touch screens, sitting on the name's corner on phones), the type chips, the Shiny toggle, and the × at the far right. Row two is three groups split by 1px Line Soft dividers, with Custom Skillset at the right: where the set comes from ("Preset Smogon" with the "Apri su Smogon" icon joined to it, then "Preset migliore"), "I miei set" (name field joined to the save floppy), and the set-text actions ("Testo del set" / "Set text", which opens the member's Showdown text to copy or paste, joined to the "Copia il set" icon). Every icon-only control in the head (Apri su Smogon, save, Copia il set, Shiny, ×) has the toolbar's bubble (Ground, 12px, under the control, shown on hover and keyboard focus, gone with Esc; any extra detail, such as which format's analysis the Smogon link opens, is linked with `aria-describedby`; after copying, a green "Copiato" bubble). No bubbles on touch screens or under 600px. The preset menu groups presets by format under small Faint caps headers (the current format first, then the others, in the order they come) when there is more than one format, so two "Offensive Utility" sets can't be confused; the headers are not options and the arrow keys skip them. Below the head, EV on the left and Set and Mosse on the right. The "Testo del set" panel opens over the Statistiche block (same cell, Ground, Paste shadow), so Set and Mosse stay in view while you compare. "N liberi" beside the EV total is Muted (8:1 on Panel).
- **Rhythm:** 4, 8, 12, 16 and 22px steps; blocks stack with 10px between them.

**Compact mode** (1100px wide and up, below 1280px wide or below 800px tall, e.g. 1366×768 and 1280×720): the same one-screen layout, tighter. Rail 190px, 15px rail sections, band padding 10px 16px with a 168px grade column, cards about 214px tall (at least 155px, the content decides) with 56px sprites (animated sprites scaled to match), roles hidden, item on one line, 15px names and 52px chips (icons of the types when two chips do not fit), a 58px grade letter, team head buttons as icons only below 1280px wide (the name in the tooltip and for screen readers), 10px 16px section padding, the summary header with a 56px sprite and 36px score, no "X → Y" line, and the four moves on one row.

**Short team band** (1100px wide and up, below 800px tall, e.g. Chrome maximised on a 1366×768 laptop leaves about 1366×657): the band gets lower so the candidate list keeps room for visible sprites. Cards 160px tall with sprite, item, name, types and role (the ability lives in the editor), a tighter grade card (46px letter, 17px "76 / 100", area rows inside the card), less padding above and below the section. Team names wrap only at spaces and hyphens and shrink (down to 11px) when their longest part does not fit.

**Fallback below 1100px:** not designed. The shell stacks, the page scrolls, the team row becomes three across and every two-column area becomes one column. Mobile is not designed.

## Elevation & Depth

Flat and tonal. Depth goes Field, Ground, Band, Panel, Raised, separated by 1px Line Soft rules. A shadow means the thing is above the page.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55)`): menus, select pickers, Filtri panel, Stats pop, alert tooltips, dialogs, undo toast, fill and speed popovers; rail and toolbar popovers use 0.5 alpha.
- **Paste** (`box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5)`): the "Testo del set" panel.
- **Tip** (`box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5)`): description tooltips on items, abilities and moves.
- **Lift** (`box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4)`): the open team card, which also rises 4px. A closed team card under the mouse gets a lighter taste of it: it rises 2px with a soft `0 6px 14px rgba(0, 0, 0, 0.35)`, the sprite grows to 1.05 (still, no GIF) and the type stripe brightens (4px); 0.15s ease-out, mouse only, no movement with reduced motion.
- **Badge** (`box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5)`): round alert marks sitting on a sprite.

### Named Rules
**The Only Floaters Cast Shadows Rule.** Panels, blocks, rows and team cards at rest never carry a shadow. A shadow means a menu, a tooltip, a dialog, the toast, the one open card, or the card under the mouse.

## Shapes

Square by default: panels, blocks, the Box list, the summary screen, team cards and empty slots have no radius. Controls (buttons, inputs, selects, popovers' summaries, floating menus) use 4px; dialogs and rail popovers 6px; tags and badges 3px; type chips and meters 2px; count pills 10px; filter and target pills 14px. The first empty slot is a 2px dashed Line outline with a dashed 56px ring around the plus; the empty slots after it are only a 2px dashed Line Soft outline. Chevrons are two-sided 2px borders rotated 45deg, down when closed, up when open.

The one expressive shape is the slanted head: a parallelogram cut by `clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)` (9-10px for small heads, 14px for the rail tab), filled with the neutral plate colour (`--plate`, Line #363b52, text `--on-plate`) under the stripe texture (`repeating-linear-gradient(-60deg, #ffffff0d 0 4px, transparent 4px 10px)`).

### Named Rules
**The Slanted Head Rule.** Only heads slant: section and panel heads, the active rail section and main action buttons are parallelograms with the stripe texture. Panels, rows, inputs and team cards are never slanted; the Masters EX diagonal lives inside the card as a light streak, not in its outline.

## Components

### Buttons
- **Shape:** 4px corners, 1px Line border, Raised fill, 500 weight, 6px 10px.
- **Hover / Focus:** the border turns cyan; focus is a 2px cyan outline at 2px offset. Pressed toggles sit on Accent Soft with a cyan border. Disabled at 40% opacity.
- **Primary:** magenta fill, On Accent 2 text, Kanit 700 15px uppercase at 0.04em; hover goes to Accent 2 Ink. On the summary plate it is slanted ("AGGIUNGI AL TEAM").
- **Danger:** an ordinary button whose border and text turn red on hover ("Svuota team", remove).
- **Segmented:** a Field strip with 1px Line dividers; the pressed segment is Accent Soft with 600 weight (modes, EN | IT, level 50/100, rating mode).

### Chips and Tags
- **Type chip:** fixed 66px (56px on cards, 52px compact), classic type colour, uppercase 11px, 2px corners; long names shrink their letter-spacing instead of widening the chip.
- **Tags:** 3px corners, 12px 600; green by default, yellow for warnings, red for banned, outlined Line for tier.
- **Count pills:** 10px radius, Raised by default, status-coloured in the rail.

### Cards / Containers
- **Blocks:** square Panel with 1px Line Soft border, 12px 16px padding. A collapsible block's title is a small slanted neutral plate on the left, its summary right-aligned beside the chevron.
- **Grade card:** Panel under a neutral "Voto" plate that carries the provisional mark and the "?" grade help (it opens on the general page; the team's type is labelled "il tuo team" in its side tabs, and the weight bars follow the real weights of the format and type, bars only, no visible words (the word molto/abbastanza/poco is for screen readers only), never percentages, columns in the order Offesa, Difesa, Velocità; the general page puts the grade letters beside its title, then two plain sentences, the Trick Room sentence and the weights table; "Come si legge" is its own tab right after "Come funziona" and before the types ("Come si legge il riquadro del voto": a small piece of the card on the left, one sentence on the right: area bar, Ruoli n/m, the red and yellow missing-role marks, Bonus/Malus, the grey letter when not legal); pages fit the 690px window without scrolling at 1440×900; each type tab is one short sentence (the Trick Room sentence lives only on the general page), the weight bars and the role entries per level as flat tags in the level colour (essential Accent 2 Soft, important Accent Soft, minor Raised; no border, no hover, the role explained in the tooltip); with fewer than six members the team is "in analisi" and no tab is marked); when members break the format's rules the letter and label turn Faint and the red "Non legale: N Pokémon" tag sits under the label (format and who in its tooltip); the big italic letter, "76 / 100" with the verbal label, then four area rows (Difesa, Offesa, Ruoli, Velocità) with 5px bars and tabular values. Each row is a button ("Difesa 83, apri il dettaglio") with a › that opens that area's tab in Analisi; hover tints Raised. Small controls (the "?", the rows, alert marks, the Stats badge) keep a hit area of at least 24×24 through a transparent pseudo-element, the drawing stays small. An inactive area is Faint and says "non conta" in its name. Bonus/Malus is the fifth row (net value, opens the Bonus/Malus tab).
- **Floating surfaces:** Ground fill, 1px Line border, 4px corners (6px for dialogs), Float shadow. Tooltips and the Stats pop carry a 2px top border (cyan, or the mark's status colour); dialogs ("Impostazioni", rating help, area details) open over a 70% dark backdrop with a striped Band head over a 2px magenta rule, close on Esc, the × or a click outside, and return focus. Menus open with a short 0.12-0.18s fade-in.
- **Undo toast:** a Panel card fixed bottom left (24px right of the rail, over the candidate list, never over the candidate detail's action bar; full width above the bottom bar on phones) with the Float shadow, the removed member's icon and name (or "Team importato", "Caricato «nome»", "Team svuotato"…), an "Annulla" button and a 3px cyan timer bar that shrinks over 5 seconds for one member, 10 seconds for whole-team actions (clear, import, saved team or link loaded, Completa team, Migliora i set, tournament team), and pauses on hover or focus.

### Inputs / Fields
- **Style:** Field fill, 1px Line border, 4px corners, 6px 10px; placeholders Faint; checkboxes 16px in cyan.
- **Focus:** the border turns cyan, with a 2px cyan outline on keyboard focus.
- **Menus:** the editor combobox and native selects (through `appearance: base-select`) share one Ground listbox with Line Soft row dividers, the active option on Raised and the chosen one on Accent Soft. "Più usati" options lead the list with a 2px cyan left rule, a faint cyan wash and the usage share at the right.

### Navigation
The left rail's vertical tab list: Kanit 600 italic 17px in Muted, Raised on hover. The active section is a slanted magenta tab with the stripe texture and On Accent 2 text; its count pill inverts (On Accent 2 fill, Accent 2 Ink text). Disabled sections are Faint at 55%. Inactive panels stay mounted and hidden with CSS, so search, filters and page survive a switch.

### Team Card (signature)
A square Masters EX card, 268px tall (about 214px compact, 160px on screens under 800px tall), full and empty alike. Fill: a 160deg gradient from the first type colour (42% into Panel) fading to Panel at half height, with a thin 115deg white light streak across it and a 3px bottom stripe in the type colours (half and half for dual types). Content: "Lead" in cyan italic on a small dark Ground plate (88%, 3px corners) on the first card, so it stays at least 4.5:1 on every type gradient, favourite and remove top-right (32px hit areas), the Custom Skillset lock top-left, a centred 96px pixelated sprite (nothing drawn over it), the Stats badge on its own row, the italic name (two lines at most) with the round red or yellow alert marks at the end of its row (the name shrinks to leave them room), item with its icon (two lines), ability, type chips and roles. Hover adds a 1px Line inset ring and a lighter lift than the open card (see Lift); a problem card gets a 1px red or yellow outline. Open: the card lifts 4px with the Lift shadow, the sprite grows to fill the card and plays its animated idle, only the name row stays under it (so the open member is named in the band), the bottom stripe turns cyan, and the editor replaces the section body under a 3px cyan rule. Cards can be dragged to reorder (dashed cyan drop outline) and slide into compact shape through view transitions. Only the first empty slot carries the dashed ring and "Aggiungi un Pokémon"; the other empty slots are quiet dashed frames in Line Soft with no text (same accessible name, same click), so with an empty team the eye goes to one place. All turn cyan on hover.

### Box List
The ranked candidates in a framed Panel that matches the summary screen: a striped Band strip on top with a small slanted neutral plate "Candidati (n)", rows divided by Line Soft, and the numbered pager (pages of 10) inside the frame at the bottom, so list and card start and end on the same lines. Each row has two lines: the italic name (one line, ellipsis) with its marks (ban, list ♥/⊘, a yellow round mark for weather clashes or weakened moves, a cyan spark for "often used together") and 56px type chips (long names widen); then one Muted summary line: the change worth the most grade points and the one costing the most, each truncating on its own, with only the leading + in green and − in red (adding: the reason that weighs most; empty team: the Pokémon's main roles, since the usage share sits on the right). Left: rank (20px italic Faint) and a 40px sprite. Right: when swapping, the leaving member's icon only (its name in the tooltip, the screen-reader text and the main button), the grade change in 22px italic (the resulting grade only in its accessible name), and a 30px + / ⇄ button. A double click on the row does the same as the button. Hover tints Raised; the selected row is Raised with a 1px cyan inset ring. The #1 is told by its magenta + button (and the summary screen's magenta Aggiungi al team); its +N tag on cards is Accent Ink on Accent Soft, rank, result and ring stay as on the other rows. Compact mode turns the row's type chips into 10px type-colour dots so the name keeps its room. With an empty team a single Muted 13px start line sits under the tools: "Scegli il primo Pokémon qui sotto, in ordine di uso nel meta · oppure Completa team o Importa da Showdown", the two names as underlined cyan links that open the same Completa team panel and Import menu as the team bar (the Import box gets the cursor). It wraps on phones; no tour, no modal.

### Candidate Cards
The list is a grid of cards (columns from the list's width, never shorter than 144px, otherwise one row only; card sprite at least 60px). Under the mouse a card at once rises 4px with a drop shadow and its face tints a little more; only after the mouse rests on it for 120ms does the type-tinted spotlight turn on, the sprite pop out of the card and play its animated GIF (box icons hop), so sweeping across the grid lights nothing and loads no GIF. The selected card and a keyboard-focused one show the full state at once; only the selected card adds the 2px type line under its plate. The list-view menu in the "Candidati (n)" strip only picks the sprite (Normale or Icona box). The pager is ‹ "3/9" › at every size (no dashes); the strip drops the double-click hint when it does not fit; the result count is said once, in "Candidati (n)". A name with a forme shows the base species whole and the forme as a small cyan uppercase label ("Charizard" + MEGA Y); the full official name is in the tooltip and for screen readers.

**Reasons as signs.** On cards narrower than 560px the reasons are short signs instead of words: the drawn sword (long and straight like Zacian's) and the chips of the types it hits, the drawn shield (Zamazenta's shape: wide notched top, pointed bottom, a centre ridge) and the chips of the types it takes (immunities first, with no extra mark: the shield already says it takes them; "Immune a…" in the chip's tooltip), an italic "VS" with the first Pokémon it stops (type dot and name, like the detail) and the others as "+N", the chain and the linked member; all symbols are one stroke family in Accent Ink (14px). The same sword and shield mark the attacker/wall places in Coaching and the attack/defence scores in the Riassunto. Chips that do not fit become a small grey "+N" right after the last chip or name, never cut. The whole sentence stays in the tooltip and for screen readers. From 560px up cards keep the words; one choice for the whole list. With no reasons but a rising grade, the card names the area that rises most ("Offesa +13") instead of "nessuna differenza".

### Summary Screen
The selected candidate, like the game's summary page, read top to bottom by importance. A header on the striped Band texture: the other sprite kind than the list's (the small box icon, scaled up and hopping like the selected card, when the list shows sprites; the 72px animated sprite when the list shows box icons), the 24px italic name (base species plus forme label, as on the cards) with the Stats badge ("Stat" in Italian), type chips, when swapping, right after the name, Stats badge and types (vertically centred), a ⇄ and the leaving member's sprite greyed out (46px, 45% opacity; "Al posto di X" in its title and for screen readers), and on the right the grade change in 44px italic (Text; the #1 is told by its magenta button) over just "C 68 → B 77" (the words "voto del team" only for screen readers) (usage share with an empty team). Then, under small slanted heads: **Porta** and **Toglie** side by side (at most three items each, a green + or red − before each; Porta merges the swap gains and the reasons, never the usage share; Toglie also carries clash warnings and roles lost to the chosen team type; adding shows only Porta, full width), **Effetto sul team** as one row of bordered pills ("Difesa +3", change in 14px italic green or red, ±0 Faint; absolute values under "Voto con lui da solo" when there is no grade before, a 0 shown as "—") plus a dashed "Bonus/Malus" pill when penalties and bonuses change, so the header number is explained; "Anche al posto di" below. When swapping, Toglie is never "Niente di rilevante" beside falling areas: it lists the biggest drops. With an empty team Porta lists the Pokémon's roles. and **Set consigliato** (item with icon, ability, nature, EVs in one wrapping line, the moves in a two-column grid). The actions sit at the bottom: the main action (magenta for #1), "Copia set", "Apri su Smogon". The body scrolls inside the card if needed; at 1440×900 and 1366×768 it fits.

### Filtri
The Filtri summary opens a floating panel (Ground, Float shadow) over the summary screen, so the list stays visible and updates while choosing. Inside: a row of selects (Tipo 1, Tipo 2 with Qualsiasi / Mono / the 18 types, Imposta, Sfrutta, Tier, Uso nel meta), the "Resiste a" and "Superefficace contro" type grids side by side, the role chips, then Mega and Leggendari as three-way segments and the "Solo preferiti" checkbox. Each active filter shows as a cyan pill chip under the tool row with its own ×, followed by "Azzera filtri" (the result count is only in "Candidati (n)"). The panel's group titles are h3 under the section's h2. The team type is not a filter: it is the "Tipo di team" select (232px, small Faint caps caption "TIPO DI TEAM", Qualunque and the five types) beside Filtri, with no chip. Role names (filter chips, the detail's Ruoli, the team card role, the editor's Ruoli) carry a one-sentence plain explanation in their tooltip. In Liste the same panel drops the meta filters (usage, favourites only).

### Analisi
A row of inner tabs under the tool row: Panoramica · Coaching (with a red count chip of serious problems) · Difesa · Offesa · Ruoli · Velocità · Bonus/Malus, Kanit 600 italic 15px in Muted with a 3px cyan underline on the open one, arrows and Home/End between them; every tab keeps 28px on its right for the "?" that explains the open tab (it opens the help dialog).

- **Panoramica** is a two-column dashboard (about 2:1) that fills the space left in the tab and never scrolls; both columns end on the same line. On top the verdict (22px italic) with the team type. Every section has a slanted magenta plate on a striped head, a short Muted summary and cyan links (or a lone ›) to its tab. Left, how the team is built: **Copertura** (the 18 official Scarlet/Violet type icons, 22px and round (cropped to a circle), bundled from `src/assets/types/` (PokeAPI sprites, Nintendo artwork, no network at runtime), over two rows of cells, Regge and Colpisce, each cell its own box with a 1px Line border and 4px gaps: covered Raised with a faint ✓, minor yellow, open red with ✕; never compressed), then **Ruoli** and **Velocità** side by side (roles in three horizontal bands one under the other, Essenziali, Importanti, Minori, with the level label in a narrow column on the left; in tight and normal the roles flow as one-line chips that wrap inside the band (only ✓ or ✕ and the name; who covers it is in the chip's title and accessible name), in roomy one role per line with the covering members' names written out ("✓ Hazard: Garchomp, Great Tusk", no icons; an uncovered role is just ✕ and its name, minor ones in a more transparent Faint); the card stretches to the bottom like Velocità, while the bands sit compact at its top like a small table, each as tall as its content (never equal thirds); missing roles first, missing essential/important ones as a red tag and minor ones dashed and quiet; what fits is measured once over all bands in order, so when room runs out the last bands give way first, each closing with its own "+N", and a "+N" never appears while there is room (it removes a role only if the "+N" itself does not fit); speed bars from the fastest with the amber "media meta" line, sprites under the bars, the control line, then "supera / superato da" rows as many as fit). Right, what to do: **Cosa fare** (Coaching problems grouped, worst group first, with GRAVE/MINORE plates and the area as an icon: weaknesses as one "Debole a" row of type names in their colours, meta threats as "Senza check", per-member legality as "Non legali" with the members, missing essential/important roles as "Ruoli mancanti"; items joined by " · ", serious ones first in bold red, species and members included (types keep their colour inside a small red pill: thin bad border, faint bad wash), a small count pill beside the title when a group holds more than one problem, wrapping between items and never truncating a name; the per-type detail lives in the row tooltip, and in normal and roomy (not tight), when every group fits, the full texts of a group's problems show under it as small Muted sub-lines, as many as fit (not for threats and missing roles, where they would only repeat the names); every other problem stays a single row with its text; the header still counts problems, "Tutti gli N nel Coaching ›"; a › in the head always opens Coaching) and **Minacce non gestite** (sprites on an elliptical plinth, a dashed "+X" to the Meta tab). Density: with the team open it follows the measured height (tight below 440px, otherwise normal, never roomy, so a tall 2K screen stays normal and fills through more problems and threat rows); collapsing the team always gives roomy, at every resolution, and the collapsed team shows more (roles one per line with the covering members' names, problem detail lines, more rows), never bigger empty boxes. Only problems carry full colour.
- **Coaching** lists problems only, no swaps tab. A magenta-tinted "PRIMA DI TUTTO" strip with the best single replacement and "Apri in Sostituisci →"; then GRAVI and MINORI groups of rows (Panel, 1px Line, red wash when serious; area label in Faint caps on the right). Each row: the problem, then "Considera, al posto di X" with candidate buttons (italic cyan name, type dot, green "+N" grade delta chip); a click opens the Pokémon tab on Sostituisci with that candidate open.
- **A member** replaces the Overview: a nav with "‹ Panoramica" and previous/next, a hero on the striped Band (animated 96px sprite, 24px italic name, type chips, item, the grade in 44px italic cyan with its role), then the real stats as a two-column definition list (roles as tags, speed, attack, coverage, bulk, typing, support) with thin meters.
- **An area tab** shows the old area dialog on the page: on the left the area title with its value ("non conta" when inactive), the sub-statistics as a vertical tablist (label, 4px cyan bar, value; the open one on Accent Soft) and the problems of that area; on the right the detail of the chosen sub-statistic in a framed Panel that scrolls. Difesa and Offesa open on Coverage tipi, which starts with the full table: the weakness matrix (cells red for ×2/×4, green for ×½/×¼/×0, flagged rows tinted) or the offensive coverage list (uncovered types first, red wash). Ruoli starts with the full needs table by level.

### Settings Dialog
"Impostazioni" in the rail opens a 440px dialog. Its only group, "PALETTE", lists three choices as rows (Panel, 1px Line border): "Segue il gioco", "Spada e Scudo", "Scarlatto e Violetto", each with two 16px swatches of its version colours (split diagonally for "Segue il gioco"); the checked row has a cyan border and Accent Wash fill. "Salvate in questo browser" sits under it.

### Issue Marks
- **Red triangle:** a legality problem. **Yellow triangle:** needs checking. **Cyan mark:** information (the Custom Skillset unlock, in the card's top-left corner).
- On sprites the marks are round badges on Ground with a status-coloured border and the Badge shadow.
- Every mark is focusable and opens a tooltip listing each reason with a status-coloured dot.

## Do's and Don'ts

### Do:
- **Do** use cyan for every working state: hover and focus, pressed toggles, selection, meters, the grade letter, info.
- **Do** reserve magenta for the one best next action (the #1 candidate's Aggiungi al team and + button, the best proposal's Usa) and for "you are here" (the open rail section, the open Analisi and editor tab). Section and panel heads are neutral slanted plates (`--plate`).
- **Do** draw heads as slanted parallelograms with the stripe texture, and keep panels, rows, inputs and team cards square.
- **Do** read accents only through the tokens, so a palette swap repaints everything.
- **Do** keep the app one screen above 1100px wide, with long content scrolling inside its own area and the team band always visible.
- **Do** keep type chips fixed-width so they align in columns.
- **Do** set Pokémon names in Kanit italic on cards, rows and plates, and bold with a type dot in prose.
- **Do** put every UI string in both dictionaries (`src/i18n/en.ts`, `it.ts`); keep Pokémon names in official English.

### Don't:
- **Don't** make any button other than the main action and the #1 + magenta, nor tags, frames, scores or toolbar buttons around it.
- **Don't** slant panels, rows, inputs or the team cards' outline.
- **Don't** change ground, panel, status or type colours with the palette.
- **Don't** re-hue the classic type colours or use them as decoration outside type meaning.
- **Don't** use red, yellow or green for anything but status.
- **Don't** add shadows to blocks, rows, panels or cards at rest.
- **Don't** set text below 11px.
- **Don't** make the page scroll at 1440×900, or design a mobile layout by accident: below 1100px is a stacking fallback.

The previous navy-and-gold "World Final Team Preview" look survives only as the git tag `grafica-classica`, until the owner deletes it.
