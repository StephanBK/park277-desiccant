# HANDOVER: 277 Park cavity fog outlook

Last session: 2026-09-23 (session 1). State: v1.0.0 built, tested
end-to-end against the patched engine running locally; not yet deployed.

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

- Palette: night glass #0a1622, pane #102231, teal #26aebf (working),
  mist #ecf4f7 (fog). Archivo variable, self-hosted; wide cut for headings.
- Fog opacity 0.52 + 0.053 x level; teal 0.12 + 0.34 x remaining capacity.
- Runs of 3+ quiet years fold into one band (tested; rare with 8 lb max).
- Class names: header is `.top`; calendar lanes are `.lane-top` /
  `.lane-bottom` (a shared `.top` once inflated the lanes).

## Open items

- Desorption / cold-capacity decision (above).
- U per glass from WINDOW when available (shared/scenario.js, one line each,
  also send it: engineParams currently sends FIXED.u_ip).
- Odoo embed if wanted (the server sets X-Frame-Options SAMEORIGIN and
  frame-ancestors 'self'; loosen both for the Odoo domain).
