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

## Mobile mode and desktop mode

The app runs in one of two modes, recorded as a class on `<body>`:

* **`mode-desktop`** is the layout this app has always had — the configuration
  sidebar, plan, section, 3D view, stair profile and manifest all on screen at once.
  It is unchanged: no element moved, no class changed, and a screenshot of everything
  below the header is pixel-for-pixel what it was. The one visible addition is the
  mode switch in the header, sized to the height of the buttons beside it so the
  header does not grow.
* **`mode-mobile`** puts the same panels behind three sequential phase tabs —
  **1 Input Parameters**, **2 Visualisations**, **3 Bill of Quantities** — with a second
  row of tabs inside phase 2 for the 2D plan, section, 3D view and stair tower.
  Only one drawing is on screen at a time, and each is scaled to fit the panel
  rather than asking for a sideways scroll.

**Which mode, and who decides.** On first load it is automatic: a viewport at or under
900px, or a coarse pointer on a mobile user agent, gets mobile. The Mobile/Desktop
switch in the header overrides that at any width and the choice is remembered
(`scaffulator.mode.v1`); an **Auto** link appears next to it to hand the decision back to
the viewport. Automatic detection keeps following the viewport until the user picks a
side — after that the pick wins, whatever the window does.

**Nothing is duplicated.** Mobile mode is a stylesheet and two `data-` attributes on
`<body>`. The panels are the same elements with the same IDs, so every renderer keeps
drawing into the same containers and no view has a second implementation to keep in
step. Print is exempt from the phase rules: *Print Manifest* prints the manifest and the
3D view from whichever phase is on screen.

**Dropdowns become steppers.** In mobile mode every configuration `<select>` is hidden
and driven by a −/+ pair with the current option spelled out between them; the number
fields keep their keyboard and gain a step pair underneath. The `<select>` is still the
state: a stepper moves its selection and fires the same `change` event a finger on the
native dropdown fires, so `settingsChanged()` and the rest run exactly as before. No
quantity, dimension or weight is reached from the mobile code at all.

## Installable and offline

`manifest.json` and `sw.js` make the calculator installable to a home screen and
independent of signal — which is the point, because the jobs being measured are on
sites without any.

The engine, the markup and the utility CSS are all inside `index.html`, so caching that
one document caches the calculator: geometry, renderers and all. The service worker
serves navigations from the cache first and revalidates in the background, so the app
opens instantly on one bar and opens at all on none. Icons, the manifest and the Google
Fonts stylesheet are cached alongside it. **Bump `CACHE_VERSION` in `sw.js` whenever
`index.html` changes**, or a client keeps serving the previous document until its
background revalidate catches up.

**Background sync.** Saving still writes the file first, offline or not. There is no
upload endpoint by default — the site is static assets with no server side — but point
one at a collector with `Scaffulator.setSyncEndpoint('https://…')` in the console and
every save is also queued in IndexedDB and posted by the service worker once the device
has a connection again. Browsers without Background Sync (Safari, Firefox) drain the
same queue from the page's `online` event. A pill in the header counts what is waiting.

## Files

