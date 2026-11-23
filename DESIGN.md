---
name: DreamDex
description: Team builder for Smogon formats and the mainline games, styled as the PC Box and summary screens of Pokémon Sword and Shield, with the team and the candidates as "Pedana" cards (the Pokémon standing on a platform of its type colour).
colors:
  ground: "#101219"
  band: "#14172a"
  panel: "#1a1d2a"
  raised: "#272b3d"
  field: "#0c0e15"
  line: "#363b52"
  line-soft: "#262a3b"
  control-line: "#646b90"
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
  room: "#a35cff"
  room-ink: "#c09aff"
  room-soft: "#2f1d52"
  bad: "#ff8a8a"
  bad-bg: "#3a1426"
  warn: "#ffc857"
  warn-bg: "#362a0d"
  good: "#63e3a8"
  good-bg: "#0f3229"
  move-physical: "#ff9a5c"
  move-special: "#9aa8ff"
  type-ink: "#10142b"
  type-normal: "#A8A878"
  type-fire: "#F08030"
  type-water: "#6890F0"
  type-electric: "#F8D030"
  type-grass: "#78C850"
  type-ice: "#98D8D8"
  type-fighting: "#C03028"
  type-poison: "#A040A0"
  type-ground: "#E0C068"
  type-flying: "#A890F0"
  type-psychic: "#F85888"
  type-bug: "#A8B820"
  type-rock: "#B8A038"
  type-ghost: "#705898"
  type-dragon: "#7038F8"
  type-dark: "#705848"
  type-steel: "#B8B8D0"
  type-fairy: "#EE99AC"
typography:
  grade:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "76px"
    fontWeight: 800
    lineHeight: 0.85
  score:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 0.9
    fontFeature: "tnum"
  stat:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
  display:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
  boot:
    fontFamily: "Kanit Boot, Kanit, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1
  headline-l:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
  headline:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.01em"
  heading:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.1
  plate:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1
  title-l:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "0.01em"
  title-s:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.1
  body:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  button-primary:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
  section:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.2
  small:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
  label:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
  chip:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.04em"
rounded:
  square: "0px"
  hairline: "1px"
  chip: "2px"
  alt-sm: "7px 2px 7px 2px"
  alt: "10px 3px 10px 3px"
  tag: "3px"
  control: "4px"
  floating: "6px"
  sheet: "8px"
  count: "10px"
  pill: "14px"
  round: "999px"
spacing:
  sp-1: "2px"
  sp-2: "4px"
  sp-3: "6px"
  sp-4: "8px"
  sp-5: "10px"
  sp-6: "12px"
  sp-7: "14px"
  sp-8: "16px"
  sp-9: "18px"
  sp-10: "22px"
components:
  button:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.alt}"
    padding: "6px 10px"
  button-pressed:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.text}"
  button-primary:
    backgroundColor: "{colors.accent-2}"
    textColor: "{colors.on-accent-2}"
    typography: "{typography.button-primary}"
    rounded: "{rounded.alt}"
  button-primary-hover:
    backgroundColor: "{colors.accent-2-ink}"
  button-guide:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.square}"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  plate:
    backgroundColor: "{colors.line}"
    textColor: "{colors.text}"
    typography: "{typography.section}"
    rounded: "{rounded.square}"
    padding: "4px 24px 4px 12px"
  rail-tab:
    textColor: "{colors.muted}"
    typography: "{typography.title}"
    padding: "9px 16px"
  rail-tab-active:
    backgroundColor: "{colors.accent-2}"
    textColor: "{colors.on-accent-2}"
  analysis-tab-active:
    textColor: "{colors.text}"
    typography: "{typography.body}"
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
  candidate-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    typography: "{typography.title-s}"
    rounded: "{rounded.square}"
  area-head:
    backgroundColor: "{colors.panel}"
    typography: "{typography.stat}"
    padding: "0 16px"
    height: "50px"
  type-chip:
    backgroundColor: "{colors.raised}"
    typography: "{typography.chip}"
    rounded: "{rounded.control}"
    height: "20px"
  tag:
    backgroundColor: "{colors.good-bg}"
    textColor: "{colors.good}"
    typography: "{typography.caption}"
    rounded: "{rounded.tag}"
    padding: "1px 7px"
  tag-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn}"
  tag-bad:
    backgroundColor: "{colors.bad-bg}"
    textColor: "{colors.bad}"
  count-pill:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.count}"
  pager-button:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.muted}"
    rounded: "{rounded.tag}"
    width: "28px"
    height: "26px"
  menu:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.floating}"
  tooltip:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    typography: "{typography.small}"
    width: "380px"
  dialog:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.floating}"
  toast:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    width: "400px"
---

# Design System: DreamDex

## Overview

**Creative North Star: "The Trainer's PC Box"**

DreamDex looks like a modern Pokémon game interface, not a dashboard. The working surface is the PC Box and the summary screens of Sword and Shield: a deep blue-black ground, square panels in two tonal steps, two bright "version colours" and slanted striped plates for heads. The team sits on top as six "Pedana" cards (each Pokémon standing on a platform of its type colour, the same family as the candidate and Meta cards), beside a big grade card. It is a game menu that still reads like a tool: numbers, names and reasons come first, and the costume never gets in the way of reading them.

On desktop the app is one screen: a left rail, the team band always in view, and below it one section whose long parts scroll or page inside their own areas. The page itself never scrolls. Density is medium, with 22px gutters and 6 to 16px gaps. Kanit carries the whole voice: italic for what should feel like the game (names, heads, numbers, sections), upright for reading.

The words are part of the design. Every text is plain everyday Italian (or English with the EN | IT switch) and says only what helps the player decide; no calibration details, no internal numbers, no jargon beyond the Smogon words players already use (Coverage, Setup, Team Coverage).

