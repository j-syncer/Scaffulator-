# Scaffold Gear Calculator

A single-page visual calculator for scaffolding runs across Kwikstage, AT-PAC Ringlock,
Kwikally and Ally Frame. Add bays, set the deck height and configuration, and it produces a
plan view, a section, a categorised bill of quantities, and estimated tonnage.

## Running it

No build step and no dependencies to install — open `public/index.html` in a browser.

Tailwind and the Google Fonts stylesheet are loaded from CDNs, so the page needs a network
connection to look right. The calculation engine itself is inline and works offline.

## Front end

**No render-blocking network.** The utility CSS is built from this file's own markup with
Tailwind 3.4 + the forms plugin and inlined into `index.html` (~24 kB). It used to pull
`cdn.tailwindcss.com` at load — ~400 kB of JavaScript that parses the page and generates
CSS at runtime — which on poor signal left the app not merely unstyled but **wrong**: seven
controls hide themselves with `.hidden`, so with no CSS a Ringlock job showed a Frame
Height dropdown and a Kwikstage clip selector that do not apply to it. Fonts still come
from Google but load non-blocking behind real fallbacks, so the page works with no network
at all. To regenerate after adding classes:

```
npx tailwindcss@3 -i in.css -o out.css --minify --content public/index.html
```

**The job persists.** `runs` and the job details autosave to `localStorage` on every render
and restore on load, so closing the tab or having the browser evict the page does not lose
a take-off. Every storage call is wrapped — private browsing and a full quota both throw,
and neither stops the calculator. *Save* / *Load* still write and read a file, which is how
a job moves between devices; files predating job details (a bare run array) still load.

**Job details** — name, client, site, estimator, date — sit at the foot of the sidebar and
print as a header block above the manifest, so what comes off the printer identifies
itself. They are user input and are escaped before going into the page.

**Phones are the primary target.** The header collapses to one line with icon-only buttons
under `sm`, putting the bay buttons in the first screen.

## Files

| File | Purpose |
| --- | --- |
| `public/index.html` | The whole app — markup, styles, and the calculation engine |
| `public/favicon.ico` | Tab icon |
| `public/og-image.jpg` | Social preview image referenced by the `og:image` meta tag |
| `wrangler.toml` | Cloudflare Worker config — serves `public/` as static assets |

## Deployment

Live at <https://scaffulator.com>, served by the Cloudflare Worker named
`scaffulator` as an assets-only Worker: there is no server-side script, so
Cloudflare serves `public/` straight from its edge.

Pushing to `main` triggers a rebuild. Everything Cloudflare needs is in
`wrangler.toml` — the `name` there must keep matching the Worker's name in the
dashboard, or the build will deploy to the wrong Worker.

Because no Worker script runs, the dashboard's **Invocations** metric stays at
zero even when the site is being served normally. That is expected, not a fault.

## Scaffold systems

The calculator supports four systems, chosen per run from the **Scaffold System**
dropdown. Each is one entry in the `SYSTEMS` registry at the top of the engine, holding
its own geometry, bay lengths, deck widths, component names and weights.

| System | Model | Status | Data |
| --- | --- | --- | --- |
| Kwikstage | `modular` | Ready | Turbo Scaffolding catalogue + Acrow/Waco manuals |
| AT-PAC Ringlock | `modular` | **Beta** | From AT-PAC AUS catalogue v5.6 |
| Kwikally | `modular` | **Beta** | **Provisional** |
| Ally Frame | `frame` | **Beta** | **Provisional** |

**Kwikstage is the only finished system.** Everything else is beta: tagged in the system
dropdown, banner-warned in the sidebar, and badged in the gear list. Two independent flags
drive that, because they mean different things — `beta` says the takeoff model is still
being built out, `provisional` says the dimensions and weights are estimates. AT-PAC
Ringlock is beta but not provisional: its component figures come straight from the
catalogue, it is the modelling around them that is unfinished. Clearing a flag in the
registry is all it takes to promote a system.

### Component naming

Systems name the same structural member differently, so each may override the wording via a
`parts` map: a Kwikstage transom is a Ringlock Ledger O-Type, a dogleg is a Bay Brace. Two
`parts` entries also change the takeoff rather than just the label — `baseCollar` adds one
per standard position (Ringlock starts each leg on one), and `toeBoard` bills a dedicated
toe board per bay per lift instead of Kwikstage's convention of decking the kickboard as an
extra plank.

### Kwikstage sources

Sizes and weights come from the **Turbo Scaffolding Kwikstage catalogue**; the erection
rules from the **Acrow Quickstage Erection Manual v02 (11/2021)** and **Waco Kwikform's
Wedgelok/Kwikstage guidelines**, both written to AS/NZS 1576.

Three things those corrected outright:

