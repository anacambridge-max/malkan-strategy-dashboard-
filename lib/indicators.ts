export type Candle = { open:number; high:number; low:number; close:number; volume:number; timestamp:string };

export function rsi(closes:number[], period=14): number {
  if (closes.length <= period) return NaN;
  let gain=0, loss=0;
  for(let i=1;i<=period;i++){ const d=closes[i]-closes[i-1]; gain+=Math.max(d,0); loss+=Math.max(-d,0); }
  let avgGain=gain/period, avgLoss=loss/period;
  for(let i=period+1;i<closes.length;i++){ const d=closes[i]-closes[i-1]; avgGain=(avgGain*(period-1)+Math.max(d,0))/period; avgLoss=(avgLoss*(period-1)+Math.max(-d,0))/period; }
  if(avgLoss===0) return 100;
  return 100-100/(1+avgGain/avgLoss);
}

export function relativeVolume(volumes:number[], period=20): number {
  if (!volumes.length) return NaN;
  const slice=volumes.slice(-period-1,-1); if(!slice.length) return NaN;
  const avg=slice.reduce((a,b)=>a+b,0)/slice.length; return avg>0 ? volumes[volumes.length-1]/avg : 0;
}

export function aggregateWeekly(candles:Candle[]):Candle[]{
  const map=new Map<string,Candle>();
  for(const c of candles){ const d=new Date(c.timestamp); const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day); const key=d.toISOString().slice(0,10); const x=map.get(key); if(!x) map.set(key,{...c,timestamp:key}); else {x.high=Math.max(x.high,c.high);x.low=Math.min(x.low,c.low);x.close=c.close;x.volume+=c.volume;} }
  return [...map.values()].sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}

export function aggregateMonthly(candles:Candle[]):Candle[]{
  const map=new Map<string,Candle>();
  for(const c of candles){ const key=c.timestamp.slice(0,7); const x=map.get(key); if(!x) map.set(key,{...c,timestamp:key}); else {x.high=Math.max(x.high,c.high);x.low=Math.min(x.low,c.low);x.close=c.close;x.volume+=c.volume;} }
  return [...map.values()].sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}

export function swingLow(candles:Candle[], lookback=10):number { return Math.min(...candles.slice(-lookback).map(c=>c.low)); }
export function previousSwingHigh(candles:Candle[], lookback=20):number { return Math.max(...candles.slice(-lookback-1,-1).map(c=>c.high)); }
