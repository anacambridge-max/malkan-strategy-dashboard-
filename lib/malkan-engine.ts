export type GfsInput = {
  monthlyRsi: number;
  weeklyRsi: number;
  dailyRsi: number;
  dailyRsiPrevious: number;
  setupLow: number;
  entry: number;
  target: number;
  relativeVolume: number;
  cip: boolean;
  confirmation: boolean;
  smallCandle: boolean;
  secondTest: boolean;
};

export type GfsResult = {
  monthlyTrend: boolean;
  weeklyTrend: boolean;
  dailyZone: boolean;
  dailyTurningUp: boolean;
  volumeConfirmed: boolean;
  gfsReady: boolean;
  setupType: string;
  score: number;
  riskReward: number;
};

/**
 * Rule engine v1.0.
 * The 60/40 RSI thresholds are kept configurable here rather than buried in UI code.
 * Pattern classifications such as CIP and double-bottom are inputs until their
 * candle-level detectors are connected to a market-data provider.
 */
export function evaluateGfs(input: GfsInput, config = { trendRsi: 60, zoneLow: 38, zoneHigh: 45, minVolume: 1.5 }): GfsResult {
  const monthlyTrend = input.monthlyRsi > config.trendRsi;
  const weeklyTrend = input.weeklyRsi > config.trendRsi;
  const dailyZone = input.dailyRsi >= config.zoneLow && input.dailyRsi <= config.zoneHigh;
  const dailyTurningUp = input.dailyRsi > input.dailyRsiPrevious;
  const volumeConfirmed = input.relativeVolume >= config.minVolume;
  const risk = Math.max(input.entry - input.setupLow, 0);
  const reward = Math.max(input.target - input.entry, 0);
  const riskReward = risk > 0 ? reward / risk : 0;
  const gfsReady = monthlyTrend && weeklyTrend && dailyZone && dailyTurningUp && input.confirmation;

  let setupType = "Regular GFS";
  if (input.secondTest) setupType = "Double Bottom GFS";
  else if (input.smallCandle) setupType = "Small Candle GFS";
  if (input.cip && gfsReady) setupType += " + CIP";

  const checks = [monthlyTrend, weeklyTrend, dailyZone, dailyTurningUp, input.confirmation, volumeConfirmed, input.cip, riskReward >= 2];
  const score = Number(((checks.filter(Boolean).length / checks.length) * 10).toFixed(1));

  return { monthlyTrend, weeklyTrend, dailyZone, dailyTurningUp, volumeConfirmed, gfsReady, setupType, score, riskReward: Number(riskReward.toFixed(2)) };
}