**Key Characteristics:**
- Deep blue-black ground (#101219), square panels, depth by tone; shadows only on things that float.
- Two version colours per game: cyan works and informs, magenta is rare (where you are, the one best action, the S grade).
- Slanted, striped plates for heads; everything else stays square.
- Pedana cards for team, candidates and Meta (light from above only on the chosen one), PC Box lists, game-style summary screens.
- One screen with inner scrolling on desktop, a compact mode for low laptops, a separate phone layout under 1100px.

## Colors

A dark, cool ground with two saturated version colours that swap per game, plus status and type colours that never swap. Every colour is read through the custom properties in `src/styles/tokens.css`; the frontmatter mirrors them.

### Primary
- **Box Cyan** (accent; orange `sv-accent` in Scarlet and Violet): the working colour. Hover and focus borders, the 2px focus ring, pressed toggles and segments (on Accent Soft), selected rows and cards, meters and bars, info marks, links, the B grade, the open Analisi tab underline, the undo timer. Accent Ink is its text form, Accent Wash tints a chosen setting or menu entry.

### Secondary
- **Version Magenta** (accent-2; violet `sv-accent-2` in Scarlet and Violet): only three uses. "You are here" (the open rail section, the open editor tab, the open team card's bottom line with the small pointer under it and the editor's top edge), "do this" (the one best action on screen: the #1 candidate's Aggiungi al team, the best proposal's Usa, the first Coaching row's Applica) and the S grade (letter, card wash, bars). Text on it is On Accent 2; Accent 2 Ink is its hover and text form.

### Tertiary (status only)
- **Alarm Red** (bad on bad-bg): legality and serious problems, banned tags, falling values, destructive hovers, OHKO taken in Difesa.
- **Caution Yellow** (warn on warn-bg): "check this", minor problems, the C grade, 2HKO taken in Difesa.
- **Pitch Green** (good on good-bg): strengths and gains, the A grade, rising values, hits that hold in Difesa, KOs dealt in Offesa.
- **Room Violet** (room, room-ink, room-soft): Trick Room only, in the Velocità tab, the same in every palette.

### Neutral
- **Ground**: page, menus, dialogs. **Band**: the team band and striped heads. **Panel**: rail, blocks, lists, summary screens, editor, cards. **Raised**: buttons, hovered rows, active options. **Field**: inputs, code, meter tracks.
- **Line** and **Line Soft**: borders and dividers; Line is also the neutral plate colour (`--plate`, text `--on-plate`). **Control Line**: borders of fields (selects, text inputs), so they read as places to type or choose.
- **Text**, **Muted**, **Faint**: primary, secondary and tertiary text. Faint stays at least 4.6:1 on Raised.

### Type and move colours
The 18 classic type colours (`src/ui/Sprite.tsx`) fill the icon tile of type chips and tint their names toward white, colour card gradients and stripes, type dots and icons, and are lightened toward white for type and move names in text. Move Physical and Move Special colour only the move category icon in the editor; status moves stay Faint.

### Named Rules
**The Rare Magenta Rule.** Magenta marks the open rail section or tab, the one best action on screen and the S grade, nothing else. Tags, frames, scores and toolbar buttons around that action stay cyan or neutral; a second "main" button on the same surface is an ordinary button. While the Completa team panel is open, the page behind it turns its magenta actions neutral.

**The Cyan Works Rule.** Cyan is work, information and selection: hover, focus, pressed, chosen, meters, links, info.

**The Status Means Status Rule.** Red, yellow and green never decorate and never follow the palette. In Difesa they are a traffic light on the hits taken (holds green, 2HKO yellow, OHKO red). Counts are role-aware: a member's count is toned only where it is that member's job, so walls stay neutral in Offesa and Velocità and attackers stay neutral in Difesa. A team-level hole always keeps its colour.

**The Only Accents Change Rule.** A palette swaps the accent tokens and nothing else; ground, panels, lines, text, status, room and type colours are identical in Sword and Shield and Scarlet and Violet. "Segue il gioco" (default) picks Scarlet and Violet for Gen 9 and Sword and Shield otherwise. Never hard-code an accent hex in a component (the Settings swatches, which show the palettes, are the one exception).

**The Classic Types Rule.** Type colours keep their classic hues. Lighten them for text, never re-hue them, never use them outside type meaning.

**The Contrast Rule.** Text is at least 4.5:1 on its ground (pairs are checked in the `tokens.css` comment). Information is never dimmed with opacity: use Muted or Faint, or grayscale plus brightness for "greyed" items. Opacity is only for disabled controls and sprites.

## Typography

**Display Font:** Kanit italic 600 to 800 (with system-ui, sans-serif), self-hosted through `@fontsource/kanit`
**Body Font:** Kanit upright 400 to 600

**Character:** One rounded, slightly technical sans in two postures: italic for anything that should feel like the game, upright for reading. Tabular figures from the body down, so numbers line up in tables.

### Hierarchy
Every size is a role token in `tokens.css` (`--fs-label` 11px up to `--fs-grade` 76px); only the grade letter's smaller layouts (40 to 64px) and sizes inside `clamp()` that scale with a table row are written beside their rule.
- **Grade** (800 italic, `--fs-grade`): the grade letter only, in the grade colour (S magenta, A green, B cyan, C yellow, D red). Thresholds are fixed: S 90, A 80, B 70, C 60. An illegal team shows its letter in Faint until it is legal again.
- **Score / Stat** (700 to 800 italic, `--fs-score`, `--fs-stat`, `--fs-stat-s`): grade changes, big area numbers, the +N gain.
- **Display** (800 italic, `--fs-display`): the logo, the member's name in the editor, big empty-state titles.
- **Headline / Heading** (700 to 800 italic, `--fs-headline`, `--fs-heading`): page h2, guide heads, names in Coaching rows.
- **Plate** (700 italic, `--fs-plate`): numbers and names on plates (format, team count, grade word).
- **Title** (700 to 800 italic, `--fs-title`, `--fs-title-s`): Pokémon names on cards and rows, rail sections (600).
- **Body** (400, `--fs-body`): default text, buttons, tooltip titles; `--fs-small` 13px for explanations, options and tooltip text; `--fs-section` 14px inside section heads.
- **Caption** (600, `--fs-caption` 12px, sentence case): tags, counts, legends, notes under a row.
- **Boot** (800 italic 22px, `Kanit Boot`): the bouncing CARICAMENTO on the loading screen in `index.html`, Kanit 800 italic loaded straight from the page so it shows before the app loads.
- **Label** (600, `--fs-label` 11px, uppercase, 0.05em, Faint): field labels and every table head in the Analisi (`--col-head`). Never a decorative kicker above a heading.

### Named Rules
**The Readable First Rule.** Pick the size that reads best in its place, from the scale. 11px is the smallest step on the scale, not a target; propose options when in doubt.

**The One Voice Per Role Rule.** Every uppercase label (table heads, CORE, BONUS/MALUS, "5 problemi") is `--col-head` with `--col-head-track`, colour aside. Every "+N" counter of hidden items is the shared `.more-n`: "+N" 700 `--fs-caption` Kanit upright, tabular, muted on `--raised`, 16px tall, `--alt-r-sm` corners (the Bonus/Malus overflow keeps its word, "+3 altre", so it never reads as points). Gains and head numbers in a card are 700 14px italic (`--fs-section`), the number before its word ("4 scoperte", "18/18 offesa"). A Pokémon name in a row or sentence is upright 600 and as big as the names in the rows around it; italic only where the Pokémon is the protagonist (meta tiles, team cards).

**The Official Names Rule.** UI copy follows the EN | IT switch. Pokémon names always stay official English. Moves, abilities, items, types and natures use the official Italian names in Italian. Team data, saves and Showdown text are always English.

**The Names In Text Rule.** A Pokémon name inside prose is bold Text preceded by a type dot (split for dual types); type names take their lightened type colour, move names their type's text colour.

## Layout

Desktop first. The reference screens are 1440×900, 1366×768 and 1280×620 (Chrome on a low laptop); every change is checked there.

- **Shell** (1100px wide and up): a grid of the 214px rail and the main column, exactly `100dvh` tall with overflow hidden. Each section's long content scrolls inside its own area (lists, summary screen, Meta columns, editor) or turns pages (Liste, Coaching, Coverage meta).
- **Rail** (Panel): the logo; the **format plate** (a full-width cyan plate with stripes: family icon, the format name in Kanit 800 italic 18px in On Accent, a small arrow on the right that nudges on hover; under it a Field strip with the muted summary, e.g. "Smogon · Singolo", and the family name in cyan italic on the right, hidden on the compact rail, where the plate icon already says it; the name wraps balanced; the whole block is one button that opens the format window on the active family; the families themselves are chosen only in the window)); the **sections** as compact full-width rows (edge to edge, 54px, 48px in compact mode, 1px Soft line between them): cyan 20px icon, name in Kanit 700 italic 18px, and on the right only the number that matters (team 5/6, problems in warn/bad colour, favourites·bans; Meta shows none); the full status stays as the tab's accessible description and shows in the app's hint bubble on hover (every row, Meta included; while a member is being edited the open row's hint says "Modifica: <name>"). On the magenta band the count turns white, and a warn or bad problem count keeps a small coloured dot beside it. The open section is a full-width band of dark magenta (#d81f72 → #ad115b, so white text stays above 4.5:1) with stripes and white text. The problem count stays neutral until the team has six members; only then it turns warn or bad. At the foot EN | IT and Impostazioni drawn as the game's button hints (round key + label, 28–30px tall), the stats month and the Segnala / Crediti links (28px tall). On the phone only the plate stays in the top bar (icon, name, arrow), 40px tall, and the sections stay the bottom bar with their status line.
- **Format window** ("Scegli il formato", fixed frame 840px wide and up to 840px tall (three game tiles per row, the most any generation has), one column that scrolls inside, so switching tabs never changes its shape): the three families as slanted tabs on a Band strip (switching tabs only shows that family; the format family in use keeps a cyan underline); Competitivo shows the sources as a compact strip of tiles (logo left, name and note right; VGC and Champions greyed), then National Dex and Gen 9 as two big tiles, then the choices used most, Lotta and Tier chips, then the past Smogon generations as one 8-cell scale (number over the Smogon acronym, greyed until ready), then the advanced switches; Giochi shows game tiles with the two version logos grouped by generation plus the game options; No Format shows its one-line rule, the 1–9 generation scale and Più Mega. Choices are a draft: the format changes only with the footer's main button, which names what it will use ("Usa National Dex UU", magenta, the one main action) and takes the open tab's choice; a tab holding unconfirmed changes shows a small magenta dot; the not-yet-ready choices (past generations, VGC, Champions, other games) are greyed with a faint hatch and a small "in arrivo" label, and never react to hover; Annulla, ×, Esc or a click outside close without changing anything. When the team holds members the chosen format would not allow, a warn-coloured line at the left of the footer says how many ("2 Pokémon del team non ammessi in National Dex UU"). The member names are in that line's hint bubble, not in the line. When nothing changed, the main button is a neutral "Chiudi". The logo credit sits at the bottom of the body, above the footer. Tab stays inside the window; it opens with the focus on the current tier (Competitivo) or on the family tab, and closing it in any way puts the keyboard back on the format plate. The key F (outside text fields, with no window or menu open) opens the window; the plate's hint says so.
- **Team band** (Band, 14px 22px): always on screen. A head row read as one strip (choice 8C): the "Team (n/6)" plate (one slant, on the right), Team salvati, the guide button (Completa team or Migliora i set), a fading line, then Importa | Esporta | link joined in one cluster and the trash. Every piece is 28px tall with the same 26.57° slant (14px over 28) and an 8px gap; the buttons are parallelograms with the small alternate corners (a skewed `::before`), the plate stays a label; then six cards in a 6-column grid beside the 196px grade card. It can collapse to one strip of 48px member chips (empty slots narrow to the + ring, so names keep one line) and the grade, whose button opens the "Voto delle aree" popover.
- **Section body** (16px 22px): one tool row (38px), then the content. Pokémon: "Box + scheda laterale", the candidate list at a fixed width beside the summary screen, which takes the rest (`--list-w` from `usePerPage`/`listLayout.ts`: 3 columns when lista + scheda are under 1000px wide, 4 up to 1500px, 5 up to 1600px, then 6 (fewer if the detail would drop under 500px); cards 150px wide, 140 under 1150px; 1 to 3 rows from the list height, cards up to 232px tall; so 8 cards at 1440×900 and 1366×768, 4 at 1280×620, and 12 / 8 / 8 with the team collapsed; phone, tablet and tests keep 6 per page). Analisi: the area template (see Components). Meta: two columns. Liste: two PC boxes over the paged Pokédex. Opening a team card replaces the section body with the set editor.
- **Rhythm:** spacing comes only from `--sp-1` to `--sp-10` (2, 4, 6, 8, 10, 12, 14, 16, 18, 22px). 6px is the most used step (icon to text, inside controls), 10px between stacked blocks, 22px is the band and section gutter. Written by hand on purpose: 1px and 3px insets, odd paddings that balance italic text or a slant, negatives, and layout sizes of 20px and up.

**Compact mode** (1100px wide and up, below 1280px wide or below 800px tall): the same layout, tighter. Rail 190px, cards about 214px with 56px sprites, a 58px grade letter, team head buttons as icons with their name in the tooltip, moves on one row. **Short team band** (below 800px tall): cards 160px, a 46px grade letter. **Low frame** (below 640px tall): Analisi rows and legend rows shrink so six members plus Team Coverage fit at 1280×620.

**Phone and tablet** (below 1100px): a layout of its own. A 56px sticky top bar (logo mark, format, language, settings), the sections as a 64px bottom tab bar within thumb reach, the team as a row of small cards that scrolls sideways, editors full screen; the candidate detail and Filtri are full-screen sheets on the phone and 620px panels sliding in from the right over a scrim on the tablet (from 760px); menus as bottom sheets (8px top corners, up to 85dvh). On the phone the candidate list has no pages: it scrolls, twelve cards arriving at a time; on the tablet in portrait a page is the rows that fit between the top of the list and the bottom tab bar (with the page at the top): two rows while cards stay at least 150px tall (up to 232), otherwise one, so the list never runs under the bar; no card shows the selected frame while its sheet is closed. Type icons are square tiles everywhere (`ti-sq`). Here the page scrolls; only the bars stay put. Touch targets are at least 44px, hover-only details (bubbles, tooltip delays) are off. Where the editor covers the grade card (phone, tablet in portrait) its header carries a small grade chip (letter and score, "74 → 76" while it changes); on the tablet in landscape (and a half-screen computer) the grade card stays in view in the team column, so the editor has no chip and its header is lower (116px instead of 150px).

### Named Rules
**The One Screen Rule.** On desktop the page never scrolls. Measure before adding: if something does not fit, it pages, scrolls inside its own frame, or gives way with a "+N" or a "MoreBelow" button, never pushes the page.

## Elevation & Depth

Flat and tonal. Depth goes Field, Ground, Band, Panel, Raised, separated by 1px Line Soft rules. A shadow means the thing is above the page.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55)`): popovers, select pickers, the Filtri panel, dialogs, the Completa team panel, toasts.
- **Menu** (`box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55)`): the small menus (Liste, Coaching "Altre N", Voto delle aree).
- **Tooltip** (`box-shadow: 0 0 0 1px rgb(0 0 0 / 0.5), 0 0 26px -4px <tone 45%>, 0 18px 40px rgb(0 0 0 / 0.65)`): the DreamDex tooltip, with a halo in its tone colour.
- **Lift** (`box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4)`): the open team card, raised 4px; a hovered card gets a lighter `0 6px 14px` and rises 2px.
- **Badge** (`box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5)`): round alert marks on a sprite.
- **Selection rings** are inset, not shadows: 1px cyan for a selected row, 2px cyan for a focused or lit cell.

### Named Rules
**The Only Floaters Cast Shadows Rule.** Panels, blocks, rows and cards at rest never carry a shadow. A shadow means a menu, a tooltip, a dialog, a toast, the open card or the card under the mouse.

## Shapes

Square by default: panels, blocks, lists, the summary screen, team cards and empty slots have no radius. Buttons take Pokémon Champions' alternate corners (`--alt-r` 10/3/10/3, rounded top-left and bottom-right); inputs and selects use 4px; menus and dialogs 6px; tags, pager buttons and badges 3px; meters 2px; the small Champions pieces (role boxes, bar pieces, small plates) the small alternate corners (`--alt-r-sm` 7/2/7/2); type chips are a plain 4px rounded rectangle as in Champions. Only these two alternate sizes exist; count pills 10px; filter pills 14px; phone sheets 8px on top. Chevrons are two-sided 2px borders rotated 45°, down when closed, up when open. Empty team slots are 2px dashed outlines; only the first carries the plus ring.

The one expressive shape is the slant: a parallelogram cut by `clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)` (9 to 10px on small heads, 5px on small state tags, 14px on the rail tab), filled with the neutral plate colour under the stripe texture (`--stripes`: `repeating-linear-gradient(-60deg, #ffffff0d 0 4px, transparent 4px 10px)`). Bar pieces in the Analisi share the same slanted right edge.

### Named Rules
**The Slanted Head Rule.** Only the frame slants: section and panel plates, state tags, the active rail section, the team toolbar and the small inline labels inside a panel ("TEAM COVERAGE", "+N"). The Analisi cards and tabs no longer slant (2026-11-22, like the editor): card titles are Champions bands, the open tab is a light tab with a magenta underline and point (see Analisi tabs). Panels, rows, inputs and the cards' outline (team, candidates, Meta) are never slanted, never cut and never rounded.

**The One Pill Family Rule (Analisi overview).** Move pills, condition pills (weather, terrain, style: `mvp-sm` with the condition's type icon tile, no tail) and role boxes are one family, 22px tall. Small content objects take only two radii: `--alt-r-sm` (7/2) for chips, tiles, pills and "+N" counters, 3px for data cells (coverage grid cells, the fix label); round counts on tabs stay round.

**Shared Champions tokens** (`tokens.css`): plates, pills, chips and role boxes fade from Raised to `--fade-end` (Field) at `--fade-stop` (60%); bands use `--champ-band` (Raised 90% toward white; not `--band`, the team band colour) and plate heads `--plate-head` (80%); Champions slot bars use `--slot-inset` and a 1px `--slot-shine` line on the fill. Move pills have only their Line hairline, no drop shadow (only floaters cast shadows). Editor box titles are 14px, one step above the 13px group-title bands inside panels.

**The Champions Band Rule.** A column that holds a group (the bar columns of the Generale tables: Tipi and Meta in Offesa and Difesa, the bars in Velocità) is named by Pokémon Champions' band: the word centred over the column on a light band (Raised lightened 10% toward white) that fades out at both sides, with a hairline under it fading the same way. Plain columns (Pokémon, the area number) keep the small uppercase head. The Riassunto's section titles (Meteo e campo, or Meteo e campi with the hazards when there are three conditions or more; Trappole; Sinergie) are centred like the editor boxes' titles (fading at both sides, hairline under); their "Nessuno" or "+N" sits on the right, on the band's centre line. The candidate detail's Risolve and Costa are plain small uppercase heads (2026-11-22). The Panoramica's speed columns are square with a light top line, like Champions' bars. The Coaching's list title ("Proposte, dalla più utile") is the same left band, in sentence case. The Meta profile's titles (Mosse più usate, Spesso con, Contro il tuo team) are left bands too; its "lo reggono / lo mandano KO" rows are small alternate-corner plates, and the cards' usage bars are Champions slots. Content objects inside panels (moves, types, bar pieces, role boxes, buttons) take Champions' shapes, never the slant.

## Components

### Buttons
- **Shape:** Pokémon Champions' alternate corners (`--alt-r`), 1px Line border, Raised fill, 500 weight, 6px 10px.
- **Hover / Focus:** the border turns cyan; keyboard focus is a 2px cyan outline at 2px offset (0 offset on fields). Pressed toggles sit on Accent Soft with a cyan border. Disabled at 40% opacity.
- **Primary:** magenta fill, On Accent 2 text, 700 15px uppercase at 0.04em, hover Accent 2 Ink. One per surface (see The Rare Magenta Rule).
- **Guide** (Completa team, Migliora i set): an Accent Soft parallelogram with a cyan spark in the team strip, right after Team salvati; never magenta.
- **Danger:** an ordinary button whose border and text turn red on hover (Svuota team, remove).
- **Segmented:** a Field strip with 1px dividers; the pressed segment is Accent Soft with 600 weight (modes, EN | IT, sub-views, Uso · Minaccia).
- **Help "?":** the drawn circled "?" at 20px in Muted (16px inline), cyan on hover and focus; it opens the "Come funziona" guide of the place it sits in.
- Small controls keep a hit area of at least 24×24 (44 on touch) through a transparent pseudo-element, while the drawing stays small.

### Plates, Chips and Tags
- **Plate:** the neutral slanted striped head (Line, Text, 700 italic) used for section and panel titles outside the Analisi and for the "TEAM COVERAGE" plate.
- **Analisi card heads** (`.dash-head`, every `DashCard`: Panoramica, Bonus/Malus…): like the editor boxes' titles, a Champions band on the left (Raised lightened 10% toward white, fading to the right by 72%) with a hairline under it fading the same way; the title upright, 600 15px Text (no plate, no slant, no stripes); numbers and links stay on the right; a head that opens a tab lights from the right in cyan on hover.
- **Type chip** (`TypeChip`): as in Pokémon Champions, in the site's colours: a square tile in the type colour with the official icon, then the name (11px, 700, uppercase, centred) on a dark plate that fades from Raised to Field, tinted 35% toward the type colour; a plain rounded rectangle (4px, not the moves' alternate corners), 20px tall. One fixed width for every type, as in Champions (the name area is 70px, enough for the longest name; "Coleottero" drops to 10px), so chips line up in columns. In list reasons (16px tall) the width follows the name. Team cards (18px, still uppercase) step down together, measured on the team's own pairs (one step down as soon as one pair does not fit): one width for every type (the longest name, so chips line up in columns: 2K, 1080p), then three fixed widths for short, medium and long names (per language, e.g. BUG / GROUND / FIGHTING), then the width follows the name (10px and tighter spacing on cards under 180px), then the type icons alone on every card. The icon tile is always square: never change its ratio to save space.
- **Role box** (`.dash-role-tag`, Panoramica › Ruoli and Porta/Toglie): a small Champions plate, the check or × in a tile on the left (green tint when covered, red when an essential or important role is missing, dashed when the miss costs no points yet because the team is incomplete; minor roles are not listed), the name on a plate fading from Raised to Field, small alternate corners.
- **Tags:** 3px corners, 12px 600; green by default, yellow for warnings, red for banned or serious, outlined Line for tier. State tags (senza check, un solo check, gestito) are small slanted tags 16px tall.
- **Count pills:** 10px radius, Raised and Muted; status-coloured only in the rail.
- **Generale tables** (`.def-members`, Offesa, Difesa, Velocità, and Difesa › Recupero): striped rows like Champions' stat rows (every other row Raised at 50%, no lines between rows, small alternate corners at the two ends, the sprite 6px in from the edge). The tile grids (Coverage tipi and meta, `.ct-table`) stripe only the Pokémon cell on the same rows, so the names column looks the same across sub-tabs. Their bottom rows ("Team Coverage", "Il migliore") carry the same slanted plate as Generale, inside the row (`.row-plate`). Every Generale-style table starts its member rows at the same place with the same row height, so switching sub-tabs never jumps: Recupero's two head rows add up to the one-row head (44px), and Velocità takes its scale row's space from its lower team row (from 700px tall). Recupero's "Perde" group head is a Champions band; its loss values are small alternate-corner plates, the Netto bar is Champions' slot (dark inset track, solid fill with a light top line), no vertical divider, and the member score at the end is written like Generale's (italic display number in its tone, no pill). The bar pieces (`.kob`) have the small alternate corners and no outline: OHKO a full green fill, 2HKO a light green one (Difesa: 3HKO+ green, 2HKO yellow, OHKO red, same rule), the targets not KO'd in two hits a grey piece (Raised with a Line hairline) showing "—" (the count is in the tooltip and the accessible name); in the team row that piece stays red with the number of uncovered targets. The setup triangle sits in the piece's top-right corner. With the team collapsed, Difesa's worst hits under the bars are drawn like Offesa's closed move pills: a square tile with the type icon (or the meta threat's box icon on its colour), a dark body fading to Field, the damage in the band colour, small alternate corners. The band heads centre the icon, word and "?" in the band.
- **Status move tails:** a status move (symbol only, no number) gets a tail shrunk around its symbol instead of the fixed width, which would look empty; numbered tails keep the fixed width so they line up. The editor's move field keeps its fixed tail (it holds the menu arrow). The category symbol names itself under the mouse (Fisica, Speciale, Stato) and the editor's field tells it to screen readers.
- **Move pills** (`MovePill`, `move-pill.css`): every standalone move (editor fields, team card tooltip, Offense chips, Coverage and weather tooltips, Coaching, Meta, Speed guide, Summary hazards) is one pill inspired by Pokémon Champions in the site's dark colours: the official type icon as a square tile on the left, the name in 600 on a body that fades from Raised to Field (`--fade-end`) by 60%, and a lighter slanted tail (Raised) holding the small category symbol (`CategoryIcon`: Pokémon Champions' own shapes redrawn 1:1 as SVG, an 8-point star for physical in orange, nested rings for special in blue, the drop in an oval for status in Muted; the same symbols in the move menu) and the number centred (power by default, targets in Offense, usage in Meta; status moves show only the symbol). In Offense › Generale the pills start closed (tile and number, no symbol, straight tail) and on hover grow open: the name slides in and the tail takes its slanted cut. Alternate corners: rounded top-left and bottom-right, almost square on the others. The tail has a fixed width per size (70px, 64 small, 50 inside tooltips) so tails line up in columns. In the editor the move field is the pill itself (tile and tail drawn over the input, the tail opens the menu); the line above keeps only the accuracy. Moves inside sentences stay plain text.
- **Stat icons** (`StatIcon`): the stats wear Pokémon Champions' icons, redrawn as SVG from the game's training screen: HP a heart, Attack and Sp. Atk the physical star and special rings, Defense and Sp. Def a shield with the star or the rings cut out, Speed six bars broken by a "<" cut. Filled in the surrounding colour, before the stat names in the editor rows and in the member stats of Offense, Defense and Speed.
- **Editor boxes** (Statistiche, Set, Sfida): their titles are Champions bands centred on the box's top edge (60% wide, fading at both sides, a hairline under). The editor head is one row: the name, type chips and Shiny on the left, then (only in formats with Tera) a short TERA plate whose value is the Tera type chip, because Tera changes the type; on the right one Set button that names the set in use, drawn like a move pill: "SET / Bulk Up / SMOGON ▾" (a light head with the small uppercase SET cut at "/", the set name on the body fading to black, a light tail cut at "/" with the source and the arrow: SMOGON in Accent on an Accent Wash tail for a Smogon preset, MIO / MINE muted for one of the saved sets, only the arrow for a set changed by hand, "Modificato" / "Edited"; alternate corners like the pills; the name ellipsizes past 220px) (a popover with two tabs, Smogon and I miei set (n): the presets with the best one for the team first and marked "Migliore per il team", each row with name, item icon and "item · nature · main EVs"; the saved sets with rename and delete; at the foot Incolla testo, Salva come… and Apri su Smogon; Esc closes it and returns focus), the Copy set icon and ×. Set holds Item and Ability plates, then the four moves (a group named Mosse for screen readers). Statistiche: the column header falls exactly on the row columns (same side padding): nothing over the values (the big number explains itself), EV centred over the sliders, 508 / 510 centred over the EV boxes, IV over the IVs; no meter (over 510 the EV label gives way to a red "250 di troppo", the full sentence with "voto bloccato" in its tooltip). EV, IV and NATURA are dotted-underlined and show a one-line-per-idea help bubble on hover (310px, bordered); the EV and IV boxes have no browser spinners and their numbers are centred; the nature arrow (16px) sits right against the stat value, on its left; while typing in an EV box a cyan "›" points at that row's IV (reached with →) and the IV box returns; Nature focused shows a 2px cyan ring that follows the diamond; a little air between the big value and the start of its bar; EVs at 0 and IVs at 31 have no box, just a faint number (just a faint number, the box returns on the active row), so only what was changed stands out; rhythm: band, 16px of air (10px on short screens), the table (header and rows together), more air (16px) before Nature than after it (12px), then the Speed foot, 36px tall (32px on short screens); Spread is a real pill on the right of the Statistiche band, "SPREAD | 2° più usato · 14% ▾" (light SPREAD head cut on the diagonal like the plates, control-line border, alternate corners), as tall and level as the band and 18px from the box edge (Custom Skillset sits the same way on the Set band); when the box is under 560px wide it reads "2° · 14%" so it never touches the title (which of the most used spreads the set matches, or "EV tuoi" / "Own EVs"; "2nd" in English; its tooltip says what the pill means; opens the list); Nature sits under the stat rows, centred, as a Champions-style diamond (points < and > at the ends, the NATURA head ending in "<", same plate colours, an outline that follows the shape), its menu one piece with the diamond: the diamond stays whole, the list starts from its < > points (as wide as the cyan ring), comes down to point height with a notch shaped like the diamond's upper half where the diamond sits, opens above (below when there is room only there, mirrored); the chosen nature is only in the field (highlighted, the list's last row), the most used ones next to the field, the column under the NATURA head continues the head (lighter) and holds the usage shares so the names start at the same x as the chosen one (fixed 94px head); no row is active until the arrows move from the field into the list; the diamond sits above the Statistiche header. Custom Skillset is a small switch on the right of the Set band; what it does is only in its bubble and description. The Ruoli strip has no visible title beyond a small RUOLI label; its roles are quiet single-slant flags (labels, not buttons: no hover, no focus), the main one bold; Sostituisci is the only button on that row. The editor fills the drawer only up to 580px: stat rows grow from 40px (36 on short screens) to 56px, contiguous, the speed line at the box's foot; With Sfida, Set is only as tall as its content (fixed gaps: 12px under the band, 12px between plates and moves) and Sfida takes all the rest; without Sfida the Set fills the column. Below 1100px nothing stretches. In Statistiche the Tab moves from EV to EV (IVs at 31 are out of the Tab order, reached with → from their EV and ← back); an IV other than 31 stays in the Tab order.
- **Phone, direction A "summary screen"** (under 600px, chosen by the user 2026-11-19): the grade is one strip (big letter, score and verdict, then Offense, Defense and Speed as small bars in three columns and Roles, Bonus/Malus as values; the "?" in its corner; tap an area for details). The team head is the plate (still slanted), Fill team (straight, alternate corners 8/2px like the "…" button, Accent Wash fill with a soft cyan line, 40px) and a "…" button that opens a bottom sheet with Saved teams, Import, Export, Copy link and Clear team (each named; the real buttons stay alive but out of sight so their panels open as before). The six cards sit in a 3×2 grid, all in view, no sideways scroll. The editor opens on a game-summary head: the member's type colour and stripes behind, the big sprite on the right, the name large at the bottom left with the type chips, × top right and Shiny at the sprite's bottom left, no circle or fill, only a soft dark halo (44px touch area; Shiny on turns Warn); Copy set lives in the SET menu's foot with Paste text and Save as (on the computer it stays the button next to SET); a long name wraps on two lines; the whole head (summary, SET, switch) stays fixed at the top, never shrinking (editor pages are short); a 3px magenta rule under it; then the SET button full width and a three-way switch Set · Stats · Matchup (also by swiping left or right on the editor: a firm horizontal swipe of at least 56px, never from the 24px screen edges, the field being typed in or an open list; the content follows the finger a little, the new tab slides in from its side, a small bounce at the first and last tab, no motion with reduced motion; editor only, not Analisi); one box at a time, no title bands or frames, no Roles strip and no Replace button on the phone (Replace is in the member menu) (Spread and Custom Skillset in a small row at the top right of their tab). Stats rows: name, value, EV box, IV box (no sliders). The Matchup stacks the opponent band (verdict, name, gear, sprite) over the two hits. Every dropdown, the SET menu, Spread and the Matchup settings open as a bottom sheet: full width above the keyboard, at most three quarters of the visible screen, a grab handle, a dark shade over the rest (a tap there closes it without touching what is under), the field name with × and a search box where you can type, 48px rows. The undo toast is a one-row strip above the bottom bar under 1100px. With a touch screen under 1100px editor fields and buttons are 44px.
- **Fill team and the grade guide on the phone** (under 600px, 2026-11-19): Fill team is full screen with a fixed head ("Fill team", the current grade, ×) over the two tabs at half width each; the proposals come first (each proposal a compact Masters-like card: striped fill washed in its team type's colour (Hyper Offense orange, Bulky Offense amber, Balance cyan, Semi-stall green, Stall violet) with a matching line; on top one row with the team type in italic display on the left and the grade (30px, in its grade colour) and Use on the right; under it the six sprites in a row on the card itself, the new ones with a short cyan tick; the card body stays plain Panel with a 3px top line in the team type's colour and the type name tinted with it; the six sprites sit on a dark Field strip so they stand out; the best card has a magenta line and its Use is outlined in magenta, not filled (all Use buttons 34px, centred uppercase label); a tap on a proposal's Pokémon opens its set card (they do nothing else); while computing a single dashed row with Eevee thinking replaces the grey skeleton rows): above them one line sums up the choices ("The best · Any · Favourites first") with a Settings button that opens one bottom sheet with Your Pokémon (icon and lock only, one row), Team type, Condition and Favourites (choices apply at once); everywhere your Pokémon start unlocked (the proposals may improve their sets) except members already locked in the team, and a closed cyan lock keeps a set as it is ("Lock a Pokémon to keep its set as it is"); Use is 44px. "How the grade works" keeps Eevee peeking over it and takes all the height under it; it opens on How it works (the S–D letters and the text, without the weights table), then "Team type": every type as a row with its one-line note, yours first with a cyan line and "your team" next to its name; each row opens its page with ‹ Back on the title's row, at the right, where the area weights sit on one row (three narrow columns, name and bar). While any dialog is open the page under it does not scroll (with a finger the drag never passes to the page), and the browser's tap highlight is off everywhere.
- **Bottom section bar** (under 1100px, 2026-11-19): four equal tabs 64px tall on the Band fill, icon over the name (12px italic display); the open section's icon sits in a 56×30 magenta capsule ("you are here") with its name in Text, the others Muted; no slanted tab. The status line shows only from 600px (tablet), in Muted with the grade and warnings in their colours; the warnings count is a small badge at the icon's top right.
- **Tooltips with a finger** (touch screens, `(hover: none) and (pointer: coarse)`, 2026-11-19): no tooltip opens on a tap. Holding half a second on something with a tooltip opens it as a bottom sheet with × (a tap outside or Esc closes it); rich tooltips (a member's set card, the Speed bars) become that sheet, with a round × above it; the set card's sprite may stick out over the sheet's top edge. The long press never presses the element and never opens the browser menu. Team cards held open the member menu instead, a bottom sheet with the sprite and name, then Edit set, Lock/Unlock (with what it does), Move left, Move right, Replace and Remove from team (Bad); with a finger the card has no × or lock button (a locked member keeps the lock as a mark in the card's top right corner). With a finger the browser's own long-press menu never opens outside text fields. The collapsed team on the phone: six equal cards (44px wide at 390) and the grade in a column (letter over score); there is no collapse handle on the phone: the team collapses by itself when only a strip's height of it is still in view (the bottom of the last cards), so the strip takes exactly that place and covers no content (earlier is impossible without the page jumping); the collapse state lives in AutoBand so only the team re-renders and the swap is instant (the page moves up by what the team lost, so nothing jumps) and the collapsed strip stays fixed under the top bar with a soft shadow, sliding in from under it (0.2s); the full team fades in (0.24s) when it grows back; it grows back when you scroll back to the very top (or pull down there on a short page), again without moving the page: it opens above the strip's place, so you first see its bottom and scrolling further up reveals the rest; a tap on a section in the bottom bar (or an area of the grade) opens that section from its start with the team collapsed. The unsaved-changes yellow dot sits on the team's "…" button and on its Saved teams row; the saved team's name is off the plate on the phone.
- **Editor fields, empty and search** (2026-11-19): an empty Item, Ability, Nature or move has a Warn line and label (the Nature diamond keeps its shape); a number over 252 stops at 252 and the EV head says "Max 252 per stat" for a moment; Spread reads "No EVs" with nothing spent; a set changed by hand reads "Bulk Up · edited" on the SET button when it shares at least 2 moves with a preset (most shared moves, then item, ability, nature, EVs), the preset marked "edited" in the menu, otherwise just "Edited"; select-only fields (Nature, Tera) jump to the first option starting with the letters typed; the Sfida's verdict, speed tags and tips are hover tooltips with their text for screen readers, not Tab stops; 8 or more EVs left to spend turn the EV total Warn with "n EVs still to spend" in its tooltip. Dropdown search ranks exact name, then names starting with the text, then a word starting with it, then names containing it; most used first only inside a rank; no group heads while searching; spellcheck and browser autocomplete off. Move and item menus keep each row to two lines and show the active row's description in a fixed two-line footer at the bottom of the menu.
- **Editor type scale** (Statistiche, Set, Sfida; 2026-11-19): four roles only. Uppercase labels 12px (`--fs-caption`) 700 Muted: stat names, column heads, MOSSA n, the STRUMENTO / ABILITA / NATURA plate heads, the Sfida titles and units. Contents 14px (`--fs-section`) 600: move, item, ability and nature names (also the Sfida move pill). Key numbers 18px (`--fs-title-l`) 700: the stat value and the Sfida result. Secondary text 12px 500: damage %, tips, accuracy. Uppercase at 12 reads as tall as lowercase at 14, so labels and contents look level; the numbers lead by size alone. Names that are headings (the member, the Sfida opponent) stay outside the scale.
- **Sfida** (under Mosse): a diagonal card in the opponent's type colour. Left: a slanted verdict tag (Sfida peggiore / sfavorevole / alla pari / favorevole, red to green; who wins one on one with each side's best hit, fewer hits to KO wins, the faster on equal hits, checked with the rolls for and against), the opponent's name big and always whole (it shrinks down to 13px), searchable by typing (only a name from the list counts), the gear with its Settings (set, item, EVs), the sprite. The worst matchup among the meta threats loads once when the editor opens; a picked opponent stays while the set changes. The opponent list: the meta threats first, worst matchup first, each with its short verdict and usage; then every other Pokémon. Right: your best hit and theirs, each with its move pill showing the move's base power in its tail, power-up toggles (24px), the HP bar ("HP" in English, "PS" in Italian, from the dictionaries) with the KO stamp, the damage as Showdown writes it ("47–56%"); the HP bar is 160px; the hits to KO ("2–3 HITS", the number big) sit right after the damage on the same line, a little apart; a fixed right column (104px, 64px on the phone) holds the speed tag in words (FIRST / SECOND / TIE with the speed), always in the same place (on short screens it moves to the bar's line, right side, and the move pill takes the full width); and under each hit its own tips line, always there and independent (under yours: attack EVs, a better move, speed EVs; under theirs: defence EVs): "Consigli:" in Accent Ink, then one 20px chip per tip (EVs "+32 DifSp", speed "+12 Vel", a move by name; Accent Wash with a soft cyan line, solid cyan when its card is open); with no tips a line is Faint and says only "Consigli: nessuno" (no reason after it); chips that do not fit become "Altri N". A chip opens, on click, a 324px tip card (Ground, 1px cyan line, 6px corners, Menu shadow; above the chip, a bottom sheet on the phone; Esc or a click outside closes it): head with the row icon (red shield, cyan sword, yellow speed), the tip name and ×; before → after (today's damage and hits struck through in Faint, the new ones in Accent Ink, hits big italic); where it comes from ("Tolti da Att 252 → 220", the free EVs, or "Al posto di [move ▾]", preset to the move that costs the team grade least); "Contro il resto del meta": up to four short lines (green or red arrow) with a dotted-underlined count "7 Pokémon del meta" whose tooltip (in the top layer) lists icon, name and "2 → 3 colpi", at most 8 rows then "e altri N", biggest change first; the foot holds the team grade: the letter big in its grade colour, "80 → 79" italic, a change tag (+N green, = grey, −N red) and Applica (cyan, alternate corners). EVs are taken first from the free ones, else from one stat, preferring one that keeps the other rows, then the highest team grade. The grades and effects are computed in the background worker; until they arrive the card says Calcolo… and Applica is off. Applica changes the set and shows the undo toast "Great Tusk: +32 EV in DifSp, −32 in Att".
- **Set plates** (item, ability, nature, Tera): each value is a Champions plate (alternate corners, fading from Raised to Field) with its label inside a lighter slanted head on the left, as wide as its word (uppercase 11px), so the value keeps the rest of the plate; the item icon and nature effect after it; the Mega's ability note stays small above on the right. In a format without Tera (National Dex) there is no Tera plate: Natura takes the whole row (the declared Tera stays in the set).
- **Nature arrows** (`NatureArrow`): Champions' double chevrons, green up and red down, after the stat name in the editor rows and in the nature effect ("Allegra ⌃Vel ⌄AttSp"); the stat name keeps its colour, the final value takes green or red.
- **Stat rows** (editor): like Champions' summary screen, striped rows (every other one Raised at 55%, small alternate corners): stat icon and name, the nature arrow next to the number, the stat value at level 100 large (where the base used to be, green or red with the nature), then the EV bar, the EV number and the IV. Column heads: STATS over the value, EV over bar and number together, IV. The EV bar is Champions' slot made quieter: a 6px dark inset track, a dimmed cyan fill with a light top line; on the active row (hover or focus) the fill lights up and the white handle appears, the row takes a cyan outline and the small cyan triangle on the left. Under the rows a slim line "Più veloce del X% del meta" (or "…dei Pokémon del tier" without meta) follows the EVs; hovering or focusing it opens the same tooltip as Analisi › Velocità (`SpeedTip`), and the full comparison with the neighbours is its description; no line without speed data. "EV usati" sits in the band at the top of the block, beside "Spread più usati"; over 510 it turns red and says how many too many and that the grade is blocked (the editor shows no separate warning for it; the team card keeps its mark). While the editor is open the team band has a fixed state, open on normal screens and collapsed below 760px tall, and the collapse arrow is hidden. Spare height in the editor drawer goes to the middle band (spacing between the stat rows, Set and Mosse sharing the height); from 1080px tall the rows, menus and move pills grow. Below 1440px wide the Statistiche column gives some width to Set and Mosse.
- **Problem chips** (`ProblemPill`): Warn on Warn Bg or Bad on Bad Bg with a warning icon and the short problem text; the same chip in the area head bands and the Coaching rows. A chip is a button only when a Coaching proposal solves it.