- **There is no 3.0m bay.** The range has no 3.0m ledger, so there is nothing to span one
  with. It was being offered.
- **Bay lengths are the metric nominals** — 0.7 / 1.2 / 1.8 / 2.4m — not the
  imperial-derived 0.71 / 1.22 / 1.78 / 2.39 they were carrying. The imperial nicknames
  stay in the labels because that is what they get called on site.
- **Weights were badly out.** They were mostly a round 5 kg/m: transoms and hop-up
  brackets 63% light, base jacks 75%, sole boards 125%. Every figure is now the
  catalogue's.

Note the suppliers do not agree on everything. Acrow lists standards as "1.0m to 3.0m",
while Turbo stocks a 0.5m — so the 0.5m stays. Acrow's text pairs a 2.4m bay with a 3.6m
brace while its own pallet list and Turbo both carry a 3.2m. Where they differ the setting
is left editable rather than silently picking a side.

### Deck widths and board counts

How wide a bay is, is the same question as how many boards land across it, so the *Deck
Width* dropdown is labelled by board count and the counts are **derived, not typed in**.
`deckWidths()` in the engine takes the transverse-member lengths a system stocks plus the
plank width it decks with, and returns the widths map. Two carrying styles are modelled:

- `span: 'clear'` — the member is a ledger running standard to standard, so the boards
  only get the space **between** the two tubes: `floor((length - 48.3 mm) / plank)`.
  Ringlock works this way.
- `span: 'captive'` — the transom is an inverted-T that carries the boards inside its own
  length, so the whole nominal length decks: `floor(length / plank)`. Kwikstage works this
  way, which is why its 710 mm transom is a 3-board and its 1220 mm is a 5-board.

Adding a width is therefore one number in the length list plus a `weights` entry for that
transom length — the dropdown option, its label and its plank count all follow.

**AT-PAC Ringlock** decks with the 0.24 m Steel Plank O-Type, and every length in the
Ledger O-Type range (01.03.xxx) is a usable bay width:

| Ledger | Clear between standards | Boards | Spare |
| --- | --- | --- | --- |
| 600 mm | 551 mm | 2 | 71 mm |
| 650 mm | 601 mm | 2 | 121 mm |
| 840 mm | 791 mm | 3 | 71 mm |
| 880 mm | 831 mm | 3 | 111 mm |
| 1065 mm | 1016 mm | 4 | 56 mm |
| 1150 mm | 1101 mm | 4 | 141 mm |
| 1520 mm | 1471 mm | 6 | 31 mm |
| 1570 mm | 1521 mm | 6 | 81 mm |
| 1820 mm | 1771 mm | 7 | 91 mm |
| 2130 mm | 2081 mm | 8 | 161 mm |
| 2430 mm | 2381 mm | 9 | 221 mm |
| 3050 mm | 3001 mm | 12 | 121 mm |

The 0.24 m step is confirmed by the catalogue's own parts: the Ledger to Plank Transom is
sold as 1-Plank 0.24 m, 2-Plank 0.48 m and 3-Plank 0.72 m, and the Side Bracket range
steps 0.31 / 0.60 / 0.84 / 1.065 m for 1, 2, 3 and 4 boards.

**There is no 5-board Ringlock width.** Five boards need 1200 mm of clear deck, so about a
1250 mm ledger, and AT-PAC's range steps 1.15 m straight to 1.52 m — by which point six
boards fit. The ladder skips 10 and 11 for the same reason. If you want a five-board
platform on Ringlock, the honest options are a 1.52 m bay decked out in full at six, or
five boards plus an Infill Plank.

### Nodes: stars and rosettes

The two systems connect differently and the app says so. Kwikstage uses a pressed **star**
plate and a wedge; AT-PAC Ringlock uses a circular **rosette** welded to the standard, with
eight connection points. Same 0.5 m pitch, different part — so `SYS.node` picks the wording
and the graphic, and nothing defaults to Kwikstage's. Kwikstage reads `★7` and `6-Star`;
Ringlock reads `◎7` and `6-Ring`. In the section the rosette is drawn as a deeper,
fully-rounded disc against the star's square-cornered plate.

### Resolving a height: the column and the jack

You enter the height of the top working platform and your feet end up on exactly that
height. What gives is the split between the **standard column**, which only comes in 0.5 m
node steps, and the **jack**, which is continuously adjustable but only over its own travel.

`calcPhysics` picks the **tallest** column whose leftover lands inside the jack's range —
tallest because that is the most nodes, and so the most platforms. The jack's travel is one
node pitch wide (`jackMinM` to `jackMaxM`, a 600 mm screwjack against a 500 mm pitch), which
is exactly what makes every height reachable with one answer and no gaps. Below the jack's
minimum standing height the deck is simply too low, and the app says so rather than
inventing a base.

