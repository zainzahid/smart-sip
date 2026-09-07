const proxyUrl = import.meta.env.VITE_PSX_PROXY_URL?.trim().replace(/\/+$/, '');
// The Worker owns source URLs, HTML parsing, and fallback selection.
const PRICE_BASE = `${proxyUrl || '/api'}/price`;
const FETCH_TIMEOUT_MS = 20_000;

const MOCK_PRICES: Record<string, number> = {
  MARI: 285.50,
  FFC: 152.25,
  SYS: 625.00,
  HUBC: 198.75,
  MCB: 312.00,
  ENGRO: 845.50,
  PSO: 480.00,
  TRG: 153.25,
  LUCK: 710.00,
  OGDC: 172.50,
};

export async function fetchStockPrice(symbol: string): Promise<number> {
  if (import.meta.env.VITE_USE_MOCK_PRICES === 'true') {
    await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
    const price = MOCK_PRICES[symbol] ?? (50 + Math.random() * 800);
    return Math.round(price * 100) / 100;
  }

  const url = `${PRICE_BASE}/${encodeURIComponent(symbol)}`;

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);

    const quote = await res.json();
    if (quote?.symbol !== symbol.toUpperCase() || typeof quote.price !== 'number' || !isValidPrice(quote.price)) {
      throw new Error(`Invalid price response for ${symbol}`);
    }
    return quote.price;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Timeout fetching price for ${symbol}`, { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timerId);
  }
}

export async function fetchAllPrices(
  symbols: string[],
): Promise<Map<string, { price?: number; error?: string }>> {
  const results = new Map<string, { price?: number; error?: string }>();

  await Promise.allSettled(
    symbols.map(async symbol => {
      try {
        const price = await fetchStockPrice(symbol);
        results.set(symbol, { price });
      } catch (err) {
        results.set(symbol, {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }),
  );

  return results;
}

function isValidPrice(price: number): boolean {
  return Number.isFinite(price) && price > 0 && price < 1_000_000;
}