### Cards / Containers
- **Blocks:** square Panel, 1px Line Soft border, 12px 16px padding, a plate as title.
- **Pedana card (signature, `pedana.css`):** one card family for the team, the candidate list and the Meta grid: a square dark card (Panel, 1px Line Soft) whose first type colour washes in from the top and fades out by two thirds, a 3px stripe at the bottom in the two type colours (half and half), the card's base (inside the frame), and the Pokémon standing on a **pedana**, an ellipse of its first type colour with a soft light ring and a shadow under the sprite. How lit a card is (`--lit`, 0 to 1) drives the wash, the stripe and the pedana together. The **light from above** (`.pedana-beam`, a trapezoid in the first type colour falling onto the pedana) shows only on the chosen card: the selected candidate, the chosen Meta card, the team card open in the editor (`.beam-on`). No streak, no diagonal, no cut corner, no alternate corners (the user rejected them on cards).
- **Team card:** a Pedana card, always fully lit (268px, 214 compact, 160 short band). Content, centred (type chips centred under the name; no role line, roles are in the editor): the padlock and remove top-right (below 1920px wide the padlock sits under the ×), the pixelated sprite on its pedana filling the free space (up to 176px), the italic name (on desktop always one line: first it shrinks down to 13px, then, if it still does not fit, the name without its form, e.g. Urshifu for Urshifu-Rapid-Strike, Charizard for Charizard-Mega-X, and only a name still too long gets an ellipsis; the full name is in the tooltip; below 1250px wide, and in the collapsed strip below 1600px, the item icon leaves its room to the name) with its alert marks, item, ability, type chips. Open: it lifts 4px with the Lift shadow, the light comes down on it, the sprite grows and plays its animated idle, the bottom stripe turns magenta ("you are here", one stripe only), a small magenta pointer under the card (measured, it follows the open card) points into the editor, which opens under a 3px magenta rule. In the collapsed strip the chips keep the type stripe at the bottom; the open chip has a magenta outline instead (no pointer) and its × sits inside the chip on the right. The collapse arrow is a small handle hanging from the band's bottom edge (Band fill, Line Soft border, rounded below). Cards drag to reorder.
- **Padlock "Fisso":** outline when off, filled Accent body when on; a fixed member is never replaced by the Coaching or suggestions, but its set can still change. The same padlock marks fixed members in menus.
- **Grade card:** Panel under a neutral "Voto" plate with the "?" guide; the big letter, "76 / 100" with the grade word and the team type as plain italic Accent Ink text, not underlined (never a pill; its tooltip opens on hover), then one button row per area (bar and value, › to its Analisi tab). The team cards come first: from 1500px wide down the grade card narrows (196px to 160px at 1250, shorter bars), below 1250 it drops the bars (132px: letter, score, area values). In the collapsed strip the grade keeps Offesa, Difesa and Velocità visible as three tiny bars with a short label (OFF, DIF, VEL) and the value, in the colour of the letter each would earn alone; Ruoli and Bonus/Malus stay in the popover. While editing, the change since the editor opened ("+2") sits under the score; on closing the editor it stays for 2.6s, rises and fades, and the letter does a small jump if it changed (a plain fade with reduced motion; screen readers hear "Voto passato da 78 a 80"). An illegal team turns the grade grey and puts the reason (format, who, why) in the red triangle at the top right, whose tooltip stays on screen; no tag under the grade word (it made the card taller). A blocked grade (EVs over 510, unknown species) never flashes the old grade first.
- **Candidate cards** (Pokémon tab): Pedana cards in the Box grid, dim at rest (`--lit` .45) so the list stays calm next to the always-lit team; the "+N" plate top-left (the #1's on Accent Soft, never magenta), the type icons in a column top-right (22px, `--ti-tip`, as in the detail header), the sprite on its pedana (up to 112px), then the centred name (16px, `--fs-title-s`) and the reasons left-aligned (2px apart) in a foot as tall as the reasons that fit (on tall cards up to 24px more air, so the sprite rises), so every name sits on the same line. Cards (list and Meta) show the base name with the form beside it, small (11px 700 italic uppercase, Muted, like the Mega letter): "Zapdos GALAR", "Ogerpon WELLSPRING", so two cards with the same name never look the same; when room is short the form shrinks with an ellipsis, never the name, and the full name stays in the hint bubble and the accessible name; Mega and Primal, unique per team, get the Mega Evolution symbol after the name (the "S" without its circle, traced from the games' icon, `MegaIcon`, in the games' rainbow: a diagonal gradient from orange top-left to magenta bottom-right; an approved exception to the Rare Magenta Rule, like the gold "Most used" marks; the X/Y letter stays Accent Ink) with X/Y when there are two Megas. The leaving member in replace mode is its box icon at full size (40×30, cropped to 28×22), never scaled down. Hover lifts 4px and lights the card a bit (.8) at once, and after 120ms of rest the sprite pops out and animates, so sweeping across the grid lights nothing; no spotlight on hover. Selected: fully lit, a 2px Accent frame and the light from above. The #1 is told only by its magenta button. On narrow cards the reasons become signs: the drawn sword (types it hits), shield (types it takes), "VS" (who it stops), all in Accent Ink, followed by 14px type icons. Beside the detail the list loses a column rather than leave the detail under 500px wide (1280: three columns with the team open or collapsed), so collapsing the team never makes the detail narrower. The list always shows the normal sprite (the "Icona box" option is gone).
- **Summary screen** (candidate detail, the "verdict", rebuilt 2026-11-22): built around the player's question (should I add it, what does it fix, what does it cost, what set). The header is the card's head (a diagonal in the two type colours with the stripes and a dark fade), the sprite, the italic name with the type tiles, the forme label (a solid dark pill, Accent Ink text) and the Stat button (a real button: Raised with a Control Line border, Text, a small cyan hexagon before the word; opens on hover, tap, Enter or Space, closes with Esc or a tap outside), both 11px 700 and about 20px tall (24px to hit); on the right the grade gain ("+9", then "B 79 → A 88") and under it one small row per area (12px): the short name (Dif, Off, Vel, Ruoli, B/M) and only its direction, a green triangle up, two grey bars for the same, a red triangle down. Never a per-area number (areas weigh differently per team type, so numbers never added up to the +N); the full sentence ("Velocità sale") is in the bubble. In replace mode a strip under the header: ⇄, the leaving member's sprite greyed, "Esce", its name struck through and the roles the team loses in Bad ("perde Muro Speciale · Hazard"). Then two columns: Perché on the left ("Risolve": the green + reasons grouped by kind in the fixed order Difesa, Offesa, Minacce, Sinergie, short form with the full sentence in the tooltip; "Spesso con" with the chain and the icons of the frequent meta teammates already in the team, nothing when meta is off; "Costa": red − losses and yellow ! warnings, also when adding, and when an area drops with no other reason "Difesa scende"; with nothing lost, "Niente: il team non perde nulla", on phone and tablet always and on the computer only when it fits in the empty space beside a taller set, never making the detail longer), the set on the right (`MemberKit` on two columns with the small name over the value, the four move pills `MemberMoves` one per row or two from 520px, then the set's roles once, those the team was missing in Good with "+"). Roles are never listed in Risolve, except with an empty team, where Risolve says what the Pokémon does and the set's RUOLI line is left out (no repeat). No Meta section; the set's stat hexagon (`StatHex`) sits in the Stat badge's tooltip and, on the computer, also in the body under "Statistiche col set" only when a gap below one column holds it whole (measured, in the column with more free room; never making the detail longer, after the Costa line), "Col set" beside the base stats, opening under the header. Labels are small uppercase heads (Faint), not bands. Fitting, decided by the panel, never by the candidate: two columns from 440px of body width (1 : 1.5 up to 600px, so the set column keeps its two-column data at 1366 and 1440), one below; the low version (only when the content does not fit, never from the detail's height alone; it is retried full when the detail grows) has the one-row header, the thin leaving strip and the set data as text on at most two lines; a set column under 260px shows the data as wrapping text; if the body overflows on desktop it first takes the low version, and only if it still overflows two tabs, "Perché" (Risolve and Costa side by side when wide) and "Set consigliato", switched also with the arrow keys. The actions: the main button is uppercase 700 for every candidate (magenta for the #1, Accent Soft with a cyan border for the others); Copia set and Apri su Smogon are ordinary buttons with the alternate corners (Copia set turns into "Copiato" with a check for 1.5s, also announced to screen readers); when the full names don't fit (measured) they become the short "Copia" and "Smogon", and only when those don't fit either, icons (name in the bubble and for screen readers); on the phone they are always an icon with the short word under it, since touch has no bubbles. Never empty while the list has candidates. The header sprite starts at the left edge of its column and only overhangs to the right (80px where the column is 64px), never clipped by the detail. On tablet and phone the sheet scrolls, two columns from 440px (the 620px tablet panel) and one on the phone, where the area row wraps into two short lines so the name stays whole.
- **PC Box lists** (Liste): two boxes (Preferiti, Bannati) with a tinted plate, 10×2 slots with box icons on a halo of their type colour, pages instead of scrolling, drag between boxes or out to remove (with undo), full keyboard support; under them the paged Pokédex of type-washed cards with heart and ban toggles. A banned card is desaturated with a red hatch.
- **Meta grid cards** (Meta tab): Pedana cards like the candidates (dim at rest, light from above on the chosen one), with the rank plate (gold, silver, bronze for the podium), the base name with the Mega symbol like the candidates, "Tuo" on the bottom edge of the stage on the left, and the usage with its Champions slot bar under the name.
- **Threat cards** (Meta): smaller Masters cards on Raised with a type wash, a light streak and a slanted right edge, the state as a slanted tag.
- **Copertura tabs** (Panoramica, 2026-11-22; the meta threats card is gone): a Champions switch after the title, Tipi | Meta: a sunken track (Field 85%, inner shadow, alternate corners 9/3) with two equal halves and a light raised thumb (Raised lightened, 2px cyan underline, small drop shadow) that slides to the chosen one (0.22s, none with reduced motion); labels 700 italic 13px display, Muted when not chosen; Tipi shows three overlapping mini type icons (Fire, Water, Grass), Meta the rail's globe; the unchosen side's icons dim; it always opens on Tipi; Meta carries a small red count of the threats with no check (senza check). Tipi: the 18 types, OFFESA and DIFESA rows, with bigger icons and cells (26/28px, 22/24 tight, 28/32 roomy). Meta (only with meta stats): only the problem threats as a row of "Pedana" tiles (min 96px, as many as fit, the rest in a dashed +N tile): the Box icon scaled 1.2 on a glowing ellipse in the case colour (red senza check, yellow un solo check), the name under it in italic display (ellipsis), and top right a shield (Difesa) and a sword (Offesa) in that side's colour (red none, yellow one, green two or more); tile background fades from the case colour; small alternate corners; no threats: one green check line. The head is number-first: "3 senza check · 9 con un solo check" (EN "3 no check · 9 one check"). Both tabs are exactly as tall (`--cov-h` 92/80/102px). A tile's tooltip lists both sides (the side its click opens first) and the usage; the click opens the Coverage meta of the uncovered side, Difesa first when both are. The head's Offesa › and Difesa › links go to Coverage tipi on Tipi and to Coverage meta on Meta. From 1100 to 1279px wide the switch drops its icons so the head counts stay whole.
- **Panoramica on desktop sizes** (2026-11-22): the Riassunto column grows from 300px at 1100 to 360px at 1280 and up (so the 1180 tablet in landscape keeps the pills whole), Copertura and Ruoli | Velocità share the rest. Density follows the dashboard height: tight under 440, normal, and on desktop from 600 (1920×1080 and taller, team open or collapsed) the roomy, rich version (Ruoli as the roles × members table, bigger Riassunto); under 1100 the dashboard is as tall as its content, so only a collapsed team makes it roomy. On short screens (from 1100px wide, under 760px tall) Analisi opens with the team band collapsed; expanded there, it stays expanded in Analisi for the session (not saved: the other tabs keep the saved choice). Tight on a short screen (1280×620, 1366×657 with the team open): a 3-member core is a synergy row like the 2-member one (three sprites joined by the chain ring, CORE and the title; who parries what is in the core tooltip), never a squeezed triangle, and every Ruoli band keeps its first role (a missing one first) before its "+N", the pill shortening with an ellipsis.
- **Panoramica on tablet** (2026-11-22): the Sinergie get their own height (150px, 190px with two cores side by side) so the triangles keep full size and titles. With a finger (any width, 1180 tablet included) the Tipi | Meta halves and the head links get an invisible 44px touch area; whole-link heads (Ruoli, Velocità) grow theirs to 44 too. On tablet (600–1099) the Da sistemare strip (to Coaching) sits at the top of the Panoramica, before the cards. Tablet landscape page grid: empty implicit rows are min-content, so no blank space under the section.
- **Panoramica critique round** (2026-11-23): on the rich (tall) dashboard the Copertura shows Tipi and Meta together, one under the other, with no switch (the head carries both counts), each 3-member core is drawn whole with its "X para Tipo" lines (no side-by-side pair), and Ruoli rows stop at 36px (the table stays at the top). Ruoli band titles (Essenziali, Importanti) use the same centred Champions band as the Riassunto sub-heads, also in the table. The Da sistemare strip has no thick left border: its tone lives in the label chip, the gradient and a thin frame; while Coaching computes it already shows the problem count and tone, only the offer waits (no link). With one member the invitation sits in that strip, neutral, at the bottom. The empty team shows the invitation and the four cards dashed, each saying what it will show. A Meta "+N" is a narrow 44px column. Speed bar numbers sit on a panel-coloured chip above the average line. With a finger, a tap opens the tooltip of things that don't act on click (coverage cells, speed bars and sprites, role pills); under 1100 role pills are 32px and the Bonus/Malus row 44px. On phone the Voto delle aree popover starts with who the team is ("Balance · 2 core · Pioggia"; the type only with 6 members).
- **Analisi on phone** (under 600px, 2026-11-23): the six Analisi tabs are one icon bar, all in view (no scrolling): a sunken Field track, six equal segments 56px tall; Panoramica (grid), Coaching (target) and Ruoli (star) show icon + short name (11px, 10.5 under 370px), Offesa (sword), Difesa (shield) and Velocità (bolt) show icon + score (the name stays for screen readers); the chosen one is the light raised plate with the magenta underline (like the desktop's big tabs), its icon magenta; problem counts sit top right. The areas' sub-tabs (Generale, Coverage tipi…) look exactly like the editor's tabs: sunken track, chosen one Raised with the cyan underline, 44px (Difesa's four scroll sideways on narrow phones). There is no Panoramica on phone: with a grade Analisi opens on Coaching (five tabs, and at the right end the team grade box, whose tap opens the Voto delle aree popover); without a grade (empty team, or a blocked vote) the tabs are gone and the overview's message (or the Da sistemare strip, on two lines) shows. Analisi reads as a page: the tab bar runs edge to edge right under the collapsed team (no rounded track, a hairline under it), and an area's sub-tabs sit attached right below, edge to edge too, with its "?" at the end; the area's grade and problem chips are not shown on phone (the grade is in the bar, the problems in the tab's count and in Coaching). The bar's six segments touch edge to edge (no track, no rounding), the chosen one a full Raised plate with the magenta underline. On phone the team band shows only in the Pokémon tab (and while the editor or Completa team is open); in Analisi, Meta and Liste it is hidden (kept mounted): the grade is in the bottom bar, the members in every table.