This used to floor the column and hand the jack whatever was left over, so a height that
divided evenly asked the jack to stand at **0 mm** — not something you can build. Roughly a
fifth of heights change column as a result: exactly those where the old jack came out under
100 mm.

`geom.baseOffsetM` is everything **fixed** between the jack head and the first node —
nothing else varies, so soleboards and ground packing are deliberately not in the height.
On Ringlock that is the 0.301 m Starter/Base Collar (01.27.000.00). Kwikstage has no base
collar, so the standard sits straight on the jack and the offset is the standard's own
190 mm from its foot to its first star — the same figure the section draws it at, which
those two had disagreed about.

The catalogue gives the AT-PAC screwjack as 0.60 m (06.01.060.00). The wound-down figure is
a working assumption in `geom.jackMinM`; correct it and every height re-solves against it.

### The lift plan

Everything vertical comes from two inputs: the height of the **top working platform**, and
**how many platforms** you want under it. `liftPlan(run)` turns those into the whole
set-out — the jack extension, the star the top deck lands on, every ring below it, and
which of those rings carry boards — and returns it as one object:

```
liftPlan → { targetH, gTFS, jackExt, starSpan, nomH, stepDown, topStar,
             levels: [{ m, star, heightM, role }],   // role: base | dummy | working | top
             working, boardedLifts, boardable, requestedLifts, shortfall }
```

The takeoff, the section view, the metrics panel and the *Boarded Lifts* dropdown all read
that one object. **They used to re-derive it** — each calling `calcPhysics` and
`getRingLevels` with its own clamp — and they drifted apart. That drift is what shorted the
tie bars: the takeoff counted levels as `ceil(starSpan / 2)` while the decks were actually
placed off `boardedLifts`. One function read by all of them means a rule can now only be
wrong in one place.

Asking for more platforms than the height carries is answered by the height rather than
silently clamped: `minHeightForPlatforms(n)` gives the lowest top deck that carries `n`,
and both the dropdown and the note under the height input say so. The note also reports
what the entered height actually resolves to — `Top deck lands on ★10 · jack 0mm · carries
3 platforms` — so the two driving inputs are answered back in the terms they were asked in.

### Rings, lifts and the dummy lift

A **ring** is a rectangle of ledgers and transoms. The rule on site is that nothing ever
sits more than a **three-star gap** from the next ring — three stars in between, so 2.0 m,
a ring on every fourth star — and every working deck has that full 2.0 m of clearance
above the one below it.

That means the levels are set from the **top down**, not from the ground up. The top
working platform is where it is; the deck below is 2.0 m under it, and so on. Whatever is
left over lands at the bottom, next to the **base lift** — the first ring, on star 1,
which carries no boards.

Ten stars to the top deck works out as:

| | Star | Height above base |
| --- | --- | --- |
| Top deck | ★10 | 4.5 m |
| Lift 2 | ★6 | 2.5 m |
| Lift 1 | ★2 | 0.5 m |
| Base lift | ★1 | 0 m |

A **dummy lift** is any ring below the lowest boarded lift that is not the base lift: a
full ring of ledgers and transoms with no boards, there only to keep the three-star rule.
It needs no special case — ask for two working levels on that ten-star column and ★2
simply stops being boarded and becomes one. The section view names them, with their stars.

`getRingLevels()` counts down from the climb in `geom.ringM` steps and puts the base lift
at 0, so every gap is at most 2.0 m by construction. `boardableLifts()` is the ring count
less the base lift, and the *Boarded Lifts* dropdown clamps to it.

**This used to build upward from the ground** and push a stray ring in at the top wherever
the climb was not a whole number of 2.0 m lifts. A 4.5 m climb came out with rings on
★1 ★5 ★9 ★10 — so asking for two working decks put them on ★9 and ★10, half a metre
apart. Anything ending on an odd half-metre was affected: 5.0 m gave 1.0 m of clearance,
5.5 m gave 1.5 m.

### Stars and stair flights

Stars are numbered the way they are counted on site: **star 1 is the rosette at the foot
of the column**, star 2 is 0.5 m up, and so on. A height of *h* metres above the base is
star `h / 0.5 + 1`, so a 4.0 m column runs star 1 to star 9. `starAt()` in the engine is
that one line, and it is the only place the numbering is defined.

Stair flights rise in whole star steps and land on a star at both ends:

- a **1.5 m** flight climbs three steps and **sits on four stars** — star 1 → 4;
- a **2.0 m** flight climbs four steps and **sits on five stars** — star 1 → 5.

Flights stacked above one another **share the star at the landing between them** — they
hook onto the same rosette, side by side — so the stars do not simply add up. A 1.5 m
flight under a 2.0 m flight runs star 1 → 4 → 8: eight stars in total, not nine. Shorter
flights go in at the bottom.

