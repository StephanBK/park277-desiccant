import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  calendarRows, desiccantStatus, formatDate, formatDays, HOURS_PER_YEAR, isWorkingHour, levelRangeUm, levelWord,
  MONTH_SHORT, MONTH_START_DAY, remainingOnDay, yearStats,
} from '../../shared/story.js'
import { WORKING_HOURS } from '../../shared/scenario.js'

// One panel per year: a stat row, then a grid of 365 x 24 cells (columns are
// days, rows are hours, 00:00 at the top), each cell one hour.
const DAYS = 365
const ROW = 5                         // css px per hour row: 4 px cell + 1 px gap
const CLEAR = [231, 235, 238]         // no fog
const EXCLUDED = [246, 247, 248]      // off hours, not counted (working-hours view)
const DRY_FRESH = [120, 196, 207]     // desiccant working, fresh
const DRY_SPENT = [205, 234, 238]     // desiccant working, nearly full
const FOG_LIGHT = [150, 180, 228]     // fog, thinnest visible film
const FOG_HEAVY = [22, 58, 124]       // fog, film at the 100 um cap

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`
export const fogColor = (level) => rgb(mix(FOG_LIGHT, FOG_HEAVY, (level - 1) / 8))

const clock = (h) => `${String(h).padStart(2, '0')}:00`

function working(r, gh) {
  if (r.lb === 0) return false
  return r.full_hour === null || gh < r.full_hour
}

function drawYear(canvas, r, yi, width, progress, workingOnly) {
  const dpr = window.devicePixelRatio || 1
  const H = 24 * ROW
  const pw = Math.round(width * dpr)
  const ph = Math.round(H * dpr)
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph }
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, pw, ph)
  // Gaps between cells, as in a printed matrix; dropped horizontally when a
  // day is under 3 device px wide (phones), or the gaps would hide the cells.
  const gapX = pw / DAYS >= 3 ? Math.max(1, Math.round(dpr * 0.75)) : 0
  const gapY = Math.max(1, Math.round(dpr))
  const xs = Array.from({ length: DAYS + 1 }, (_, d) => Math.round((d * pw) / DAYS))
  const ys = Array.from({ length: 25 }, (_, h) => Math.round(h * ROW * dpr))
  const y0 = yi * HOURS_PER_YEAR
  const fog = r.years[yi].fog
  const clear = rgb(CLEAR)
  const excluded = rgb(EXCLUDED)
  const fogStyles = [null]
  for (let l = 1; l <= 9; l++) fogStyles[l] = fogColor(l)

  for (let d = 0; d < DAYS; d++) {
    const w = Math.max(1, xs[d + 1] - xs[d] - gapX)
    const rem = remainingOnDay(r.daily_loading_pct[yi * DAYS + d])
    const dry = rgb(mix(DRY_SPENT, DRY_FRESH, rem))
    for (let h = 0; h < 24; h++) {
      const i = d * 24 + h
      const l = fog ? fog.charCodeAt(i) - 48 : 0
      const hgt = ys[h + 1] - ys[h] - gapY
      if (workingOnly && !isWorkingHour(i)) {          // off hours: faded out, not counted
        ctx.fillStyle = excluded
        ctx.fillRect(xs[d], ys[h], w, hgt)
        continue
      }
      // base: clear or desiccant working
      ctx.fillStyle = working(r, y0 + i) ? dry : clear
      ctx.fillRect(xs[d], ys[h], w, hgt)
      if (l > 0) {
        ctx.globalAlpha = progress
        ctx.fillStyle = fogStyles[l]
        ctx.fillRect(xs[d], ys[h], w, hgt)
        ctx.globalAlpha = 1
      }
    }
  }
}

function describe(r, gh, level, multi, workingOnly) {
  const d = describeHour(r, gh, level, multi)
  if (workingOnly && !isWorkingHour(gh % HOURS_PER_YEAR)) return { ...d, state: `Off hours, not counted. ${d.state}`, kind: 'clear' }
  return d
}

function describeHour(r, gh, level, multi) {
  const h = gh % 24
  const title = `${formatDate(gh, multi)}, ${clock(h)} to ${clock((h + 1) % 24)}`
  if (level > 0) {
    const [a, b] = levelRangeUm(level, r.fog_scale)
    return { title, state: `${levelWord(level, r.fog_scale.levels)}, water film about ${Math.round(a)} to ${Math.round(b)} µm`, kind: 'fog' }
  }
  if (working(r, gh)) {
    const pct = r.daily_loading_pct[Math.floor(gh / 24)]
    return { title, state: `No fog. Desiccant working, ${Math.round(pct ?? 0)} % full`, kind: 'dry' }
  }
  return { title, state: r.lb === 0 ? 'No fog' : 'No fog. Desiccant full', kind: 'clear' }
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className={`ystat ${tone || ''}`}>
      <span className="ystat-label">{label}</span>
      <span className="ystat-value">{value}</span>
      <span className="ystat-sub">{sub}</span>
    </div>
  )
}

function YearPanel({ r, index, width, progress, multi, workingOnly }) {
  const canvas = useRef(null)
  const [hover, setHover] = useState(null)
  const y0 = index * HOURS_PER_YEAR
  const y1 = y0 + HOURS_PER_YEAR
  const H = 24 * ROW
  const year = r.years[index]
  const st = yearStats(year.fog, workingOnly)
  const poolH = workingOnly ? WORKING_HOURS.hours : HOURS_PER_YEAR
  const poolD = workingOnly ? WORKING_HOURS.days : DAYS
  const des = desiccantStatus(r, index)

  useLayoutEffect(() => {
    if (canvas.current && width > 0) drawYear(canvas.current, r, index, width, progress, workingOnly)
  }, [r, index, width, progress, workingOnly])

  const xOf = (gh) => (((gh - y0) / 24) / DAYS) * width
  const fullHere = r.lb > 0 && r.full_hour !== null && r.full_hour >= y0 && r.full_hour < y1
  const fogHere = r.first_fog_hour !== null && r.first_fog_hour >= y0 && r.first_fog_hour < y1

  function onMove(e) {
    const box = e.currentTarget.getBoundingClientRect()
    const d = Math.min(DAYS - 1, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * DAYS)))
    const h = Math.min(23, Math.max(0, Math.floor((e.clientY - box.top) / ROW)))
    const i = d * 24 + h
    const level = year.fog ? year.fog.charCodeAt(i) - 48 : 0
    setHover({ d, h, ...describe(r, y0 + i, level, multi, workingOnly) })
  }

  const marks = []
  if (fullHere) marks.push({ key: 'full', x: xOf(r.full_hour), text: `Desiccant full, ${formatDate(r.full_hour, false)}` })
  if (fogHere) marks.push({ key: 'fog', x: xOf(r.first_fog_hour), text: `First fog, ${formatDate(r.first_fog_hour, false)}` })

  return (
    <section className="ypanel" aria-label={`Year ${index + 1}`}>
      <header className="ypanel-head">
        <h3><span className="ynum">{String(index + 1).padStart(2, '0')}</span>Year {index + 1}</h3>
      </header>
      <div className="ystats">
        <Stat label={workingOnly ? 'Fog hours, working' : 'Fog hours'} value={st.hours.toLocaleString('en-US')}
          sub={`${((100 * st.hours) / poolH).toFixed(1)} % of ${poolH.toLocaleString('en-US')} ${workingOnly ? 'working hours' : 'hours'}`} tone={st.hours ? 'fog' : ''} />
        <Stat label={workingOnly ? 'Working days with fog' : 'Days with fog'} value={st.days}
          sub={`${((100 * st.days) / poolD).toFixed(1)} % of ${workingOnly ? `${poolD} working days` : 'the year'}`} tone={st.days ? 'fog' : ''} />
        <Stat label="Fog events" value={st.events} sub={st.events ? `avg ${Math.round(st.hours / st.events)} h each` : 'none'} />
        <Stat label="Longest event" value={st.longest ? `${st.longest.toLocaleString('en-US')} h` : '0 h'}
          sub={workingOnly ? 'within one working day' : st.longest >= 48 ? `about ${formatDays(st.longest)}` : 'unbroken fog'} />
        <Stat label="Desiccant" value={des.value} sub={des.sub} tone={des.value === 'Working' ? 'dry' : ''} />
      </div>
      <div className="ygrid">
        <div className="yhours" aria-hidden="true" style={{ height: H }}>
          {[0, 6, 12, 18].map((h) => <span key={h} style={{ top: h * ROW + ROW / 2 }}>{clock(h)}</span>)}
        </div>
        <div className="ymain" style={{ width }}>
          <div className="ymonths" aria-hidden="true">
            {MONTH_SHORT.map((m, i) => (
              <span key={m} style={{ left: (MONTH_START_DAY[i] / DAYS) * width }}>{width < 520 ? m[0] : m.toUpperCase()}</span>
            ))}
          </div>
          <div className="ycanvas" style={{ height: H }}>
            <canvas ref={canvas} style={{ width, height: H }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}
              role="img" aria-label={`Year ${index + 1}: ${st.hours} fog hours on ${st.days} days${workingOnly ? ', working hours only' : ''}`} />
            {fullHere && <span className="yline full" style={{ left: xOf(r.full_hour) }} />}
            {hover && (
              <>
                <span className="ycell" style={{ left: (hover.d / DAYS) * width - 1, top: hover.h * ROW - 1, width: width / DAYS + 1, height: ROW + 1 }} />
                <div className={`tip ${hover.kind}${hover.d > DAYS * 0.66 ? ' flip' : ''}`}
                  style={{ left: ((hover.d + 0.5) / DAYS) * width, top: hover.h * ROW }}>
                  <strong>{hover.title}</strong>
                  <span>{hover.state}</span>
                </div>
              </>
            )}
          </div>
          {marks.length > 0 && (
            <div className="ymarks" style={{ height: marks.length * 20 + 4 }}>
              {marks.map((m, k) => (
                // flip to the left of its line when the label (about 6.6 px per
                // character at 12 px) would run past the grid's right edge
                <span key={m.key} className={`ymark ${m.key}${m.x + m.text.length * 6.6 + 12 > width ? ' right' : ''}`} style={{ left: m.x, top: k * 20 + 4 }}>{m.text}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Band({ from, to }) {
  return (
    <div className="yband">
      <span className="ynum">{String(from + 1).padStart(2, '0')}</span>
      Years {from + 1} to {to + 1}: desiccant working all year, no fog
    </div>
  )
}

/** Animation progress 0..1, restarted whenever `key` changes. */
function useDevelop(key) {
  const [p, setP] = useState(1)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setP(1); return undefined }
    let raf
    const t0 = performance.now()
    const tick = (t) => {
      const x = Math.min(1, (t - t0) / 900)
      setP(1 - Math.pow(1 - x, 3))
      if (x < 1) raf = requestAnimationFrame(tick)
    }
    setP(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [key])
  return p
}

export function Legend({ working = false }) {
  return (
    <div className="ylegend">
      <span className="key"><i className="sq dry" />Desiccant working (fades as it fills)</span>
      <span className="key"><i className="sq clear" />No fog</span>
      {working && <span className="key"><i className="sq excluded" />Off hours, not counted</span>}
      <span className="key">
        {[1, 5, 9].map((l) => <i key={l} className="sq" style={{ background: fogColor(l) }} />)}
        Fog, light to heavy
      </span>
      <p className="legend-note">
        Each cell is one hour: columns are days, rows are hours of the day, 00:00 at the top. Year 1 starts with installation on January 1. Hover any cell for details.
      </p>
    </div>
  )
}

export default function FogCalendar({ result, runKey, working = false }) {
  const wrap = useRef(null)
  const [width, setWidth] = useState(0)
  const progress = useDevelop(runKey)

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return undefined
    const measure = () => {
      const w = el.getBoundingClientRect().width
      const narrow = w < 640
      const hoursCol = narrow ? 38 : 52
      const pad = narrow ? 12 : 20                                      // matches .ypanel padding
      setWidth(Math.max(200, Math.floor(w - hoursCol - 2 * pad - 2)))   // minus padding and border
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rows = calendarRows(result)
  const multi = result.hours_run > HOURS_PER_YEAR
  return (
    <div className="calendar" ref={wrap}>
      {width > 0 && rows.map((row) => (row.kind === 'band'
        ? <Band key={`b${row.from}`} from={row.from} to={row.to} />
        : <YearPanel key={row.index} r={result} index={row.index} width={width} progress={progress} multi={multi} workingOnly={working} />))}
    </div>
  )
}