### Inputs / Fields
- **Style:** Field fill, 1px Control Line border, 4px corners, 6px 10px; placeholders Faint; checkboxes 16px in cyan.
- **Focus:** the border turns cyan, with a 2px cyan outline on keyboard focus.
- **Pickers:** the combobox and native selects (`appearance: base-select`) share one Ground listbox with Line Soft dividers, the active option on Raised, the chosen one on Accent Soft; "Più usati" options lead with a 2px cyan left rule and their usage share.

### Navigation
- **Rail sections:** compact full-width rows (see Rail above); inactive panels stay mounted (hidden with CSS), so search, filters and page survive a switch.
- **Analisi tabs:** Panoramica · Coaching · Offesa · Difesa · Velocità · Ruoli e Bonus, 600 italic 15px Muted, equal width in two groups; the open one like the chosen team card in the editor: Raised fill, Line border, Text, a 3px magenta underline and a small magenta point under its centre (no point on the phone, where the row scrolls); no slant and no stretch. The area sub-tabs (Generale, Coverage tipi…) are one step below: the open one Raised with a 2px cyan underline. Arrows and Home/End between them.
- **Doubles (one team type):** wherever singles shows the team type (grade card, Riassunto hero, Ruoli head, guides) doubles shows the fixed name "Doppio" / "Doubles", also for an incomplete team, with at most one style chip beside it (the same `.sum-style` chip; terrains and Tailwind take their type colour from `CONDITION_TYPE`). The "Tipi di team" help button, the team type choice in Completa team and the team type select above the candidates are not rendered in doubles. The Ruoli tab lists only the nine doubles entries in the same three bands; an entry that needs two members ("Protect (2 membri)", "Priorità (2 membri)") with only one shows that member, named, in the missing row colour instead of "Nessuno". "Come funziona" has two topics (Come funziona, Doppio) and a one-row weights table; the Ruoli guide table has one column. Every place that names a member's roles (team card and its tooltip, candidate cards, candidate detail, role filters, Porta / Toglie) uses the doubles list: one "Attaccante" and one "Muro" entry (never Sweeper / Wallbreaker / physical / special), then Fake Out, Redirector, Mossa a più bersagli, Priorità, Pivot, Hazard and Protect; on the card the second role follows that order with Protect last, and a member showing Fake Out does not also show Priorità. A role filter chosen in singles that doubles does not offer is dropped while in doubles (not lit, not counted). Completa team offers ten conditions in doubles (weather, the four terrains, Trick Room, Tailwind) in the same radio group; the Riassunto shows only the pivot link.
- **Pagers:** one style everywhere ("‹ 1/3 ›"): 28×26 Raised buttons with a 1px Line border and 3px corners, Muted arrows that turn Text with a cyan border on hover, the page in 600 13px Text, named buttons and the range read politely to screen readers; 44px on phones.
- **Pokémon tab toolbar:** search, Aggiungi | Sostituisci (with "al posto di"), Tipo di team and Filtri share one height (`--tb-h`: 38px, 34px on low laptops, 44px with a touch screen at every width), so the row lines up. On the phone (under 600px) Tipo di team moves to the top of the Filtri window (Filtri lights up when a team type is chosen), so the bar is two rows: Aggiungi | Sostituisci, then search and Filtri. When the bar is narrow (560px or less) "al posto di" sits small and uppercase above the chosen member ("Tutti ⌄"), like the Tipo di team label, instead of disappearing.

