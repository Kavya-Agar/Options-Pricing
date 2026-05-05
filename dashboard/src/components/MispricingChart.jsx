import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const isCall = d.optionType === 'call'
  const diff = d.y - d.x
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      lineHeight: 1.7,
      boxShadow: '0 4px 24px #00000060',
    }}>
      <div style={{ fontWeight: 700, color: isCall ? 'var(--green)' : 'var(--red)', marginBottom: 4 }}>
        K = {d.strike} · {d.optionType.toUpperCase()}
      </div>
      <div style={{ color: 'var(--secondary)' }}>Market  <span style={{ color: 'var(--text)', fontWeight: 600 }}>${d.x.toFixed(3)}</span></div>
      <div style={{ color: 'var(--secondary)' }}>BS      <span style={{ color: 'var(--text)', fontWeight: 600 }}>${d.y.toFixed(3)}</span></div>
      <div style={{ color: diff >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
        {diff >= 0 ? '▲' : '▼'} {diff >= 0 ? '+' : ''}{diff.toFixed(3)}
      </div>
      {d.iv && <div style={{ color: 'var(--muted)', marginTop: 2 }}>IV: {(d.iv * 100).toFixed(1)}%</div>}
    </div>
  )
}

export default function MispricingChart({ contracts }) {
  if (!contracts?.length) return null

  const calls = contracts
    .filter(c => c.option_type === 'call' && c.iv != null)
    .map(c => ({ x: c.market_price, y: c.bs_price, strike: c.strike, optionType: 'call', iv: c.iv }))

  const puts = contracts
    .filter(c => c.option_type === 'put' && c.iv != null)
    .map(c => ({ x: c.market_price, y: c.bs_price, strike: c.strike, optionType: 'put', iv: c.iv }))

  const allPrices = contracts.map(c => [c.market_price, c.bs_price]).flat().filter(Boolean)
  const lo = Math.min(...allPrices)
  const hi = Math.max(...allPrices)

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border-soft)',
      borderRadius: 12, padding: '20px 16px', marginBottom: 20,
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
          Theoretical vs. Market Price
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Points above the diagonal are BS-overpriced relative to market
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 8, right: 20, bottom: 28, left: 10 }}>
          <CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 4" />
          <XAxis
            type="number" dataKey="x" name="Market" domain={['auto', 'auto']}
            tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
            label={{ value: 'Market Price ($)', position: 'insideBottom', offset: -14, fill: 'var(--muted)', fontSize: 11 }}
          />
          <YAxis
            type="number" dataKey="y" name="BS"
            tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
            label={{ value: 'BS Price ($)', angle: -90, position: 'insideLeft', offset: 14, fill: 'var(--muted)', fontSize: 11 }}
          />
          <ReferenceLine
            segment={[{ x: lo, y: lo }, { x: hi, y: hi }]}
            stroke="var(--muted)" strokeDasharray="5 4" strokeWidth={1}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
          <Scatter name="call" data={calls} fill="#22c55e" opacity={0.75} r={4} />
          <Scatter name="put"  data={puts}  fill="#f43f5e" opacity={0.75} r={4} />
        </ScatterChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 4, fontSize: 12, color: 'var(--secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          Call
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f43f5e', display: 'inline-block' }} />
          Put
        </span>
      </div>
    </div>
  )
}
