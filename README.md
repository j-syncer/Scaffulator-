# Scaffold Gear Calculator

A single-page visual calculator for scaffolding runs across Kwikstage, Kwikally and Ally
Frame. Add bays, set the deck height and configuration, and it produces a plan view, an
elevation view, a categorised bill of quantities, and estimated tonnage.

## Running it

No build step and no dependencies to install — open `public/index.html` in a browser.

Tailwind and the Google Fonts stylesheet are loaded from CDNs, so the page needs a network
connection to look right. The calculation engine itself is inline and works offline.

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

The calculator supports three systems, chosen per run from the **Scaffold System**
dropdown. Each is one entry in the `SYSTEMS` registry at the top of the engine, holding
its own geometry, bay lengths, deck widths, component names and weights.

| System | Model | Data |
| --- | --- | --- |
| Kwikstage | `modular` | Confirmed |
| Kwikally | `modular` | **Provisional** |
| Ally Frame | `frame` | **Provisional** |

Two takeoff models exist, selected by each system's `model` field:

- **`modular`** — standards, ledgers and transoms (`calcModularGear`). Standards stack to
  the deck height, ledgers ring at fixed spacing, planks fill the deck width.
- **`frame`** — stacked frames, braces and platforms (`calcFrameGear`). Frames stand at
  each position and stack to height; each bay takes a horizontal and a diagonal brace per
  frame level, platforms lie in the boarded lifts, and the adjustable leg takes the
  remainder below the first frame.

Runs may use different systems in one job. Quantities are bucketed per system, because the
same component name (`Ledger (3000mm)`) means different weights in different systems, and
the manifest prints a section per system with its own subtotal.

### Provisional data

`provisional: true` marks a system whose dimensions and weights are estimates awaiting
supplier confirmation. While such a system is selected the UI shows an orange warning
panel, the manifest stamps that section `PROVISIONAL DATA`, and the footnote says so.

**Kwikally and Ally Frame are both provisional.** Their bay lengths, deck widths, frame
heights and every weight are placeholders derived from typical aluminium practice, not
from a supplier spec sheet. Correct them in the `SYSTEMS` entry and flip `provisional` to
`false` once verified — nothing else needs to change.

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
  ledger ring levels (`getRingLevels`), stair tread mix (`calcTreads`), and frame stacking
  (`calcFramePhysics`).
- **Bill of quantities** — `calcRunGear` dispatches one run to `calcModularGear` or
  `calcFrameGear`; `calcTotalGear` buckets every run by system and applies the optional
  spares uplift; `calcWeightKg` weighs one bucket and `calcTotalWeightKg` sums them.
- **UI builders** — `buildBayButtons`, `buildWidthOpts`, `buildStandardsList`,
  `buildFrameHeightOpts` and `applySystemChrome` regenerate the controls whenever the
  system changes.
- **User actions** — the handlers wired to the buttons and selects.
- **Render** — `renderPlan`, `renderElevation` (with `renderFrameElevation` for the frame
  model), `renderGearList`, `renderMetrics`.

`render()` recomputes everything from `runs` on every change; there is no incremental
update path, so state changes only need to mutate `runs` and call `render()`.

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
- **Base offset** is a fixed 0.3 m (`geom.baseOffsetM`). The standard column is the largest 0.5 m multiple that
  fits below the target deck height, and the jack takes up the remainder — so jack
  extension is always under 0.5 m.
- **Step-down bracket** is Double when ground-to-first-standard exceeds 0.4 m, otherwise
  Single.
- **Ledger rings** sit at 2.0 m spacing, with an extra ring at the top of the standard
  column if that does not land on a 2.0 m multiple.
- **Bracing** is one dogleg pair per 4 m of height, and one face brace per 4 bays per
  bracing level.
- **Tie bars** are only added for 2-board and 3-board hop-ups, at one per bay per 2 m.
- **Standards** run 0.5 m to 4.0 m (1-Star to 8-Star) and are stacked greedily from the
  largest enabled size down, so unchecking sizes in *Available Standards* changes the mix.
  Weights are linear at 5 kg per metre, so the mix changes the piece count but not the
  tonnage. Adding a size means adding it to that system's `stdSizes`, `stdClr` and
  `weights` — the checkbox list and legend generate themselves.
- **Spares** (when enabled) add 5% to base jacks, sole boards, clips, couplers and tubes
  only — not to structural members.
- **Strip time** assumes 4 m² per scaffolder per hour. **RONIN strip time** assumes
  0.25 hours per ledger ring per scaffolder.
- **Piggyback bays** share the outer standards of the main run as their inner legs, so
  they add an outer standard row, transoms, ledgers and planks, but no second inner row.

## Save / load

*Save* downloads the `runs` array as JSON; *Load* reads it back. The file is the raw state
array with no version field, so changing the shape of `runs` will break previously saved
projects. Each run records its `system`, so a saved job reopens on the systems it was
built with. Projects saved before multi-system support have no `system` field and fall
back to Kwikstage.
