import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  calendarRows, formatClock, formatDate, HOURS_PER_YEAR, levelRangeUm, levelWord, MONTH_SHORT,
  MONTH_START_DAY, remainingOnDay,
} from '../../shared/story.js'

const DAYS = 365
const GLASS = '#102231'            // clear pane
const TEAL = [38, 174, 191]        // desiccant working
const MIST = [236, 244, 247]       // fog

function rowHeight(width, rows) {
  if (width < 520) return 3
  if (rows <= 2) return 6
  return rows <= 3 ? 5 : 4
}

/** Is the desiccant still working at global hour gh? */
function working(r, gh) {
  if (r.lb === 0) return false
  return r.full_hour === null || gh < r.full_hour
}

function drawStrip(canvas, r, yearIndex, width, rowH, progress) {
  const dpr = window.devicePixelRatio || 1
  const H = 24 * rowH
  const pw = Math.round(width * dpr)
  const ph = Math.round(H * dpr)
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph }
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = GLASS
  ctx.fillRect(0, 0, pw, ph)

  const x = (d) => Math.round((d * pw) / DAYS)
  const y = (h) => Math.round(h * rowH * dpr)
  const y0 = yearIndex * HOURS_PER_YEAR

  // Desiccant working: teal, strongest when fresh, fading as it fills.
  for (let d = 0; d < DAYS; d++) {
    const first = y0 + d * 24
    if (!working(r, first)) break
    const cut = r.full_hour === null ? 24 : Math.min(24, r.full_hour - first)
    const rem = remainingOnDay(r.daily_loading_pct[yearIndex * DAYS + d])
    const a = (0.12 + 0.34 * rem) * progress
    ctx.fillStyle = `rgba(${TEAL[0]},${TEAL[1]},${TEAL[2]},${a.toFixed(3)})`
    ctx.fillRect(x(d), 0, x(d + 1) - x(d), y(cut))
  }

  // Guides: month starts and 6 am / noon / 6 pm, barely there.
  ctx.fillStyle = 'rgba(255,255,255,0.045)'
  for (let m = 1; m < 12; m++) ctx.fillRect(x(MONTH_START_DAY[m]), 0, Math.max(1, Math.round(dpr)), ph)
  for (const h of [6, 12, 18]) ctx.fillRect(0, y(h), pw, Math.max(1, Math.round(dpr)))

  // Fog: white mist, more opaque as the film thickens.
  const fog = r.years[yearIndex].fog
  if (fog) {
    const styles = []
    for (let l = 1; l <= 9; l++) styles[l] = `rgba(${MIST[0]},${MIST[1]},${MIST[2]},${((0.52 + 0.053 * l) * progress).toFixed(3)})`
    for (let i = 0; i < fog.length; i++) {
      const l = fog.charCodeAt(i) - 48
      if (l <= 0) continue
      const d = (i / 24) | 0
      const h = i % 24
      ctx.fillStyle = styles[l]
      ctx.fillRect(x(d), y(h), x(d + 1) - x(d), y(h + 1) - y(h))
    }
  }
}

function describe(r, gh, level, multi) {
  const title = `${formatDate(gh, multi)}, ${formatClock(gh % 24)}`
  if (level > 0) {
    const [a, b] = levelRangeUm(level, r.fog_scale)
    return { title, state: `${levelWord(level, r.fog_scale.levels)}, water film about ${Math.round(a)} to ${Math.round(b)} µm`, kind: 'fog' }
  }
  if (working(r, gh)) {
    const pct = r.daily_loading_pct[Math.floor(gh / 24)]
    return { title, state: `Clear. Desiccant working, ${Math.round(pct ?? 0)} % full`, kind: 'dry' }
  }
  return { title, state: r.lb === 0 ? 'Clear' : 'Clear. Desiccant full', kind: 'clear' }
}

