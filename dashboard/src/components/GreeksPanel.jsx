import { useState, useMemo } from 'react'
import { bsGreeks } from '../bs.js'

const GREEK_META = [
  { key: 'price', label: 'PRICE',  unit: '$',   desc: 'Theoretical option price' },
  { key: 'delta', label: 'DELTA',  unit: '',    desc: 'dPrice/dSpot · hedge ratio' },
  { key: 'gamma', label: 'GAMMA',  unit: '',    desc: 'dDelta/dSpot · curvature' },
  { key: 'vega',  label: 'VEGA',   unit: '',    desc: 'dPrice/dVol · per 1 vol unit' },
  { key: 'theta', label: 'THETA',  unit: '/day', desc: 'dPrice/dTime · daily decay' },
  { key: 'rho',   label: 'RHO',    unit: '',    desc: 'dPrice/d(1% rate)' },
]

function Slider({ label, value, min, max, step, onChange, fmt }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: 'var(--dim)', fontSize: 11, letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ color: 'var(--green)', fontSize: 12, minWidth: 60, textAlign: 'right' }}>
          {fmt(value)}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

function GreekCard({ label, value, unit, desc }) {
  const color = label === 'THETA' ? 'var(--red)' : label === 'PRICE' ? 'var(--green)' : 'var(--text)'
  return (
    <div style={{
      border: '1px solid var(--border)',
      padding: '12px 14px',
      background: 'var(--surface)',
    }}>
      <div style={{ color: 'var(--dim)', fontSize: 10, letterSpacing: '0.1em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color, fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
        {value !== null ? value.toFixed(4) : '—'}{unit}
      </div>
      <div style={{ color: 'var(--dim)', fontSize: 10 }}>{desc}</div>
    </div>
  )
}

export default function GreeksPanel() {
  const [S, setS]          = useState(100)
  const [K, setK]          = useState(100)
  const [T, setT]          = useState(1.0)
  const [r, setR]          = useState(0.05)
  const [sigma, setSigma]  = useState(0.20)
  const [type, setType]    = useState('call')

  // Recompute instantly on every slider change — no API call needed
  const greeks = useMemo(() => bsGreeks(S, K, T, r, sigma, type), [S, K, T, r, sigma, type])

  const moneyness =
    S > K * 1.02 ? (type === 'call' ? 'ITM' : 'OTM') :
    S < K * 0.98 ? (type === 'call' ? 'OTM' : 'ITM') : 'ATM'

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32 }}>

        {/* Controls */}
        <div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: 'var(--dim)', fontSize: 11, letterSpacing: '0.08em', marginBottom: 8 }}>
              OPTION TYPE
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['call', 'put'].map(t => (
                <button
                  key={t}
                  className={type === t ? 'active' : ''}
                  onClick={() => setType(t)}
                  style={{ flex: 1 }}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <Slider label="SPOT PRICE (S)"    value={S}     min={10}   max={300}  step={1}      onChange={setS}     fmt={v => `$${v.toFixed(0)}`} />
          <Slider label="STRIKE (K)"        value={K}     min={10}   max={300}  step={1}      onChange={setK}     fmt={v => `$${v.toFixed(0)}`} />
          <Slider label="TIME TO EXPIRY (T)" value={T}    min={0.01} max={2}    step={0.01}   onChange={setT}     fmt={v => `${v.toFixed(2)}yr`} />
          <Slider label="RISK-FREE RATE (r)" value={r}    min={0}    max={0.15} step={0.001}  onChange={setR}     fmt={v => `${(v*100).toFixed(1)}%`} />
          <Slider label="VOLATILITY (σ)"     value={sigma} min={0.01} max={1.5} step={0.01}   onChange={setSigma} fmt={v => `${(v*100).toFixed(0)}%`} />

          <div style={{
            marginTop: 8,
            padding: '8px 10px',
            border: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--dim)',
          }}>
            <span>S/K = {(S/K).toFixed(3)}</span>
            <span style={{
              color: moneyness === 'ITM' ? 'var(--green)' : moneyness === 'OTM' ? 'var(--red)' : 'var(--yellow)',
            }}>
              {moneyness}
            </span>
          </div>
        </div>

        {/* Greeks grid */}
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginBottom: 16,
          }}>
            {GREEK_META.map(({ key, label, unit, desc }) => (
              <GreekCard
                key={key}
                label={label}
                value={greeks ? greeks[key] : null}
                unit={unit}
                desc={desc}
              />
            ))}
          </div>

          {/* P&L breakeven annotation */}
          {greeks && (
            <div style={{
              padding: '10px 14px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              fontSize: 11,
              color: 'var(--dim)',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
            }}>
              <span>
                Breakeven:{' '}
                <span style={{ color: 'var(--text)' }}>
                  ${type === 'call'
                    ? (K + greeks.price).toFixed(2)
                    : (K - greeks.price).toFixed(2)}
                </span>
              </span>
              <span>
                Intrinsic:{' '}
                <span style={{ color: 'var(--text)' }}>
                  ${Math.max(type === 'call' ? S - K : K - S, 0).toFixed(2)}
                </span>
              </span>
              <span>
                Time value:{' '}
                <span style={{ color: 'var(--text)' }}>
                  ${Math.max(greeks.price - Math.max(type === 'call' ? S - K : K - S, 0), 0).toFixed(2)}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
