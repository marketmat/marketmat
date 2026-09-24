export default async function handler(req, res) {
  try {
    const { product, granularity, start, end, limit } = req.query;
    if (!product || !granularity || !start || !end) {
      return res.status(400).json({ error: 'Missing market data parameters' });
    }

    const seconds = {
      ONE_MINUTE: 60,
      FIVE_MINUTE: 300,
      FIFTEEN_MINUTE: 900,
      ONE_HOUR: 3600,
      SIX_HOUR: 21600,
      ONE_DAY: 86400
    }[granularity];

    if (!seconds) {
      return res.status(400).json({ error: 'Unsupported candle granularity: ' + granularity });
    }

    const startTs = Number(start);
    const endTs = Number(end);
    const requested = Math.max(1, Math.min(8000, Number(limit || 300)));
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) {
      return res.status(400).json({ error: 'Invalid candle time range' });
    }

    // Coinbase Advanced Trade's public market-data candles endpoint is the
    // primary source. It returns up to 350 candles per request, so paginate
    // backwards to keep enough history for the 200 EMA and higher timeframes.
    const rows = [];
    let cursorEnd = endTs;
    let pages = 0;
    const maxPages = 30;

    while (cursorEnd > startTs && rows.length < requested * 2 && pages < maxPages) {
      const chunkStart = Math.max(startTs, cursorEnd - seconds * 350);
      if (chunkStart >= cursorEnd) break;

      const url = new URL(
        'https://api.coinbase.com/api/v3/brokerage/market/products/' +
        encodeURIComponent(product) + '/candles'
      );
      url.searchParams.set('start', String(chunkStart));
      url.searchParams.set('end', String(cursorEnd));
      url.searchParams.set('granularity', granularity);
      url.searchParams.set('limit', '350');

      let response = await fetch(url, { headers: { Accept: 'application/json' } });

      // Fallback to the Coinbase Exchange public endpoint if Advanced Trade
      // temporarily fails. Both are public market-data sources.
      if (!response.ok) {
        const fallback = new URL(
          'https://api.exchange.coinbase.com/products/' +
          encodeURIComponent(product) + '/candles'
        );
        fallback.searchParams.set('start', String(chunkStart));
        fallback.searchParams.set('end', String(cursorEnd));
        fallback.searchParams.set('granularity', String(seconds));
        response = await fetch(fallback, { headers: { Accept: 'application/json' } });
      }

      const body = await response.text();
      if (!response.ok) return res.status(response.status).send(body);

      const parsed = JSON.parse(body);
      const page = Array.isArray(parsed) ? parsed : parsed.candles;
      if (!Array.isArray(page) || page.length === 0) break;

      for (const x of page) {
        if (Array.isArray(x)) {
          rows.push({
            start: String(x[0]),
            low: String(x[1]),
            high: String(x[2]),
            open: String(x[3]),
            close: String(x[4]),
            volume: String(x[5])
          });
        } else {
          rows.push({
            start: String(x.start),
            low: String(x.low),
            high: String(x.high),
            open: String(x.open),
            close: String(x.close),
            volume: String(x.volume)
          });
        }
      }

      pages += 1;
      const validTimes = page.map(x => Number(Array.isArray(x) ? x[0] : x.start)).filter(Number.isFinite);
      const oldest = validTimes.length ? Math.min(...validTimes) : NaN;
      if (!Number.isFinite(oldest) || oldest >= cursorEnd) break;
      cursorEnd = oldest;
    }

    const byTime = new Map();
    for (const x of rows) {
      const t = Number(x.start);
      if (!Number.isFinite(t)) continue;
      byTime.set(t, x);
    }

    const candles = Array.from(byTime.values())
      .sort((a, b) => Number(a.start) - Number(b.start))
      .slice(-requested);

    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ candles, source: 'Coinbase public market data', pages });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Market data proxy failed' });
  }
}