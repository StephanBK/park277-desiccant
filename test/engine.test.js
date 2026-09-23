import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  createEngineClient, ECHO_EXEMPT, ECHO_KEYS, engineParams, HttpError, parseScenario, scenarioKey,
} from '../server/engine.js'
import { DEFAULTS, FIXED, GLASSES, GRAMS_PER_LB, RANGES, SEALS_EXISTING, SEALS_RETROFIT } from '../shared/scenario.js'
import { fakeEngine } from './fake-engine.js'

const q = (o) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)]))
const client = (opts, extra = {}) => {
  const f = fakeEngine(opts)
  return { f, c: createEngineClient({ baseUrl: 'http://engine.test', fetchImpl: f.fetchImpl, retryDelayMs: 1, ...extra }) }
}

// ------------------------------------------------------------ validation

test('defaults parse', () => {
  assert.deepEqual(parseScenario(q(DEFAULTS)), DEFAULTS)
})

test('every control option parses', () => {
  for (const g of GLASSES) for (const o of SEALS_EXISTING) for (const i of SEALS_RETROFIT) {
    assert.equal(parseScenario(q({ ...DEFAULTS, glass: g.key, seal_out: o.key, seal_in: i.key })).glass, g.key)
  }
  for (let lb = RANGES.lb.min; lb <= RANGES.lb.max; lb++) assert.equal(parseScenario(q({ ...DEFAULTS, lb })).lb, lb)
})

test('hermetic is not accepted on either side', () => {
  assert.throws(() => parseScenario(q({ ...DEFAULTS, seal_out: 'hermetic' })), HttpError)
  assert.throws(() => parseScenario(q({ ...DEFAULTS, seal_in: 'hermetic' })), HttpError)
})

test('out of range, fractional, missing and unknown inputs are rejected with 400', () => {
  const bad = [
    { ...DEFAULTS, lb: 9 }, { ...DEFAULTS, lb: -1 }, { ...DEFAULTS, lb: '2.5' }, { ...DEFAULTS, lb: '' },
    { ...DEFAULTS, t: 59 }, { ...DEFAULTS, t: 81 }, { ...DEFAULTS, rh: 9 }, { ...DEFAULTS, rh: 61 },
    { ...DEFAULTS, rh: '30abc' }, { ...DEFAULTS, glass: 'triple' }, { ...DEFAULTS, rh_in_pct: 30 },
  ]
  for (const b of bad) {
    assert.throws(() => parseScenario(q(b)), (e) => e instanceof HttpError && e.status === 400, JSON.stringify(b))
  }
  const { lb, ...noLb } = DEFAULTS
  assert.throws(() => parseScenario(q(noLb)), (e) => e.status === 400)
})

test('cache key ignores parameter order', () => {
  const a = parseScenario(q(DEFAULTS))
  const b = parseScenario(new URLSearchParams(Object.entries(DEFAULTS).reverse().map(([k, v]) => [k, String(v)])))
  assert.equal(scenarioKey(a), scenarioKey(b))
})

// ------------------------------------------------------------ engine params

test('engine params pin every fixed input and map the controls', () => {
  const p = engineParams({ ...DEFAULTS, glass: 'double', lb: 3, t: 65, rh: 45 })
  for (const [k, v] of Object.entries(FIXED)) if (k !== 'max_years') assert.equal(p[k], v, k)
  assert.equal(p.f_cold, 0.040)
  assert.equal(p.grams, Math.round(3 * GRAMS_PER_LB * 1000) / 1000)
  assert.equal(p.t_in, 65)
  assert.equal(p.rh_in, 45)            // the name the engine actually reads
  assert.equal(p.rh_in_pct, undefined) // the name it silently ignores
  assert.equal(p.desorption, true)
  assert.equal(p.fog_map, true)
  assert.equal(p.years_after_full, 1)
  assert.equal(p.max_years, 20)
})

test('no desiccant runs one year', () => {
  assert.equal(engineParams({ ...DEFAULTS, lb: 0 }).max_years, 1)
})

test('every parameter sent to the engine is echo-checked', () => {
  const p = engineParams(DEFAULTS)
  for (const k of Object.keys(p)) assert.ok(ECHO_KEYS[k] || ECHO_EXEMPT.includes(k), `unchecked parameter ${k}`)
})

// ------------------------------------------------------------ run

test('a normal run returns the trimmed result', async () => {
  const { c, f } = client()
  const out = await c.run(DEFAULTS)
  assert.equal(out.result.full_hour, 3940)
  assert.equal(out.result.years.length, 2)
  assert.equal(out.result.years[1].fog.length, 8760)
  assert.equal(out.result.years[0].fog, null)
  assert.equal(out.result.fog_scale.levels, 9)
  assert.ok(out.result.daily_loading_pct.every((x) => x >= 0 && x <= 100.001))
  assert.equal(f.calls.lifetime, 1)
})

test('an input the engine ignores is caught by the echo check', async () => {
  const { c } = client({ ignore: ['rh_in'] })
  await assert.rejects(c.run(DEFAULTS), (e) => e.status === 502 && e.detail.some((d) => d.startsWith('rh_in')))
})

test('an ignored fixed input is caught too', async () => {
  const { c } = client({ ignore: ['window_floor'] })
  await assert.rejects(c.run(DEFAULTS), (e) => e.status === 502 && e.detail.some((d) => d.startsWith('window_floor')))
})

test('an engine without the fog map is reported as out of date', async () => {
  const { c } = client({ noFog: true })
  await assert.rejects(c.run(DEFAULTS), (e) => e.status === 502 && e.detail.some((d) => /fog map/.test(d)))
})

test('one 503 is retried and succeeds', async () => {
  const { c, f } = client({ failFirst: 1 })
  const out = await c.run(DEFAULTS)
  assert.equal(out.result.full_hour, 3940)
  assert.equal(f.calls.lifetime, 2)
})

test('two 503s give a clean 502', async () => {
  const { c, f } = client({ failFirst: 5 })
  await assert.rejects(c.run(DEFAULTS), (e) => e.status === 502)
  assert.equal(f.calls.lifetime, 2)
})

test('an unreachable engine gives a clean 502', async () => {
  const { c } = client({ down: true })
  await assert.rejects(c.run(DEFAULTS), (e) => e instanceof HttpError && e.status === 502)
})

test('a hanging engine times out with 504 and is not retried', async () => {
  const { c, f } = client({ hang: true }, { timeoutMs: 50 })
  await assert.rejects(c.run(DEFAULTS), (e) => e.status === 504)
  assert.equal(f.calls.lifetime, 1)
})

test('presets are fetched once and reused', async () => {
  const { c, f } = client()
  await c.run(DEFAULTS)
  await c.run({ ...DEFAULTS, lb: 2 })
  assert.equal(f.calls.presets, 1)
})

test('the engine URL gets exactly the parameters built here', async () => {
  const { c, f } = client()
  await c.run({ ...DEFAULTS, rh: 42 })
  const u = f.calls.urls.find((x) => x.pathname === '/api/lifetime')
  assert.equal(u.searchParams.get('rh_in'), '42')
  assert.equal(u.searchParams.get('desorption'), 'true')
  assert.equal(u.searchParams.get('al_out'), 'wet_sealed')
})
