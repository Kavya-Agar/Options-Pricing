import { useState } from 'react'
import { fetchExpiries, fetchChain } from '../api.js'
import MispricingChart from './MispricingChart.jsx'

function fmt(v, digits = 4) {
  return v != null ? v.toFixed(digits) : '—'
}

function IVBadge({ iv }) {
  if (iv == null) return <span style={{ color: 'var(--muted)' }}>—</span>
  const pct = (iv * 100).toFixed(1)
  const color = iv > 0.4 ? 'var(--red)' : iv < 0.15 ? 'var(--blue)' : 'var(--secondary)'
  const bg    = iv > 0.4 ? 'var(--red-dim)' : iv < 0.15 ? '#60a5fa18' : 'transparent'
  return (
    <span style={{ color, background: bg, padding: '1px 7px', borderRadius: 5, fontSize: 12, fontWeight: 500 }}>
      {pct}%
    </span>
  )
}

function MispricingCell({ v }) {
  if (v == null) return <span style={{ color: 'var(--muted)' }}>—</span>
  const color = v > 0 ? 'var(--green)' : 'var(--red)'
  return <span style={{ color, fontWeight: 500 }}>{v > 0 ? '+' : ''}{v.toFixed(4)}</span>
}

function StatPill({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: valueColor ?? 'var(--text)' }}>
        {value}
      </span>
    </div>
  )
}

function ChainTable({ contracts, filter }) {
  const rows = contracts.filter(c => filter === 'all' || c.option_type === filter)
  return (
    <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border-soft)' }}>
      <table>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>
          <tr>
            <th>Strike</th>
            <th>Type</th>
            <th>Mkt Price</th>
            <th>BS Price</th>
            <th>Mispricing</th>
            <th>IV (Brent)</th>
            <th>Bid</th>
            <th>Ask</th>
            <th>Volume</th>
            <th>OI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={i}>
              <td style={{ color: 'var(--text)', fontWeight: 600 }}>{c.strike}</td>
              <td>
                <span style={{
                  color: c.option_type === 'call' ? 'var(--green)' : 'var(--red)',
                  background: c.option_type === 'call' ? 'var(--green-dim)' : 'var(--red-dim)',
                  padding: '1px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                }}>
                  {c.option_type.toUpperCase()}
                </span>
              </td>
              <td style={{ color: 'var(--text)' }}>{fmt(c.market_price)}</td>
              <td style={{ color: 'var(--text)' }}>{fmt(c.bs_price)}</td>
              <td><MispricingCell v={c.mispricing} /></td>
              <td><IVBadge iv={c.iv} /></td>
              <td>{fmt(c.bid)}</td>
              <td>{fmt(c.ask)}</td>
              <td>{c.volume != null ? Math.round(c.volume).toLocaleString() : '—'}</td>
              <td>{c.open_interest != null ? Math.round(c.open_interest).toLocaleString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ChainView() {
  const [ticker, setTicker]     = useState('SPY')
  const [expiries, setExpiries] = useState([])
  const [expiry, setExpiry]     = useState('')
  const [chain, setChain]       = useState(null)
  const [filter, setFilter]     = useState('all')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  async function loadExpiries() {
    setError(null); setChain(null); setExpiries([]); setExpiry('')
    setLoading(true)
    try {
      const data = await fetchExpiries(ticker.trim().toUpperCase())
      setExpiries(data.expiries)
      setExpiry(data.expiries[0] ?? '')
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  async function loadChain() {
    if (!ticker || !expiry) return
    setError(null); setLoading(true)
    try {
      const data = await fetchChain(ticker.trim().toUpperCase(), expiry)
      setChain(data)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  const stats = chain ? {
    spot:   chain.spot,
    r:      (chain.r * 100).toFixed(2),
    T:      chain.T.toFixed(4),
    nCall:  chain.contracts.filter(c => c.option_type === 'call').length,
    nPut:   chain.contracts.filter(c => c.option_type === 'put').length,
    avgIV:  (() => {
      const ivs = chain.contracts.map(c => c.iv).filter(Boolean)
      return ivs.length ? ((ivs.reduce((a, b) => a + b, 0) / ivs.length) * 100).toFixed(1) : null
    })(),
  } : null

  return (
    <div>
      {/* Controls row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && loadExpiries()}
          placeholder="Ticker"
          style={{ width: 100, fontWeight: 600, textTransform: 'uppercase' }}
        />
        <button onClick={loadExpiries} disabled={loading}>
          {loading && !expiries.length ? 'Loading…' : 'Load Expiries'}
        </button>

        {expiries.length > 0 && <>
          <select value={expiry} onChange={e => setExpiry(e.target.value)} style={{ minWidth: 140 }}>
            {expiries.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={loadChain} disabled={loading}>
            {loading && chain == null ? 'Loading…' : 'Load Chain'}
          </button>
        </>}

        {chain && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {['all', 'call', 'put'].map(f => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          color: 'var(--red)', fontSize: 13, marginBottom: 16,
          padding: '10px 16px', borderRadius: 8,
          border: '1px solid var(--red-dim)', background: 'var(--red-dim)',
        }}>
          {error}
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div style={{
          display: 'flex', gap: 28, flexWrap: 'wrap',
          padding: '14px 20px', borderRadius: 10,
          border: '1px solid var(--border-soft)', background: 'var(--surface)',
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', alignSelf: 'center' }}>
            {chain.ticker}
            <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>{chain.expiry}</span>
          </div>
          <div style={{ width: 1, background: 'var(--border-soft)', flexShrink: 0 }} />
          <StatPill label="Spot"    value={`$${stats.spot.toFixed(2)}`} />
          <StatPill label="T"       value={`${stats.T} yr`} />
          <StatPill label="r"       value={`${stats.r}%`} />
          <StatPill label="Calls"   value={stats.nCall} valueColor="var(--green)" />
          <StatPill label="Puts"    value={stats.nPut}  valueColor="var(--red)" />
          {stats.avgIV && <StatPill label="Avg IV" value={`${stats.avgIV}%`} />}
        </div>
      )}

      {/* Chart */}
      {chain && <MispricingChart contracts={chain.contracts} />}

      {/* Table */}
      {chain && <ChainTable contracts={chain.contracts} filter={filter} />}

      {/* Empty state */}
      {!chain && !loading && !error && (
        <div style={{
          textAlign: 'center', padding: '64px 0',
          color: 'var(--muted)', fontSize: 14,
        }}>
          Enter a ticker and load expiries to begin.
        </div>
      )}
    </div>
  )
}