`stairFlightPlan()` returns that breakdown. The section view tags each landing with the
star it lands on and its zone header reads `STAIR ★1–8`; the **Stair Tower — Side View**
panel draws the tower itself (see *The three views*).

| Climb | Stars | Flights |
| --- | --- | --- |
| 1.5 m | ★1–4 | 1.5 m ★1→4 |
| 2.0 m | ★1–5 | 2.0 m ★1→5 |
| 3.0 m | ★1–7 | 1.5 m ★1→4 + 1.5 m ★4→7 |
| 3.5 m | ★1–8 | 1.5 m ★1→4 + 2.0 m ★4→8 |
| 4.0 m | ★1–9 | 2.0 m ★1→5 + 2.0 m ★5→9 |
| 5.5 m | ★1–12 | 1.5 m ★1→4 + 2.0 m ★4→8 + 2.0 m ★8→12 |

0.5 m, 1.0 m and 2.5 m are not in the table because no mix of 1.5 m and 2.0 m flights
lands on them. `stairFlightPlan()` flags those as unreachable and `nearestStairClimbs()`
names the two nearest climbs that do work.

Which sizes are on hand is a choice. `stair.treadRises` lists what a system stocks and the
**Available Stair Treads** panel ticks the ones actually in the yard — both on by default.
`solveFlights()` solves the climb in star steps rather than metres and takes the fewest
flights that hit it exactly, falling back to the smallest total that still clears the deck
when nothing hits it. Turning a size off narrows what is reachable sharply: with only
2.0 m treads a stair lands on even metres only, and with only 1.5 m on multiples of 1.5 m.
The warnings name the sizes actually ticked, so they change with the panel.

The climb ledgers on the outside of the stair follow the same numbering: one at **every**
star from the first, and on for a further 2 m of handrail above the top landing. A 3.5 m
climb runs star 1 to star 8 as stair and star 8 to star 12 as handrail, so it takes twelve
ledgers — the count is stars, not the gaps between them.

### AT-PAC Ringlock

Lengths and weights come from the AT-PAC AUS Product Catalogue v5.6 (AP-AUS-001-V5-P6,
2023): standards with crimped spigot (01.01.xxx), Ledger O-Type (01.03.xxx), Steel Plank
O-Type 0.24 m (08.02.xxx), Interlocking Toeboard (08.08.xxx), Screwjack (06.01.060),
Starter/Base Collar (01.27.000), Side Bracket/Hop-Up O-Type (01.11.xxx), Bay Brace for
2.0 m lift (01.06.xxx), Toe Board Retaining Clamp (04.16.001), stair stringers, handrails
and step-down bracket (15.xx / 01.15.027), and the T-Bolt Right Angle Clamp (04.05.202).

Because Ringlock's transverse member is a Ledger O-Type cut to the bay width, ledgers and
transoms merge into one line by length rather than appearing as separate categories.

Four figures are **not** from the catalogue and are marked as such in the code: scaffold
tube (48.3 mm at 4.4 kg/m), the tie bar, the lap board, and a single Bay Brace weight
standing in for all bay lengths.

#### 10-Leg Steel Stair Tower

A system may carry a `stairTower` spec, in which case attaching a stair uses
`addStairTowerGear` instead of the Kwikstage tread model. Ringlock's is modelled from the
catalogue's 10-Leg Steel Stair System:

- **Flights run between lift levels**, because that is where the landings sit.
  `calcStairFlights` walks the ring levels and sizes each rise: over half a flight takes a
  2.0 m stringer, anything shorter a 1.0 m one — those being the only two the catalogue
  lists. Stringers are billed in pairs, as the catalogue requires.
- **Treads** come in 0.81 m and 1.52 m walkway widths, selectable per run; the 1.52 m is
  the stretcher tower. Handrails match the flight's bay length (2.13 m or 1.065 m).
- **The tower is ordinary Ringlock**: ten legs each with a screwjack, soleboard and base
  collar, standards stacked to a metre above the top landing, and ledgers framing every
  landing.

Step geometry is **derived, not quoted**. Ten risers over the 2.13 m stringer bay rising
2.0 m give a 200 mm rise and 213 mm going, inside AS 1657's 2R+G rule; the 1.0 m flight is
the same stair at five risers over 1.065 m. A flight carries **one fewer tread than it has
risers** — nine and four — because its top step is the landing, and the landing is decked
separately. Counting a tread there would bill that step twice.

The tower's **footprint and landing framing are not in the catalogue**, which says only
that landings are "built in any size from the AT-PAC Ledger range". It is modelled as the
plan that reconciles with the catalogue's ten legs: a switchback tower two 2.13 m bays long
by one walkway wide, giving three positions by two rows (six legs) plus four intermediate
legs carrying the half-landings. That yields four long ledgers and five cross ledgers per
landing, decked across the tower width. These counts are our assumption and are flagged in
the code — correct them against your standard tower drawing.

