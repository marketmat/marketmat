export default async function handler(req, res) {
  try {
    const { product, granularity, start, end, limit } = req.query;
    if (!product || !granularity || !start || !end) return res.status(400).json({ error: 'Missing market data parameters' });
    const url = new URL('https://api.coinbase.com/api/v3/brokerage/products/' + encodeURIComponent(product) + '/candles');
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);
    url.searchParams.set('granularity', granularity);
    url.searchParams.set('limit', limit || '300');
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await response.text();
    if (!response.ok) return res.status(response.status).send(text);
    res.setHeader('Cache-Control','s-maxage=5, stale-while-revalidate=15');
    res.setHeader('Content-Type','application/json');
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Market data proxy failed' });
  }
}