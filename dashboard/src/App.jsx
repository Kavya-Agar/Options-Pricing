import { useState } from 'react'
import GreeksPanel from './components/GreeksPanel.jsx'
import ChainView from './components/ChainView.jsx'

const TABS = ['Greeks Explorer', 'Live Chain']

export default function App() {
  const [tab, setTab] = useState(0)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--green)', fontSize: 11, letterSpacing: '0.1em' }}>▶</span>
          <h1 style={{ fontSize: 15, letterSpacing: '0.08em', color: 'var(--text)' }}>
            QUANT OPTIONS ENGINE
          </h1>
        </div>
        <p style={{ color: 'var(--dim)', fontSize: 11, letterSpacing: '0.06em' }}>
          BLACK-SCHOLES · MONTE CARLO · IMPLIED VOLATILITY · LIVE CHAIN
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {TABS.map((label, i) => (
          <button
            key={label}
            className={tab === i ? 'active' : ''}
            onClick={() => setTab(i)}
          >
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 0 && <GreeksPanel />}
      {tab === 1 && <ChainView />}
    </div>
  )
}
