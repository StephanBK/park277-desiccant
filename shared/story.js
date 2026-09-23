// Pure functions that turn an engine result into words and calendar rows.
// No DOM, no network: everything here is unit-tested (test/story.test.js).

export const HOURS_PER_YEAR = 8760
export const HOURS_PER_MONTH = HOURS_PER_YEAR / 12      // 730, a calendar-average month

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]   // TMY: no leap day
export const MONTH_SHORT = MONTHS.map((m) => m.slice(0, 3))
export const MONTH_START_DAY = MONTH_DAYS.reduce((acc, d, i) => { acc.push(i === 0 ? 0 : acc[i - 1] + MONTH_DAYS[i - 1]); return acc }, [])

/** Day of year (0..364) to { month (0..11), day (1..31) }. */
export function dayToDate(dayOfYear) {
  let d = dayOfYear
  for (let m = 0; m < 12; m++) {
    if (d < MONTH_DAYS[m]) return { month: m, day: d + 1 }
    d -= MONTH_DAYS[m]
  }
  throw new RangeError(`day of year out of range: ${dayOfYear}`)
}

/** Hour since installation to its parts. */
export function hourParts(h) {
  const year = Math.floor(h / HOURS_PER_YEAR) + 1
  const hoy = h % HOURS_PER_YEAR
  const doy = Math.floor(hoy / 24)
  return { year, hourOfYear: hoy, dayOfYear: doy, hourOfDay: hoy % 24, ...dayToDate(doy) }
}

/** "February 3" or "February 3, year 2" when the run spans more than one year. */
export function formatDate(h, withYear) {
  const p = hourParts(h)
  const base = `${MONTHS[p.month]} ${p.day}`
  return withYear ? `${base}, year ${p.year}` : base
}

/** "6 am", "12 pm", "12 am". */
export function formatClock(hourOfDay) {
  const h = ((hourOfDay % 24) + 24) % 24
  const suffix = h < 12 ? 'am' : 'pm'
  const twelve = h % 12 === 0 ? 12 : h % 12
  return `${twelve} ${suffix}`
}

/** A span of hours in the unit a person would use. */
export function formatDuration(hours) {
  if (hours < 48) return `${Math.round(hours)} hours`
  const days = hours / 24
  if (days < 45) return `${Math.round(days)} days`
  const months = hours / HOURS_PER_MONTH
  // Switch to years before rounding could print "24 months".
  if (months < 23.5) return `${months < 9.95 ? oneDecimal(months) : Math.round(months)} months`
  return `${oneDecimal(hours / HOURS_PER_YEAR)} years`
}