### Area template (Analisi)
Every area tab has the same shape. On top a head band (Panel, 1px Line Soft, about 50px, one centred row, no magenta): the area's grade letter (800 italic 30px) and word in the grade colour, then the area's problem chips on one row (the rest in "+N"; with none, one green "✓ Nessun problema"), then at the right the sub-view selector as a small segmented control and the "?". Under it the chosen sub-view in a framed Panel that never scrolls and starts at the same y in every area. Colour legends always sit top right in a 20px row above the table (12px Muted, `--legend-*` gaps); effectiveness and Trick Room switches sit top left on the same row. Member tables end with a Team Coverage row pinned to the bottom under a soft neutral wash and the "TEAM COVERAGE" plate.

Clicking an item that leads elsewhere opens the target view with that item lit (cyan ring, the rest greyed with grayscale, never opacity) and an "Evidenziato: X · Mostra tutti" note in the legend row.

#### Icon and sprite sizes
- **Type icons:** `--ti-inline` 14px in a line of text, `--ti-chip` 18px on chips and icon grids, `--ti-tip` 22px at a tooltip head, `--ti-head` 24px on grid column heads; each steps down once on low or narrow screens.
- **Sprites:** member rows use box icons scaled with the row; grid cells 34px (44 roomy); in tooltips 48px for the subject (`SPRITE_TIP`) and 40px in heads, rows and ladders (`SPRITE_TIP_ROW`, `src/ui/spriteSizes.ts`). The member card (96px) and the Coaching's incoming Pokémon stay big.

