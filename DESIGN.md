---
name: DreamDex
description: Team builder for Smogon National Dex, styled as a World Championship team preview on a night-navy broadcast set.
colors:
  ink-ground: "#070b1c"
  navy-band: "#0c1330"
  navy-panel: "#0f1735"
  navy-raised: "#17214a"
  ink-field: "#0a1129"
  navy-line: "#26326a"
  navy-line-soft: "#1b2552"
  broadcast-white: "#eef1ff"
  slate-muted: "#a3add6"
  slate-faint: "#7f8bbd"
  signal-blue: "#6f8dff"
  signal-blue-soft: "#1f2d6b"
  trophy-gold: "#ffb800"
  trophy-gold-hover: "#ffc933"
  trophy-gold-ink: "#1d1500"
  trophy-gold-soft: "#33280a"
  alarm-red: "#ff8a8a"
  alarm-red-bg: "#3a1426"
  caution-yellow: "#ffc857"
  caution-yellow-bg: "#362a0d"
  pitch-green: "#63e3a8"
  pitch-green-bg: "#0f3229"
typography:
  grade:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "132px"
    fontWeight: 700
    lineHeight: 0.9
  scoreboard:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.03em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.02em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  body-small:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.06em"
  chip:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.04em"
rounded:
  hairline: "2px"
  tag: "3px"
  control: "4px"
  panel: "6px"
  pill: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "28px"
components:
  button:
    backgroundColor: "{colors.navy-raised}"
    textColor: "{colors.broadcast-white}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  button-pressed:
    backgroundColor: "{colors.signal-blue-soft}"
    textColor: "{colors.broadcast-white}"
  button-swap:
    backgroundColor: "{colors.signal-blue-soft}"
    textColor: "{colors.broadcast-white}"
    rounded: "{rounded.control}"
    width: "30px"
  button-swap-hover:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.ink-ground}"
  quick-add-top:
    backgroundColor: "{colors.trophy-gold}"
    textColor: "{colors.trophy-gold-ink}"
    rounded: "{rounded.control}"
    size: "34px"
  quick-add-top-hover:
    backgroundColor: "{colors.trophy-gold-hover}"
  quick-add:
    backgroundColor: "{colors.navy-raised}"
    textColor: "{colors.slate-muted}"
    rounded: "{rounded.control}"
    size: "34px"
  input:
    backgroundColor: "{colors.ink-field}"
    textColor: "{colors.broadcast-white}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  block:
    backgroundColor: "{colors.navy-panel}"
    rounded: "{rounded.panel}"
    padding: "12px 16px"
  team-card:
    backgroundColor: "{colors.navy-raised}"
    padding: "10px 14px 16px"
    height: "214px"
  type-chip:
    typography: "{typography.chip}"
    rounded: "{rounded.hairline}"
    width: "66px"
  tag:
    backgroundColor: "{colors.pitch-green-bg}"
    textColor: "{colors.pitch-green}"
    rounded: "{rounded.tag}"
    padding: "1px 7px"
  tag-warn:
    backgroundColor: "{colors.caution-yellow-bg}"
    textColor: "{colors.caution-yellow}"
  tag-banned:
    backgroundColor: "{colors.alarm-red-bg}"
    textColor: "{colors.alarm-red}"
  filter-chip:
    textColor: "{colors.broadcast-white}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  filter-chip-on:
    backgroundColor: "{colors.signal-blue-soft}"
  tooltip:
    backgroundColor: "{colors.ink-ground}"
    textColor: "{colors.broadcast-white}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: DreamDex

## Overview

**Creative North Star: "The World Final Team Preview"**

DreamDex reads like the team preview shown before a World Championship final: six sprites in a row on slanted broadcast panels, each with its type stripe, and the grade standing beside them in gold like a scoreboard. Everything sits on a night-navy broadcast set: deep ink ground, navy panels in tonal steps, condensed uppercase type for names and big numbers, tabular figures everywhere.

The layout is dense on purpose, because a player builds teams on a desktop next to Showdown and wants the team, its grade and the best next additions readable in one look. Depth comes from tonal navy steps and thin rules, not from cards with shadows. The one shape motif is the slanted team card; everything else is quiet rectangles with small radii, so the slant stays special.

Colour carries meaning, not decoration. Gold belongs to the grade and the number-one suggestion. Blue is the working accent: hover, pressed, focus on fields, bars, swaps and minor issues. Red, yellow and green are status only. Classic Pokémon type colours are the one source of hue in content. The interface is in English by default or Italian from the switch; Pokémon names stay official English, while move, ability, item, type and nature names follow the chosen language.

