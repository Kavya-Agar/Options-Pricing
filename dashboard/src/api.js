const BASE = '/api'

async function request(url) {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? res.statusText)
  }
  return res.json()
}

/**
 * GET /api/expiries?ticker=SPY
 * Returns { ticker, expiries: string[] }
 */
export function fetchExpiries(ticker) {
  return request(`${BASE}/expiries?ticker=${encodeURIComponent(ticker)}`)
}

/**
 * GET /api/chain?ticker=SPY&expiry=2025-09-19
 * Returns ChainResponse
 */
export function fetchChain(ticker, expiry) {
  const params = new URLSearchParams({ ticker })
  if (expiry) params.set('expiry', expiry)
  return request(`${BASE}/chain?${params}`)
}