Two takeoff models exist, selected by each system's `model` field:

- **`modular`** — standards, ledgers and transoms (`calcModularGear`). Standards stack to
  the deck height, ledgers ring at fixed spacing, planks fill the deck width.
- **`frame`** — stacked frames, braces and platforms (`calcFrameGear`). Frames stand at
  each position and stack to height; each bay takes a horizontal and a diagonal brace per
  frame level, and platforms lie in the boarded lifts. Deck heights are quantised by the
  frames: the leg has only `FRAME_LEG_MAX_M` of travel, so the engine picks the smallest
  stack the leg can lift to the requested height and reports the height actually reached.

Runs may use different systems in one job. Quantities are bucketed per system, because the
same component name (`Ledger (3000mm)`) means different weights in different systems, and
the manifest prints a section per system with its own subtotal.

### Beta and provisional data

`beta: true` marks a system whose takeoff model is still being built out. `provisional:
true` marks one whose dimensions and weights are estimates awaiting supplier confirmation.
Either raises the orange warning panel, tags the system in the dropdown, badges its
section of the manifest (`BETA`, `PROVISIONAL DATA`, or both) and changes the footnote.

**Kwikstage is the only system that carries neither flag.**

**AT-PAC Ringlock is beta but not provisional.** Its lengths and weights are the
catalogue's own; what is unfinished is the modelling around them — the stair tower
framing, the bracing rules and the stair access geometry are still being worked through.

**Kwikally has a 4.0m standard** — it is Kwikstage that does not.

**Kwikally and Ally Frame are beta and provisional.** Their bay lengths, deck widths,
frame heights and every weight are placeholders derived from typical aluminium practice,
not from a supplier spec sheet. Correct them in the `SYSTEMS` entry and clear the flags
once verified — nothing else needs to change.

## Engine layout

The engine lives in the single `<script>` block at the bottom of `index.html`, split into
labelled sections:

- **System registry** — `SYSTEMS`, one entry per scaffold system, each holding its
  geometry, bay sizes, deck widths, standard sizes, colours and per-component weights in
  kg. `SYS` points at the system currently being calculated or drawn; `useSystem(id)`
  switches it, and is called per run because runs may differ.
- **State** — `runs`, an array of `{ bays, settings }`. Each run holds an ordered list of
  bay / gap / break items plus its own configuration, including which system it uses.
- **Geometry** — jack extension and standard stacking (`calcPhysics`, `calcStdStack`),
  ledger ring levels (`getRingLevels`), stair flight mix (`solveFlights`,
  `stairFlightPlan`), and frame stacking
  (`calcFramePhysics`).
- **Bill of quantities** — `calcRunGear` dispatches one run to `calcModularGear` or
  `calcFrameGear`; `calcTotalGear` buckets every run by system and applies the optional
  spares uplift; `calcWeightKg` weighs one bucket and `calcTotalWeightKg` sums them.
- **UI builders** — `buildBayButtons`, `buildWidthOpts`, `buildPiggybackOpts`,
  `buildHopupOpts`, `buildStandardsList`, `buildTreadList`, `buildFrameHeightOpts` and `applySystemChrome`
  regenerate the controls whenever the system changes. Nothing about a system's sizes is
  hardcoded in the HTML — the selects ship empty and are filled from the registry.
- **User actions** — the handlers wired to the buttons and selects.
- **Drawing** — both views are SVG on a real millimetre scale. `renderPlan` is a true
  top-down view of the run; `renderElevation` (and `renderFrameElevation`) draw a section
  looking along the run; `renderStairView` draws the stair tower from the side. `sectionCanvas` sets up the height axis, ground and label gutter;
  `drawStandards`, `drawDeck`, `drawFoundation` and `dimension` are the shared parts.
- **Render** — `renderGearList`, `renderMetrics`.

`render()` recomputes everything from `runs` on every change; there is no incremental
update path, so state changes only need to mutate `runs` and call `render()`.

## The four views

**3D view** draws the whole job — every run, every bay — as a true **axonometric**
projection rather than a perspective one, so parallel lines stay parallel, a bay reads the
same wherever it sits and the drawing can be scaled off:

```
sx = (x - y) · cos30        sy = (x + y) · sin30 - z
```

X runs along the job, Y across the deck, Z up. It draws the far row, then the transoms and
decking, then the near row, which is enough of a painter's order for a structure this
regular. Steps show as the level change they are. The whole job is fitted to the page, and
**it prints** — the screen colours are picked for a dark panel, so a print block restyles
the members to ink on white (presentation attributes lose to CSS, so classing them is
enough).