| File | Purpose |
| --- | --- |
| `public/index.html` | The whole app — markup, styles, and the calculation engine |
| `public/manifest.json` | Web App Manifest — name, icons, colours, home-screen install |
| `public/sw.js` | Service worker — offline cache of the app shell, background sync of saved jobs |
| `public/icons/` | Home-screen icons (192, 512, maskable 512, Apple touch) |
| `public/favicon.ico` | Tab icon |
| `public/og-image.jpg` | Social preview image referenced by the `og:image` meta tag |
| `docs/ai-prompt.md` | The prompt that teaches an AI to write a file this app can read |
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
| Ally Frame | `frame` | **Beta** | Dimensions from AS/NZS 1576 + AU ranges · weights **provisional** (derived) |

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
- **`frame`** — the aluminium mobile tower (`calcFrameGear`). Welded end frames stand at
  each position and stack on internal spigots; the tri-directional brace matrix goes on
  around them — a plan brace on the flat at the base, horizontal braces as ledgers on both
  faces at every level, and a diagonal on each face per level. Platforms land where a
  frame ends, one of them per lift being an access deck with a trapdoor, because the climb
  has to come up inside the tower. The rung is the system's node the way the star and the
  rosette are the modular systems' — a brace snaps to one, a deck lands on one, and you
  climb them — at a 500 mm pitch.

  Deck heights are quantised twice: by whole frame sections, and by the travel in the
  adjustable stem under them (`bases[].minM`/`maxM` — 200–600 mm on a castor, 150–750 mm
  on a base plate). The engine picks the tallest stack whose remainder still lands inside
  that travel and reports the height it actually reached, which is not always the one that
  was asked for.

  **The stack is a MIX of sections, not one size repeated.** A real tower is built the way
  a rigger reaches for whichever piece lands the job closest to the mark — two 4-rungs and
  a 3-rung to clear a height a run of 4-rungs alone would either fall short of or overshoot
  by half a metre. `frameStackList()` solves that mix with the same fewest-pieces DP
  `stdStackList()` runs for a modular standard column, just in RUNG units (the frame's own
  500 mm pitch) and keyed by section rather than by length; `calcFramePhysics()` searches
  the stem's own travel window for the tallest height any ticked combination of sections
  can build exactly, so an odd height gets built from a mix instead of overshooting the way
  a single repeated size would. Which sections may be used comes from checkboxes in an
  *Available Frame Sizes* panel — the frame-system twin of the modular *Available
  Standards* panel, read live by `enabledFrameSizesFor()` the same way `enabledSizesFor()`
  reads the standards checkboxes. Turn a size off and the rest re-solve around it; turn
  every size off and the engine falls back to the tallest one on offer rather than refuse
  to answer.

  Every part that depends on which section a level is built from is billed and drawn per
  section, not per run: the frame line item (`Frame 4-Rung (2.0m x 1.3m)`), the diagonal
  brace (whose own length depends on the level's height — `Diagonal Brace 3-Rung (2500mm)`
  is a different length and a different weight from the 4-Rung version of the same bay),
  and the internal access ladder segment. The section elevation and the 3D isometric view
  both walk the solved stack level by level rather than assuming a uniform height, and
  colour each level by its own section — a run built from a 4-rung, a 4-rung and a 3-rung
  draws as two colours banded up the leg, exactly the way a modular column's mixed
  standards read.

  **Stability is part of the takeoff, not a footnote to it.** A freestanding tower resists
  overturning with footprint alone, so `frameStability()` solves the height-to-base ratio
  before the gear list is written: AS/NZS puts the top platform at H ≤ 3 × Dmin, and the
  manufacturers halve that to 2 × Dmin once the tower is exposed to wind. Outriggers never
  raise the ratio — they widen D — so the engine sizes the smallest stocked arm that gets
  Dmin where it needs to be and bills four of them. Tie the run in and the ratio stops
  governing, the auto-sizing stops, and the face against the building stops taking
  guardrails and toe boards. The same object drives the sidebar's Stability & Compliance
  panel, the section header and the 3D view's label, so all four agree by construction.

  It also surfaces what changes who may legally touch the thing: a fall over 2.0 m is High
  Risk Construction Work and needs a SWMS; a platform over 4.0 m may only be erected,
  altered or dismantled under a scaffolding High Risk Work Licence.

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

**Kwikally is beta and provisional.** Its bay lengths, deck widths and every weight are
placeholders derived from typical aluminium practice, not from a supplier spec sheet.

**Ally Frame is beta and provisional, but its dimensions are no longer guesses.** The
frame sections, deck widths, duty ratings, bay lengths, castor travel and stability rules
follow the AS/NZS 1576 suite and the Australian ranges that publish them — APAC, Mr Scaffold
(Easyscaf 225 kg / Supascaf 450 kg), Turbo, SafeSmart and Global.

