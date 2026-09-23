import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  calendarRows, dayToDate, fogHoursFrom, formatClock, formatDate, formatDuration, hourParts,
  levelRangeUm, levelWord, MONTH_START_DAY, remainingOnDay, summarize,
} from '../shared/story.js'
import { coalescer, LruCache } from '../server/cache.js'

const Y = 8760
const fogYear = (from, to) => '0'.repeat(from) + '1'.repeat(to - from) + '0'.repeat(Y - to)
const run = (o) => ({ lb: 8, full_hour: null, first_fog_hour: null, capped: false, hours_run: Y, max_years: 20, years: [{ fog_hours: 0, fog: null }], ...o })

// ------------------------------------------------------------ dates

test('day of year to date, TMY without leap day', () => {
  assert.deepEqual(dayToDate(0), { month: 0, day: 1 })
  assert.deepEqual(dayToDate(31), { month: 1, day: 1 })
  assert.deepEqual(dayToDate(58), { month: 1, day: 28 })
  assert.deepEqual(dayToDate(59), { month: 2, day: 1 })
  assert.deepEqual(dayToDate(364), { month: 11, day: 31 })
  assert.throws(() => dayToDate(365))
  assert.deepEqual(MONTH_START_DAY.slice(0, 3), [0, 31, 59])
})

test('hours to dates and clock', () => {
  assert.equal(formatDate(0, false), 'January 1')
  assert.equal(formatDate(Y + 33 * 24, true), 'February 3, year 2')
  assert.equal(hourParts(Y + 5).hourOfDay, 5)
  assert.equal(formatClock(0), '12 am')
  assert.equal(formatClock(6), '6 am')
  assert.equal(formatClock(12), '12 pm')
  assert.equal(formatClock(23), '11 pm')
})

test('durations use the unit a person would', () => {
  assert.equal(formatDuration(12), '12 hours')
  assert.equal(formatDuration(24 * 21.5), '22 days')
  assert.equal(formatDuration(3940), '5.4 months')
  assert.equal(formatDuration(730 * 14), '14 months')
  assert.equal(formatDuration(Y * 3.3), '3.3 years')
  assert.equal(formatDuration(Y * 2), '2 years')
  assert.equal(formatDuration(730 * 6), '6 months')
  assert.equal(formatDuration(17420), '2 years')        // 23.9 months: never "24 months"
  assert.equal(formatDuration(730 * 23.4), '23 months')
})

// ------------------------------------------------------------ summary

test('fills, then fogs in the next winter', () => {
  const r = run({ full_hour: 3940, first_fog_hour: Y + 800, hours_run: 2 * Y, years: [{ fog_hours: 0, fog: null }, { fog_hours: 100, fog: fogYear(800, 900) }] })
  const s = summarize(r)
  assert.equal(s[0], 'The desiccant keeps the cavity dry for 5.4 months, until June 14, year 1.')
  assert.equal(s[1], 'Once it is full, the pane fogs for 100 hours over the next 19 months, starting February 3, year 2.')
})

test('fills, stays clear', () => {
  const s = summarize(run({ full_hour: 3940, hours_run: 2 * Y, years: [{ fog_hours: 0, fog: null }, { fog_hours: 0, fog: null }] }))
  assert.match(s[1], /still stays clear through the 19 months shown/)
})

test('fogs before full', () => {
  const s = summarize(run({ full_hour: 2000, first_fog_hour: 10, hours_run: 2 * Y, years: [{ fog_hours: 5, fog: fogYear(10, 15) }, { fog_hours: 0, fog: null }] }))
  assert.match(s[0], /first fogs on January 1, year 1, before the desiccant is full/)
  assert.match(s[2], /5 hours over the 2 years shown/)
})

test('never fills in 20 years', () => {
  const s = summarize(run({ capped: true, hours_run: 20 * Y }))
  assert.deepEqual(s, ['The desiccant is still working after 20 years.', 'The pane stays clear.'])
})

test('no desiccant', () => {
  assert.deepEqual(summarize(run({ lb: 0 })), ['Without desiccant, the pane stays clear all year.'])
  const s = summarize(run({ lb: 0, first_fog_hour: 40 * 24, years: [{ fog_hours: 1, fog: fogYear(960, 961) }] }))
  assert.deepEqual(s, ['Without desiccant, the pane fogs for 1 hour a year, first on February 10.'])
})