function Strip({ r, index, width, rowH, progress, multi, ticks }) {
  const canvas = useRef(null)
  const [hover, setHover] = useState(null)
  const y0 = index * HOURS_PER_YEAR
  const y1 = y0 + HOURS_PER_YEAR
  const H = 24 * rowH
  const year = r.years[index]

  useLayoutEffect(() => {
    if (canvas.current && width > 0) drawStrip(canvas.current, r, index, width, rowH, progress)
  }, [r, index, width, rowH, progress])

  const xOf = (gh) => (((gh - y0) / 24) / DAYS) * width
  const fullHere = r.full_hour !== null && r.lb > 0 && r.full_hour >= y0 && r.full_hour < y1
  const fogHere = r.first_fog_hour !== null && r.first_fog_hour >= y0 && r.first_fog_hour < y1

  function onMove(e) {
    const box = e.currentTarget.getBoundingClientRect()
    const d = Math.min(DAYS - 1, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * DAYS)))
    const h = Math.min(23, Math.max(0, Math.floor((e.clientY - box.top) / rowH)))
    const i = d * 24 + h
    const level = year.fog ? year.fog.charCodeAt(i) - 48 : 0
    setHover({ d, h, ...describe(r, y0 + i, level, multi) })
  }

  const label = (gh, text, cls) => {
    const x = xOf(gh)
    const right = x > width * 0.72
    return (
      <span className={`mark-label ${cls}${right ? ' right' : ''}`} style={{ left: `${x}px` }}>{text}</span>
    )
  }

  return (
    <div className="row">
      <div className="row-year">Year {index + 1}</div>
      <div className="row-ticks" aria-hidden="true" style={{ height: H }}>
        {ticks && [0, 6, 12, 18].map((h) => (
          <span key={h} style={{ top: h * rowH }}>{formatClock(h)}</span>
        ))}
      </div>
      <div className="row-main" style={{ width }}>
        <div className="lane lane-top">{fullHere && label(r.full_hour, `Desiccant full, ${formatDate(r.full_hour, false)}`, 'full')}</div>
        <div className="strip" style={{ height: H }}>
          <canvas ref={canvas} style={{ width, height: H }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}
            role="img" aria-label={`Year ${index + 1}: ${year.fog_hours} hours of fog`} />
          {fullHere && <span className="full-line" style={{ left: xOf(r.full_hour) }} />}
          {fogHere && <span className="fog-tick" style={{ left: xOf(r.first_fog_hour) }} />}
          {hover && (
            <>
              <span className="cell" style={{ left: (hover.d / DAYS) * width, top: hover.h * rowH, width: Math.max(3, width / DAYS), height: rowH }} />
              <div className={`tip ${hover.kind}${hover.d > DAYS * 0.66 ? ' flip' : ''}`}
                style={{ left: ((hover.d + 0.5) / DAYS) * width, top: hover.h * rowH }}>
                <strong>{hover.title}</strong>
                <span>{hover.state}</span>
              </div>
            </>
          )}
        </div>
        <div className="lane lane-bottom">{fogHere && label(r.first_fog_hour, `First fog, ${formatDate(r.first_fog_hour, false)}`, 'fog')}</div>
      </div>
      <div className="row-side">
        {year.fog_hours > 0
          ? <><b>{year.fog_hours.toLocaleString('en-US')}</b> hours of fog</>
          : <span className="quiet">No fog</span>}
      </div>
    </div>
  )
}

function Band({ from, to, width }) {
  return (
    <div className="row band-row">
      <div className="row-year">Years {from + 1} to {to + 1}</div>
      <div className="row-ticks" />
      <div className="band" style={{ width }}>Desiccant working all year, no fog</div>
      <div className="row-side"><span className="quiet">No fog</span></div>
    </div>
  )
}

function MonthAxis({ width }) {
  return (
    <div className="row axis-row" aria-hidden="true">
      <div className="row-year" />
      <div className="row-ticks" />
      <div className="months" style={{ width }}>
        {MONTH_SHORT.map((m, i) => <span key={m} style={{ left: (MONTH_START_DAY[i] / DAYS) * width }}>{m}</span>)}
      </div>
      <div className="row-side" />
    </div>
  )
}

/** Animation progress 0..1, restarted whenever `key` changes. */
function useDevelop(key) {
  const [p, setP] = useState(1)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setP(1); return }
    let raf
    const t0 = performance.now()
    const tick = (t) => {
      const x = Math.min(1, (t - t0) / 900)
      setP(1 - Math.pow(1 - x, 3))           // ease out: fog settles, it does not snap
      if (x < 1) raf = requestAnimationFrame(tick)
    }
    setP(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [key])
  return p
}

export default function FogCalendar({ result, runKey }) {
  const wrap = useRef(null)
  const [width, setWidth] = useState(0)
  const progress = useDevelop(runKey)

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      const side = w < 640 ? 0 : 150      // year label + hour ticks
      const right = w < 640 ? 0 : 118
      setWidth(Math.max(200, Math.floor(w - side - right)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rows = calendarRows(result)
  const rowH = rowHeight(width, rows.length)
  const multi = result.hours_run > HOURS_PER_YEAR
  let firstStrip = true

  return (
    <div className="calendar" ref={wrap}>
      {width > 0 && (
        <>
          <MonthAxis width={width} />
          {rows.map((row) => {
            if (row.kind === 'band') return <Band key={`b${row.from}`} from={row.from} to={row.to} width={width} />
            const ticks = firstStrip
            firstStrip = false
            return <Strip key={row.index} r={result} index={row.index} width={width} rowH={rowH}
              progress={progress} multi={multi} ticks={ticks} />
          })}
        </>
      )}
    </div>
  )
}