### Tooltips
- **DreamDex tooltip** (`FloatTip`, `src/ui/FloatTip.tsx`, `floattip.css`): the one rich tooltip of the app. A fixed panel in the body (never clipped), opened after 140ms of hover or on keyboard focus (longer, 400 to 700ms, where the mouse passes often), placed under its anchor or above or beside it when there is no room, kept 8px inside the window, with a tip pointing at the anchor. A halo and border in a tone colour (`--tc`, e.g. the type), a soft vertical gradient, a striped head with icon, name and value, a quiet foot line. Three widths (`--tip-s` 300, `--tip-m` 380, `--tip-l` 480px; the same kind has the same width everywhere) and four text sizes (`--tip-title`, `--tip-body`, `--tip-small`, `--tip-num`).
- **Navigation foot:** every tooltip whose anchor opens another tab, sub-view or dialog on click ends with `TipGo`: "Clic: vai a {place}" (or "Clic: apri …"), 600 `--tip-small` in Accent Ink under a 1px Line Soft rule, naming the destination as the UI shows it. Anchors that toggle, select or apply get no foot.
- **No % in tooltips:** tooltips speak in words, bands (OHKO, 2HKO…) and plain numbers (HP out of 100), never percentages. Damage % lives in the cells.
- **Accessible text stays inside:** the tooltip is visual only (`aria-hidden`); the same words are in the anchor's accessible name or in a `HiddenText` description inside the component, linked with `aria-describedby`. Hidden descriptions are never portalled into the body.
- **Bubbles:** icon-only controls get a small Ground bubble (12px) under them on hover and focus, closed with Esc; none on touch screens or under 600px.
- **Never the browser's `title`:** any short text tip (a type name, a "+N" with the hidden names, a note) is the app bubble (`data-hint` via `hint()`), with the same words in the element's accessible name or hidden text. An element that already opens a DreamDex tooltip gets no bubble of its own.
- **Dialogs** (`ModalLock`): when a window closes, focus goes back to the control that opened it (unless it already moved elsewhere).
- **Member card** (`MemberCard`): the Pokémon tooltip reused wherever a Pokémon shows: two-colour striped head with the sprite breaking the edge and the name written as on the cards (base name with the small form or the Mega mark), why it is there, set in two columns, a summary hexagon of final stats, moves as slanted plates in their type colour.

