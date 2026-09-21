export default async function handler(req, res) {
  try {
    const { product, granularity, start, end, limit } = req.query;
    if (!product || !granularity || !start || !end) {
      return res.status(400).json({ error: 'Missing market data parameters' });
    }

    // Coinbase Exchange candles supports these six source intervals.
    // Market Mat aggregates higher timeframes from them in the browser.
    const seconds = {
      ONE_MINUTE: 60,
      FIVE_MINUTE: 300,
      FIFTEEN_MINUTE: 900,
      ONE_HOUR: 3600,
      SIX_HOUR: 21600,
      ONE_DAY: 86400
    }[granularity];

    if (!seconds) {
      return res.status(400).json({ error: 'Unsupported Coinbase Exchange granularity: ' + granularity });
    }

    const startTs = Number(start);
    const endTs = Number(end);
    const requested = Math.max(1, Math.min(8000, Number(limit || 300)));

    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) {
      return res.status(400).json({ error: 'Invalid candle time range' });
    }

    // The Exchange endpoint caps a request at 300 candles. Paginate backwards
    // so higher timeframes still have enough source history for the 200 EMA.
    const rows = [];
    let cursorEnd = endTs;
    let pages = 0;
    const maxPages = 30;

    while (cursorEnd > startTs && rows.length < requested * 2 && pages < maxPages) {
      const chunkStart = Math.max(startTs, cursorEnd - seconds * 300);
      if (chunkStart >= cursorEnd) break;

      const url = new URL('https://api.exchange.coinbase.com/products/' + encodeURIComponent(product) + '/candles');
      url.searchParams.set('start', String(chunkStart));
      url.searchParams.set('end', String(cursorEnd));
      url.searchParams.set('granularity', String(seconds));

      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      const body = await response.text();

      if (!response.ok) return res.status(response.status).send(body);

      const page = JSON.parse(body);
      if (!Array.isArray(page) || page.length === 0) break;

      rows.push(...page);
      pages += 1;

      const validTimes = page.map(x => Number(x?.[0])).filter(Number.isFinite);
      const oldest = validTimes.length ? Math.min(...validTimes) : NaN;
      if (!Number.isFinite(oldest) || oldest >= cursorEnd) break;
      cursorEnd = oldest;
    }

    const byTime = new Map();
    for (const x of rows) {
      const t = Number(x?.[0]);
      if (!Number.isFinite(t)) continue;
      byTime.set(t, {
        start: String(t),
        low: String(x[1]),
        high: String(x[2]),
        open: String(x[3]),
        close: String(x[4]),
        volume: String(x[5])
      });
    }

    const candles = Array.from(byTime.values())
      .sort((a, b) => Number(a.start) - Number(b.start))
      .slice(-requested);

    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ candles, source: 'Coinbase Exchange', pages });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Market data proxy failed' });
  }
}