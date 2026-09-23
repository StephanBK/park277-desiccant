import { useCallback, useEffect, useRef, useState } from 'react'
import { summarize } from '../../shared/story.js'
import { fetchConfig, peek, queryOf, readUrlScenario, runScenario, writeUrlScenario } from './api.js'
import Assumptions from './Assumptions.jsx'
import Controls from './Controls.jsx'
import FogCalendar from './FogCalendar.jsx'

function Legend() {
  return (
    <div className="legend">
      <span className="key"><i className="sw dry" />Desiccant working, fading as it fills</span>
      <span className="key"><i className="sw clear" />Clear</span>
      <span className="key"><i className="sw fog" />Fog, light to heavy</span>
      <p className="legend-note">
        Each column is a day, each row an hour of that day, midnight at the top. Year 1 starts with installation on January 1.
        Hover the calendar for any hour.
      </p>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      <div className="sk-line wide" />
      <div className="sk-line" />
      <div className="sk-strip" />
      <div className="sk-strip" />
    </div>
  )
}

function ErrorPanel({ error, onRetry }) {
  const detail = Array.isArray(error.detail) ? error.detail : error.detail ? [String(typeof error.detail === 'object' ? JSON.stringify(error.detail) : error.detail)] : []
  return (
    <div className="error" role="alert">
      <h2>The simulation did not run</h2>
      <p>{error.message}</p>
      {detail.length > 0 && (
        <details>
          <summary>Details for INOVUES</summary>
          <ul>{detail.map((d) => <li key={d}>{d}</li>)}</ul>
        </details>
      )}
      <button type="button" className="primary" onClick={onRetry}>Try again</button>
    </div>
  )
}

export default function App() {
  const [scenario, setScenario] = useState(readUrlScenario)
  const [config, setConfig] = useState(null)
  const [data, setData] = useState(() => peek(scenario) ?? null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(null)
  const [drawer, setDrawer] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const kind = useRef('button')

  useEffect(() => { fetchConfig().then(setConfig).catch(() => setConfig(null)) }, [])

  useEffect(() => {
    writeUrlScenario(scenario)
    const hit = peek(scenario)
    if (hit) { setData(hit); setBusy(false); setError(null); return undefined }
    const ctl = new AbortController()
    setBusy(true)
    // Sliders fire on every step while dragging; wait until the hand rests.
    const t = setTimeout(() => {
      runScenario(scenario, ctl.signal)
        .then((d) => { setData(d); setError(null); setBusy(false) })
        .catch((err) => { if (err.name !== 'AbortError') { setError(err); setBusy(false) } })
    }, kind.current === 'slider' ? 300 : 0)
    return () => { clearTimeout(t); ctl.abort() }
  }, [scenario, attempt])

  const update = useCallback((patch, source = 'button') => {
    kind.current = source
    setScenario((s) => ({ ...s, ...patch }))
  }, [])
  const closeDrawer = useCallback(() => setDrawer(false), [])

  const r = data?.result
  const sentences = r ? summarize(r) : []
  const years = r?.years_run ?? 0

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <img className="mark" src="/inovues-mark.png" alt="" width="20" height="32" />
          <img className="word" src="/inovues-wordmark.png" alt="INOVUES" width="118" height="23" />
        </div>
        <div className="title">
          <h1>277 Park Avenue</h1>
          <p>Window cavity: how long the desiccant lasts, and when the pane fogs</p>
        </div>
        <button type="button" className="ghost" onClick={() => setDrawer(true)}>Assumptions</button>
      </header>

      <div className="body">
        <Controls scenario={scenario} update={update} config={config} />

        <main className={`stage${busy && data ? ' busy' : ''}`} aria-busy={busy}>
          <div className="progress" aria-hidden="true" data-on={busy ? '1' : '0'} />
          {error && <ErrorPanel error={error} onRetry={() => setAttempt((a) => a + 1)} />}
          {!error && !data && <Skeleton />}
          {!error && r && (
            <>
              <p className="answer" aria-live="polite">{sentences.join(' ')}</p>
              <p className="basis">
                Simulated hour by hour over {years === 1 ? 'one year' : `${years} years`} of typical weather at the site.
              </p>
              <FogCalendar result={r} runKey={queryOf(data.scenario)} />
              <Legend />
            </>
          )}
        </main>
      </div>

      <Assumptions open={drawer} onClose={closeDrawer} engineVersion={config?.engine_version} />
    </div>
  )
}