**Frames are named by rung count, because that is what they are ordered by.** Rungs sit at
500 mm centres, so the stocked sections are the 4-rung (2.0 m), the 3-rung (1.5 m) and the
2-rung (1.0 m) — the names APAC and the AU ranges list them under. `frameHeights` is keyed
in metres because that is what the height solver stacks; `frameRungs` supplies the name, and
`frameName()` / `frameRungLabel()` compose it once so the *Available Frame Sizes* checkbox
panel, the section header, the 3D legend and the gear list (`Frame 4-Rung (2.0m x 1.3m)`)
all say it the same way. A yard stocking another section adds one entry to each of those
two maps and it appears everywhere else on its own.

**Bay lengths are 3.0, 2.5, 2.4, 2.0, 1.8 and 1.3 m.** The 3.0 m and 2.5 m decks are both
everyday lengths — most of a run is built out of them, and auto-fill packs from 3.0 m down —
with the shorter bays closing a run out against a corner or an opening.

What remains provisional is the **weights**, and deliberately so: no supplier publishes a
component-by-component weight list for a tower, only a kit total and the heaviest single
piece. So `ALLY_WEIGHTS` derives them from the metal instead — 6061-T6 at 2.70 g/cm³ in
the 50 × 2.0 mm extrusion, which is 0.81 kg per metre of tube, times the metres of tube in
the part, plus a fixed allowance for its welded and captive fittings. That model reproduces
Turbo's published 2.7–3.0 m wide tower (131.2 kg total, 22.6 kg heaviest piece) to within
about a kilogram. Replace any figure with one from your own yard and every total in the app
re-solves against it.

Correct either system in its `SYSTEMS` entry and clear the flags once verified — nothing
else needs to change.

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
regular. Steps show as the level change they are.

**Standards are drawn as what they are made of.** Each column is a stack of segments in
the size colours the elevation and the *Available Standards* panel already use — Kwikstage
blue 3.0 m, green 2.5 m, amber 2.0 m, pink 1.5 m and so on — so a column reads as its
build: `3.0 + 3.0 + 0.5` is two blue bands and a short crimson one. Under the drawing a
legend names each colour, counts it, and spells out the builds in use. Every joint wears a
**collar**: a dark sleeve wider than the standard with a bright line through it, because
two 3.0 m standards stacked are otherwise one unbroken band of blue and where one stops and
the next starts is the thing the colours are there to show. With *Stagger Standards* on,
neighbouring columns visibly break at different heights, which is the whole point of it.
The jack below the steel is drawn separately, and the counts in the legend are the same
numbers the gear list bills.

**Ledgers and transoms carry the bay's colour.** A ledger is drawn in the standard colour
of the size nearest its bay length rounding up — a 2.4 m bay in the 2.5 m green, an 1.8 m
bay in the 2.0 m amber, a 1.2 m bay in the 1.5 m pink — and each transom takes the colour
of the bay that lands on it. The mapping is arithmetic over the system's own `stdClr`
rather than a second table, so a system that carries a 4.0 m standard gets a sensible
colour for its long bays without anything being added.

**Under each outer jack is the extension it is wound out to**, in metres, so the set-out
can be read off the drawing at the feet where you actually need it.

Three things it is deliberately careful about, because the drawing has to agree with the
takeoff rather than the other way round. **Guardrails are drawn on the outer face only** —
the inner face is the one against the structure, and the gear list has only ever billed one
face's worth, so rails on both faces were the picture over-reporting. They go on at **every
boarded lift**, since a run carrying three platforms is three platforms you can fall off,
but only the top lift takes the full set: the lifts below it get a guardrail and a mid-rail,
which is exactly the `2 × (lifts − 1) + 2` (or `+ 4` for a double) the takeoff bills. A bay
carrying a stair loses its full-length rails on that face altogether and takes the
part-width open rails instead, for the reason described under the stair below. And the
**decking sits *on* the ring, not in it**: the slab is lifted a board's thickness above the
ring level and given a visible near edge, so the ledgers and transoms the boards land on
stay in view instead of being buried inside the deck plane.

