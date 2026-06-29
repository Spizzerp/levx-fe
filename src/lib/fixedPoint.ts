import { BN } from '@coral-xyz/anchor'

const DECIMAL_INPUT_RE = /^\d+(?:\.\d*)?$/

export function parseScaledDecimalBn(
  label: string,
  value: string,
  decimals: number,
): BN {
  const trimmed = value.trim()
  if (!DECIMAL_INPUT_RE.test(trimmed)) {
    throw new Error(`${label} must be a positive number`)
  }

  const [wholePart, fractionalPart = ''] = trimmed.split('.')
  if (fractionalPart.length > decimals) {
    throw new Error(`${label} supports at most ${decimals} decimal places`)
  }

  const scale = new BN(10).pow(new BN(decimals))
  const whole = new BN(wholePart).mul(scale)
  const fractionDigits = fractionalPart.padEnd(decimals, '0')
  const fraction = new BN(fractionDigits || '0')
  const scaled = whole.add(fraction)

  if (scaled.lte(new BN(0))) {
    throw new Error(`${label} must be greater than zero`)
  }

  return scaled
}
