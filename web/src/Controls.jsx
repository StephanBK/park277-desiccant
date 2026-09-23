import { GLASSES, RANGES, SEALS_EXISTING, SEALS_RETROFIT } from '../../shared/scenario.js'

// Leak bar length on a log scale: the ladders span 0.005 to 2.0 cfm/ft2,
// a factor of 400, so a linear bar would show everything but the last rung
// as empty.
const LEAK_LO = 0.005
const LEAK_HI = 2.0
function leakFraction(al) {
  if (typeof al !== 'number' || al <= 0) return null
  const x = Math.log(al / LEAK_LO) / Math.log(LEAK_HI / LEAK_LO)
  return 0.06 + 0.94 * Math.max(0, Math.min(1, x))
}

// Room dew point, Magnus formula (Sonntag constants), shown in degF.
//   gamma = ln(RH) + a.T / (b + T);   Td = b.gamma / (a - gamma)
export function dewPointF(tF, rhPct) {
  const a = 17.62
  const b = 243.12
  const t = ((tF - 32) * 5) / 9
  const g = Math.log(rhPct / 100) + (a * t) / (b + t)
  const td = (b * g) / (a - g)
  return (td * 9) / 5 + 32
}

function Section({ title, hint, children }) {
  return (
    <section className="ctl">
      <div className="ctl-head">
        <h2>{title}</h2>
        {hint && <span className="ctl-hint">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function Ladder({ title, items, value, onPick, engineValues }) {
  return (
    <Section title={title} hint="Tightest first">
      <div className="ladder" role="radiogroup" aria-label={title}>
        {items.map((it) => {
          const eng = engineValues?.find((e) => e.key === it.key)?.engine
          const frac = leakFraction(eng?.al_cfm_ft2)
          const tip = eng
            ? `${eng.label}. Rated air leakage ${eng.al_cfm_ft2} cfm/ft² at 75 Pa${eng.estimate ? ' (estimate)' : ''}.`
            : it.label
          const on = value === it.key
          return (
            <button key={it.key} type="button" role="radio" aria-checked={on}
              className={`rung${on ? ' on' : ''}`} data-tip={tip} onClick={() => onPick(it.key)}>
              <span className="rung-label">{it.label}</span>
              <span className="leak" aria-hidden="true">
                {frac !== null && <span className="leak-fill" style={{ width: `${frac * 100}%` }} />}
              </span>
            </button>
          )
        })}
      </div>
    </Section>
  )
}

function Slider({ id, label, value, unit, range, onChange, ticks }) {
  return (
    <div className="slider">
      <label htmlFor={id} className="slider-top">
        <span>{label}</span>
        <output htmlFor={id} className="slider-val">{value}{unit}</output>
      </label>
      <input id={id} type="range" min={range.min} max={range.max} step={range.step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--pos': `${((value - range.min) / (range.max - range.min)) * 100}%` }} />
      {ticks && (
        <div className="ticks" aria-hidden="true">
          {ticks.map((t) => <span key={t}>{t}</span>)}
        </div>
      )}
    </div>
  )
}

export default function Controls({ scenario, update, config }) {
  const lbTicks = []
  for (let v = RANGES.lb.min; v <= RANGES.lb.max; v += 2) lbTicks.push(v)
  const dp = dewPointF(scenario.t, scenario.rh)

  return (
    <aside className="controls" aria-label="Scenario">
      <Section title="Retrofit glass">
        <div className="seg" role="radiogroup" aria-label="Retrofit glass">
          {GLASSES.map((g) => {
            const on = scenario.glass === g.key
            return (
              <button key={g.key} type="button" role="radio" aria-checked={on} className={on ? 'on' : ''}
                data-tip={g.tip} onClick={() => update({ glass: g.key })}>
                {g.label}
              </button>
            )
          })}
        </div>
      </Section>

      <Ladder title="Existing window seal" items={SEALS_EXISTING} value={scenario.seal_out}
        engineValues={config?.seals_existing} onPick={(k) => update({ seal_out: k })} />
      <Ladder title="Retrofit seal" items={SEALS_RETROFIT} value={scenario.seal_in}
        engineValues={config?.seals_retrofit} onPick={(k) => update({ seal_in: k })} />

      <Section title="Desiccant">
        <Slider id="lb" label="Amount per window" value={scenario.lb} unit=" lb" range={RANGES.lb}
          ticks={lbTicks} onChange={(v) => update({ lb: v }, 'slider')} />
      </Section>

      <Section title="Room">
        <Slider id="t" label="Temperature" value={scenario.t} unit=" °F" range={RANGES.t}
          onChange={(v) => update({ t: v }, 'slider')} />
        <Slider id="rh" label="Relative humidity" value={scenario.rh} unit=" %" range={RANGES.rh}
          onChange={(v) => update({ rh: v }, 'slider')} />
        <p className="dew" data-tip="Air that reaches a surface colder than its dew point leaves water on it. The existing pane in winter is far colder than this.">
          Room dew point {Math.round(dp)} °F
        </p>
      </Section>
    </aside>
  )
}