**Key Characteristics:**
- Six slanted team cards (skew -8deg) with a type-colour bottom stripe, split in half for dual types.
- Huge gold grade letter at the right of the team band.
- Barlow Condensed uppercase for headings, names and scoreboard numbers; Barlow for UI text; tabular figures throughout.
- Flat navy tonal layering; shadows only on things that float (popovers, tooltips, menus, the lifted selected card).
- Below the team, tabs show one section at a time (Pokémon, Analisi, Meta, Confronto later), each at full width.
- Suggestions as a compact ruled ranked list beside a detail panel for the selected candidate; the #1 row is the only gold row.
- Collapsible analysis blocks: title left, summary and chevron right.
- Desktop first; mobile is not designed yet.

## Colors

A night-navy broadcast palette: four navy steps over an ink ground, one gold reserved for winners, one signal blue for work, and status colours that only ever mean status.

### Primary
- **Trophy Gold** (`trophy-gold`): the grade letter (S, A, B), the grade number in the Valutazione block, the #1 suggestion row (rank, score, faint gold wash and its + button), and the "DEX" half of the logo. It also marks selection state, never action: the focus ring, text selection, caret, checkbox accent, the favourite star, the selected option in menus, the lifted selected team card's underline, the open set drawer's top rule and the top rule of the Stats tooltip. **Trophy Gold Ink** is the text on gold fills; **Trophy Gold Soft** is the start of the #1 row's wash.

### Secondary
- **Signal Blue** (`signal-blue`): the working accent. Button and summary hover borders, field focus, meter fills (score bars and rating bars), minor-issue triangles and table rows, the Custom Skillset unlock mark, the picked-row outline from keyboard search, and the swap button's hover fill. **Signal Blue Soft** fills pressed toggles, active filter chips, the active segmented option, the swap button at rest, the "picked" tag and info banners.

### Tertiary (status only)
- **Alarm Red** (`alarm-red`) on **Alarm Red Bg**: legality problems, serious issues and their counts, banned tags, missing coverage, weak-to counts, removal hover, grade D, error banners.
- **Caution Yellow** (`caution-yellow`) on **Caution Yellow Bg**: things to check (second Mega, illegal moves or ability under Custom Skillset), warning tags, rating penalties, grade C.
- **Pitch Green** (`pitch-green`) on **Pitch Green Bg**: strengths, checklist ticks, resist counts, score gains, positive tags, rating bonuses.

### Neutral
- **Ink Ground** (`ink-ground`): page background, sticky top bar, and the background of every floating surface (tooltips, menus, Stats pop) so they read as cut-outs above the navy.
- **Navy Band** (`navy-band`): the full-width team preview band.
- **Navy Panel** (`navy-panel`): analysis blocks, the suggestions board, fieldsets inside the editor. Type-word contrast is computed against this colour.
- **Navy Raised** (`navy-raised`): team cards, buttons, popovers, the open set drawer, count badges.
- **Ink Field** (`ink-field`): inputs, selects, code and the Showdown set text.
- **Navy Line** / **Navy Line Soft**: control borders and dashed empty slots / every divider, block border and meter track.
- **Broadcast White** (`broadcast-white`): primary text and all Pokémon names. **Slate Muted**: secondary text, block summaries, form labels. **Slate Faint**: tertiary text, placeholders, chevrons, idle icons, board column heads.

### Type colours
The 18 classic type colours (Normal #A8A878 … Fairy #EE99AC, defined in the Sprite module) are content, not theme. They appear as solid chips with dark or white ink chosen by luminance, as the team card's bottom stripe, as the type dot before Pokémon names, as tinted filter buttons, and as type words in running text, where each colour is lightened toward white until it reaches a contrast of at least 6:1 on Navy Panel.

### Named Rules
**The Trophy Rule.** Gold is the grade and the #1 suggestion (row and its + button). No other call to action is gold; gold elsewhere only marks focus or selection, plus one approved exception: the "Most used" markers in the set editor (a gold left rule, faint gold wash and the usage share on the most used items, abilities, natures, moves, Tera types and ready EV spreads).

**The Status Means Status Rule.** Red, yellow and green never decorate. Red is a legality or serious problem, yellow is "check this", green is a strength or a gain.

**The Classic Types Rule.** Type colours keep their classic hues. Lighten them for text legibility; never re-hue them to fit the palette.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, sans-serif), weights 600 and 700, self-hosted.
**Body Font:** Barlow (with system-ui, sans-serif), weights 400, 500 and 600, self-hosted.

