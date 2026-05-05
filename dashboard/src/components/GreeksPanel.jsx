import { useState, useMemo } from 'react'
import { bsGreeks } from '../bs.js'

const GREEK_META = [
  { key: 'price', label: 'Price',  unit: '$',    desc: 'Theoretical option price',         accent: 'var(--accent)' },
  { key: 'delta', label: 'Delta',  unit: '',     desc: 'Rate of change vs. spot price',    accent: 'var(--blue)' },
  { key: 'gamma', label: 'Gamma',  unit: '',     desc: 'Rate of change of Delta',          accent: 'var(--blue)' },
  { key: 'vega',  label: 'Vega',   unit: '',     desc: 'Sensitivity to volatility',        accent: 'var(--amber)' },
  { key: 'theta', label: 'Theta',  unit: '/day', desc: 'Daily time decay',                 accent: 'var(--red)' },
  { key: 'rho',   label: 'Rho',    unit: '',     desc: 'Sensitivity per 1% rate change',   accent: 'var(--secondary)' },
]

function Slider({ label, value, min, max, step, onChange, fmt }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--secondary)' }}>{label}</span>
        <span style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text)',
          background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 5,
          minWidth: 64, textAlign: 'right',
        }}>
          {fmt(value)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value} onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

function GreekCard({ label, value, unit, desc, accent }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-soft)',
      borderRadius: 12,
      padding: '16px 18px',
      borderLeft: `3px solid ${accent}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 4 }}>
        {value !== null ? value.toFixed(4) : '—'}{unit && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)', marginLeft: 3 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{desc}</div>
    </div>
  )
}

export default function GreeksPanel() {
  const [S, setS]         = useState(100)
  const [K, setK]         = useState(100)
  const [T, setT]         = useState(1.0)
  const [r, setR]         = useState(0.05)
  const [sigma, setSigma] = useState(0.20)
  const [type, setType]   = useState('call')

  const greeks = useMemo(() => bsGreeks(S, K, T, r, sigma, type), [S, K, T, r, sigma, type])

  const moneyness =
    S > K * 1.02 ? (type === 'call' ? 'ITM' : 'OTM') :
    S < K * 0.98 ? (type === 'call' ? 'OTM' : 'ITM') : 'ATM'

  const moneynessColor =
    moneyness === 'ITM' ? 'var(--green)' :
    moneyness === 'OTM' ? 'var(--red)' : 'var(--amber)'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 36 }}>

      {/* ── Controls ── */}
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--secondary)', marginBottom: 10 }}>
            Option type
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['call', 'put'].map(t => (
              <button
                key={t}
                className={type === t ? 'active' : ''}
                onClick={() => setType(t)}
                style={{ flex: 1, borderRadius: 8 }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <Slider label="Spot price (S)"     value={S}     min={10}   max={300}  step={1}     onChange={setS}     fmt={v => `$${v.toFixed(0)}`} />
        <Slider label="Strike (K)"         value={K}     min={10}   max={300}  step={1}     onChange={setK}     fmt={v => `$${v.toFixed(0)}`} />
        <Slider label="Time to expiry (T)" value={T}     min={0.01} max={2}    step={0.01}  onChange={setT}     fmt={v => `${v.toFixed(2)} yr`} />
        <Slider label="Risk-free rate (r)" value={r}     min={0}    max={0.15} step={0.001} onChange={setR}     fmt={v => `${(v*100).toFixed(1)}%`} />
        <Slider label="Volatility (σ)"     value={sigma} min={0.01} max={1.5}  step={0.01}  onChange={setSigma} fmt={v => `${(v*100).toFixed(0)}%`} />

        {/* Moneyness badge */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', borderRadius: 8, background: 'var(--surface)',
          border: '1px solid var(--border-soft)', fontSize: 12,
        }}>
          <span style={{ color: 'var(--secondary)' }}>
            S/K = <span style={{ color: 'var(--text)', fontWeight: 600 }}>{(S/K).toFixed(3)}</span>
          </span>
          <span style={{
            color: moneynessColor, fontWeight: 700, fontSize: 11,
            letterSpacing: '0.06em', background: moneynessColor + '18',
            padding: '2px 8px', borderRadius: 5,
          }}>
            {moneyness}
          </span>
        </div>
      </div>

      {/* ── Greeks ── */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {GREEK_META.map(({ key, label, unit, desc, accent }) => (
            <GreekCard
              key={key} label={label} unit={unit} desc={desc} accent={accent}
              value={greeks ? greeks[key] : null}
            />
          ))}
        </div>

        {/* Summary row */}
        {greeks && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1, borderRadius: 10, overflow: 'hidden',
            border: '1px solid var(--border-soft)',
          }}>
            {[
              { label: 'Breakeven', value: `$${type === 'call' ? (K + greeks.price).toFixed(2) : (K - greeks.price).toFixed(2)}` },
              { label: 'Intrinsic value', value: `$${Math.max(type === 'call' ? S - K : K - S, 0).toFixed(2)}` },
              { label: 'Time value', value: `$${Math.max(greeks.price - Math.max(type === 'call' ? S - K : K - S, 0), 0).toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--surface)', padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