**Plan view** looks down on the run, drawn to one scale (`PLAN_PX_PER_M`). Bays are tinted
by size and dimensioned underneath, standards appear as circles at every position on both
edges of the deck, and hop-up and piggyback are bands outboard of the deck.

**Stair Tower — Side View** appears only when the current run carries a stair, and looks
at the side of the tower. A scaffold stair switchbacks inside one bay footprint — each
flight climbs the length of the bay, you turn on the landing and the next climbs back the
other way — so from the side it reads as a zigzag, which is what it draws. Flights are
coloured and labelled by rise (`1.5m ★1→4`), landings carry their real height, and the
vertical axis is numbered in **stars rather than metres**, because that is the unit a
stair is set out in. The stars above the top landing are the tower's 2 m of handrail,
drawn heavier and captioned.

The flights are laid out **backwards from the top**. The top landing is not free to fall
wherever the mix leaves it — it has to arrive at the end where the access opening is, or
you cannot step off onto the deck. So the last flight is pinned to that end (marked
`ACCESS`) and every flight below alternates down from it, which in turn fixes which end
you walk on at ground level (marked `WALK ON`): **the same end for an even flight count,
the far end for an odd one**. Landings that arrive at the access end are tagged *step
off*; the ones at the far end are turns only. Working that out by hand is easy with two
flights and not with twenty, which is most of the reason to solve the mix at all. Every star above the base doubles as the guard ledger drawn across
the tower, so the gridline and the billed member are the same line. The step profile along
each stringer is the drawing's own assumption — about a 200 mm rise per step, the figure
the Ringlock tower is modelled at, which keeps every flight inside AS 1657's 130–225 mm
band — not a billed quantity: the units are prefabricated and billed whole.

**Section** looks along the run, showing deck width, lift heights, standards, guardrails,
hop-up, piggyback and the stair tower. Standards carry a rosette at every 0.5 m, drawn as
the flange it is rather than a notch in the tube. A standard's rosettes run from 0.5 m
above its foot to its very **top** — a 2.0 m standard is a 4-Star. Below the lowest ring — the star
the transom goes into — there is **190 mm** of tube down to the base of the standard: the
socket that slides over the spigot of the one underneath. That leaves **310 mm** above the
top ring for the spigot itself, and 190 + 310 being one 500 mm pitch is what makes the
star counts come out (0.5 m = 1-Star, 3.0 m = 6-Star, 4.0 m = 8-Star).

It is also what makes a joint readable: the next standard starts 190 mm **below** its
first ring, so a short bleed of its colour shows under that ring. Drawing the joints *on*
a ring instead made every boundary ambiguous — a 3.0 m standard appeared to carry seven
rings because it also showed the one belonging to the standard above it, a 1.5 m looked
like a 4-Star, and a ring was left stranded above the top deck on the inside column, where
the run breaks at the deck and nothing sits above it. Ledger rings, decks
and guardrails all land on 0.5 m multiples, so every one of them lines up with a star, and
each deck is drawn resting **on** its ring: the ring line, the star and the underside of
the boards are one line. Height is drawn to a scale that adapts so a 40 m
job still fits on screen, while width uses a fixed larger scale (`SEC_PX_PER_M_H`) so
detail stays readable. When those two scales diverge far enough to matter the label says
`width exaggerated`. Every element is placed along one metre axis and the labels sit in a
gutter beyond it, so nothing overlaps regardless of configuration.

## Calculation assumptions

These are the rules baked into the engine for the **Kwikstage** system, which is the one
with confirmed data. They are estimates and are worth checking against your own yard's
practice. Kwikally follows the same modular rules with its own sizes; Ally Frame follows
the frame rules described above.

- **Bay lengths** are 0.71 m (700), 1.22 m (4ft), 1.78 m (6ft), 2.39 m (8ft) and 3.00 m.
  Each bay contributes its own ledgers and planks at that length, and every standard
  position adds a further 50 mm (`geom.posMM`) to the run. Auto-fill packs greedily from
  the longest bay down. Adding a length means adding it to that system's `bays` plus two
  `weights` entries (ledger and plank) — the buttons and counters generate themselves.
- **Boarded lifts** can be set from 1 to 20. The ceiling is the `MAX_LIFTS` constant in the
  engine; the dropdown is generated from it at boot, so raising it is a one-line change.
  The count is also clamped to the levels the deck height actually provides — a lift can
  only be boarded where a ledger ring (or frame level) exists, so a 4 m deck bills three
  lifts however many are selected, and the dropdown snaps back to match.
- **Base offset** is a fixed 0.3 m (`geom.baseOffsetM`). The standard column is the largest 0.5 m multiple that
  fits below the target deck height, and the jack takes up the remainder — so jack
  extension is always under 0.5 m.