**Character:** Barlow Condensed in uppercase is the broadcast caption voice: team names, section heads and the scoreboard numbers. Barlow is the calm reading voice for labels, reasons and data. Tabular figures are on for the whole body so scores and percentages line up.

### Hierarchy
- **Grade** (700, 132px, line-height 0.9): the team's grade letter in the band. One per screen.
- **Scoreboard** (700, 30px, line-height 1): rank and score in the suggestion board (26px at ≤1440px), the logo (30px, 0.06em), the grade number in the rating block (44px).
- **Headline** (700, 22px, 1.1, uppercase, 0.03em): section heads (Team, Analisi, Suggerimenti).
- **Title** (700, 21px, 1.05, uppercase, 0.02em): Pokémon names on team cards; 19px in the board, 17px in swap rows, 16px in Meta Use rows.
- **Body** (400, 15px, 1.45): default UI text; 14px for list rows, pros and cons, select values; 13px for notes, held items, abilities, secondary lines.
- **Label** (600, 12px, uppercase, 0.05 to 0.06em): form labels in the top bar and set editor, analysis sub-heads with counts, filter group heads, board column heads.
- **Chip** (600, 11px, uppercase, 0.04em): type chips (10px in cards at ≤1440px); 10px in the type filter grid.

### Named Rules
**The Official Names Rule.** UI copy follows the EN | IT switch (English by default). Pokémon names always stay official English. Move, ability, item, type and nature names, and move/ability/item descriptions, use the official Italian text from PokeAPI in Italian (English where a translation is missing) and Showdown's English data in English. Team data, saves and Showdown import/export are always English.

**The Names In Text Rule.** A Pokémon name inside prose is bold Broadcast White preceded by a 9px type dot (split vertically for dual types). Type names inside prose take their lightened type colour, weight 600. Move names take their type's text colour.

## Layout

Desktop first, single screen, one 28px page gutter.

