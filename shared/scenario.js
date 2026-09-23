// The 277 Park scenario: every control, range and fixed engine input lives
// here, once. The server imports it to validate requests and build engine
// calls; the web page imports it to draw the controls. Change it here only.

export const APP_VERSION = '1.0.0'

// Engine: INOVUES desiccant lifetime simulator (StephanBK/desiccant_life-).
// Needs the 2026-09-23 fog-map API (fog_map, years_after_full).
export const ENGINE_DEFAULT_URL = 'https://web-production-3950a.up.railway.app'

export const GRAMS_PER_LB = 453.59237

// Retrofit glass options. f_cold is the temperature factor of the cavity
// side of the EXISTING pane with that retrofit behind it (WINDOW, used in
// the 2026-09-16 study). U is held at 0.16 for all three for now.
export const GLASSES = [
  { key: 'single', label: 'Single pane', f_cold: 0.068, tip: 'Single pane retrofit glass. Cavity-side temperature factor f = 0.068.' },
  { key: 'double', label: 'Double pane', f_cold: 0.040, tip: 'Double pane retrofit glass. Cavity-side temperature factor f = 0.040.' },
  { key: 'vig', label: 'VIG', f_cold: 0.014, tip: 'Vacuum insulated glass. Insulates best, so the old pane in front of it runs coldest: f = 0.014.' },
]

// Seal ladders, tightest first. Keys are the engine's preset keys; the
// leakage numbers come from the engine (/api/presets), not from here.
// "Hermetic" is deliberately absent: not reachable with a field seal.
export const SEALS_EXISTING = [
  { key: 'wet_sealed', label: 'Wet-sealed' },
  { key: 'new_fixed', label: 'New fixed window' },
  { key: 'resealed', label: 'Freshly resealed' },
  { key: 'operable', label: 'Operable, in spec' },
  { key: 'aged', label: 'Aged gaskets' },
  { key: 'baseline', label: 'Unsealed baseline' },
]
export const SEALS_RETROFIT = [
  { key: 'wet_sealed', label: 'Wet-sealed' },
  { key: 'gasketed', label: 'Well-gasketed' },
  { key: 'certified_best', label: 'Best certified insert' },
  { key: 'certified_typical', label: 'Typical certified insert' },
  { key: 'vented', label: 'Vent slots' },
]

export const RANGES = {
  lb: { min: 0, max: 8, step: 1 },
  t: { min: 60, max: 80, step: 1 },
  rh: { min: 10, max: 60, step: 1 },
}

export const DEFAULTS = { glass: 'vig', seal_out: 'wet_sealed', seal_in: 'wet_sealed', lb: 8, t: 70, rh: 30 }

// Every hidden engine input is pinned explicitly (not left to engine
// defaults), so an engine default change cannot move these results, and
// every one of them is checked against the engine's echo.
export const FIXED = {
  address: '277 Park Avenue, New York, NY 10172',
  orientation: 'north',
  width_in: 60, height_in: 96, offset_in: 0.6,
  u_ip: 0.16, r_ip: 0.97,
  desiccant: 'ms3a',
  desorption: true,
  absorptance: 0.1,
  floors: 50, window_floor: 25,
  p_occ_pa: 5, p_unocc_pa: 0, occ_start_h: 7, occ_end_h: 19, weekdays_only: true,
  sealant_out: 'silicone', sealant_in: 'silicone',
  max_years: 20,
}
// Whole years simulated after the desiccant fills, so the first winter
// with a full desiccant is always in the picture.
export const YEARS_AFTER_FULL = 1

// Plain-language list of what is fixed, for the assumptions drawer.
export const FIXED_DESCRIPTION = [
  ['Building', '277 Park Avenue, New York. North facade, window on floor 25 of 50.'],
  ['Window', '60 × 96 in, 0.6 in cavity between the existing pane and the retrofit.'],
  ['Weather', 'Typical meteorological year for the site (NREL NSRDB), repeated every year.'],
  ['Start', 'Installation on January 1 with a fresh desiccant.'],
  ['Desiccant', '3A molecular sieve. It can release water again when warm (desorption on).'],
  ['Sealant', 'Silicone beads on both layers; water vapour slowly diffuses through them.'],
  ['Building pressure', '+5 Pa on weekdays 7 am to 7 pm, 0 Pa otherwise, plus stack and wind.'],
]

export const ASSUMPTIONS = [
  'Fog means a water film thicker than 5 µm on the cavity side of the existing pane. That visibility threshold is an estimate; no optical measurement exists yet.',
  '"Wet-sealed" is the ASTM E283 detection floor (0.005 cfm/ft² at 75 Pa), not a measurement of an installed INOVUES seal. A pressure test on an installed cavity would replace it.',
  'Once nearly full, the desiccant holds the cavity near its own equilibrium humidity and can release stored water. The engine gives 3A no extra capacity below 25 °C; real 3A holds a few percent more when cold, which would make this release, and the fog it causes, smaller. Fog shown after the desiccant is full should be read with this in mind.',
  'The three glasses differ by their cavity-side temperature factor only; the assembly U-value is held at 0.16 for all three.',
  '"Desiccant full" means 95 % of its capacity at 25 °C.',
  'The same typical weather year repeats; no climate trend or unusual years.',
]