/** 5.4 -> "5.4", 6.0 -> "6". */
function oneDecimal(x) {
  const s = x.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export function formatHours(n) {
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'hour' : 'hours'}`
}

/** Fog hours in the run at or after hour h0. */
export function fogHoursFrom(years, h0) {
  let n = 0
  years.forEach((y, i) => {
    if (!y.fog) return
    const start = i * HOURS_PER_YEAR
    if (start + HOURS_PER_YEAR <= h0) return
    const from = Math.max(0, h0 - start)
    for (let k = from; k < y.fog.length; k++) if (y.fog.charCodeAt(k) !== 48) n++
  })
  return n
}

/**
 * The one-paragraph answer, as a list of sentences.
 * r: { lb, full_hour, first_fog_hour, capped, hours_run, max_years, years: [{ fog_hours, fog }] }
 */
export function summarize(r) {
  const multi = r.hours_run > HOURS_PER_YEAR
  const date = (h) => formatDate(h, multi)
  const total = r.years.reduce((s, y) => s + y.fog_hours, 0)

  if (r.lb === 0) {
    if (r.first_fog_hour === null) return ['Without desiccant, the pane stays clear all year.']
    return [`Without desiccant, the pane fogs for ${formatHours(total)} a year, first on ${formatDate(r.first_fog_hour, false)}.`]
  }

  const full = r.full_hour
  const fog = r.first_fog_hour
  const life = full === null
    ? `The desiccant is still working after ${r.max_years} years.`
    : `The desiccant keeps the cavity dry for ${formatDuration(full)}, until ${date(full)}.`

  if (fog !== null && (full === null || fog < full)) {
    return [`The pane first fogs on ${date(fog)}, before the desiccant is full.`, life,
      `In total the pane fogs for ${formatHours(total)} over the ${formatDuration(r.hours_run)} shown.`]
  }
  if (full === null) return [life, 'The pane stays clear.']
  const after = r.hours_run - full
  if (fog === null) return [life, `After that the pane still stays clear through the ${formatDuration(after)} shown.`]
  return [life, `Once it is full, the pane fogs for ${formatHours(fogHoursFrom(r.years, full))} over the next ${formatDuration(after)}, starting ${date(fog)}.`]
}

/**
 * Calendar rows. Runs of 3+ "quiet" years (desiccant working all year, no
 * fog) keep their first and last year as strips and fold the middle into
 * one band, so a 20-year life does not become 20 identical strips.
 */
export function calendarRows(r) {
  const n = r.years.length
  const quiet = r.years.map((y, i) => y.fog_hours === 0 && r.lb > 0 &&
    (r.full_hour === null || (i + 1) * HOURS_PER_YEAR <= r.full_hour))
  const rows = []
  let i = 0
  while (i < n) {
    if (!quiet[i]) { rows.push({ kind: 'year', index: i }); i++; continue }
    let j = i
    while (j + 1 < n && quiet[j + 1]) j++
    const len = j - i + 1
    if (len >= 3) {
      rows.push({ kind: 'year', index: i })
      rows.push({ kind: 'band', from: i + 1, to: j - 1 })
      rows.push({ kind: 'year', index: j })
    } else {
      for (let k = i; k <= j; k++) rows.push({ kind: 'year', index: k })
    }
    i = j + 1
  }
  return rows
}

/** Film thickness range of a fog level, µm, on the engine's log scale. */
export function levelRangeUm(level, scale) {
  const { visible_um: lo, max_um: hi, levels } = scale
  const at = (x) => lo * Math.pow(hi / lo, x / levels)
  return [at(level - 1), at(level)]
}

export function levelWord(level, levels = 9) {
  if (level <= levels / 3) return 'Light fog'
  if (level <= (2 * levels) / 3) return 'Fog'
  return 'Heavy fog'
}

/** Remaining desiccant capacity 0..1 on a given day (for the teal tint). */
export function remainingOnDay(loadingPct, fullPct = 95) {
  if (loadingPct === undefined || loadingPct === null) return 0
  return Math.max(0, Math.min(1, 1 - loadingPct / fullPct))
}

/**
 * The three result boxes at the top of the page:
 *   1. how long the desiccant keeps the cavity dry   (teal)
 *   2. first visible fog                             (amber, or neutral if none)
 *   3. how much fog                                  (amber, or neutral if none)
 * Each: { key, tone: 'dry' | 'fog' | 'none', label, value, detail }.
 */
export function headlineCards(r) {
  const multi = r.hours_run > HOURS_PER_YEAR
  const total = r.years.reduce((s, y) => s + y.fog_hours, 0)
  const fog = r.first_fog_hour
  const full = r.full_hour
  const yearOf = (h) => `Year ${hourParts(h).year}`

  // 1. Desiccant life
  let life
  if (r.lb === 0) life = { tone: 'none', label: 'Desiccant', value: 'None', detail: 'Seals and room air alone' }
  else if (full === null) life = { tone: 'dry', label: 'Desiccant keeps the cavity dry for', value: `${r.max_years}+ years`, detail: 'Still working at the end of the run' }
  else life = { tone: 'dry', label: 'Desiccant keeps the cavity dry for', value: formatDuration(full), detail: `Full on ${formatDate(full, multi)}` }

  // 2. First visible fog
  let first
  if (fog === null) {
    first = { tone: 'none', label: 'First visible fog', value: 'None', detail: r.lb === 0 ? 'Clear all year' : `Clear through the ${formatDuration(r.hours_run)} shown` }
  } else {
    let when
    if (r.lb === 0) when = 'Without desiccant'
    else if (full === null || fog < full) when = `${multi ? `${yearOf(fog)}, b` : 'B'}efore the desiccant is full`
    else when = `${multi ? `${yearOf(fog)}, a` : 'A'}fter the desiccant is full`
    first = { tone: 'fog', label: 'First visible fog', value: formatDate(fog, false), detail: when }
  }

  // 3. Amount of fog
  let amount
  if (r.lb === 0) {
    amount = { tone: total ? 'fog' : 'none', label: 'Fog in a year', value: formatHours(total), detail: total ? 'Hours with a visible film' : 'The pane stays clear' }
  } else if (full !== null && (fog === null || fog >= full)) {
    const after = fogHoursFrom(r.years, full)
    amount = { tone: after ? 'fog' : 'none', label: 'Fog once the desiccant is full', value: formatHours(after), detail: `Over the next ${formatDuration(r.hours_run - full)}` }
  } else {
    amount = { tone: total ? 'fog' : 'none', label: 'Fog in the run', value: formatHours(total), detail: `Over the ${formatDuration(r.hours_run)} shown` }
  }

  return [{ key: 'life', ...life }, { key: 'first', ...first }, { key: 'amount', ...amount }]
}
