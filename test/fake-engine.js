// A stand-in for the desiccant_life- API. It echoes inputs the way the real
// engine does (t_in -> t_in_f, rh_in -> rh_in_pct, seal keys -> numbers)
// and can be told to misbehave.

export const PRESETS = {
  version: 'fake',
  al_out: [
    { key: 'hermetic', label: 'Hermetic', al_cfm_ft2: 0.0, source: 's', estimate: true },
    { key: 'wet_sealed', label: 'Wet-sealed, continuous bead', al_cfm_ft2: 0.005, source: 's', estimate: true },
    { key: 'new_fixed', label: 'New fixed window', al_cfm_ft2: 0.06, source: 's', estimate: false },
    { key: 'resealed', label: 'Freshly resealed', al_cfm_ft2: 0.10, source: 's', estimate: true },
    { key: 'operable', label: 'Operable, in spec', al_cfm_ft2: 0.30, source: 's', estimate: false },
    { key: 'aged', label: 'Aged, worn gaskets', al_cfm_ft2: 1.0, source: 's', estimate: true },
    { key: 'baseline', label: 'AERC baseline single-pane', al_cfm_ft2: 2.0, source: 's', estimate: false },
  ],
  al_in: [
    { key: 'hermetic', label: 'Hermetic', al_cfm_ft2: 0.0, source: 's', estimate: true },
    { key: 'wet_sealed', label: 'Wet-sealed, continuous bead', al_cfm_ft2: 0.005, source: 's', estimate: true },
    { key: 'gasketed', label: 'Well-gasketed fixed insert', al_cfm_ft2: 0.01, source: 's', estimate: true },
    { key: 'certified_best', label: 'Best certified insert', al_cfm_ft2: 0.06, source: 's', estimate: false },
    { key: 'certified_typical', label: 'Typical certified insert', al_cfm_ft2: 0.30, source: 's', estimate: true },
    { key: 'vented', label: 'Deliberate vent slots', al_cfm_ft2: 2.0, source: 's', estimate: true },
  ],
}

const RENAME = { t_in: 't_in_f', rh_in: 'rh_in_pct' }
const BOOL = new Set(['desorption', 'weekdays_only'])
const STRING = new Set(['address', 'orientation', 'desiccant', 'sealant_out', 'sealant_in'])

function lifetimePayload(q, opts) {
  const inputs = {}
  for (const [k, v] of q.entries()) {
    if (['trace', 'fog_map', 'years_after_full'].includes(k)) continue
    if (opts.ignore?.includes(k)) continue
    let val = STRING.has(k) ? v : BOOL.has(k) ? v === 'true' : Number(v)
    if (k === 'al_out' || k === 'al_in') val = PRESETS[k].find((p) => p.key === v).al_cfm_ft2
    inputs[RENAME[k] || k] = val
  }
  // What the real engine falls back to when a parameter is not sent.
  if (inputs.rh_in_pct === undefined) inputs.rh_in_pct = 35
  const years = opts.years ?? 2
  const fogYear = '0'.repeat(8000) + '1'.repeat(760)
  const payload = {
    version: '0.1.0',
    inputs,
    weather: { source: 'NSRDB TMY (fake)' },
    headline: {
      exhausted_hour: 3940, first_visible_hour: 8760 + 8000, capped: false,
      hours_run: years * 8760, years_run: years,
    },
    years: Array.from({ length: years }, (_, i) => ({ year: i + 1, hours_visible: i === years - 1 ? 760 : 0 })),
    daily: { loading: Array.from({ length: years * 365 }, (_, d) => Math.min(0.21, d * 0.002)) },
    q_max_25: 0.21,
  }
  if (q.get('fog_map') === 'true' && !opts.noFog) {
    payload.fog = {
      years: Array.from({ length: years }, (_, i) => (i === years - 1 ? fogYear : null)),
      levels: 9, scale: 'log', visible_um: 5, max_um: 100,
      years_after_full: Number(q.get('years_after_full') || 0),
    }
  }
  return payload
}

function response(status, body) {
  return { status, json: async () => body }
}

/**
 * fetch-compatible fake. opts:
 *   ignore: [param]    engine silently ignores these (like rh_in_pct)
 *   noFog: true        engine predates the fog-map API
 *   failFirst: n       first n lifetime calls answer 503
 *   down: true         every call throws (network error)
 *   hang: true         lifetime calls never answer (until aborted)
 */
export function fakeEngine(opts = {}) {
  const calls = { presets: 0, lifetime: 0, urls: [] }
  async function fetchImpl(url, init = {}) {
    const u = new URL(url)
    calls.urls.push(u)
    if (opts.down) throw new TypeError('fetch failed')
    if (u.pathname === '/api/presets') { calls.presets++; return response(200, PRESETS) }
    if (u.pathname === '/api/lifetime') {
      calls.lifetime++
      if (opts.hang) {
        return new Promise((_, reject) => init.signal?.addEventListener('abort', () => {
          const e = new Error('aborted'); e.name = 'AbortError'; reject(e)
        }))
      }
      if (opts.failFirst && calls.lifetime <= opts.failFirst) return response(503, { error: 'busy' })
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs))
      return response(200, lifetimePayload(u.searchParams, opts))
    }
    return response(404, { error: 'not found' })
  }
  return { fetchImpl, calls }
}