**The stair tower is drawn in full**, off the same `stairFlightPlan()` the side view uses —
sharing the plan is the point, because if the two pictures disagreed about where a tread
lands one of them would be lying. Flights switchback inside the one bay, each climbing the
bay's length onto a landing you turn on, with risers and treads stepped out in the flight's
rise colour and the last flight pinned to the access end so the top landing arrives where
you can step off. The tower hangs off the **outer** face of its bay: that face stops being
the outside of the run and becomes the inside of the stairway, which is the same reason the
takeoff strips its guardrails. Standing straight against the run its inner legs *are* the
run's own outer standards, so only the length the tower adds above the run's guardrail is
drawn over them — painting the whole leg grey would hide the build the colours are there to
show; pushed clear by a piggyback it stands on all four of its own legs and is tied back to
the run at every ring — a hop-up never pushes it, because a hop-up is on the opposite side of
the run entirely (see below). It is drawn last, because under this projection depth runs
with `x + y` and the tower is further out in Y than anything else in the picture.

At the stair opening the part-width rails run into an **intermediate standard**, and it is
drawn. That standard is a short one clipped straight onto the base ledger of the deck you
are standing on rather than run up from the ground — which is how the takeoff bills it, one
2.0 m stack per boarded lift — so it starts at deck level and carries the four stars the
rails need. Without it the rails simply stopped in mid-air at the opening.

**The cross-section is the elevation's.** Hop-up, then the deck, then the piggyback bay,
then the stair tower, on the one axis and in the one order `renderElevation` lays them out.
Taking the elevation's own layout rather than inventing a second one is what stops the two
drawings disagreeing about what is bolted to which face.

**A side hop-up brackets off the INNER standard, toward the structure — not the outer one.**
That is what a hop-up is *for*: closing the gap to the wall you are working on, not adding
width out past the guardrail into open air. This was wrong for a while: it drew on the far
side of the outer standard, past the handrail, in all three views (elevation, plan, 3D)
because the 3D work copied an assumption the elevation already had. All three now put it on
the structure side instead — `y ∈ [-hopM, 0]` in the 3D run frame, `[0, hopM]` on the far side
of `iX` in the elevation's one axis, and the band ABOVE the deck rather than below it in the
plan. **Guardrails never moved for it** — the fall hazard is still only on the run's own
outer face, whether or not a hop-up sits against the structure on the other side — which is
also why nothing else outboard (piggyback, the stair tower) had to move: they were never
sharing that space with the hop-up to begin with, once the hop-up is on the correct side. In
the 3D view this also flips the paint order: a hop-up now sits even further back in the
picture than the run's own inner row, so it has to be drawn *before* that row rather than
after the outer one, or the inner row's steel would show through it.

None of this touches the **end** hop-up a run break can carry (the 1B/2B/3B *Break / Join
Type*) — that one caps the END of a run to join it to the next, which is a different
mechanism with its own correct placement already, described under Breaks below.

**Console brackets** are drawn for the hop-up — an arm out at each standard position and the
diagonal back down to the leg, which is what a console bracket is — carrying the boards.
**Piggyback** shares the run's outer standards as its inner legs, so only its new outer row
of columns is drawn as new steel, with transoms tying it back at every ring, its own decks,
and its own rails on the face that is now the outside. Its rails follow the takeoff's own
count — `numRings + (lifts − 1) + guardRails` per bay, so one rail at each lift below the top
and the full set at the top, which is one fewer per lower lift than the run itself gets.

