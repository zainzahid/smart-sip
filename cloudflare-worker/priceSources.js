const SOURCES = {
  dps: {
    baseUrl: 'https://dps.psx.com.pk/company/',
    selector: '.quote__close',
  },
  sarmaaya: {
    baseUrl: 'https://sarmaaya.pk/stocks/',
    // Ignore red/green classes: they change with price movement.
    selector: '#fundamentals div.mb-1.pl-2.text-lg.font-bold.text-right',
  },
};

export async function fetchSourcePrice(source, symbol) {
  const { baseUrl, selector } = SOURCES[source];
  // Two attempts fit within the client's 20-second timeout, including body reads.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(`${baseUrl}${encodeURIComponent(symbol)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'manual',
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    return await extractPrice(response, selector, source === 'dps');
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

async function extractPrice(response, selector, hasCurrencyPrefix) {
  if (!response.body) throw new Error('Empty upstream response');
  let bytes = 0;
  const body = response.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > 2 * 1024 * 1024) throw new Error('Upstream response exceeds 2 MB');
      controller.enqueue(chunk);
    },
  }));
  let text = '';
  let matches = 0;
  await new HTMLRewriter().on(selector, {
    element() { matches++; },
    text(chunk) {
      text += chunk.text;
      if (text.length > 64) throw new Error('Invalid price text');
    },
  }).transform(new Response(body)).body.pipeTo(new WritableStream());

  const value = (hasCurrencyPrefix ? text.replace(/^\s*Rs\.\s*/i, '') : text).trim();
  const price = Number(value.replace(/,/g, ''));
  if (matches !== 1 || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value)
    || !Number.isFinite(price) || price <= 0 || price >= 1_000_000) {
    throw new Error('Price missing, ambiguous, or invalid');
  }
  return price;
}