- **Top bar:** sticky, Ink Ground, controls aligned to the baseline of their small uppercase labels; an EN | IT segmented switch on the right, before the stats month.
- **Team band:** full width, Navy Band, a grid of the six-card row and a 210px grade column (28px gap). Cards sit in a 6-column grid with 14px by 16px gaps. Opening a card drops the set editor full width under the row (a drawer in the second grid row), one card open at a time.
- **Tabs:** a tab bar under the team band (Barlow Condensed 20px uppercase, 3px Trophy Gold underline on the active tab, status-coloured count pills: problems red or blue, open threats yellow, replacing blue). Inactive panels stay mounted and are hidden with CSS, so search, filters and page survive a tab switch. Choosing a member to replace switches to the Pokémon tab. The Meta tab is disabled when the rating is without meta.
- **Analisi tab:** two columns at 5fr / 6fr (rating and coaching left; weaknesses, coverage and roles right, open by default), the member sheet full width below.
- **Meta tab:** Meta Use left and Meta threats right at 5fr / 6fr, both open.
- **Pokémon modes:** a segmented control always on top (Aggiungi, disabled with a full team; Migliora team; Sostituto simile). Outside Aggiungi a row of round chips picks who to replace: Tutti (free recommendations: each candidate once, with the member worth replacing most, chosen by team grade; favourites never leave) or one member, each chip with its chibi icon (favourites carry a small gold star). A full team opens on Migliora team · Tutti. In free recommendations each row shows who leaves (a small swap arrow over the member's chibi icon, between name and result), and the detail lists the other members it could replace with their grade change.
- **Pokémon tab:** title, modes, search and filters at full width; below them the list and the detail start on the same line. A 560px list (rank 26, sprite 48, name flexible, result 52, action 34; 10px gap), ranked by the team grade each candidate would give (by meta usage for the first Pokémon; by similarity in "similar replacement"), with numbered pages of 10 (up to 50 candidates) below. The result cell shows the grade change in Scoreboard type (+7, red when it drops, gold on #1) over the resulting grade (A 88), or the meta usage for the first Pokémon. A sticky detail panel fills the rest: hero (88px sprite, 26px name, types, tags, the grade change with "team grade B 73 → A 88"), "What changes" when replacing, "Effect on the team" (team grade before → after and every rating area with its change), "Why", the suggested set and the add/replace action.
- **Rhythm:** spacing steps of 4, 8, 12, 16 and 28px; blocks stack with 10px between them.

**Breakpoints.** At ≤1440px the team cards compact (56px type chips, 80px sprites, roles truncated) and the list narrows to 500px and the detail hero shrinks (72px sprite). At ≤1100px the band, the tab columns and list/detail stack and the team row becomes three across; this is a fallback, not a designed layout. Mobile is not designed yet.

## Elevation & Depth

Flat by default. Depth is tonal: Ink Ground, then Navy Band, then Navy Panel, then Navy Raised, separated by 1px Navy Line Soft rules. Shadows exist only on things that float above the layout.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55)`): menus, the Stats pop, alert tooltips, popovers (0.5 alpha).
- **Tip** (`box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5)`): description tooltips on items, abilities and moves.
- **Lift** (`box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4)`): the selected team card, which also rises 4px.
- **Badge** (`box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5)`): the round alert marks sitting on a sprite.

### Named Rules
**The Only Floaters Cast Shadows Rule.** Panels, blocks and board rows never carry a shadow. A shadow means the thing is above the page: a menu, a tooltip, or the one selected card.

## Shapes

Small, square-ish corners: 2px for chips and meters, 3px for tags and badges, 4px for controls and tooltips, 6px for blocks and the board, 14px only for filter pills. Alert marks on sprites are circles. The single expressive shape is the slant: team cards are parallelograms (skewX -8deg around their bottom edge, so the first and last cards' bottom corners line up with the set drawer below) drawn by a pseudo-element so their content stays upright. Empty slots repeat the slant with a 2px dashed Navy Line outline. Chevrons are drawn as two-sided 2px borders rotated 45deg, pointing down closed and up open.

**The One Slant Rule.** Only team cards are slanted, together with the small shapes inside them that sit on the slanted edge (the Stats badge and the type chips, drawn as parallelograms with the same -8deg). Do not skew blocks, buttons or board rows.

## Components

### Buttons
- **Shape:** gently squared (4px), 1px Navy Line border, Navy Raised fill, weight 500, inline icon with 6px gap.
- **Hover / Focus:** border turns Signal Blue; keyboard focus is a 2px Trophy Gold outline offset 2px.
- **Pressed toggles:** Signal Blue Soft fill with Signal Blue border.
- **Swap (⇄) in recommendations:** 30px square, Signal Blue Soft fill and Signal Blue border, filling Signal Blue with Ink Ground icon on hover. Not gold.
- **Quick add (+) on the board:** 34px square; Slate Muted icon at rest, Signal Blue Soft on hover. On the #1 row only it is solid Trophy Gold.
- **Icon buttons on cards** (favourite, remove): borderless, Slate Faint; star turns gold when on, × turns red on hover.

### Chips
- **Type chip:** solid classic colour, ink chosen by luminance, uppercase 11px, 2px radius, fixed 66px width so chips align in columns (56px in cards at ≤1440px).
- **Tags:** 3px radius, 12px weight 600. Green on green-bg for positives, yellow with a warning icon for checks, red for banned, outlined muted for tier.
- **Type filter grid:** buttons tinted 12% of the type colour with a 45% border and lightened text; selected fills solid with a ground-coloured gap ring.
- **Filter pills:** transparent, 14px radius; on = Signal Blue Soft with Signal Blue border.

### Cards / Containers
- **Analysis block:** Navy Panel, 1px Navy Line Soft border, 6px radius, 12px by 16px padding, collapsible. Summary row: title left (weight 600), summary text in Slate Muted 14px right-aligned beside the chevron, issue triangles with counts where relevant. Valutazione and Coaching start open; Meta Use and the deeper analysis blocks start collapsed.
- **Suggestion list:** one Navy Panel list with 6px radius, rows ruled by Navy Line Soft. Row hover tints toward Navy Raised; the selected row is Navy Raised with a 1px Signal Blue inset outline (Trophy Gold on the #1 row). The #1 row carries a Trophy Gold Soft wash fading to the panel by 70%, gold rank and gold grade change. While the list is recomputed after a team change it dims to 55%.
- **Candidate detail:** Navy Panel, Navy Band hero, sections ruled by Navy Line Soft with Label-style heads; the main action is gold only for the #1 candidate, Signal Blue Soft otherwise.

### Inputs / Fields
- **Style:** Ink Field fill, 1px Navy Line border, 4px radius; labels above in the Label style.
- **Focus:** border and 2px outline in Signal Blue.
- **Comboboxes and selects:** custom chevron; menus open on Ink Ground with the Float shadow, rows ruled by Navy Line Soft, active row Navy Raised. Chosen values can render styled (type chip, nature effects, item icon at left).
- **Disabled:** 0.4 to 0.55 opacity, not-allowed cursor.

### Navigation
The top bar is the only navigation: logo, format, gen limit, usage threshold, Avanzate and Import / Export popovers, saved teams, and the stats month at the right. Popovers open below on Navy Raised with the Float shadow.

### Team Card (signature)
A slanted Navy Raised parallelogram, 214px tall: Custom Skillset lock top-left, favourite and remove top-right, centred 96px pixelated sprite with round alert marks at its lower right, then the Stats badge on its own row, name, item (with its 18px item icon), ability, type chips and roles. Every row keeps the same 14px gap from the slanted left edge (measured, so it stays exact when a long name makes the card taller); the sprite stays centred within the slant. Holding a Mega Stone (or Ultranecrozium Z) the card shows the battle forme's name and ability. A 5px bottom stripe in the type colour, split half and half for dual types. Hover lightens the fill. Selected: the card lifts 4px with the Lift shadow, the sprite scales 1.12 and plays its animated idle (Showdown gen5ani, static under reduced motion or when missing), and the stripe turns Trophy Gold; the set drawer opens beneath with a 3px gold top rule.

### Rating Help
A small "?" in a circle (Slate Faint, Signal Blue on hover) beside "Team rating" opens "How the grade works": a modal on Ink Ground with the Float shadow, rendered in the page body so it inherits nothing from the panel. Topics on the left (How it works, each area, Bonuses and penalties) as a vertical tab list on Navy Panel, the selected one on Signal Blue Soft; the explanation on the right. "How it works" shows the weight table per kind of team with the current team's row on Signal Blue Soft. Esc, the × or a click outside closes it and focus returns to the "?". Tooltips on the rating bars carry only per-member data; the rules live here.

### Issue Marks
- **Red triangle:** a legality problem. **Yellow triangle:** needs checking (second Mega, illegal moves or ability). Both can sit on the same sprite.
- **Blue unlock:** Custom Skillset; informational, placed in the card's top-left corner, not a problem.
- **Rules warning on the grade:** when members break the format's rules (banned, gen limit, too many Megas, illegal moves or ability), a red triangle sits right above the score in the Valutazione block, starting where the score starts, like an apostrophe to the grade letter; its tooltip lists the reasons.
- Every mark is focusable and opens a tooltip listing each reason.
- **Summaries:** red and blue triangles with counts (serious and minor); zero counts are hidden. Problem cards get a thin 1px outline in their colour so the selection stays the most visible state.

### Pokémon Names in Text
Bold Broadcast White with a 9px type dot. Chibi menu icons (40×30) replace the dot only in swap recommendations. Names on cards and board rows stay white, with no dot.

## Do's and Don'ts

### Do:
- **Do** keep Trophy Gold to the grade and the #1 suggestion row and its + button; use it otherwise only as a focus or selection mark.
- **Do** use Signal Blue for every working state: hover borders, pressed toggles, meters, swap actions, minor issues.
- **Do** keep type chips fixed-width (66px; 56px in cards at ≤1440px) so they align in columns.
- **Do** colour type words in prose with the lightened type colour (contrast at least 6:1 on Navy Panel) and set Pokémon names bold white with a type dot.
- **Do** put collapsible block titles left and their summary right beside the chevron, hiding zero counts.
- **Do** use Barlow Condensed uppercase for names, section heads and scoreboard numbers, with tabular figures.
- **Do** reserve shadows for floating surfaces and the selected card.
- **Do** put every UI string in both dictionaries (`src/i18n/en.ts`, `it.ts`); keep Pokémon names in official English and show game names through `gameName`/`typeName`.

### Don't:
- **Don't** make any other button or call to action gold, including swap recommendations.
- **Don't** re-hue the classic type colours or use them as decoration outside type meaning.
- **Don't** use red, yellow or green for anything but status.
- **Don't** slant anything but the team cards.
- **Don't** add shadows to blocks, board rows or panels.
- **Don't** show chibi icons outside swap recommendations, or colour Pokémon names on cards.
- **Don't** delete or block the player's input to signal a problem; mark it with a triangle and explain it in the tooltip.