**Runs can turn corners.** Most jobs are not one long line — they go round a building — so
**Current Run Direction** turns the run you are working on relative to the one before it:
Straight, Turn Left 90° or Turn Right 90°. A straight run behaves as it always has, carrying
on along the same wall line. A turn starts the run exactly where the previous run's **outer**
(guardrail) face ended, facing 90° off the previous run's heading — so the outer face of one
run lines up with the inner (structure) face of the next, and the corner is a clean right
angle with nothing overlapping and nothing to mitre. Four turns the same way close the job
into a rectangle with an open middle, the way a run actually going round a building would.
It only steers the pictures: gear counts, the elevation and the stair view are all still
per-run and do not know or care which way anything turned.

The control **edits the current run live and is reversible** — pick a direction, the drawing
turns; change your mind, it turns back. It is deliberately *not* a setting captured at the
moment you insert a break. It was exactly that at first, and it was wrong: choosing a
direction *after* inserting the break — the obvious order to do it in — silently did nothing
and left the run stubbornly straight with no hint why. A control that only works if you
touch it in the right order is a broken control. Run 1 has nothing to turn from, so there it
disables itself and says so rather than sitting there pretending to be live.

**Both drawings turn**, off the same `turn` field and the same rule, because a plan and a 3D
view of the same job that disagreed about its shape would be worse than either alone. Each
gets there the same way: every run keeps its own **local** frame — x along the run, y from
its inner face at 0 out to its outer — and gains an `(origin, dirX, dirY)` chained from the
run before it, that carries that frame into the drawing's space. The 3D redefines
`P(x, y, z)` once per run, closing over that run's transform; the plan wraps each run in one
SVG `<g transform>`. Either way every call site inside — sole boards, columns, ledgers,
transoms, decking, the whole stair tower, and in the plan every band, bay tint, standard and
dimension — turns with the run automatically, and nothing downstream had to learn that
rotation exists.

Plan **annotations are counter-rotated** so they always read left to right, whichever way
their run points: a run drawn at 180° would otherwise label itself upside down. The run
label is kept short for the same reason — drawn horizontally across a run that may be
vertical, every extra word is one more crossing the run beside it — and the fit accounts for
where that label actually ends, or a turned run's label gets cut off at the edge of the
frame. A turned run tags itself `↰90°` / `↱90°` in amber, so the plan says which way it went
rather than leaving you to infer it from the shape.

**What ties one run to the next is drawn too.** A break's gear belongs to no single run — it
spans two local frames — so it is the one thing in the 3D view set out in *world* space,
which is also what lets it work unchanged whether the runs carry straight on or turn a
corner. Every break takes bridging tube and right-angle couplers at the rail heights, the
`2 × (lifts − 1) + 2` (or `+ 4`) the takeoff bills; on top of that the type chosen draws
itself — **lap boards** laid across the join at each boarded lift, or an **end hop-up**'s
console boards — and the join is named on the drawing rather than left to the gear list.
The tube is drawn at its **stock 1.2 m length centred on the join**, overhanging both sides
the way a coupled tube really does, because round a corner the two standards are barely
50 mm apart and a tube drawn as the gap came out as a pair of dots. Which two columns the
join is made of depends on the turn: carrying straight on it is outer line to outer line,
round a corner it is the outer line of one run meeting the **inner** line of the next —
that is what the corner *is*, and tubing outer-to-outer there would cut across the opening
instead of closing it.

The whole job is fitted to the page, and **it prints** — the screen colours are picked for a dark panel, so a print block restyles
the members to ink on white (presentation attributes lose to CSS, so classing them is
enough), including the labels: jack heights are near-white for the dark panel and vanished
on paper until the print block made every label ink too.

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

  In the 3D view a step moves the **ground** with the deck — sole boards after a step stand
  a node higher — and the step column, standing on the lower ground and reaching the upper
  deck, is drawn the node taller that the takeoff bills it.

  Frame systems have no nodes to step by — an Ally Frame lift is whatever frame you stack —
  so the step buttons are hidden there rather than billing a half-metre nothing can be
  built at.
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

  Columns are counted by **walking the run position by position**, not in height buckets,
  because staggering is a fact about *neighbours*: position 0 gets one build, position 1
  the other, and so on along the run. Counting level and stepped columns as two separate
  buckets and halving each split them at the wrong places and billed a mix no run is
  actually built from — the total steel was right, the piece mix was not. `stepPositionSet()`
  names the positions a step lands on, and the 3D view draws from the same walk, so the
  bands you read off a column in the picture are the standards in the gear list.
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

