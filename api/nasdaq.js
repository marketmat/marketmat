export default async function handler(req,res){
  try{
    const {granularity,start,end,limit}=req.query;
    const intervalMap={
      ONE_MINUTE:'1m',
      FIVE_MINUTE:'5m',
      FIFTEEN_MINUTE:'15m',
      THIRTY_MINUTE:'30m',
      ONE_HOUR:'1h',
      FOUR_HOUR:'1h',
      SIX_HOUR:'1h',
      TWELVE_HOUR:'1h',
      ONE_DAY:'1d'
    };
    const interval=intervalMap[granularity];
    if(!interval||!start||!end)return res.status(400).json({error:'Missing or unsupported NASDAQ parameters'});
    const period1=Number(start),period2=Number(end);
    const url=new URL('https://query1.finance.yahoo.com/v8/finance/chart/NQ%3DF');
    url.searchParams.set('period1',String(period1));
    url.searchParams.set('period2',String(period2));
    url.searchParams.set('interval',interval);
    url.searchParams.set('events','history');
    url.searchParams.set('includePrePost','true');
    const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'}});
    const body=await response.text();
    if(!response.ok)return res.status(response.status).send(body);
    const j=JSON.parse(body),r=j?.chart?.result?.[0];
    if(!r)return res.status(502).json({error:'NASDAQ data source returned no result'});
    const q=r.indicators?.quote?.[0]||{},ts=r.timestamp||[];
    const candles=[];
    for(let i=0;i<ts.length;i++){
      const o=q.open?.[i],h=q.high?.[i],l=q.low?.[i],c=q.close?.[i],v=q.volume?.[i]??0;
      if([o,h,l,c].every(Number.isFinite))candles.push({start:String(ts[i]),low:String(l),high:String(h),open:String(o),close:String(c),volume:String(v||0)});
    }
    const out=candles.slice(-Number(limit||300));
    res.setHeader('Cache-Control','s-maxage=5, stale-while-revalidate=10');
    res.setHeader('Content-Type','application/json');
    return res.status(200).json({candles:out,source:'Yahoo Finance • NQ=F',market:'Nasdaq-100 E-mini futures'});
  }catch(e){
    return res.status(500).json({error:e.message||'NASDAQ market data proxy failed'});
  }
}