### Menus, Popovers and Dialogs
- **Menus and popovers:** Ground, 1px Line, 6px corners, the Menu shadow, a short 0.14s fade (`tip`). Arrows, Home/End, Enter and Esc work; Esc and closing return focus to the button; a click outside or focus leaving closes them. Group headers are small Faint caps and are skipped by the arrows.
- **Large panels** (Completa team, Filtri, Testo del set, opened from Set › Incolla testo): Ground, 4px, Float shadow, a fixed size so they never change size while loading or switching.
- **Dialogs** (Impostazioni, guides, Migliora i set): over a 70% dark backdrop, a striped Band head over a 2px Line rule (never magenta), close on Esc, × or a click outside, return focus. The "Come funziona" guides are 980px wide with one fixed height for every area; long pages scroll inside.

### Toasts
- **Undo toast:** a Panel card centred in the work area (past the rail), with a light cyan border and glow over the Float shadow, the item's icon and name, an "Annulla" button and a 3px cyan timer bar: 3 seconds for one member, 6 when the whole team or a whole list changes; paused on hover or focus.
- **Done toast** (`DoneToast`): the same card without Annulla after Esporta: a green check, "Team copiato per Showdown" and the team grade in its colour, a ×, 3 seconds, `role="status"`. A pending undo toast waits behind it.

