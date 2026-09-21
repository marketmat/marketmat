export default async function handler(req,res){
  try{
    const url='https://nfs.faireconomy.media/ff_calendar_thisweek.json';
    const r=await fetch(url,{headers:{'User-Agent':'Market-Mat/1.0'}});
    if(!r.ok) return res.status(r.status).json({error:'Calendar source unavailable'});
    const data=await r.json();
    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin','*');
    return res.status(200).json(Array.isArray(data)?data:[]);
  }catch(e){return res.status(500).json({error:'Unable to load economic calendar'});}
}
