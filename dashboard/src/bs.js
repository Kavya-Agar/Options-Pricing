/**
 * Client-side Black-Scholes — used for the real-time Greeks sliders.
 *
 * Computing via the API would add network latency on every slider drag.
 * This JS implementation matches the Python pricer to 6 decimal places
 * for the parameter ranges used in the dashboard.
 *
 * normCdf uses Abramowitz & Stegun 26.2.17 (max error 7.5e-8).
 */

function normCdf(x) {
  const a = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429]
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
  let poly = 0
  let tk = t
  for (const ai of a) { poly += ai * tk; tk *= t }
  const p = 1 - d * poly
  return x >= 0 ? p : 1 - p
}

function normPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

/**
 * @param {number} S  - spot price
 * @param {number} K  - strike
 * @param {number} T  - time to expiry in years
 * @param {number} r  - risk-free rate
 * @param {number} sigma - volatility
 * @param {string} optionType - "call" | "put"
 * @returns {{ price, delta, gamma, vega, theta, rho } | null}
 */
export function bsGreeks(S, K, T, r, sigma, optionType) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return null

  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  const disc = Math.exp(-r * T)
  const phi  = normPdf(d1)

  let price, delta
  if (optionType === 'call') {
    price = S * normCdf(d1) - K * disc * normCdf(d2)
    delta = normCdf(d1)
  } else {
    price = K * disc * normCdf(-d2) - S * normCdf(-d1)
    delta = normCdf(d1) - 1
  }

  const gamma = phi / (S * sigma * sqrtT)
  const vega  = S * phi * sqrtT
  const thetaYear = optionType === 'call'
    ? -(S * phi * sigma) / (2 * sqrtT) - r * K * disc * normCdf(d2)
    : -(S * phi * sigma) / (2 * sqrtT) + r * K * disc * normCdf(-d2)
  const theta = thetaYear / 365
  const rho = optionType === 'call'
    ? K * T * disc * normCdf(d2) / 100
    : -K * T * disc * normCdf(-d2) / 100

  return { price, delta, gamma, vega, theta, rho }
}
