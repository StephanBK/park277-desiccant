# HANDOVER: 277 Park cavity fog outlook

Last session: 2026-09-23 (session 1). State: v1.3.0. Repo
StephanBK/park277-desiccant (Stephan's personal account, not INOVUES-APPS),
local clone ~/Documents/park277-desiccant. v1.2.0 deployed on Railway and
working against the live engine; v1.3.0 delivered as a patch.

## Deploy order (matters)

1. Engine first: desiccant_life- needs the fog-map API (applied and pushed
   2026-09-23, main 0d79ef6, live).
2. This repo: Railway service from StephanBK/park277-desiccant, no
   variables needed.
If the engine lacks the fog map, the page shows "The simulation did not
run" with the detail "engine returned no fog map": by design, not a crash.

## v1.3.0 (same day): fair per-year numbers, location check

- Stephan asked why 4 lb showed more fog (1,732 h) than no desiccant
  (1,336 h). Mostly an unfair comparison in the app: 0 lb ran one year, and
  year 1 is a start-up year (clean pane, fresh cavity air). Live, VIG,
  wet-sealed both, 70 F / 30 %, typical (second) winter:
    no desiccant                    1,564 h
    4 lb full, desorption off       1,625 h   (+61, +3.9 %)
    4 lb full, desorption on        1,732 h   (+168; desorption = 107 of it)
  The +61 h with desorption off is not physical (a full sieve that cannot
  release water cannot add fog): suspected difference between the engine's
  with-desiccant and without-desiccant solver paths. Under investigation.
- Now: 0 lb runs 2 years; the third box, the sentence and the drawing chip
  all use fog in ONE year = the last simulated year (story.js fogPerYear).
- Server checks the engine's geocoded location: matched address must contain
  10172 and lie within 0.01 deg of 40.7555, -73.975 (scenario.js
  EXPECTED_SITE). "277 Park Avenue, New York, NY" without the ZIP geocodes
  to 277 Park Avenue, Brooklyn 11205; the old desiccant app's default
  address has no ZIP, so its first-load scenario uses Brooklyn weather
  (fix proposed for desiccant_life-).
- Numbers I showed during the build (5.4 months, 886 h, February 4) came
  from the engine's test weather file, which has no wind direction (the
  engine then treats every windy hour as windward). Live default (8 lb):
  full after 8.4 months (September 14, year 1), first fog January 23,
  year 2, 1,738 h in year 2. Same NSRDB cell (station 1245244).

## v1.2.0 (same day): result boxes on top

- Stephan: make the callouts on top more pronounced, in a box. The answer
  sentence became three boxes (shared/story.js headlineCards, tested for
  every case): desiccant life (teal), first visible fog (amber), fog hours
  once full (amber); boxes turn neutral grey when there is no fog. The
  sentence stays as a screen-reader live region. Stephan: "overall we are
  moving in the right direction".

## v1.1.0 (same day): cavity in the middle, light theme

- Stephan asked for the cavity in the middle with the values set left and
  right of it, and a light theme.
- Layout: answer sentence on top; then [existing window seal | live cavity
  section | retrofit seal + room temperature + RH]; glass and desiccant
  directly under the drawing; fog calendar full width below.
- web/src/Cavity.jsx: SVG section, not to scale. Outside, existing pane,
  cavity with the desiccant cartridge (height follows lb), retrofit glass by
  type (VIG with pillars), seal beads (solid = wet-sealed, dashed + air
  arrows for leakier rungs, more arrows further down the ladder), room
  T/RH/dew point, and result chips (dry for X, fog hours once full), fog
  band and droplets on the pane when the run fogs.
- Light theme: fog is amber (#d9731c) because white mist does not show on
  a light page; teal (#138fa3) still means desiccant working.

## Decisions (Stephan, 2026-09-23)

- Controls: glass (Single 0.068, Double 0.040, VIG 0.014 cavity-side f),
  existing-window seal ladder and retrofit seal ladder (engine presets,
  hermetic removed on both), desiccant 0 to 8 lb in 1 lb steps (default 8),
  room 60 to 80 F (70), RH 10 to 60 % (30).
- U held at 0.16 for all three glasses "for now".
- Desorption ON.
- Visual: fog calendar per year (days across, hours down), teal while the
  desiccant works, white mist for fog, one year simulated after the fill.
- Dark, cinematic look. One assumptions drawer, closed by default.
- Architecture: frontend plus own server that proxies the engine
  (validation, fixed inputs, echo check, location check, cache, retry, timeout).

## Findings to carry

- The engine reads room conditions as `t_in` / `rh_in`. The Sep 16 study
  sent `rh_in_pct=30`, silently ignored: those runs used 35 % RH. This app
  checks every input against the engine's echo, so that cannot recur here.
- Default (VIG, wet-sealed both, 8 lb, 70 F / 30 %), LIVE weather: full
  after 8.4 months, first fog January 23 of year 2, 1,738 h in year 2. (The
  5.4 months / 886 h quoted earlier were from the test weather file.)
- That fog exists only with desorption on: the full sieve releases stored
  water. It hinges on the engine's no-extra-capacity-below-25 C rule; a few
  percent of real cold capacity would likely remove it. OPEN: Stephan to
  choose between keeping it (current, caveat in drawer), vendor isotherm
  data at 0 to 10 C, or desorption off.

## Design notes

- Palette (v1.1): page #f7f9fa, ink #13232f, clear cell #e3ecf1, teal
  #138fa3 (working), amber #d9731c (fog). Archivo variable, self-hosted;
  wide cut for headings. (v1.0 was dark: night glass with white mist.)
- Fog opacity 0.5 + 0.055 x level; teal 0.16 + 0.5 x remaining capacity.
- Runs of 3+ quiet years fold into one band (tested; rare with 8 lb max).
- Class names: header is `.masthead`; calendar lanes are `.lane-top` /
  `.lane-bottom` (a shared `.top` once inflated the lanes).

## Open items

- Desorption / cold-capacity decision (above).
- U per glass from WINDOW when available (shared/scenario.js, one line each,
  also send it: engineParams currently sends FIXED.u_ip).
- Odoo embed if wanted (the server sets X-Frame-Options SAMEORIGIN and
  frame-ancestors 'self'; loosen both for the Odoo domain).
