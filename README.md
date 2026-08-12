# Kwikstage Gear Calculator

A single-page visual calculator for Kwikstage scaffolding runs. Add bays, set the deck
height and configuration, and it produces a plan view, an elevation view, a categorised
bill of quantities, and estimated tonnage.

Deployed at <https://scaffulater.tiiny.site/>.

## Running it

No build step and no dependencies to install — open `index.html` in a browser.

Tailwind, the Google Fonts stylesheet and the Plausible analytics script are loaded from
CDNs, so the page needs a network connection to look right. The calculation engine itself
is inline and works offline.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app — markup, styles, and the calculation engine |
| `favicon.ico` | Tab icon |
| `og-image.jpg` | Social preview image referenced by the `og:image` meta tag |

## Engine layout

The engine lives in the single `<script>` block at the bottom of `index.html`, split into
labelled sections:

- **Domain constants** — bay sizes (`BAY`), deck widths (`WIDTH_SPEC`), per-component
  weights in kg (`WEIGHTS`), standard colours (`STD_CLR`).
- **State** — `runs`, an array of `{ bays, settings }`. Each run holds an ordered list of
  bay / gap / break items plus its own configuration, so settings can differ per run.
- **Geometry** — jack extension and standard stacking (`calcPhysics`, `calcStdStack`),
  ledger ring levels (`getRingLevels`), stair tread mix (`calcTreads`).
- **Bill of quantities** — `calcRunGear` takes off one run, `calcTotalGear` sums all runs
  and applies the optional spares uplift, `calcWeightKg` converts to weight.
- **User actions** — the handlers wired to the buttons and selects.
- **Render** — `renderPlan`, `renderElevation`, `renderGearList`, `renderMetrics`.

`render()` recomputes everything from `runs` on every change; there is no incremental
update path, so state changes only need to mutate `runs` and call `render()`.

## Calculation assumptions

These are the rules currently baked into the engine. They are estimates and are worth
checking against your own yard's practice.

- **Boarded lifts** can be set from 1 to 20. The ceiling is the `MAX_LIFTS` constant in the
  engine; the dropdown is generated from it at boot, so raising it is a one-line change.
- **Base offset** is a fixed 0.3 m. The standard column is the largest 0.5 m multiple that
  fits below the target deck height, and the jack takes up the remainder — so jack
  extension is always under 0.5 m.
- **Step-down bracket** is Double when ground-to-first-standard exceeds 0.4 m, otherwise
  Single.
- **Ledger rings** sit at 2.0 m spacing, with an extra ring at the top of the standard
  column if that does not land on a 2.0 m multiple.
- **Bracing** is one dogleg pair per 4 m of height, and one face brace per 4 bays per
  bracing level.
- **Tie bars** are only added for 2-board and 3-board hop-ups, at one per bay per 2 m.
- **Standards** are stacked greedily from the largest enabled size down, so unchecking
  sizes in *Available Standards* changes the mix.
- **Spares** (when enabled) add 5% to base jacks, sole boards, clips, couplers and tubes
  only — not to structural members.
- **Strip time** assumes 4 m² per scaffolder per hour. **RONIN strip time** assumes
  0.25 hours per ledger ring per scaffolder.
- **Piggyback bays** share the outer standards of the main run as their inner legs, so
  they add an outer standard row, transoms, ledgers and planks, but no second inner row.

## Save / load

*Save* downloads the `runs` array as JSON; *Load* reads it back. The file is the raw state
array with no version field, so changing the shape of `runs` will break previously saved
projects.
