import { Candle, previousSwingHigh, relativeVolume, rsi } from './indicators';
import { evaluateGfs } from './malkan-engine';

export type GfsScan = {
  symbol:string;
  monthlyRsi:number;
  weeklyRsi:number;
  dailyRsi:number;
  dailyRsiPrevious:number;
  entry:number;
  stopLoss:number;
  target:number;
  relativeVolume:number;
  riskReward:number;
  ready:boolean;
  score:number;
  setupType:string;
  reasons:string[];
};

/**
 * Evaluate the GFS setup using the provider's native weekly/monthly candles.
 * This keeps the higher-timeframe RSI aligned with charting platforms.
 *
 * Trade plan:
 * - Entry: above the latest daily signal candle high.
 * - Stop: below the latest daily signal candle low.
 * - Target: previous daily swing high, excluding the current signal candle.
 * - A setup is READY only when the resulting R:R is at least 1:3.
 */
export function scanGfs(symbol:string, daily:Candle[], weekly?:Candle[], monthly?:Candle[]):GfsScan|null {
  if(daily.length<80) return null;
  const weeklyCandles=weekly ?? [];
  const monthlyCandles=monthly ?? [];
  if(weeklyCandles.length<20 || monthlyCandles.length<20) return null;

  const dailyCloses=daily.map(x=>x.close);
  const weeklyCloses=weeklyCandles.map(x=>x.close);
  const monthlyCloses=monthlyCandles.map(x=>x.close);
  const m=rsi(monthlyCloses), w=rsi(weeklyCloses), d=rsi(dailyCloses), prev=rsi(dailyCloses.slice(0,-1));

  const last=daily[daily.length-1];
  const confirmation=last.close>last.open;
  const relVol=relativeVolume(daily.map(x=>x.volume));

  // Use the prior swing high as the realistic resistance/target. Never use a
  // high from the current signal candle, otherwise R:R can collapse toward 0.
  const entry=last.high;
  const sl=last.low;
  const target=previousSwingHigh(daily,20);

  const result=evaluateGfs({
    monthlyRsi:m,
    weeklyRsi:w,
    dailyRsi:d,
    dailyRsiPrevious:prev,
    setupLow:sl,
    entry,
    target,
    relativeVolume:relVol,
    cip:false,
    confirmation,
    smallCandle:(last.high-last.low)/Math.max(last.close,0.01)<0.02,
    secondTest:false,
  });

  const reasons:string[]=[];
  if(result.monthlyTrend) reasons.push(`Monthly RSI ${m.toFixed(1)} > 60`);
  if(result.weeklyTrend) reasons.push(`Weekly RSI ${w.toFixed(1)} > 60`);
  if(result.dailyZone) reasons.push(`Daily RSI ${d.toFixed(1)} is near 40`);
  if(result.dailyTurningUp) reasons.push(`Daily RSI is turning upward (${prev.toFixed(1)} → ${d.toFixed(1)})`);
  if(confirmation) reasons.push('Green signal candle formed');
  if(result.volumeConfirmed) reasons.push(`Relative volume ${relVol.toFixed(2)}x`);
  if(result.riskRewardConfirmed) reasons.push(`Risk/reward ${result.riskReward.toFixed(2)} meets 1:3 minimum`);

  return {
    symbol,
    monthlyRsi:m,
    weeklyRsi:w,
    dailyRsi:d,
    dailyRsiPrevious:prev,
    entry,
    stopLoss:sl,
    target,
    relativeVolume:relVol,
    riskReward:result.riskReward,
    ready:result.gfsReady,
    score:result.score,
    setupType:result.setupType,
    reasons,
  };
}
