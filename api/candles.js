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
      THIRTY_MINUTE: 1800,
      ONE_HOUR: 3600,
      TWO_HOUR: 7200,
      FOUR_HOUR: 14400,
      SIX_HOUR: 21600,
      TWELVE_HOUR: 43200,
      ONE_DAY: 86400
    }[granularity];

    if (!seconds) return res.status(400).json({ error: 'Unsupported granularity: ' + granularity });

    const url = new URL('https://api.exchange.coinbase.com/products/' + encodeURIComponent(product) + '/candles');
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);
    url.searchParams.set('granularity', String(seconds));

    const response = await fetch(url, {
      headers: { Accept: 'application/json' }
    });

    const body = await response.text();
    if (!response.ok) {
      return res.status(response.status).send(body);
    }

    // Coinbase Exchange returns [time, low, high, open, close, volume].
    const rows = JSON.parse(body);
    const candles = Array.isArray(rows)
      ? rows.slice(0, Number(limit || 300)).map(x => ({
          start: String(x[0]),
          low: String(x[1]),
          high: String(x[2]),
          open: String(x[3]),
          close: String(x[4]),
          volume: String(x[5])
        }))
      : [];

    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=15');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ candles });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Market data proxy failed' });
  }
}
