/** Token logo URLs from CoinGecko CDN. Add more as needed. */
export const TOKEN_IMAGES: Record<string, string> = {
  BTC: 'https://assets.coingecko.com/coins/images/1/standard/bitcoin.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/standard/Avalanche_Circle_RedWhite_Trans.png',
}

export function getTokenImage(symbol: string): string | null {
  return TOKEN_IMAGES[symbol.toUpperCase()] ?? null
}
