import { Candle, previousSwingHigh, relativeVolume, rsi, swingLow } from './indicators';
import { evaluateGfs } from './malkan-engine';

export type GfsScan = { symbol:string; monthlyRsi:number; weeklyRsi:number; dailyRsi:number; dailyRsiPrevious:number; entry:number; stopLoss:number; target:number; relativeVolume:number; riskReward:number; ready:boolean; score:number; setupType:string; reasons:string[] };

/** Evaluate daily history using the provider's native weekly/monthly candles.
 * This avoids small timeframe-boundary differences from rebuilding higher
 * timeframes locally and keeps RSI aligned with charting platforms. */
export function scanGfs(symbol:string, daily:Candle[], weekly?:Candle[], monthly?:Candle[]):GfsScan|null {
  if(daily.length<80) return null;
  const weeklyCandles=weekly ?? [];
  const monthlyCandles=monthly ?? [];
  if(weeklyCandles.length<20 || monthlyCandles.length<20) return null;
  const dailyCloses=daily.map(x=>x.close), weeklyCloses=weeklyCandles.map(x=>x.close), monthlyCloses=monthlyCandles.map(x=>x.close);
  const m=rsi(monthlyCloses), w=rsi(weeklyCloses), d=rsi(dailyCloses), prev=rsi(dailyCloses.slice(0,-1));
  const last=daily[daily.length-1], prevC=daily[daily.length-2];
  const confirmation=last.close>last.open && last.close>prevC.high;
  const relVol=relativeVolume(daily.map(x=>x.volume));
  const sl=swingLow(daily,10), entry=last.high, target=Math.max(previousSwingHigh(daily,40),entry);
  const result=evaluateGfs({monthlyRsi:m,weeklyRsi:w,dailyRsi:d,dailyRsiPrevious:prev,setupLow:sl,entry,target,relativeVolume:relVol,cip:false,confirmation,smallCandle:(last.high-last.low)/Math.max(last.close,0.01)<0.02,secondTest:false});
  const reasons:string[]=[];
  if(result.monthlyTrend) reasons.push(`Monthly RSI ${m.toFixed(1)} > 60`);
  if(result.weeklyTrend) reasons.push(`Weekly RSI ${w.toFixed(1)} > 60`);
  if(result.dailyZone) reasons.push(`Daily RSI ${d.toFixed(1)} is in the 40-zone`);
  if(result.dailyTurningUp) reasons.push('Daily RSI is turning upward');
  if(confirmation) reasons.push('Confirmation candle cleared prior high');
  if(result.volumeConfirmed) reasons.push(`Relative volume ${relVol.toFixed(2)}x`);
  return {symbol,monthlyRsi:m,weeklyRsi:w,dailyRsi:d,dailyRsiPrevious:prev,entry,stopLoss:sl,target,relativeVolume:relVol,riskReward:result.riskReward,ready:result.gfsReady,score:result.score,setupType:result.setupType,reasons};
}
