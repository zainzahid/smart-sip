// PSX price fetching via Vite dev proxy (/psx → dps.psx.com.pk).
// The parsePriceFromHtml function tries multiple strategies against dps.psx.com.pk pages.
// If the page structure changes, update parsePriceFromHtml — it is intentionally isolated here.

const PSX_BASE = '/psx/company';
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

  const url = `${PSX_BASE}/${encodeURIComponent(symbol)}`;

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timerId);

    if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);

    const html = await res.text();
    if (html.length < 200) throw new Error(`Empty response for ${symbol}`);
    console.log(`HTML for ${symbol}`, html);

    return parsePriceFromHtml(html, symbol);
  } catch (err) {
    clearTimeout(timerId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Timeout fetching price for ${symbol}`);
    }
    throw err;
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

function parsePriceFromHtml(html: string, symbol: string): number {
  // Strategy 1: JSON data embedded in <script> tags
  const scriptTags = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scriptTags) {
    const script = match[1];
    const jsonPatterns = [
      /"current"\s*:\s*"?([\d,]+\.?\d*)"?/,
      /"ldcp"\s*:\s*"?([\d,]+\.?\d*)"?/,
      /"close"\s*:\s*"?([\d,]+\.?\d*)"?/,
      /"last"\s*:\s*"?([\d,]+\.?\d*)"?/,
      /"price"\s*:\s*"?([\d,]+\.?\d*)"?/,
      /"ltp"\s*:\s*"?([\d,]+\.?\d*)"?/,
    ];
    for (const pat of jsonPatterns) {
      const m = script.match(pat);
      if (m) {
        const price = parseFloat(m[1].replace(/,/g, ''));
        if (isValidPrice(price)) return price;
      }
    }
  }

  // Strategy 2: DOM element selectors
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const domDoc = parser.parseFromString(html, 'text/html');
    const selectors = [
      '.quote-price',
      '.current-price',
      '.last-price',
      '.ltp',
      '[data-field="last"]',
      '[data-field="price"]',
      '[data-field="ltp"]',
      'span[class*="price"]',
      'td[class*="price"]',
      'div[class*="price"]',
    ];
    for (const sel of selectors) {
      const el = domDoc.querySelector(sel);
      if (el) {
        const price = parseFloat(
          (el.textContent ?? '').replace(/,/g, '').trim(),
        );
        if (isValidPrice(price)) return price;
      }
    }
  }

  // Strategy 3: Raw HTML regex — last resort
  const rawPatterns = [
    /last[^0-9]{0,40}([\d,]{1,8}\.?\d{0,2})/i,
    /current[^0-9]{0,40}([\d,]{1,8}\.?\d{0,2})/i,
    /price[^0-9]{0,40}([\d,]{1,8}\.?\d{0,2})/i,
  ];
  for (const pat of rawPatterns) {
    const m = html.match(pat);
    if (m) {
      const price = parseFloat(m[1].replace(/,/g, ''));
      if (isValidPrice(price)) return price;
    }
  }

  throw new Error(
    `Could not parse price for ${symbol}. Update parsePriceFromHtml() in priceService.ts to match the current page structure.`,
  );
}

function isValidPrice(price: number): boolean {
  return !isNaN(price) && price > 0 && price < 1_000_000;
}
