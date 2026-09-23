# HANDOVER: 277 Park cavity fog outlook

Last session: 2026-09-23 (session 1, two passes). State: v1.2.0 built,
tested end-to-end against the patched engine running locally; not yet deployed.

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

## Deploy order (matters)

1. Engine first: apply `desiccant_life-fog-map.patch` to StephanBK/desiccant_life-
   (`git am`), push; Railway redeploys the engine.
2. This repo: push to INOVUES-APPS/park277-desiccant, new Railway service,
   no variables needed.
If step 2 runs before step 1, the page shows "The simulation did not run"
with the detail "engine returned no fog map": by design, not a crash.

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
  (validation, fixed inputs, echo check, cache, retry, timeout).

## Findings to carry

- The engine reads room conditions as `t_in` / `rh_in`. The Sep 16 study
  sent `rh_in_pct=30`, silently ignored: those runs used 35 % RH. This app
  checks every input against the engine's echo, so that cannot recur here.
- Default (VIG, wet-sealed both, 8 lb, 70 F / 30 %): desiccant full June 14
  of year 1 (5.4 months); first visible fog February 4 of year 2; 886 fog
  hours, a thin film (level 1 of 9, 5 to 7 um), at all hours of the day,
  mid February to early March.
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