- **Step-down bracket** is Double when ground-to-first-standard exceeds 0.4 m, otherwise
  Single.
- **Ledger rings and the dummy lift** — see *Rings, lifts and the dummy lift* below. Rings
  are set from the top deck **downwards** at 2.0 m, so no two rings are more than a
  three-star gap apart and every working deck has its full 2.0 m of clearance.
- **Bracing** is one dogleg pair per 4 m of height, and one face brace per 4 bays per
  bracing level.
- **Stair towers** piggyback off one bay length only, declared per system in `stair.bays`:
  the 8ft (2390 mm) bay on Kwikstage, the 2.13 m bay on Ringlock (its stringers are built
  for it) and Kwikally's 2.50 m. *Attach Stair Tower* goes on the last eligible bay, not
  simply the last bay, and refuses if the run has none. Loading a project clears any stair
  sitting on a bay that cannot carry one. Systems with no `stair` block — Ally Frame —
  hide the button rather than offering one that bills nothing.
- **Stair flights** come in the rises listed in `stair.treadRises` — 1.5 m and 2.0 m — and
  the *Available Stair Treads* panel turns either off for a yard that only carries one.
  `solveFlights()` then picks the fewest flights that land on the deck from whatever is
  left. See *Stars and stair flights* below. Some climbs have no combination that reaches
  them at all; the calculator says so when the stair is attached and keeps saying so in
  the section caption, rather than quietly billing a stair that finishes above the deck.
- **Stair access rules** change two things in the takeoff, both in `stair`:
  - `climbRailEveryM` puts a ledger on the stair's outside standards at **every 0.5 m
    star for the whole climb**, at the stair bay's length. A stair rises continuously, so
    unlike a deck it cannot be railed only at lift level — a 4 m stair is 8 stars and
    takes 8 ledgers. Ringlock sets this to 0 because its 10-leg tower already carries
    ledgers at every landing.
  - `railAboveLandingM` carries those ledgers on **above the top landing**, for a full
    2.0 m, and stacks the tower's own standards to match. A working platform may only
    carry 1 m of guardrail, but you step off that platform onto the stairs, so the stair
    side needs rail above waist height there too — four more ledgers, independent of the
    run's *Top Guardrail* setting. The run starts at the **first** star, not the one above
    it: that bottom ledger ties the tower's feet together rather than railing anything, so
    the count is stars and not the gaps between them. A 3.5 m climb runs star 1 → 8 as
    stair and star 8 → 12 as handrail, and takes **twelve** ledgers.
  - `faceBrace` braces the tower itself, which the run's own bracing rule does not
    cover. A stair tower is **fully face-braced** — a diagonal at every lift on each of
    its long faces, not the run's one-per-4 m — and never end-braced, since a dogleg
    across the width would sit right where you walk. Kwikstage uses its **3.6 m face
    brace**, the top of a 1.7 / 2.1 / 2.7 / 3.2 / 3.6 m range. The bracing has to reach
    **at least the top working platform**, so levels are counted over the climb and not
    over the handrail above it, and each brace spans a whole lift — the top one finishes
    a little above the platform rather than being cut short at it, because that is the
    length it is made in.
  - The bay the stair attaches to **loses its full-length guardrails and mid-rails**. That
    face was the outside of the run, but a piggybacked stair makes it the inside of the
    stairway and the way onto the treads, so an 8ft rail across it would fence the stair
    off. It takes `stair.openRails` short ledgers of `stair.openRailMM` per boarded lift
    instead — three 6ft (1780 mm) on Kwikstage — running into an intermediate standard,
    leaving the rest of the bay open so you can step through onto the tread. That
    standard is a short one: 2.0 m (`railAboveLandingM`), clipped straight onto the base
    ledger of the deck you are standing on rather than run up from the ground, which is
    what gives it the four stars the rails hook into — so it bills no jack or sole board.
    One per boarded lift, since each lift has its own opening onto the stairs. The
    deck-level ledger carrying the boards is untouched; only the guardrails above it
    change.
- **Deck width** is chosen by board count — see *Deck widths and board counts* below. The
  *Side Hop-up* and *Piggyback Bay* dropdowns are generated from the same system data, so
  they only ever offer brackets and transoms that system actually stocks.