test('fog hours after full count only from the fill hour', () => {
  const years = [{ fog: fogYear(0, 10), fog_hours: 10 }, { fog: fogYear(0, 20), fog_hours: 20 }]
  assert.equal(fogHoursFrom(years, 5), 25)
  assert.equal(fogHoursFrom(years, Y), 20)
  assert.equal(fogHoursFrom(years, 0), 30)
})

// ------------------------------------------------------------ calendar rows

test('short runs show every year', () => {
  const r = run({ full_hour: 3940, hours_run: 2 * Y, years: [{ fog_hours: 0 }, { fog_hours: 3 }] })
  assert.deepEqual(calendarRows(r), [{ kind: 'year', index: 0 }, { kind: 'year', index: 1 }])
})

test('a 20-year quiet life folds into first, band, last', () => {
  const r = run({ capped: true, hours_run: 20 * Y, years: Array.from({ length: 20 }, () => ({ fog_hours: 0 })) })
  assert.deepEqual(calendarRows(r), [{ kind: 'year', index: 0 }, { kind: 'band', from: 1, to: 18 }, { kind: 'year', index: 19 }])
})

test('quiet years before the fill fold; the fill year and aftermath stay', () => {
  const years = Array.from({ length: 6 }, (_, i) => ({ fog_hours: i === 5 ? 50 : 0 }))
  const r = run({ full_hour: 4 * Y + 100, hours_run: 6 * Y, years })
  assert.deepEqual(calendarRows(r), [
    { kind: 'year', index: 0 }, { kind: 'band', from: 1, to: 2 }, { kind: 'year', index: 3 },
    { kind: 'year', index: 4 }, { kind: 'year', index: 5 },
  ])
})

test('two quiet years are not folded', () => {
  const years = [{ fog_hours: 0 }, { fog_hours: 0 }, { fog_hours: 9 }]
  const r = run({ full_hour: 2 * Y + 5, hours_run: 3 * Y, years })
  assert.equal(calendarRows(r).filter((x) => x.kind === 'band').length, 0)
})

// ------------------------------------------------------------ fog scale

test('fog level ranges tile the log scale', () => {
  const sc = { visible_um: 5, max_um: 100, levels: 9 }
  const [a0, a1] = levelRangeUm(1, sc)
  assert.equal(a0, 5)
  assert.ok(Math.abs(a1 - 5 * 20 ** (1 / 9)) < 1e-9)
  assert.ok(Math.abs(levelRangeUm(9, sc)[1] - 100) < 1e-9)
  assert.equal(levelWord(1), 'Light fog')
  assert.equal(levelWord(5), 'Fog')
  assert.equal(levelWord(9), 'Heavy fog')
})

test('remaining capacity is clamped', () => {
  assert.equal(remainingOnDay(0), 1)
  assert.equal(remainingOnDay(95), 0)
  assert.equal(remainingOnDay(120), 0)
  assert.equal(remainingOnDay(undefined), 0)
})

// ------------------------------------------------------------ cache

test('LRU evicts the oldest and refreshes on read', () => {
  const c = new LruCache({ max: 2 })
  c.set('a', 1); c.set('b', 2); c.get('a'); c.set('c', 3)
  assert.equal(c.get('b'), undefined)
  assert.equal(c.get('a'), 1)
  assert.equal(c.get('c'), 3)
})

test('LRU entries expire', () => {
  let t = 0
  const c = new LruCache({ ttlMs: 10, now: () => t })
  c.set('a', 1); t = 11
  assert.equal(c.get('a'), undefined)
})

test('coalescer shares one promise and forgets it afterwards, even on failure', async () => {
  const once = coalescer()
  let n = 0
  const fn = () => new Promise((r) => setTimeout(() => r(++n), 5))
  const [a, b] = await Promise.all([once('k', fn), once('k', fn)])
  assert.equal(a, 1); assert.equal(b, 1)
  assert.equal(await once('k', fn), 2)
  await assert.rejects(once('x', async () => { throw new Error('boom') }))
  assert.equal(await once('x', async () => 7), 7)
})