### Importing a file this app did not write

A take-off now arrives as often from a model reading a photo of a drawing as it does from
*Save*. That JSON says the right thing in the wrong words — `2400` or `"2.4m"` or `"8ft"`
for the bay this app keys as `'8ft'`, a height of `4.5` instead of `"4.5"`, the whole
thing wrapped in a code fence with a paragraph of explanation around it. None of it used
to load, and because an unrecognised bay was dropped in silence, a nine-bay run arrived
as three with nothing on screen to say why.

Reading is three stages now, and the last is the strict check that was always there:

1. `parseProjectText()` — text to an object. Forgives code fences, prose on either side,
   `//` and `/* */` comments, trailing commas, smart quotes, single-quoted strings and
   unquoted keys. Every repair is only kept if the result actually parses.
2. `normaliseProject()` — that object to the exact shape *Save* writes. Sizes are matched
   by key, by catalogue label, by either half of a label like `2.4m (8ft)`, by board
   count, or as a length in millimetres, metres or feet; failing all of those, by the
   nearest stocked size within `IMPORT_TOL_MM` (75mm). Two sizes equally close is not a
   match — guessing between them would be inventing a quantity.
3. `sanitiseRuns()` — unchanged, and still the only thing that decides what is allowed
   into `runs`.

So the tolerance is all in the reading. Nothing in the import path can put a bay, a size
or a setting into a job that the app could not have produced itself.

It also reads: a bare list of sizes as the bay list (`["2.4m","2.4m","1.8m"]`), `count` /
`qty` on an entry (one line for nine bays), a wrapper object such as `{"project":{…}}`,
a single run that was not put in a `runs` array, settings written straight on the run
instead of under `settings`, and aliased field names — `topDeckHeight`, `boardedLifts`,
`deckWidth`, `siteAddress`, `customer`. With no system named, the one that recognises
most of the bay sizes is the one the file is taken to describe.

**Everything it does differently is reported.** The toast counts the bays and runs
loaded, names an inferred system, and counts what was snapped to a stocked size and what
could not be read at all; the console carries the item-by-item detail, which is what you
need to fix whatever produced the file.

**Paste works too.** *Paste* in the header opens a box to paste the take-off into and a
**Build the plan** button — which is the only way in on a phone, where there is no Ctrl+V
to press and saving a file first to load it back is a step with no purpose. Where the
browser allows reading the clipboard the box offers a button for it, and where it does
not, long-pressing the field and choosing Paste is the same thing. On a desktop Ctrl+V
anywhere on the page imports directly, and Ctrl+Enter imports from the box. Pasting into
a field still types into the field, and text that is not a project is left for the
browser to handle normally.

**And there is a prompt to teach an AI the format.** `docs/ai-prompt.md` is the whole
thing — the entry types, corners as separate runs, break types, stair bays, hop-ups,
heights, and the sizes each of the four systems actually stocks — with a worked example.
*Copy the prompt for your AI* in the paste box puts it on the clipboard, which is how it
gets onto a phone. The app's copy is generated from that document and a test fails if the
two drift apart; the example inside it is imported by that same test, so the format it
teaches is the format that loads.

Failures stay in the box with the reason on them — *"Could not read that…"*, or *"No bay
in that was a size Kwikstage stocks — it had bay "9.9m""* — rather than flashing past in
a toast, because the fix is usually a re-prompt and you need to know what to change. On a
phone a successful paste moves to the Visualisations phase, since the plan is the answer
to the paste. The file picker accepts `.txt` as well as `.json`.