### Eevee moments
Eevee is the app mascot (Dream World art, `src/assets/eevee/`), never the logo. It appears only where a page would otherwise be empty or waiting: waving at an empty team, thinking while a search finds nothing or a calculation runs, happy when the Coaching has nothing to fix, down when data is missing (`EeveeMoment`). It pops up once and then stays still. In guides and modals it peeks over the edge (`EeveePeek`) and plays hide-and-seek when clicked (top, tail or side face). Always decorative: no click target in moments, `alt=""` and `aria-hidden`.

### Motion
One easing for everything (`--ease`: `cubic-bezier(0.16, 1, 0.3, 1)`), short durations (0.12 to 0.22s for menus, tooltips and sheets; 0.32s for a proposal fading into place). Content fades and slides a few pixels; heights never animate. Skeletons are built from the same parts as the real row, so nothing jumps when data arrives. With `prefers-reduced-motion: reduce` every lift, slide, pop, shimmer and Eevee movement is off and things simply appear.

### Issue marks
A red triangle is a legality problem, a yellow one needs checking, a cyan mark is information. On sprites they are round badges on Ground with a status border and the Badge shadow. Every mark is focusable and lists its reasons in a tooltip.

## Do's and Don'ts

### Do:
- **Do** read every colour, spacing and text size through the tokens in `src/styles/tokens.css`, so a palette swap repaints everything.
- **Do** use cyan for every working state: hover, focus, pressed, selection, meters, links, info.
- **Do** keep magenta to the open rail section or tab, the one best action on screen and the S grade.
- **Do** keep status colours for status, with role-aware counts (walls neutral in Offesa and Velocità, attackers neutral in Difesa).
- **Do** keep the grade thresholds S 90, A 80, B 70, C 60 and the grade colours S magenta, A green, B cyan, C yellow, D red.
- **Do** keep the desktop app one screen with the team band always visible; check 1440×900, 1366×768 and 1280×620 with the band open and collapsed.
- **Do** build every Analisi area from the template: head band with grade letter and word, problem chips, sub-view selector, "?".
- **Do** use the DreamDex tooltip for anything richer than a few words, with the `TipGo` foot when the anchor navigates.
- **Do** draw frame heads as slanted striped plates, name grouped columns with the Champions band, and keep panels, rows, inputs and cards square.
- **Do** keep text at least 4.5:1 on its ground and every control reachable and usable from the keyboard.
- **Do** put every UI string in both dictionaries (`src/i18n/it.ts`, `en.ts`), in plain everyday words that help the player.

### Don't:
- **Don't** make a second magenta action on the same surface, or magenta tags, frames, scores or heads.
- **Don't** change ground, panel, status, room or type colours with the palette, or re-hue the classic type colours.
- **Don't** use red, yellow or green as decoration.
- **Don't** let the desktop page scroll; page, scroll inside a frame or show "+N" instead.
- **Don't** put percentages in tooltips, or calibration details (weights, hidden points, internal levels) in any user text.
- **Don't** dim information with opacity; use Muted, Faint or grayscale.
- **Don't** add shadows to blocks, rows, panels or cards at rest.
- **Don't** slant panels, rows, inputs or the team cards' outline.
- **Don't** portal hidden screen-reader descriptions into the body, or rely on the browser `title` where a DreamDex tooltip exists.
- **Don't** animate without a reduced-motion fallback.

The full decision history behind these rules, with every measured size and the reasons for each change, is archived in `docs/design-storia.md`.