- **Step up / step down** — a `step` item in the bay list moves everything after it one
  node (0.5 m) up or down, for ground that has run past what the jack can follow. Ground
  that only rises or falls a little is **not** a step: the jack takes that and every deck
  stays where it is. Stepping in whole nodes is why the jack's travel is one node pitch —
  the jack setting is the same either side of a step.

  **Every platform in the bays after a step moves together**, so they stay `ringM` apart —
  a step is a move of the whole set-out, not of one deck. And it is always exactly one
  node: stepping more than one at a time is not allowed, so 2 m of fall is four steps taken
  a bay at a time. `addStep()` refuses a second step at the same position and the loader
  drops doubled ones.

  A stepped bay needs no more gear than a level one, because its base and its deck move
  together. What does change is the **step position itself**, which carries both set-outs:
  those standards serve both levels, so the two columns there are one node taller, **and a
  step adds a set of transoms** — the bay below lands its boards at the lower level, the
  bay above one node up, both off the same standards. The previous bay's transoms stay
  exactly where they are; the step adds, it does not move. The plan view marks each step with the running level,
  and the section caption reports the deck range across the run.
- **Ties to the structure** (*Ties to Structure*, **None** by default) — whether a scaffold
  is tied and how is a design decision, so nothing is assumed. Turned on, you pick the tie
  type (wall/multi bracket, F-tie, reveal tie, box tie) and the spacing, and the ties bill
  with their tube and couplers. Vertically they sit no more than 4.0 m above the
  foundation and then no more than 4.0 m apart; horizontally every Nth standard, never
  fewer than the two ends. A scaffold inside its free-standing limit — three times the
  deck width — needs none, and the note says so. Acrow's table says every second standard
  under 10 m and Waco's every third under 20 m, so **the spacing is a setting** rather than
  a silent choice. The parts making up each tie are declared in `TIE_TYPES` and are the
  piece most worth checking against your own yard.
- **End edge protection** — at each **open end** of a run a person or object could fall off,
  so the end takes the same rails the sides do: guardrail and mid-rail at every boarded
  lift, the full set at the top, plus a toe board. The manual allows transoms in place of
  ledgers, and across the end of a run the member that spans is a **transom at the deck
  width**. A run carrying a break joins the next one there, so `openEndCount()` does not
  charge either side of that join — two joined runs have one open end each, not four.
- **Hop-ups and tie bars** — a hop-up is a pair of brackets, one at each standard bounding
  the bay, with a tie bar across them for the board to sit in: a floating piggyback on the
  inside of the run, towards the building. Neighbouring bays **share their brackets**, so
  brackets are one per standard position per boarded lift — four across three bays. They
  do **not** share tie bars: each bay's tie bar sits centred on that bay, so it is one per
  bay per **working** level (dummy lifts get none), and it is as long as the bay, because
  it is as long as the board that drops into it. Three 8ft bays with three working levels
  is twelve brackets and nine 2390 mm tie bars. A **one-board** hop-up is the exception
  and takes no tie bar: its bracket carries an end flange that holds the single board on.
- **Staggering** (*Stagger Standards*, off by default) builds alternate columns to the same
  height a different way, so no two adjacent standards join at the same level — the
  manuals' "no two adjacent standards may be of the same length". `staggerPair()` returns
  the two builds: a 4.5 m column is `3.0 + 1.5` or `2.5 + 2.0`, a 3.5 m is `3.0 + 0.5` or
  `2.5 + 1.0`. It only moves the gear where a height has more than one build; a 3.0 m
  column is a single 3.0 m standard, and staggering it means splitting it, which the pair
  does. Where no alternative exists both columns fall back to the same build. Off, the
  takeoff is byte-identical to before it existed.
- **Standards** are stacked from the largest enabled size down, so unchecking
  sizes in *Available Standards* changes the mix. The sizes on offer come from the
  system's own `stdSizes`: AT-PAC Ringlock runs 0.5 m to 4.0 m (1-Star to 8-Star), while
  Kwikstage stops at 3.0 m — it has no 4.0 m standard. Kwikstage weights are linear at
  5 kg per metre, so the mix changes the piece count but not the tonnage. Adding a size
  means adding it to that system's `stdSizes`, `stdClr` and `weights` — the checkbox list
  and legend generate themselves.
- **Spares** (when enabled) add 5% to base jacks, sole boards, clips, couplers and tubes
  only — not to structural members.
- **Strip time** assumes 4 m² per scaffolder per hour. **RONIN strip time** assumes
  0.25 hours per ledger ring per scaffolder.
- **Piggyback bays** share the outer standards of the main run as their inner legs, so
  they add an outer standard row, transoms, ledgers and planks, but no second inner row.

## Save / load

*Save* downloads the `runs` array as JSON; *Load* reads it back through `sanitiseRuns`,
which drops unrecognised bays, unknown systems and invalid gaps rather than trusting the
file. A file that yields no usable runs is rejected and the open job is left untouched. The file is the raw state
array with no version field, so changing the shape of `runs` will break previously saved
projects. Each run records its `system`, so a saved job reopens on the systems it was
built with. Projects saved before multi-system support have no `system` field and fall
back to Kwikstage.
