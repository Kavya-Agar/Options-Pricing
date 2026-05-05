import { useState } from 'react'
import { fetchExpiries, fetchChain } from '../api.js'
import MispricingChart from './MispricingChart.jsx'

function fmt(v, digits = 4) {
  return v != null ? v.toFixed(digits) : '—'
}

function IVCell({ iv }) {
  if (iv == null) return <span className="dim">—</span>
  const pct = (iv * 100).toFixed(1)
  const color = iv > 0.4 ? 'var(--red)' : iv < 0.15 ? 'var(--accent)' : 'var(--text)'
  return <span style={{ color }}>{pct}%</span>
}

function MispricingCell({ v }) {
  if (v == null) return <span className="dim">—</span>
  const color = v > 0 ? 'var(--green)' : 'var(--red)'
  const sign  = v > 0 ? '+' : ''
  return <span style={{ color }}>{sign}{v.toFixed(4)}</span>
}

function ChainTable({ contracts, filter }) {
  const rows = contracts.filter(c => filter === 'all' || c.option_type === filter)

  return (
    <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
      <table>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg)' }}>
          <tr>
            <th>STRIKE</th>
            <th>TYPE</th>
            <th>MKT PRICE</th>
            <th>BS PRICE</th>
            <th>MISPRICING</th>
            <th>IV (BRENT)</th>
            <th>BID</th>
            <th>ASK</th>
            <th>VOLUME</th>
            <th>OI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={i}>
              <td style={{ color: 'var(--text)' }}>{c.strike}</td>
              <td style={{ color: c.option_type === 'call' ? 'var(--green)' : 'var(--red)', letterSpacing: '0.06em' }}>
                {c.option_type.toUpperCase()}
              </td>
              <td>{fmt(c.market_price)}</td>
              <td>{fmt(c.bs_price)}</td>
              <td><MispricingCell v={c.mispricing} /></td>
              <td><IVCell iv={c.iv} /></td>
              <td className="dim">{fmt(c.bid)}</td>
              <td className="dim">{fmt(c.ask)}</td>
              <td className="dim">{c.volume != null ? Math.round(c.volume).toLocaleString() : '—'}</td>
              <td className="dim">{c.open_interest != null ? Math.round(c.open_interest).toLocaleString() : '—'}</td>
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
    setError(null)
    setChain(null)
    setExpiries([])
    setExpiry('')
    setLoading(true)
    try {
      const data = await fetchExpiries(ticker.trim().toUpperCase())
      setExpiries(data.expiries)
      setExpiry(data.expiries[0] ?? '')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadChain() {
    if (!ticker || !expiry) return
    setError(null)
    setLoading(true)
    try {
      const data = await fetchChain(ticker.trim().toUpperCase(), expiry)
      setChain(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const stats = chain ? {
    spot:     chain.spot,
    r:        (chain.r * 100).toFixed(2),
    T:        chain.T.toFixed(4),
    nCall:    chain.contracts.filter(c => c.option_type === 'call').length,
    nPut:     chain.contracts.filter(c => c.option_type === 'put').length,
    avgIV:    (() => {
      const ivs = chain.contracts.map(c => c.iv).filter(Boolean)
      return ivs.length ? ((ivs.reduce((a,b) => a+b, 0) / ivs.length) * 100).toFixed(1) : null
    })(),
  } : null

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && loadExpiries()}
          placeholder="TICKER"
          style={{ width: 90, textTransform: 'uppercase' }}
        />
        <button onClick={loadExpiries} disabled={loading}>
          {loading && !expiries.length ? 'LOADING...' : 'LOAD EXPIRIES'}
        </button>

        {expiries.length > 0 && (
          <>
            <select value={expiry} onChange={e => setExpiry(e.target.value)} style={{ minWidth: 130 }}>
              {expiries.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button onClick={loadChain} disabled={loading}>
              {loading && chain == null ? 'LOADING...' : 'LOAD CHAIN'}
            </button>
          </>
        )}

        {chain && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {['all', 'call', 'put'].map(f => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12, padding: '8px 12px', border: '1px solid var(--red-dim)' }}>
          ERROR: {error}
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div style={{
          display: 'flex', gap: 24, marginBottom: 20,
          padding: '8px 14px', border: '1px solid var(--border)',
          background: 'var(--surface)', fontSize: 11, color: 'var(--dim)',
          flexWrap: 'wrap',
        }}>
          <span>{chain.ticker} · {chain.expiry}</span>
          <span>SPOT <span style={{ color: 'var(--text)' }}>${stats.spot.toFixed(2)}</span></span>
          <span>T <span style={{ color: 'var(--text)' }}>{stats.T}yr</span></span>
          <span>r <span style={{ color: 'var(--text)' }}>{stats.r}%</span></span>
          <span>CALLS <span style={{ color: 'var(--green)' }}>{stats.nCall}</span></span>
          <span>PUTS <span style={{ color: 'var(--red)' }}>{stats.nPut}</span></span>
          {stats.avgIV && <span>AVG IV <span style={{ color: 'var(--text)' }}>{stats.avgIV}%</span></span>}
        </div>
      )}

      {/* Mispricing scatter */}
      {chain && <MispricingChart contracts={chain.contracts} />}

      {/* Chain table */}
      {chain && <ChainTable contracts={chain.contracts} filter={filter} />}

      {/* Empty state */}
      {!chain && !loading && !error && (
        <div style={{ color: 'var(--dim)', fontSize: 12, padding: '40px 0', textAlign: 'center' }}>
          Enter a ticker and load expiries to begin.
        </div>
      )}
    </div>
  )
}
